/**
 * behavior_log.js — Stage H 學生操作行為紀錄（G.BehaviorLog）。
 * 整局逐季記錄：讀報（捲動%、展開篇數、讀報秒數）、街景線索（蒐集數、點選真／假／半真）、公所貓貓建議採納（選卡是否在推薦卡內、是否委任／派員）、
 * 選卡判定（cure/assist/palliative/none/backfire）、點數使用率、忽略次數、提早結報次數、民怨／流量／店家／金錢曲線。
 * 存 localStorage（鍵含版本 KEY；file:// 可用；新局 newGame() 重置；不上傳）。任期序號 termNo＝localStorage catflash.termCount（每次新任期 +1）。
 * metrics()＝呆呆 tools/ending_profile_ref.js metricsFromLog 同定義（existing＋derived＋new）；計分在 stage_h.js（唯一來源 G.DATA.ending.profileRules，docs/ENDING_CERT.md）。
 * 掛點：main.js 呼叫 newGame／seasonStart／decision／ignore／result／seasonEnd／finish；讀報捲動、展開、泡泡點選、提早結報用 document capture 監聽（不改 newspaper.js／street_clues.js）。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var VERSION = 'h1', KEY = 'catflash.behaviorLog.' + VERSION, TERM_KEY = 'catflash.termCount';
  var lastBillRef = null, log = null, cur = null, dirty = false, lastTick = 0, lastSave = 0, bound = false, getCtx = null;

  function now() { return Date.now(); }
  function save() {
    dirty = false;
    if (!log) return false;
    try { global.localStorage.setItem(KEY, JSON.stringify(log)); return true; } catch (e) { return false; }
  }
  function load() { try { var s = global.localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function r1(v) { return v == null ? null : Math.round(v * 10) / 10; }
  function pol(pid) { return (G.DATA.policies || {})[pid] || null; }
  function phaseOk(ctx) { return ctx && (ctx.phase === 'newspaper' || ctx.phase === 'policy'); }

  function townState(ctx) {
    var c = (ctx.complaints && ctx.complaints.values) || {}, ck = Object.keys(c);
    var T = ctx.town, fl = T && T.flows ? Object.keys(T.flows).map(function (k) { return T.flows[k]; }) : [];
    return {
      complaintAvg: r1(avg(ck.map(function (k) { return +c[k] || 0; }))),
      flowAvg: r1(avg(fl.map(Number))),
      shopsOpen: T && T.shops ? T.shops.filter(function (s) { return s.state !== 'closed'; }).length : null,
      shopsTotal: T && T.shops ? T.shops.length : null,
      money: ctx.metrics ? Math.round(ctx.metrics.money) : null,
      happiness: ctx.metrics && ctx.metrics.happiness != null ? Math.round(ctx.metrics.happiness) : null,
      loans: T ? (+T.loans || 0) : null
    };
  }
  function newSeason(ctx) {
    var ps = ctx.poolState;
    return {
      idx: log.seasons.length + 1, cycle: (ctx.pool && ctx.pool.cycle) | 0, seasonId: ctx.season && ctx.season.id, startedAt: now(), ended: false,
      paper: { maxScrollPct: 0, expanded: 0, expandedIds: [], storyCount: 0, readMs: 0, readSec: 0, highlights: 0 },
      clues: { collected: 0, available: 0, tapped: { 'true': 0, 'false': 0, partial: 0 }, tappedIds: [], trueShare: null },
      advice: { recommended: [], staff: [], adopted: false, adoptedPids: [], delegated: false, assign: {}, commissionAccepted: false },
      decision: { played: [], verdicts: {}, counts: { cure: 0, assist: 0, palliative: 0, none: 0, backfire: 0 }, pointsAvail: null, pointsUsed: 0, pointsUseRate: null, clueBacked: 0, ignored: false },
      earlyReport: false,
      commissionBase: (ctx.commissionsAccepted || []).length,
      seed: ps && ps.seed
    };
  }

  /* ---------- document capture 監聽（不改其他模組） ---------- */
  function bind() {
    if (bound || !global.document) return; bound = true;
    var d = global.document;
    d.addEventListener('scroll', function (ev) {
      var t = ev.target; if (!cur || !t || t.id !== 'newspaper-sheet' || !getCtx || !phaseOk(getCtx())) return;
      var max = t.scrollHeight - t.clientHeight, pct = max <= 0 ? 100 : Math.min(100, Math.round(t.scrollTop / max * 100));
      if (pct > cur.paper.maxScrollPct) { cur.paper.maxScrollPct = pct; dirty = true; }
    }, true);
    d.addEventListener('click', function (ev) {
      var t = ev.target; if (!cur || !t || !t.closest) return;
      var tg = t.closest('.np-story__toggle');
      if (tg && getCtx && phaseOk(getCtx())) {
        var art = tg.closest('[data-article-id],[data-story-id],article,.np-story'), all = d.querySelectorAll('#newspaper-sheet .np-story__toggle');
        var id = (art && (art.getAttribute('data-article-id') || art.getAttribute('data-story-id') || art.id)) || ('i' + Array.prototype.indexOf.call(all, tg));
        cur.paper.storyCount = Math.max(cur.paper.storyCount, all.length);
        if (tg.getAttribute('aria-expanded') !== 'true' && cur.paper.expandedIds.indexOf(id) < 0) { cur.paper.expandedIds.push(id); cur.paper.expanded = cur.paper.expandedIds.length; dirty = true; }
        return;
      }
      var hl = t.closest('#newspaper-sheet .np-clue');
      if (hl && cur && getCtx && phaseOk(getCtx())) { /* 畫重點：點擊後依是否帶 is-highlighted 增減（同 newspaper.js readState.highlights） */
        var sc = cur; setTimeout(function () { if (sc !== cur) return; if (hl.classList.contains('is-highlighted')) sc.paper.highlights += 1; else sc.paper.highlights = Math.max(0, sc.paper.highlights - 1); dirty = true; }, 0);
        return;
      }
      var b = t.closest('.npc-bubble--tap');
      if (b) { tapBubble(b); return; }
      if (t.closest('#btn-round-early') && G.StreetClues && G.StreetClues.isRunning && G.StreetClues.isRunning()) {
        if (!cur.earlyReport) { cur.earlyReport = true; log.totals.earlyReportCount += 1; save(); }
      }
    }, true);
    setInterval(tick, 500);
  }
  function intelKind(ctx, dialogueId) {
    var pk = ctx && ctx.pool && ctx.pool.pack; if (!pk) return null;
    var dl = (pk.dialogues || []).filter(function (x) { return x.id === dialogueId; })[0]; if (!dl || !dl.intelId) return null;
    var tr = (pk.truth || []).filter(function (x) { return x.intelId === dl.intelId; })[0];
    return tr ? tr.kind : null;
  }
  function tapBubble(b) {
    var ctx = getCtx && getCtx(), id = b.getAttribute('data-dialogue-id'); if (!ctx || !id || cur.clues.tappedIds.indexOf(id) >= 0) return;
    var k = intelKind(ctx, id); if (!k || cur.clues.tapped[k] == null) return;
    cur.clues.tappedIds.push(id); cur.clues.tapped[k] += 1; dirty = true;
  }
  function tick() {
    var t = now(), dt = lastTick ? Math.min(2000, t - lastTick) : 0; lastTick = t;
    if (!cur || !getCtx) return;
    var ov = global.document && global.document.getElementById('newspaper-overlay');
    if (ov && ov.classList.contains('is-open') && phaseOk(getCtx())) {
      cur.paper.readMs += dt; cur.paper.readSec = Math.round(cur.paper.readMs / 100) / 10; dirty = true;
      var n = global.document.querySelectorAll('#newspaper-sheet .np-story__toggle').length; if (n > cur.paper.storyCount) cur.paper.storyCount = n;
    }
    if (dirty && t - lastSave > 2000) { lastSave = t; save(); }
  }

  /* ---------- main.js 掛點 ---------- */
  function newGame(meta, ctxGetter) {
    if (ctxGetter) getCtx = ctxGetter;
    meta = meta || {};
    var ctx = getCtx ? getCtx() : null, termNo = 1;
    try { termNo = (parseInt(global.localStorage.getItem(TERM_KEY), 10) || 0) + 1; global.localStorage.setItem(TERM_KEY, String(termNo)); } catch (e) { termNo = 1; }
    log = {
      version: VERSION, key: KEY, startedAt: now(), endedAt: null, seed: meta.seed || null, studentName: meta.name || '', termNo: termNo,
      endReason: null, endingKind: null, start: ctx ? townState(ctx) : null,
      seasons: [], totals: { ignoreCount: 0, earlyReportCount: 0, seasonsEnded: 0 }, curves: { complaint: [], flow: [], shops: [], money: [] },
      mayorAnan: { clicks: 0, correct: 0, topics: {} } /* Stage I：安安市長點擊（任命狀趣味統計） */
    };
    if (log.start) { log.curves.complaint.push(log.start.complaintAvg); log.curves.flow.push(log.start.flowAvg); log.curves.shops.push(log.start.shopsOpen); log.curves.money.push(log.start.money); }
    cur = null; bind(); save();
    return log;
  }
  function ensure(ctx) { if (!log) newGame({}, null); if (!cur && ctx) { cur = newSeason(ctx); log.seasons.push(cur); } return cur; }
  function seasonStart(ctx) {
    if (!log) newGame({}, null);
    if (cur && !cur.ended) { /* 上一季未結束（例：強制結束後重開）→ 丟棄 */ }
    cur = newSeason(ctx); log.seasons.push(cur);
    if (ctx.pool && ctx.pool.pack) cur.clues.available = (ctx.pool.pack.clues || []).length;
    save();
  }
  function setName(name) { if (!log) return; log.studentName = String(name || '').trim(); save(); }
  function decision(ctx, policies, info) {
    var s = ensure(ctx); info = info || {};
    var S = ctx.stageG || {}, rec = (S.adviceList || []).map(function (x) { return x.pid; }).filter(Boolean);
    s.decision.played = (policies || []).slice();
    s.decision.pointsAvail = info.pointsAvail != null ? info.pointsAvail : (ctx.baseMetrics ? ctx.baseMetrics.points : null);
    s.decision.pointsUsed = s.decision.played.reduce(function (a, pid) { var p = pol(pid); return a + (p ? (p.cost | 0) : 0); }, 0);
    s.decision.pointsUseRate = s.decision.pointsAvail ? Math.round(s.decision.pointsUsed / s.decision.pointsAvail * 100) / 100 : null;
    s.advice.recommended = rec;
    s.advice.staff = (S.adviceList || []).map(function (x) { return x.staff; });
    s.advice.adoptedPids = s.decision.played.filter(function (pid) { return rec.indexOf(pid) >= 0; });
    s.advice.adopted = s.advice.adoptedPids.length > 0;
    s.advice.assign = JSON.parse(JSON.stringify(S.assign || {}));
    s.advice.commissionAccepted = (ctx.commissionsAccepted || []).length > s.commissionBase;
    s.advice.delegated = Object.keys(s.advice.assign).length > 0 || s.advice.commissionAccepted;
    var clues = ctx.clues || [];
    s.clues.collected = clues.length;
    s.decision.clueBacked = s.decision.played.filter(function (pid) { return clues.some(function (c) { return (c.policyHints || []).some(function (h) { return h.policyId === pid && (h.role === '對症' || h.role === '搭配'); }); }); }).length;
    save();
  }
  function ignore(ctx) {
    var s = ensure(ctx);
    s.decision.ignored = true; s.decision.played = []; s.clues.collected = (ctx.clues || []).length;
    s.decision.pointsAvail = ctx.baseMetrics ? ctx.baseMetrics.points : null; s.decision.pointsUseRate = 0;
    log.totals.ignoreCount += 1; save();
  }
  /** 結報（settle 後）：依事件池結果判定每張卡（只看非機會事件；取最佳效果） */
  function result(ctx, played) {
    var s = ensure(ctx), res = ctx.pool && ctx.pool.preview, RANK = { cure: 0, assist: 1, palliative: 2, backfire: 3, none: 4 };
    var opp = function (eid) { var P = G.DATA.eventPool, ev = P && (P.events || []).filter(function (e) { return e.id === eid; })[0]; return ev && ev.polarity === 'opportunity'; };
    var v = {}; (played || []).forEach(function (pid) { v[pid] = 'none'; });
    ((res && res.results) || []).forEach(function (r) {
      if (opp(r.eventId)) return;
      (r.responses || []).forEach(function (x) {
        var k = x.effect === 'neutral' ? 'none' : x.effect; if (v[x.policyId] == null || RANK[k] == null) return;
        if (RANK[k] < RANK[v[x.policyId]]) v[x.policyId] = k;
      });
    });
    s.decision.verdicts = v;
    var c = { cure: 0, assist: 0, palliative: 0, none: 0, backfire: 0 }; Object.keys(v).forEach(function (k) { c[v[k]] += 1; });
    s.decision.counts = c;
    var tp = s.clues.tapped, tt = tp['true'] + tp['false'] + tp.partial; s.clues.trueShare = tt ? Math.round(tp['true'] / tt * 100) / 100 : null;
    save();
  }
  function seasonEnd(ctx) {
    var s = cur; if (!s || s.ended) return;
    var ts = townState(ctx), b = G.Economy && G.Economy.bill ? G.Economy.bill(ctx) : null;
    if (b && b === lastBillRef) b = null; /* 忽略季不走 preview／commit：Economy.bill 仍是上一季的帳單，不重複記 */
    if (b) lastBillRef = b;
    s.after = ts; s.after.net = b ? b.net : null; s.ended = true; s.endedAt = now();
    s.after.installmentUnpaid = !!s.installmentUnpaid; /* Stage I：本季吹笛人尾款付不出 */
    s.after.neutralCost = b ? Math.round(b.neutralCost || 0) : 0; s.after.cardCost = b && b.parts ? Math.round(b.parts.cardCost || 0) : 0; /* finance.wasteFreeRate */
    var tp = s.clues.tapped, tt = tp['true'] + tp['false'] + tp.partial; s.clues.trueShare = tt ? Math.round(tp['true'] / tt * 100) / 100 : null;
    log.totals.seasonsEnded += 1;
    log.curves.complaint.push(ts.complaintAvg); log.curves.flow.push(ts.flowAvg); log.curves.shops.push(ts.shopsOpen); log.curves.money.push(ts.money);
    cur = null; save();
  }
  /* ---------- Stage I ---------- */
  function egg(ctx, id) { var s = cur || (ctx ? ensure(ctx) : null); if (!s) return; s.easterEggs = s.easterEggs || []; s.easterEggs.push(id); dirty = true; save(); }
  function installmentUnpaid(ctx, pid) { var s = cur || (ctx ? ensure(ctx) : null); if (!s) return; s.installmentUnpaid = pid || true; save(); }
  function mayorClick(ctx, info) {
    if (!log) newGame({}, null);
    var m = log.mayorAnan = log.mayorAnan || { clicks: 0, correct: 0, topics: {} };
    m.clicks += 1; if (info && info.kind === 'correct') m.correct += 1;
    if (info && info.topic) m.topics[info.topic] = (m.topics[info.topic] || 0) + 1;
    var s = cur; if (s) s.mayorClicks = (s.mayorClicks || 0) + 1;
    save();
  }
  function finish(ctx, info) {
    if (!log) newGame({}, null);
    info = info || {};
    log.endedAt = now(); log.endReason = info.reason || null; log.endingKind = info.kind || null;
    log.final = ctx ? townState(ctx) : null;
    if (log.final && info.win) log.final.winCheck = { ok: !!info.win.ok, parts: info.win.parts, values: info.win.values };
    cur = null; save();
    return log;
  }

  /* ---------- 指標：與呆呆 tools/ending_profile_ref.js metricsFromLog 同定義（existing＋derived＋new；缺欄位＝null）。定義 docs/ENDING_CERT.md ---------- */
  function V(x) { return (x && typeof x === 'object' && 'value' in x) ? x.value : x; }
  function num(x) { return typeof x === 'number' && isFinite(x); }
  var GOOD = { cure: 1, assist: 1 };
  function metrics(lg, rules, policies) {
    lg = lg || log || load(); if (!lg) return {};
    var rv = rules && rules.resultValue, RV = { cure: 1, assist: 0.7, palliative: 0.4, none: 0, backfire: 0 };
    if (rv) Object.keys(rv).forEach(function (k) { RV[k] = V(rv[k]); });
    var P = policies || G.DATA.policies || {};
    var S = lg.seasons || [], paper = S.filter(function (s) { return s.paper && (s.paper.readMs > 0 || s.paper.maxScrollPct > 0); });
    var dec = S.filter(function (s) { return s.decision && ((s.decision.played || []).length || s.decision.ignored); });
    var ended = S.filter(function (s) { return s.ended && s.after; });
    var played = dec.filter(function (s) { return (s.decision.played || []).length; });
    var cards = []; dec.forEach(function (s) { Object.keys(s.decision.verdicts || {}).forEach(function (pid) { cards.push(s.decision.verdicts[pid]); }); });
    var tp = { t: 0, f: 0, p: 0 }; S.forEach(function (s) { var t = (s.clues && s.clues.tapped) || {}; tp.t += t['true'] || 0; tp.f += t['false'] || 0; tp.p += t.partial || 0; });
    var avail = S.reduce(function (a, s) { return a + ((s.clues && s.clues.available) || 0); }, 0), coll = S.reduce(function (a, s) { return a + ((s.clues && s.clues.collected) || 0); }, 0);
    var startMoney = (lg.start && lg.start.money) || null, fin = lg.final || (ended.length ? ended[ended.length - 1].after : null) || lg.start;
    var nPlayed = played.reduce(function (a, s) { return a + s.decision.played.length; }, 0);
    var cost = function (pid) { var p = P[pid]; return p ? (num(p.cost) ? p.cost : (p.costPoints | 0)) : 0; };
    var fe = function (k) { return ended.filter(function (s) { return num(s.after[k]); }); };
    var cA = fe('complaintAvg'), fA = fe('flowAvg'), sA = ended.filter(function (s) { return s.after.shopsTotal; });
    var m = {
      seasons: lg.totals ? lg.totals.seasonsEnded : ended.length,
      avgScrollPct: paper.length ? avg(paper.map(function (s) { return s.paper.maxScrollPct; })) : null,
      avgExpandedRatio: paper.length ? avg(paper.map(function (s) { return s.paper.storyCount ? Math.min(1, s.paper.expanded / s.paper.storyCount) : 0; })) : null,
      avgReadSec: paper.length ? avg(paper.map(function (s) { return s.paper.readMs / 1000; })) : null,
      notEarlyRate: S.length ? 1 - S.filter(function (s) { return s.earlyReport; }).length / S.length : null,
      collectRate: avail ? Math.min(1, coll / avail) : null,
      trueShare: (tp.t + tp.f + tp.p) ? tp.t / (tp.t + tp.f + tp.p) : null,
      clueBackedRate: nPlayed ? played.reduce(function (a, s) { return a + (s.decision.clueBacked || 0); }, 0) / nPlayed : null,
      cureScore: cards.length ? avg(cards.map(function (k) { return RV[k] != null ? RV[k] : 0; })) : null,
      backfireFreeRate: cards.length ? 1 - cards.filter(function (k) { return k === 'backfire'; }).length / cards.length : null,
      notIgnoreRate: dec.length ? 1 - dec.filter(function (s) { return s.decision.ignored; }).length / dec.length : null,
      moneyRatio: startMoney && fin && fin.money != null && ended.length ? fin.money / startMoney : null,
      positiveNetRate: ended.length ? ended.filter(function (s) { return (s.after.net || 0) > 0; }).length / ended.length : null,
      complaintCare: cA.length ? 100 - avg(cA.map(function (s) { return s.after.complaintAvg; })) : null,
      avgFlow: fA.length ? avg(fA.map(function (s) { return s.after.flowAvg; })) : null,
      shopsOpenRatio: sA.length ? avg(sA.map(function (s) { return s.after.shopsOpen / s.after.shopsTotal; })) : null,
      adoptRate: played.length ? played.filter(function (s) { return s.advice && s.advice.adopted; }).length / played.length : null,
      delegateRate: played.length ? played.filter(function (s) { return s.advice && s.advice.delegated; }).length / played.length : null
    };
    /* derived */
    var pa = dec.filter(function (s) { return num(s.decision.pointsAvail) && s.decision.pointsAvail > 0; });
    m.targetPointsRate = pa.length ? pa.reduce(function (a, s) { return a + (s.decision.played || []).filter(function (pid) { return GOOD[(s.decision.verdicts || {})[pid]]; }).reduce(function (b, pid) { return b + cost(pid); }, 0); }, 0) / pa.reduce(function (a, s) { return a + s.decision.pointsAvail; }, 0) : null;
    var nAd = 0, nAdGood = 0; played.forEach(function (s) { ((s.advice && s.advice.adoptedPids) || []).forEach(function (pid) { nAd++; if (GOOD[(s.decision.verdicts || {})[pid]]) nAdGood++; }); });
    m.adoptGoodRate = nAd ? nAdGood / nAd : null;
    m.bankrupt = lg.endingKind === 'bankrupt';
    /* new */
    var hl = paper.filter(function (s) { return num(s.paper.highlights); });
    m.avgHighlights = hl.length ? avg(hl.map(function (s) { return s.paper.highlights; })) : null;
    var cc = ended.filter(function (s) { return num(s.after.cardCost); }), cSum = cc.reduce(function (a, s) { return a + s.after.cardCost; }, 0);
    if (cSum > 0) m.wasteFreeRate = 1 - cc.reduce(function (a, s) { return a + (s.after.neutralCost || 0); }, 0) / cSum;
    else m.wasteFreeRate = cards.length ? 1 - cards.filter(function (k) { return k === 'none'; }).length / cards.length : null;
    m.noLoan = lg.final && num(lg.final.loans) ? (lg.final.loans === 0 ? 1 : 0) : null;
    var hp = fe('happiness');
    m.avgHappiness = hp.length ? avg(hp.map(function (s) { return s.after.happiness; })) : null;
    /* 摘要（任命狀數據列；非計分指標） */
    m.finalMoney = fin ? fin.money : null; m.finalShops = fin ? fin.shopsOpen : null;
    m.avgComplaint = cA.length ? r1(avg(cA.map(function (s) { return s.after.complaintAvg; }))) : (fin ? fin.complaintAvg : null);
    m.avgFlowRaw = fA.length ? r1(avg(fA.map(function (s) { return s.after.flowAvg; }))) : (fin ? fin.flowAvg : null);
    m.ignoreCount = lg.totals ? lg.totals.ignoreCount : 0; m.earlyReportCount = lg.totals ? lg.totals.earlyReportCount : 0;
    m.tapped = tp; m.cardCounts = cards.reduce(function (o, k) { o[k] = (o[k] || 0) + 1; return o; }, {});
    return m;
  }

  G.BehaviorLog = {
    VERSION: VERSION, KEY: KEY,
    newGame: newGame, seasonStart: seasonStart, setName: setName, decision: decision, ignore: ignore, result: result, seasonEnd: seasonEnd, finish: finish,
    egg: egg, installmentUnpaid: installmentUnpaid, mayorClick: mayorClick,
    metrics: metrics, get: function () { return log; }, load: load, save: save, current: function () { return cur; },
    setCtxGetter: function (f) { getCtx = f; }
  };
})(window);
