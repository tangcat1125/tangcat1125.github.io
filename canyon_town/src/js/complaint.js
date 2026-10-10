/**
 * complaint.js — 民怨值（docs/COMPLAINT.md）。
 * 資料：G.DATA.complaints（data/complaints/complaints_season_01.json）＋ 政策卡 complaintDelta / complaintRebound。
 * 狀態：ctx.complaints = { values, ignoreStreak, reboundPending, history, lastDelta, pending }（跨季延續）。
 * 流程：init → 結報 settle()（算出本季結報預覽 pending，可重複呼叫，不累加）→ 離開結報（進入下一月／忽略繼續）時 commit() 才結算寫入 values。
 * 結算順序（每領域）：relief → solvedBonus → carryUnresolved → ignorePenalty → calmDecay → rebound → clamp(0–100)。
 * 只放邏輯，不碰 DOM。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  /* 交通（derived）建模：沒有逐車模擬，用季初車流＋卡牌 logistics.metricBoost 估算；
   * 物流延誤（event_supply_delay）沒解決時，壅塞度 +1、準點率 -0.10（卡車塞在峽口）。 */
  var TRAFFIC_PENALTY = { congestion: 1, onTimeRate: -0.1 };

  function data() { return (G.DATA && G.DATA.complaints) || null; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r2(n) { return Math.round(n * 100) / 100; }

  function domainList() {
    var C = data();
    if (!C) return [];
    var order = C.domainOrder || C.domains.map(function (d) { return d.id; });
    return order.map(function (id) { return domainById(id); }).filter(Boolean);
  }
  function domainById(id) {
    var C = data();
    if (!C) return null;
    for (var i = 0; i < C.domains.length; i++) if (C.domains[i].id === id) return C.domains[i];
    return null;
  }

  function tierOf(value) {
    var C = data();
    var tiers = (C && C.tiers) || [];
    for (var i = 0; i < tiers.length; i++) {
      if (value >= tiers[i].min && value <= tiers[i].max) return tiers[i];
    }
    return tiers[tiers.length - 1] || { id: 'calm', label: '', color: '#888' };
  }

  function init(ctx) {
    var C = data();
    if (!C) { ctx.complaints = null; return null; }
    var values = {}, streak = {}, rebound = {};
    domainList().forEach(function (d) {
      var sv = (C.season && C.season.startValues && C.season.startValues[d.id]);
      values[d.id] = clamp(Math.round(sv != null ? sv : (d.startValue || 0)), 0, 100);
      streak[d.id] = 0;
      rebound[d.id] = 0;
    });
    ctx.complaints = { values: values, ignoreStreak: streak, reboundPending: rebound, history: [], lastDelta: {}, lastSteps: {}, pending: null };
    G.state.complaints = ctx.complaints;
    return ctx.complaints;
  }

  function deepest(values) {
    var best = null;
    domainList().forEach(function (d) { /* 同分取 domainOrder 前面的 */
      if (best === null || values[d.id] > values[best]) best = d.id;
    });
    return best;
  }
  function average(values) {
    var ds = domainList();
    if (!ds.length) return 0;
    return Math.round(ds.reduce(function (s, d) { return s + (values[d.id] || 0); }, 0) / ds.length);
  }

  function cardsOf(played) {
    return (played || []).map(function (pid) { return G.DATA.policies[pid]; }).filter(Boolean);
  }
  function cardDelta(p) {
    var C = data();
    if (p && p.complaintDelta) return p.complaintDelta;
    var cr = C && C.cardRelief && C.cardRelief[p && p.id];
    return (cr && cr.complaintDelta) || {};
  }
  function cardRebound(p) {
    var C = data();
    if (p && p.complaintRebound) return p.complaintRebound;
    var cr = C && C.cardRelief && C.cardRelief[p && p.id];
    return (cr && cr.reboundNextSeason) || {};
  }

  /** 事件池餵入（ctx.poolFeed）：feed.domains[d].sevAfter＝該領域本季事件結報後最大嚴重度；feed.extra[d]＝反效果額外民怨。 */
  function poolDom(feed, id) {
    var d = feed && feed.domains && feed.domains[id];
    return d ? (d.sevAfter || 0) : 0;
  }

  /** 各領域「是否未解決」與嚴重度。event：problems[eventId]；traffic／safety：derived（見檔頭）。 */
  function unresolvedMap(problems, cards, feed) {
    var C = data();
    var un = {}, sev = {};
    var derivedSev = (C.rules && C.rules.derivedUnresolvedSeverity) || 1;
    domainList().forEach(function (d) {
      if (d.kind === 'event') {
        var s = 0;
        (d.eventIds || []).forEach(function (eid) { s = Math.max(s, problems[eid] || 0); });
        var pf = poolDom(feed, d.id); /* 事件池：本季抽到的該領域事件結報後仍有嚴重度 → 也算未解決（取最大） */
        if (pf > s) s = pf;
        un[d.id] = s > 0; sev[d.id] = s;
      }
    });
    var base = (G.DATA.season_01 && G.DATA.season_01.trafficMetrics) || { congestion: 1, onTimeRate: 0.72 };
    var cong = base.congestion, ot = base.onTimeRate;
    cards.forEach(function (p) {
      var mb = (p.logistics && p.logistics.metricBoost) || {};
      cong += mb.congestion || 0; ot += mb.onTimeRate || 0;
    });
    if (un.logistics) { cong += TRAFFIC_PENALTY.congestion; ot += TRAFFIC_PENALTY.onTimeRate; }
    cong = Math.max(0, cong); ot = r2(ot);
    un.traffic = cong >= 2 || ot < 0.72; sev.traffic = derivedSev;
    if (poolDom(feed, 'traffic') > 0) { un.traffic = true; sev.traffic = Math.max(sev.traffic, poolDom(feed, 'traffic')); }
    un.safety = !!(un.drain || un.traffic); sev.safety = derivedSev;
    if (poolDom(feed, 'safety') > 0) { un.safety = true; sev.safety = Math.max(sev.safety, poolDom(feed, 'safety')); }
    un._traffic = { congestion: cong, onTimeRate: ot };
    return { un: un, sev: sev };
  }

  function baselineProblems() {
    var p = {};
    (G.DATA.eventOrder || Object.keys(G.DATA.events || {})).forEach(function (eid) {
      var e = G.DATA.events[eid]; if (e) p[eid] = e.baselineSeverity || 1;
    });
    return p;
  }

  /**
   * 結報預覽：從目前已寫入的 values 起算（所以重複呼叫 settle 不會重複累加）。
   * played＝本次打出的卡 id；problems＝日常運行後 problems（Replay.simulate 的結果）。
   */
  function settle(ctx, played, problems) {
    var C = data(); var st = ctx.complaints;
    if (!C || !st) return null;
    var R = C.rules || {};
    var ig = R.ignore || {};
    var cards = cardsOf(played);
    var feed = ctx.poolFeed || null;
    var now = unresolvedMap(problems || {}, cards, feed);
    var had = unresolvedMap(baselineProblems(), []).un;
    if (feed && feed.domains) Object.keys(feed.domains).forEach(function (k) { if (feed.domains[k].drawn) had[k] = true; }); /* 季初就有問題的領域（本 MVP 每季事件都會再發生） */
    var values = {}, steps = {}, newStreak = {}, deltas = {}, reboundNext = {};
    domainList().forEach(function (d) {
      var id = d.id, v = st.values[id], s = [];
      var relief = 0, strong = false;
      cards.forEach(function (p) {
        var x = cardDelta(p)[id] || 0;
        relief += x;
        if (x <= (ig.reliefThreshold != null ? ig.reliefThreshold : -10)) strong = true;
      });
      if (relief) { s.push(['relief', relief]); v += relief; }
      var unres = !!now.un[id];
      var solved = !!had[id] && !unres;
      if (solved) { s.push(['solved', R.solvedBonus != null ? R.solvedBonus : -10]); v += (R.solvedBonus != null ? R.solvedBonus : -10); }
      if (unres) {
        var carry = (R.carryUnresolvedBySeverity || {})[String(now.sev[id])] || 0;
        if (carry) { s.push(['carry', carry]); v += carry; }
      }
      var streak = st.ignoreStreak[id] || 0;
      if (unres && !strong) {
        streak += 1;
        var pen = (ig.base != null ? ig.base : 5) + Math.min(ig.maxStreakBonus != null ? ig.maxStreakBonus : 6, (ig.streakStep != null ? ig.streakStep : 3) * (streak - 1));
        s.push(['ignore', pen]); v += pen;
      } else if (strong || !unres) {
        streak = 0;
      }
      if (!unres && !had[id] && relief === 0) {
        var cd = R.calmDecay != null ? R.calmDecay : -3;
        s.push(['calm', cd]); v += cd;
      }
      var bf = (feed && feed.extra && feed.extra[id]) || 0;
      if (bf) { s.push(['backfire', bf]); v += bf; } /* 事件池：反效果政策額外民怨（+8×嚴重度係數） */
      var rb = (st.reboundPending && st.reboundPending[id]) || 0;
      if (rb) { s.push(['rebound', rb]); v += rb; }
      values[id] = clamp(Math.round(v), 0, 100);
      steps[id] = s; newStreak[id] = streak; deltas[id] = values[id] - st.values[id];
      reboundNext[id] = 0;
    });
    cards.forEach(function (p) {
      var rb = cardRebound(p);
      Object.keys(rb).forEach(function (k) { reboundNext[k] = (reboundNext[k] || 0) + rb[k]; });
    });
    st.pending = {
      seasonId: ctx.season && ctx.season.id, monthLabel: ctx.season && ctx.season.monthLabel,
      played: (played || []).slice(), values: values, steps: steps, deltas: deltas,
      ignoreStreak: newStreak, reboundNext: reboundNext, unresolved: now.un,
      deepest: deepest(values), average: average(values), traffic: now.un._traffic
    };
    return st.pending;
  }

  /** 進入下一季（含「忽略，繼續下一季」）時把預覽寫入；沒有預覽就不動。 */
  function commit(ctx) {
    var st = ctx.complaints;
    if (!st || !st.pending) return false;
    var p = st.pending;
    st.values = clone(p.values);
    st.ignoreStreak = clone(p.ignoreStreak);
    st.reboundPending = clone(p.reboundNext);
    st.lastDelta = clone(p.deltas);
    st.lastSteps = clone(p.steps);
    st.history.push({ season: p.seasonId, monthLabel: p.monthLabel, values: clone(p.values), deepest: p.deepest, played: p.played.slice() });
    st.pending = null;
    return true;
  }

  /** 排序後的列：高 → 低（同分依 domainOrder） */
  function rows(values) {
    var list = domainList().map(function (d, i) {
      var v = values[d.id] || 0, t = tierOf(v);
      return { id: d.id, name: d.name, icon: d.icon, value: v, tier: t.id, tierLabel: t.label, color: t.color, speaker: d.speaker, quote: d.quote, order: i, domain: d };
    });
    list.sort(function (a, b) { return b.value - a.value || a.order - b.order; });
    return list;
  }

  function fill(tpl, m) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (_, k) { return m[k] != null ? m[k] : ''; });
  }

  /** 居民怨言：爆怒／不滿用 domain.quote（資料的「一句居民怨言」），較輕時用 quotesByTier。 */
  function quoteFor(row) {
    var d = row.domain;
    if (row.tier === 'furious' || row.tier === 'upset') return d.quote;
    return (d.quotesByTier && d.quotesByTier[row.tier]) || d.quote;
  }

  function boxTitle() {
    var C = data();
    var np = G.DATA.newspapers && G.DATA.newspapers.newspaper_season_01;
    return (np && np.complaintBox && np.complaintBox.title) || (C.display && C.display.boxTitle) || C.title || '民怨榜';
  }

  /** 側欄「民怨榜」所需資料：values 預設為目前已寫入值。 */
  function view(ctx, useValues) {
    var C = data(); var st = ctx.complaints;
    if (!C || !st) return null;
    var values = useValues || st.values;
    var list = rows(values);
    var top = list[0];
    var disp = C.display || {};
    var notes = [];
    if (!useValues) {
      list.forEach(function (r) {
        var dl = st.lastDelta && st.lastDelta[r.id];
        if (dl > 0) notes.push({ id: r.id, delta: dl, text: fill(disp.carryTemplate, { name: r.name, delta: dl }) });
        var sk = st.ignoreStreak[r.id] || 0;
        if (sk >= 1 && dl > 0) notes.push({ id: r.id, delta: dl, text: fill(disp.ignoredTemplate, { name: r.name, streak: sk }) });
      });
    }
    return {
      title: boxTitle(),
      rows: list,
      deepest: top,
      deepestText: fill(disp.deepestTemplate, { icon: top.icon, name: top.name, value: top.value, speaker: top.speaker.npcName, quote: quoteFor(top) }),
      quote: quoteFor(top),
      hint: '優先用點數改善',
      legend: disp.legend || '',
      average: average(values),
      notes: notes.slice(0, 4)
    };
  }

  /** 政策卡提示：建議（命中最高民怨的前兩個領域且降 ≥10）與降怨晶片。 */
  function cardHints(ctx) {
    var C = data(); var st = ctx && ctx.complaints;
    if (!C || !st) return null;
    var list = rows(st.values);
    var topIds = list.slice(0, 2).map(function (r) { return r.id; });
    var out = {};
    var names = {}, vals = st.values;
    domainList().forEach(function (d) { names[d.id] = d; });
    Object.keys(G.DATA.policies || {}).forEach(function (pid) {
      var p = G.DATA.policies[pid];
      var del = cardDelta(p);
      var neg = Object.keys(del).filter(function (k) { return del[k] < 0 && names[k]; });
      neg.sort(function (a, b) { return (vals[b] - vals[a]) || (del[a] - del[b]); });
      var rec = topIds.some(function (k) { return del[k] != null && del[k] <= -10; });
      var score = 0;
      topIds.forEach(function (k, i) { if (del[k] < 0) score += -del[k] * (i === 0 ? 2 : 1); });
      out[pid] = {
        recommended: rec, score: score,
        chips: neg.slice(0, 2).map(function (k) { return { id: k, name: names[k].name, icon: names[k].icon, delta: del[k] }; })
      };
    });
    return out;
  }

  /** 結果對話「民怨變化」每領域一行（只列有變動者），依新值高 → 低。 */
  function previewLines(ctx) {
    var st = ctx.complaints; var p = st && st.pending;
    if (!p) return [];
    return rows(p.values).map(function (r) {
      var old = st.values[r.id], dl = p.values[r.id] - old;
      return { id: r.id, icon: r.icon, name: r.name, from: old, to: p.values[r.id], delta: dl, tier: r.tier, tierLabel: r.tierLabel, color: r.color };
    });
  }

  G.Complaint = {
    init: init, settle: settle, commit: commit, view: view, rows: rows, tierOf: tierOf,
    deepest: deepest, cardHints: cardHints, previewLines: previewLines, domainList: domainList,
    TRAFFIC_PENALTY: TRAFFIC_PENALTY
  };
})(window);
