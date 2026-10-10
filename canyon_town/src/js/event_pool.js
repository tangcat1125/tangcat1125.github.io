/* event_pool.js — 隨機事件池（種子可重現）。file:// 可用，無外部依賴。
 * 使用：Game.EventPool.draw(state, {seed, mode, count}) → assemble(drawResult, state) → settle(drawResult, state, policyIds)
 * 資料：Game.DATA.eventPool（data/events/pool_*.json 的內嵌版）。 */
(function (root) {
  'use strict';
  var G = root.Game = root.Game || {};
  function pool() { return (G.DATA && G.DATA.eventPool) || null; }

  /* ---------- 種子亂數 ---------- */
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFor(seed, cycle, purpose) { return mulberry32(xmur3(String(seed) + '|' + cycle + '|' + purpose)); }
  function randInt(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(r, arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- 狀態與條件 ---------- */
  function seasonOf(st, P) {
    if (st.season) return st.season;
    var c = P.calendar, m = ((c.startMonth - 1 + ((st.cycle || 1) - 1) * c.monthsPerCycle) % 12) + 1;
    return c.seasonByMonth[String(m)];
  }
  function has(arr, x) { return (arr || []).indexOf(x) >= 0; }
  function lastRes(st, id) {
    var h = st.history || [], best = null;
    for (var i = 0; i < h.length; i++) if (h[i].eventId === id && (!best || h[i].cycle >= best.cycle)) best = h[i];
    return best && best.cycle === (st.cycle || 1) - 1 ? best.resolution : null;
  }
  function evalCond(c, st, ctx) {
    if (!c) return true;
    if (c.all) { for (var i = 0; i < c.all.length; i++) if (!evalCond(c.all[i], st, ctx)) return false; return true; }
    if (c.any) { for (var j = 0; j < c.any.length; j++) if (evalCond(c.any[j], st, ctx)) return true; return false; }
    if (c.not) return !evalCond(c.not, st, ctx);
    switch (c.type) {
      case 'complaint': var v = (st.complaints || {})[c.domain] || 0; return (c.gte == null || v >= c.gte) && (c.lt == null || v < c.lt);
      case 'ignored': return ((st.ignoredStreak || {})[c.domain] || 0) >= c.gte;
      case 'policy':
        var before = has(st.policiesOwned, c.id), now = has(st.policiesBoughtNow, c.id), owned;
        if (c.since === 'before') owned = before; else if (c.since === 'this') owned = now; else owned = before || now;
        return owned === c.owned;
      case 'season': return has(c.in, ctx.season);
      case 'event':
        if (c.active) return has(ctx.activeIds, c.id);
        if (c.lastResolution) return has(c.lastResolution, lastRes(st, c.id));
        return false;
    }
    return false;
  }
  function byId(P) { var m = {}; P.events.forEach(function (e) { m[e.id] = e; }); return m; }

  /* ---------- 抽事件 ---------- */
  function stats(st) {
    var d = st.complaints || {}, ks = Object.keys(d), sum = 0, mx = 0;
    ks.forEach(function (k) { sum += d[k]; if (d[k] > mx) mx = d[k]; });
    return { mean: ks.length ? sum / ks.length : 0, max: mx };
  }
  function weightOf(ev, st, P, ctx, locked) {
    var w = ev.weight * ((ev.seasonMult || {})[ctx.season] == null ? 1 : ev.seasonMult[ctx.season]);
    var parts = { base: ev.weight, season: (ev.seasonMult || {})[ctx.season] == null ? 1 : ev.seasonMult[ctx.season], mods: [] };
    if (!locked) {
      (ev.weightMods || []).forEach(function (m) { if (evalCond(m.when, st, ctx)) { w *= m.mult; parts.mods.push(m.why || m.whenText); } });
      var dp = P.draw.domainPressure, c = (st.complaints || {})[ev.domainId] || 0;
      parts.pressure = dp.base + c * dp.perPoint; w *= parts.pressure;
      var ig = (st.ignoredStreak || {})[ev.domainId] || 0;
      parts.ignored = 1 + P.draw.ignoredBoost.perStreak * ig; w *= parts.ignored;
    }
    return { w: w, parts: parts };
  }
  function draw(st, opts) {
    var P = pool(); if (!P) throw new Error('G.DATA.eventPool missing');
    opts = opts || {}; st = st || {};
    var seed = opts.seed != null ? opts.seed : (st.seed != null ? st.seed : 'canyon');
    var mode = opts.mode || st.mode || 'adaptive', locked = mode === 'locked';
    var cycle = st.cycle || 1, season = seasonOf(st, P), M = byId(P);
    var ctx = { season: season, activeIds: [] };
    var DR = P.draw, trace = [];
    // 數量
    var rc = rngFor(seed, cycle, 'count'), s = stats(st), count = DR.countRule.base, why = ['基本 2'];
    if (!locked) {
      if (s.mean >= 55) { count++; why.push('平均民怨≥55'); }
      if (s.max >= 75) { count++; why.push('有領域≥75'); }
    }
    if (count === DR.countRule.base && rc() < DR.countRule.jitter.chance) { count++; why.push('種子加成'); }
    count = Math.max(DR.countRule.min, Math.min(DR.countRule.max, count));
    if (opts.count) { count = Math.max(1, Math.min(DR.maxTotal, opts.count)); why = ['教師指定']; }
    var chosen = [], domCount = {}, hasOpp = false, hasFalse = false;
    function add(id, source, extra) {
      var e = M[id]; chosen.push({ eventId: id, source: source, domainId: e.domainId, severity: e.severity, weight: extra && extra.w, from: extra && extra.from });
      ctx.activeIds.push(id); domCount[e.domainId] = (domCount[e.domainId] || 0) + 1;
      if (e.polarity === 'opportunity') hasOpp = true; if (e.falseAlarm) hasFalse = true;
    }
    // 強制 pending
    var pend = (st.pending || []).filter(function (p) { return p.dueCycle <= cycle && M[p.eventId]; })
      .sort(function (a, b) { return (a.dueCycle - b.dueCycle) || (M[b.eventId].severity - M[a.eventId].severity); });
    var carried = [];
    pend.forEach(function (p) {
      if (chosen.length < 2) {
        if (has(chosen.map(function (c) { return c.eventId; }), p.eventId)) return;
        add(p.eventId, 'pending', { from: p.fromEventId });
      } else carried.push(p);
    });
    var forcedN = chosen.length;
    count = Math.max(count, forcedN); count = Math.min(count, DR.maxTotal);
    // 加權抽（不放回）
    var r = rngFor(seed, cycle, 'draw');
    var lastIds = (st.history || []).filter(function (h) { return h.cycle === cycle - 1; }).map(function (h) { return h.eventId; });
    while (chosen.length < count) {
      var cand = [], tot = 0;
      P.events.forEach(function (e) {
        if (ctx.activeIds.indexOf(e.id) >= 0) return;
        if (e.chainOnly && !(e.requires && evalCond(e.requires, st, ctx))) return;
        if (e.chainOnly && locked) return;
        if (!locked && e.requires && !evalCond(e.requires, st, ctx)) return;
        if (has(lastIds, e.id) && !(st.pending || []).some(function (p) { return p.eventId === e.id; })) {
          var lr = lastRes(st, e.id); if (lr !== 'palliative') return;   // 反彈例外
        }
        if ((domCount[e.domainId] || 0) >= DR.noRepeat.maxPerDomainPerCycle) return;
        if (e.polarity === 'opportunity' && hasOpp) return;
        if (e.falseAlarm && hasFalse) return;
        var wp = weightOf(e, st, P, ctx, locked);
        if (e.chainOnly) wp.w *= 0.3;
        if (wp.w > 0) { cand.push({ e: e, w: wp.w }); tot += wp.w; }
      });
      if (!cand.length) break;
      var t = r() * tot, acc = 0, hit = cand[cand.length - 1];
      for (var i = 0; i < cand.length; i++) { acc += cand[i].w; if (t < acc) { hit = cand[i]; break; } }
      add(hit.e.id, 'drawn', { w: Math.round(hit.w * 100) / 100 });
    }
    return { seed: seed, mode: mode, cycle: cycle, season: season, count: chosen.length, countWhy: why, events: chosen, carriedPending: carried };
  }

  /* ---------- 組裝：文章、對話、線索 ---------- */
  function fill(tpl, v) { return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
  function rollVars(ev, P, seed, cycle) {
    var r = rngFor(seed, cycle, 'vars:' + ev.id), v = {}, g = P.vars;
    Object.keys(g).forEach(function (k) {
      if (k === 'note') return;
      var spec = (ev.vars && ev.vars[k]) || g[k];
      if (spec.pool) v[k] = pick(r, spec.pool);
      else if (spec.range) v[k] = randInt(r, spec.range[0], spec.range[1]);
      else if (Array.isArray(spec) && typeof spec[0] === 'number') v[k] = randInt(r, spec[0], spec[1]);
      else if (Array.isArray(spec)) v[k] = pick(r, spec);
    });
    if (ev.vars) Object.keys(ev.vars).forEach(function (k) {
      if (v[k] != null) return; var spec = ev.vars[k];
      if (Array.isArray(spec) && typeof spec[0] === 'number') v[k] = randInt(r, spec[0], spec[1]);
      else if (Array.isArray(spec)) v[k] = pick(r, spec);
    });
    return v;
  }
  function npcName(id) {
    var D = G.DATA || {}, i, a = (D.npcs || []);
    for (i = 0; i < a.length; i++) if (a[i].id === id) return a[i].name;
    a = (D.staff && D.staff.staff) || [];
    for (i = 0; i < a.length; i++) if (a[i].id === id) return a[i].name;
    return id;
  }
  function isStaff(id) { return /^staff_/.test(id); }
  function assemble(dr, st) {
    var P = pool(), M = byId(P), seed = dr.seed, cycle = dr.cycle, out = { articles: [], dialogues: [], clues: [], truth: [], vars: {}, headlineEventId: null, schedule: [] };
    var best = null;
    dr.events.forEach(function (c) {
      var ev = M[c.eventId], v = rollVars(ev, P, seed, cycle); out.vars[ev.id] = v;
      var a = ev.article;
      out.articles.push({ id: a.id, relatedEventId: a.relatedEventId, poolEventId: ev.id, kicker: fill(a.kicker, v), title: fill(a.title, v), blurb: fill(a.blurb, v), body: fill(a.body, v),
        clues: ev.intel.filter(function (i) { return i.kind === 'true'; }).slice(0, 3).map(function (i) { return fill(i.text, v); }),
        takeaway: fill(a.takeaway, v), storyStage: 'clue', actionOptionIds: a.actionOptionIds.slice(), complaintDomainIds: a.complaintDomainIds.slice(), severity: ev.severity, domainId: ev.domainId });
      if (!best || ev.severity > best.sev || (ev.severity === best.sev && c.source === 'pending')) best = { id: a.id, sev: ev.severity };
      ev.intel.forEach(function (it) {
        var id = it.id, cid = 'cl_' + id.replace(':', '_'), did = 'dlg_' + id.replace(':', '_'), cat = it.kind === 'true' ? 'clue' : 'rumor';
        var text = fill(it.text, v), pol = [];
        if (it.kind === 'true') Object.keys(ev.responses).forEach(function (pid) {
          var rr = ev.responses[pid], eff = rr[rr.length - 1].effect;
          rr.forEach(function (x) { if (!x.when) eff = x.effect; });
          var role = { cure: '對症', assist: '搭配', palliative: '治標', backfire: '提醒' }[eff];
          if (role) pol.push({ policyId: pid, role: role, hint: fill((rr[0].note || '').replace('（預設）', ''), v) });
        });
        out.dialogues.push({ id: did, speakerNpcId: it.npcId, lines: [text], weight: it.kind === 'true' ? 3 : 2, category: cat, categoryLabel: cat === 'clue' ? '關鍵線索' : '傳聞', domainId: ev.domainId,
          articleId: a.id, eventId: ev.id, clueId: it.kind === 'true' ? cid : null, intelId: id, speakerKind: isStaff(it.npcId) ? 'staff' : 'resident' });
        if (it.kind === 'true') out.clues.push({ id: cid, npcId: it.npcId, npcName: npcName(it.npcId), speakerKind: isStaff(it.npcId) ? 'staff' : 'resident', domainId: ev.domainId, articleId: a.id, eventId: ev.id,
          dialogueId: did, kind: 'cause', kindLabel: '成因', importance: ev.severity, summary: text, policyHints: pol, actionOptionIds: a.actionOptionIds.slice(), reportLine: '【' + npcName(it.npcId) + '】' + text });
        out.truth.push({ intelId: id, eventId: ev.id, kind: it.kind, text: text, explain: fill(it.explain, v), checkHint: it.checkHint ? fill(it.checkHint, v) : null, npcId: it.npcId });
      });
      var cl = ev.complaintLine;
      out.dialogues.push({ id: 'dlg_' + ev.id + '_complaint', speakerNpcId: cl.npcId, lines: [fill(cl.text, v)], weight: 2, category: 'complaint', categoryLabel: '怨言', domainId: ev.domainId, articleId: a.id, eventId: ev.id, clueId: null, speakerKind: 'resident' });
    });
    out.headlineEventId = best && best.id;
    out.schedule = schedule(out, dr, P, st);
    return out;
  }
  function schedule(out, dr, P, st) {
    var R = P.streetRound, r = rngFor(dr.seed, dr.cycle, 'schedule'), slots = R.slots, list = [];
    var trues = out.dialogues.filter(function (d) { return d.category === 'clue'; });
    var rum = out.dialogues.filter(function (d) { return d.category === 'rumor'; });
    var comp = out.dialogues.filter(function (d) { return d.category === 'complaint'; });
    trues = shuffle(r, trues);
    // 每個事件至多一則傳聞
    var seenEv = {}, rumPick = [];
    shuffle(r, rum).forEach(function (d) { if (!seenEv[d.eventId]) { seenEv[d.eventId] = 1; rumPick.push(d); } });
    // 靜態補強：真線索不足 5 則
    var fill5 = [], S = G.DATA && G.DATA.clues && G.DATA.clues.clues, D0 = (G.DATA && G.DATA.dialogues) || null;
    if (trues.length < R.trueClueTarget.min && S) {
      var doms = {}; dr.events.forEach(function (c) { doms[c.domainId] = 1; });
      var need = R.trueClueTarget.min - trues.length;
      var pre = shuffle(r, S.filter(function (c) { return doms[c.domainId]; })), rest = shuffle(r, S.filter(function (c) { return !doms[c.domainId]; }));
      pre.concat(rest).slice(0, need).forEach(function (c) { fill5.push({ id: c.dialogueId, speakerNpcId: c.npcId, category: 'clue', staticClueId: c.id, domainId: c.domainId, eventId: c.eventId, lines: null, source: 'static' }); });
    }
    list = trues.slice(0, R.trueClueTarget.max).map(function (d) { return { dialogueId: d.id, category: 'clue', speakerNpcId: d.speakerNpcId, eventId: d.eventId, clueId: d.clueId }; });
    fill5.forEach(function (d) { list.push({ dialogueId: d.id, category: 'clue', speakerNpcId: d.speakerNpcId, eventId: d.eventId, clueId: d.staticClueId, source: 'static' }); });
    rumPick.slice(0, Math.max(1, Math.min(3, slots - list.length - 1))).forEach(function (d) { list.push({ dialogueId: d.id, category: 'rumor', speakerNpcId: d.speakerNpcId, eventId: d.eventId, clueId: null }); });
    shuffle(r, comp).forEach(function (d) { if (list.length < slots) list.push({ dialogueId: d.id, category: 'complaint', speakerNpcId: d.speakerNpcId, eventId: d.eventId, clueId: null }); });
    // 靜態怨言／閒聊補滿
    var SD = ((G.DATA && G.DATA.dialogues && G.DATA.dialogues.season_01) || []).filter(function (d) { return d.speakerKind !== 'staff' && !isStaff(d.speakerNpcId || ''); }), doms2 = {}, used = {}, activeEv = {};
    dr.events.forEach(function (c) { activeEv[c.eventId] = 1; });
    SD = SD.filter(function (d) { return !d.eventId || activeEv[d.eventId]; }); /* 事件相關居民閒聊：只在該事件本季有抽到時使用 */
    /* 公職句（speakerKind==='staff'）只在「公所貓貓真的出現在街上」時由 dialogue.js／street_clues.js 另外取，這裡的靜態補滿只用居民句 */
    dr.events.forEach(function (c) { doms2[c.domainId] = 1; });
    list.forEach(function (x) { used[x.dialogueId] = 1; });
    var fillers = shuffle(r, SD.filter(function (d) { return d.category === 'complaint' && doms2[d.domainId]; }))
      .concat(shuffle(r, SD.filter(function (d) { return d.category === 'chat'; })), shuffle(r, SD.filter(function (d) { return d.category === 'complaint' && !doms2[d.domainId]; })));
    fillers.forEach(function (d) {
      if (list.length >= slots || used[d.id]) return; used[d.id] = 1;
      list.push({ dialogueId: d.id, category: d.category, speakerNpcId: d.speakerNpcId, eventId: null, clueId: null, source: 'static' });
    });
    list = list.slice(0, slots);
    // 洗牌；同 NPC 不連續
    var best = null;
    for (var t = 0; t < 200; t++) {
      var s = shuffle(r, list), bad = 0;
      for (var i = 1; i < s.length; i++) if (s[i].speakerNpcId === s[i - 1].speakerNpcId) bad++;
      if (!best || bad < best.bad) best = { s: s, bad: bad }; if (!bad) break;
    }
    return best.s.map(function (x, i) { x.startSec = Math.round(i * (R.bubbleSec + R.gapSec) * 10) / 10; x.slot = i; return x; });
  }

  /* ---------- 政策效果與結算 ---------- */
  function respond(eventId, st, policyIds) {
    var P = pool(), ev = byId(P)[eventId], st2 = {}, k;
    for (k in st) st2[k] = st[k];
    st2.policiesBoughtNow = policyIds || st.policiesBoughtNow || [];
    var ctx = { season: seasonOf(st, P), activeIds: st.activeIds || [eventId] };
    return (policyIds || []).map(function (pid) {
      var rr = ev.responses[pid], hit = null;
      if (!rr) return { policyId: pid, effect: 'neutral', note: '（此政策與事件無關）' };
      for (var i = 0; i < rr.length; i++) if (!rr[i].when || evalCond(rr[i].when, st2, ctx)) { hit = rr[i]; break; }
      return { policyId: pid, effect: hit.effect, note: hit.note, conditional: !!hit.when };
    });
  }
  function settle(dr, st, policyIds) {
    var P = pool(), M = byId(P), seed = dr.seed, cycle = dr.cycle, scale = P.severityScale, E = P.effects;
    var results = [], pending = (st.pending || []).filter(function (p) { return p.dueCycle > cycle; }).concat(dr.carriedPending || []);
    var aftermath = [], legacyFired = [], extra = {};
    var stx = {}; for (var k in st) stx[k] = st[k]; stx.policiesBoughtNow = policyIds || []; stx.activeIds = dr.events.map(function (e) { return e.eventId; });
    dr.events.forEach(function (c) {
      var ev = M[c.eventId], rs = respond(ev.id, stx, policyIds || []), effs = rs.map(function (x) { return x.effect; });
      var best = 'ignored', sevAfter = ev.severity;
      if (has(effs, 'cure')) best = 'cured'; else if (has(effs, 'assist')) best = 'assisted'; else if (has(effs, 'palliative')) best = 'palliative'; else if (has(effs, 'backfire')) best = 'backfired';
      if (best === 'cured' || best === 'palliative') sevAfter = 0;
      else if (best === 'assisted') sevAfter = Math.max(0, ev.severity - 1);
      var resolved = sevAfter === 0, extraDelta = 0;
      rs.forEach(function (x) { if (x.effect === 'backfire') extraDelta += Math.round(E.backfire.complaintUnit * scale[String(ev.severity)]); });
      if (extraDelta) extra[ev.domainId] = (extra[ev.domainId] || 0) + extraDelta;
      if (ev.legacyEventId) legacyFired.push(ev.legacyEventId);
      var onKey = best === 'backfired' ? 'backfire' : best, rc = rngFor(seed, cycle, 'chain:' + ev.id), spawned = [];
      (ev.chain || []).forEach(function (ch) {
        var okOn = dr.mode === 'locked' ? true : has(ch.on, onKey) || (best === 'backfired' && has(ch.on, 'ignored'));
        var roll = rc();
        if (!okOn || roll >= ch.chance) return;
        if (!M[ch.to]) return;
        if (ch.delay === 0) { aftermath.push({ eventId: ch.to, fromEventId: ev.id, label: ch.label }); spawned.push({ eventId: ch.to, delay: 0, label: ch.label }); }
        else { pending.push({ eventId: ch.to, fromEventId: ev.id, dueCycle: cycle + Math.max(1, ch.delay || 1), label: ch.label }); spawned.push({ eventId: ch.to, delay: 1, label: ch.label }); }
      });
      results.push({ eventId: ev.id, domainId: ev.domainId, severity: ev.severity, resolution: best, severityAfter: sevAfter, resolved: resolved, responses: rs, extraDelta: extraDelta, spawned: spawned, takeaway: ev.takeaway });
    });
    var history = results.map(function (x) { return { cycle: cycle, eventId: x.eventId, resolution: x.resolution }; });
    return { results: results, history: history, pending: pending, aftermath: aftermath, legacyFired: legacyFired, extraComplaintDelta: extra };
  }


  /* ---------- 動態文字：側欄／社論／線索框／天氣（G.DATA.dynamicText；見 docs/DYNAMIC_TEXT.md） ---------- */
  function dyn() { return (G.DATA && G.DATA.dynamicText) || null; }
  var TIER_FALLBACK = [{ id: 'calm', label: '平靜', min: 0, max: 24 }, { id: 'grumble', label: '抱怨', min: 25, max: 49 }, { id: 'upset', label: '不滿', min: 50, max: 74 }, { id: 'furious', label: '爆怒', min: 75, max: 100 }];
  var DOMAIN_FALLBACK = ['drain', 'market', 'logistics', 'traffic', 'health', 'safety'];
  var DOMAIN_NAME_FALLBACK = { drain: '排水', market: '市集', logistics: '物流', traffic: '交通', health: '衛生', safety: '治安' };
  var SEASON_LABEL = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  function tierList() { var C = G.DATA && G.DATA.complaints; return (C && C.tiers && C.tiers.length) ? C.tiers : TIER_FALLBACK; }
  function tierOfValue(v) {
    var L = tierList(), t = L[0];
    for (var i = 0; i < L.length; i++) if (v >= L[i].min) t = L[i];
    return t;
  }
  function domainOrder() { var C = G.DATA && G.DATA.complaints; return (C && C.domainOrder && C.domainOrder.length) ? C.domainOrder : DOMAIN_FALLBACK; }
  function domainNameOf(id) {
    var C = G.DATA && G.DATA.complaints, a = (C && C.domains) || [];
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i].name;
    return DOMAIN_NAME_FALLBACK[id] || id;
  }
  function deepestOf(comp) {
    var ord = domainOrder(), best = null;
    ord.forEach(function (d) { var v = comp[d] != null ? comp[d] : 30; if (best === null || v > comp[best]) best = d; });
    return best;
  }
  function pickFill(r, list, v) {
    if (!list || !list.length) return '';
    var ok = list.filter(function (t) { return !(/\{chainLabel\}/.test(t) && !v.chainLabel); });
    if (!ok.length) ok = list.filter(function (t) { return !/\{chainLabel\}/.test(t); });
    if (!ok.length) return '';
    return fill(pick(r, ok), v);
  }

  /* ---------- 喵安市長時事梗報導：G.EventPool.pickMayorNews（G.DATA.mayorNews；見 docs/MAYOR_NEWS.md） ---------- */
  function mayorData() { return (G.DATA && G.DATA.mayorNews) || null; }
  var MOOD_ALIAS = { praise: 'praise', neutral: 'neutral', roast: 'roast', better: 'praise', same: 'neutral', worse: 'roast' };
  function moodFromResolution(r) {
    if (r === 'cured' || r === 'assisted') return 'praise';
    if (r === 'palliative') return 'neutral';
    return r ? 'roast' : null;
  }
  function moodFromTier(t) { return t === 'calm' ? 'praise' : (t === 'grumble' ? 'neutral' : 'roast'); }
  /**
   * pickMayorNews(ctx, opts) → { id, memeId, tag, headline, deck, body, mayorQuote, residentReactions, editorNote, rumorFlag, mood, tier, domainId, placement, safetyNote, meta } | null
   * ctx：seed、cycle、complaints（{domain:值} 或 {values:{…}}）、tiers（{domain:'calm|…'}）或 tier、mood（praise／neutral／roast 或 better／same／worse）、resolution（cured／assisted／palliative／ignored／backfired）、
   *      focusDomainId、vars（place／day／n／pct／mm／eventTitle 覆蓋）、eventTitle、recentMemeIds（近期用過的 memeId；呼叫端傳上一季的即可）
   * opts：placement（frontPage｜monthly｜banter，預設 frontPage）、domainId、avoidMemeIds
   * 純函式、種子化（rngFor(seed, cycle, 'mayor-news:'+placement)）；沒有資料回 null。
   */
  function pickMayorNews(ctx, opts) {
    var D = mayorData(); if (!D || !D.memes || !D.memes.length) return null;
    ctx = ctx || {}; opts = opts || {};
    var placement = opts.placement || ctx.placement || 'frontPage';
    var seed = ctx.seed != null ? ctx.seed : 'canyon', cycle = ctx.cycle || 1;
    var cv = (ctx.complaints && ctx.complaints.values) ? ctx.complaints.values : (ctx.complaints || {}), comp = {};
    domainOrder().forEach(function (d) { comp[d] = typeof cv[d] === 'number' ? cv[d] : 30; });
    var focus = opts.domainId || ctx.focusDomainId || deepestOf(comp);
    var tier = (ctx.tiers && ctx.tiers[focus]) || ctx.tier || tierOfValue(comp[focus] != null ? comp[focus] : 30).id;
    var mood = MOOD_ALIAS[ctx.mood] || moodFromResolution(ctx.resolution) || moodFromTier(tier);
    var avoid = {}; [].concat(ctx.recentMemeIds || [], opts.avoidMemeIds || [], ctx.prevMemeId || []).forEach(function (x) { avoid[x] = 1; });
    var byPlace = D.memes.filter(function (m) {
      return m.placement === placement || (m.placement === 'both' && (placement === 'frontPage' || placement === 'monthly'));
    });
    var inDom = byPlace.filter(function (m) { return m.domainIds.indexOf('any') >= 0 || m.domainIds.indexOf(focus) >= 0; });
    var cand = inDom.length ? inDom : byPlace;
    var fresh = cand.filter(function (m) { return !avoid[m.memeId]; });
    if (!fresh.length) fresh = byPlace.filter(function (m) { return !avoid[m.memeId]; });
    if (fresh.length) cand = fresh;
    if (!cand.length) return null;
    var r = rngFor(seed, cycle, 'mayor-news:' + placement), total = 0;
    var ws = cand.map(function (m) {
      var w = (m.weight || 1) * (m.tier.indexOf(tier) >= 0 ? 1 : 0.15) * (m.mood === mood ? 1 : 0.3) * (m.domainIds.indexOf('any') >= 0 ? 1 : 2);
      total += w; return w;
    });
    var x = r() * total, m = cand[cand.length - 1], i;
    for (i = 0; i < cand.length; i++) { x -= ws[i]; if (x <= 0) { m = cand[i]; break; } }
    /* 變數：defaults → 隨機 → ctx.vars 覆蓋 → 全局稱呼 */
    var rv = rngFor(seed, cycle, 'mayor-news-vars:' + placement), V = D.vars || {}, v = {}, k;
    for (k in (V.defaults || {})) v[k] = V.defaults[k];
    v.place = pick(rv, V.places || [v.place]); v.day = pick(rv, V.days || [v.day]);
    ['n', 'pct', 'mm'].forEach(function (key) {
      var rg = (m.vars && m.vars[key]) || (V.ranges && V.ranges[key]);
      var val = rg ? randInt(rv, rg[0], rg[1]) : v[key]; v[key] = val;
    });
    for (k in (ctx.vars || {})) if (ctx.vars[k] != null && ctx.vars[k] !== '') v[k] = ctx.vars[k];
    if (ctx.eventTitle) v.eventTitle = ctx.eventTitle;
    v.domainName = domainNameOf(focus); v.cycle = cycle;
    for (k in (D.names || {})) v[k] = D.names[k];
    for (k in (ctx.names || {})) v[k] = ctx.names[k];
    var DEF = V.defaults || {};
    function F(t) { return String(fill(t, v)).replace(/\{(\w+)\}/g, function (mm, kk) { return DEF[kk] != null ? DEF[kk] : ''; }); }
    var rumor = m.rumorFlag ? { label: m.rumorFlag.label || '傳聞', text: F(m.rumorFlag.text), checkHint: F(m.rumorFlag.checkHint) } : null;
    return {
      id: m.id, memeId: m.memeId, tag: m.tag, headline: F(m.headline), deck: F(m.deck), body: F(m.body), mayorQuote: F(m.mayorQuote),
      residentReactions: (m.residentReactions || []).map(function (q) { return { speakerNpcId: q.speakerNpcId, speaker: npcName(q.speakerNpcId), text: F(q.text), mood: q.mood }; }),
      editorNote: F(m.editorNote), rumorFlag: rumor, mood: m.mood, tier: tier, domainId: focus, placement: placement, safetyNote: m.safetyNote,
      meta: { seed: seed, cycle: cycle, focusDomainId: focus, tier: tier, wantedMood: mood, candidates: cand.length }
    };
  }

  function compose(dr, st, assembled) {
    var P = pool(), T = dyn();
    if (!P) throw new Error('G.DATA.eventPool missing');
    if (!T) throw new Error('G.DATA.dynamicText missing');
    st = st || {}; dr = dr || { events: [] };
    var seed = dr.seed != null ? dr.seed : (st.seed != null ? st.seed : 'canyon'), cycle = dr.cycle || st.cycle || 1, M = byId(P);
    var season = dr.season || seasonOf(st, P), evs = (dr.events || []).filter(function (c) { return M[c.eventId]; });
    var comp = {}, k;
    domainOrder().forEach(function (d) { comp[d] = (st.complaints && st.complaints[d] != null) ? st.complaints[d] : 30; });
    for (k in (st.complaints || {})) if (comp[k] == null) comp[k] = st.complaints[k];
    function varsOf(eid) { var v = assembled && assembled.vars && assembled.vars[eid]; return v || rollVars(M[eid], P, seed, cycle); }
    // 主事件：嚴重度最高；同級時由連鎖排入（pending）者優先（與 assemble 的頭條規則一致）
    var lead = null;
    evs.forEach(function (c) {
      var ev = M[c.eventId];
      if (!lead || ev.severity > lead.ev.severity || (ev.severity === lead.ev.severity && c.source === 'pending' && lead.c.source !== 'pending')) lead = { c: c, ev: ev };
    });
    var deepest = deepestOf(comp);
    function eventInDomain(d) {
      var b = null;
      evs.forEach(function (c) { var ev = M[c.eventId]; if (ev.domainId === d && (!b || ev.severity > b.severity)) b = ev; });
      return b || (lead && lead.ev) || null;
    }
    function ctxVars(domainId, ev) {
      var v = {}, base = ev ? varsOf(ev.id) : {}, key, t = tierOfValue(comp[domainId] != null ? comp[domainId] : 30);
      for (key in base) v[key] = base[key];
      v.place = v.place || '峽口'; v.day = v.day || '週末';
      v.domainName = domainNameOf(domainId); v.complaint = comp[domainId] != null ? comp[domainId] : 30; v.tier = t.id; v.tierLabel = t.label;
      v.eventTitle = ev ? ev.title : '本季事件'; v.seasonLabel = SEASON_LABEL[season] || season; v.chainLabel = '';
      return v;
    }
    var leadEv = lead && lead.ev, leadDom = leadEv ? leadEv.domainId : deepest;
    var leadTier = tierOfValue(comp[leadDom] != null ? comp[leadDom] : 30), deepTier = tierOfValue(comp[deepest] != null ? comp[deepest] : 30);
    var leadVars = ctxVars(leadDom, leadEv);
    // 連鎖說明：優先找「導致主事件」的那條連鎖，其次用主事件自己的第一條連鎖
    var isChain = !!(lead && lead.c.source === 'pending'), chainLabel = '';
    if (isChain && lead.c.from && M[lead.c.from]) (M[lead.c.from].chain || []).forEach(function (ch) { if (!chainLabel && ch.to === leadEv.id) chainLabel = ch.label; });
    if (!chainLabel && leadEv && leadEv.chain && leadEv.chain.length) chainLabel = leadEv.chain[0].label;
    leadVars.chainLabel = chainLabel;
    var leadFalse = !!(leadEv && leadEv.falseAlarm), otherFalse = false;
    evs.forEach(function (c) { if (M[c.eventId].falseAlarm && (!leadEv || c.eventId !== leadEv.id)) otherFalse = true; });

    /* ---- 側欄 ---- */
    var rs = rngFor(seed, cycle, 'sidebar'), S = T.sidebar.boxes, box = {};
    S.forEach(function (b) { box[b.id] = b; });
    var byEv = function (b) { return (leadEv && b && b.byEvent && b.byEvent[leadEv.id] && b.byEvent[leadEv.id].length) ? b.byEvent[leadEv.id] : null; };
    var tipsList = byEv(box.tips) || ((leadFalse && box.tips.falseAlarm) ? box.tips.falseAlarm : ((box.tips.templates[leadDom] || {})[leadTier.id] || []));
    var deepEv = eventInDomain(deepest), deepVars = ctxVars(deepest, deepEv);
    var sidebar = [
      { id: 'tips', title: box.tips.title, body: pickFill(rs, tipsList, leadVars), tone: leadTier.id },
      { id: 'mailbox', title: box.mailbox.title, body: pickFill(rs, (box.mailbox.templates[deepest] || {})[deepTier.id] || [], deepVars), tone: deepTier.id },
      { id: 'thermometer', title: box.thermometer.title, body: pickFill(rs, box.thermometer.byTier[deepTier.id] || [], deepVars), tone: deepTier.id },
      { id: 'notice', title: box.notice.title, body: pickFill(rs, byEv(box.notice) || ((leadFalse && box.notice.falseAlarm) ? box.notice.falseAlarm : (box.notice.byDomain[leadDom] || [])), leadVars), tone: leadTier.id }
    ];

    /* ---- 社論 ---- */
    var re = rngFor(seed, cycle, 'editorial'), E = T.editorial, sev = String(leadEv ? leadEv.severity : 1);
    var eb = function (o) { return (leadEv && o && o.byEvent && o.byEvent[leadEv.id] && o.byEvent[leadEv.id].length) ? o.byEvent[leadEv.id] : null; };
    var tl = eb(E.titles) || (leadFalse ? E.titles.falseAlarm : (isChain ? E.titles.chain : (E.titles.byDomain[leadDom] || [])));
    var title = pickFill(re, tl, leadVars);
    var p1 = pickFill(re, E.phenomenon.byTier[leadTier.id], leadVars), p1b = pickFill(re, E.phenomenon.bySeverity[sev], leadVars);
    var cl = eb(E.cause) || (leadFalse ? E.cause.falseAlarm : ((isChain && chainLabel) ? E.cause.chain : (E.cause.byDomain[leadDom] || [])));
    var p2 = pickFill(re, cl, leadVars);
    var cb = eb(E.call) || (leadFalse ? E.call.falseAlarm : (isChain ? E.call.chain : E.call.base));
    var p3 = pickFill(re, cb, leadVars);
    if (leadTier.id === 'furious' && E.call.furious) p3 += ' ' + fill(E.call.furious[0], leadVars);
    else if (leadTier.id === 'calm' && E.call.calm) p3 += ' ' + fill(E.call.calm[0], leadVars);
    if (otherFalse && !leadFalse && E.sideNote) p3 += E.sideNote;
    var editorial = { title: title, paragraphs: [p1 + (p1b ? p1b : ''), p2, p3], domainId: leadDom, eventId: leadEv ? leadEv.id : null,
      variant: { falseAlarm: leadFalse, chain: isChain, tier: leadTier.id, severity: leadEv ? leadEv.severity : 0 } };

    /* ---- 線索框 ---- */
    var rc = rngFor(seed, cycle, 'clueBox'), CB = T.clueBox, truth = (assembled && assembled.truth) || [];
    var items = truth.filter(function (x) { return x.kind !== 'true'; }).map(function (x) {
      var lab = CB.labels[x.kind] || CB.labels.false, tv = { text: x.text, tag: lab.tag, explain: x.explain || '' };
      return { intelId: x.intelId, eventId: x.eventId, kind: x.kind, tag: lab.tag, note: lab.note, text: x.text, explain: x.explain || '', checkHint: x.checkHint || null,
        line: fill(CB.kindLine[x.kind] || CB.kindLine.false, tv) };
    });
    var indep = pickFill(rc, CB.independent, leadVars), checkLine;
    var hinted = items.filter(function (x) { return x.checkHint; });
    if (hinted.length) checkLine = fill(CB.checkTemplate, { checkHint: pick(rc, hinted).checkHint });
    else checkLine = pickFill(rc, CB.checkFallback, leadVars);
    var byStage = {
      read: CB.intro.read.map(function (t) { return fill(t, leadVars); }),
      decide: CB.intro.decide.map(function (t) { return fill(t, leadVars); }).concat([indep, checkLine]),
      after: CB.intro.after.map(function (t) { return fill(t, leadVars); })
    };
    var clueBox = { title: CB.title, byStage: byStage, labels: CB.labels, independentTip: indep, checkTips: [checkLine], items: items };

    /* ---- 天氣 ---- */
    var rw = rngFor(seed, cycle, 'weather'), W = T.weather, dflt = pick(rw, W.seasonDefaults[season] || W.seasonDefaults.spring), wsrc = null, wid = null;
    evs.forEach(function (c) {
      var o = W.overrides[c.eventId]; if (!o || !W.types[o]) return;
      if (!wsrc || W.types[o].priority > W.types[wid].priority) { wsrc = M[c.eventId]; wid = o; }
    });
    var source = 'event';
    if (!wid) { wid = dflt; source = 'season'; }
    var wt = W.types[wid], wv = ctxVars(wsrc ? wsrc.domainId : leadDom, wsrc || leadEv);
    var weather = { id: wid, icon: wt.icon, title: wt.title, desc: fill(wt.desc, wv), hint: fill(wt.hint, wv), source: source, eventId: wsrc ? wsrc.id : null, season: season };

    /* ---- 可直接合併進 paper 的欄位（給 newspaper.js；舊欄位名稱不變） ---- */
    var byId2 = {}; sidebar.forEach(function (x) { byId2[x.id] = x; });
    var paperPatch = {
      sidebar: { title: byId2.tips.title, byStage: { read: [byId2.tips.body, byId2.notice.body], decide: [byId2.tips.body, byId2.thermometer.body], after: [byId2.mailbox.body, byId2.thermometer.body] } },
      clueBox: { title: clueBox.title, byStage: byStage },
      opEd: { title: '本報社論｜' + editorial.title, body: editorial.paragraphs.join('　') },
      footerBand: { weather: { read: weather.icon + ' ' + weather.title + '：' + weather.desc, decide: weather.icon + ' ' + weather.hint, after: weather.icon + ' ' + weather.title + '：政策上路後，請再觀察一季。' } }
    };
    var mayorNews = null;
    try { mayorNews = pickMayorNews({ seed: seed, cycle: cycle, complaints: comp, focusDomainId: leadDom, vars: leadVars, eventTitle: leadEv ? leadEv.title : '', recentMemeIds: st.recentMayorMemeIds || dr.recentMayorMemeIds }, { placement: 'frontPage' }); } catch (e) { mayorNews = null; }
    return { sidebar: sidebar, editorial: editorial, clueBox: clueBox, weather: weather, paperPatch: paperPatch, mayorNews: mayorNews,
      meta: { seed: seed, cycle: cycle, season: season, leadEventId: leadEv ? leadEv.id : null, deepestDomainId: deepest } };
  }

  /* ---------- 本月快報：G.EventPool.composeMonthly（G.DATA.monthlyPaper；見 docs/MONTHLY_PAPER.md） ---------- */
  function monthlyData() { return (G.DATA && G.DATA.monthlyPaper) || null; }
  function domainIconOf(id) {
    var C = G.DATA && G.DATA.complaints, a = (C && C.domains) || [];
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i].icon || '';
    return '';
  }
  function composeMonthly(sr, prev, next, dr, assembled) {
    var P = pool(), T = monthlyData();
    if (!P) throw new Error('G.DATA.eventPool missing');
    if (!T) throw new Error('G.DATA.monthlyPaper missing');
    var M = byId(P), DF = T.vars.defaults, TH = T.thresholds;
    sr = sr || {}; prev = prev || {}; next = next || {}; dr = dr || { events: [] };
    var results = (sr.results || []).filter(function (x) { return M[x.eventId]; });
    var seed = dr.seed != null ? dr.seed : (next.seed != null ? next.seed : (prev.seed != null ? prev.seed : 'canyon'));
    var cycle = dr.cycle || prev.cycle || next.cycle || 1;
    var season = dr.season || next.season || prev.season || seasonOf({ cycle: cycle }, P);
    var seasonLabel = SEASON_LABEL[season] || season;
    var monthLabel = next.monthLabel || prev.monthLabel || dr.monthLabel || ('第' + cycle + '季（' + seasonLabel + '）');
    var ord = domainOrder(), pc = prev.complaints || {}, nc = next.complaints || {};
    var rM = rngFor(seed, cycle, 'monthly:mast'), rF = rngFor(seed, cycle, 'monthly:front'), rS = rngFor(seed, cycle, 'monthly:side'),
        rB = rngFor(seed, cycle, 'monthly:board'), rC = rngFor(seed, cycle, 'monthly:carry'), rQ = rngFor(seed, cycle, 'monthly:quote');
    function sweep(t) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return DF[k] != null ? DF[k] : ''; }); }
    function F(tpl, v) { return sweep(fill(tpl, v)); }
    function PF(r, list, v) { return (list && list.length) ? F(pick(r, list), v) : ''; }
    function moodOf(res) { return (res === 'cured' || res === 'assisted') ? 'better' : (res === 'palliative' ? 'same' : 'worse'); }

    /* 領域狀態 */
    var dom = {};
    ord.forEach(function (d) {
      var f = pc[d] != null ? pc[d] : (nc[d] != null ? nc[d] : 30), t = nc[d] != null ? nc[d] : f, tier = tierOfValue(t), dl = t - f;
      var state = tier.id === 'furious' ? 'furious' : (dl >= TH.risingMin ? 'rising' : (dl <= -TH.fallingMin ? 'falling' : 'stable'));
      dom[d] = { id: d, from: f, to: t, delta: dl, tier: tier, state: state };
    });
    function dvars(d, base) {
      var v = {}, k, x = dom[d];
      for (k in DF) v[k] = DF[k];
      for (k in (base || {})) if (base[k] != null) v[k] = base[k];
      v.domainName = domainNameOf(d); v.domainIcon = domainIconOf(d); v.from = x.from; v.to = x.to; v.delta = Math.abs(x.delta); v.tierLabel = x.tier.label;
      v.monthLabel = monthLabel; v.seasonLabel = seasonLabel; v.cycle = cycle; v.count = results.length;
      return v;
    }
    function evVars(eid) {
      var ev = M[eid], b = (assembled && assembled.vars && assembled.vars[eid]) || rollVars(ev, P, seed, cycle), r = null, i;
      for (i = 0; i < results.length; i++) if (results[i].eventId === eid) r = results[i];
      var v = dvars(ev.domainId, b);
      v.eventTitle = ev.title; v.severityAfter = r ? r.severityAfter : 0;
      return v;
    }
    /* 主事件 */
    var lead = null;
    results.forEach(function (r) {
      if (!lead) { lead = r; return; }
      if (r.severity > lead.severity || (r.severity === lead.severity && !r.resolved && lead.resolved)) lead = r;
    });
    /* 民怨焦點 */
    var focus = null;
    function best(cond, key) {
      var b = null; ord.forEach(function (d) { if (cond(dom[d]) && (!b || key(dom[d]) > key(dom[b.id]))) b = dom[d]; }); return b;
    }
    focus = best(function (x) { return x.state === 'furious'; }, function (x) { return x.to; }) ||
      best(function (x) { return x.state === 'rising'; }, function (x) { return x.delta; }) ||
      best(function (x) { return x.state === 'falling'; }, function (x) { return -x.delta; }) ||
      best(function () { return true; }, function (x) { return x.to; });
    var fvars = dvars(focus.id, lead ? evVars(lead.eventId) : null);
    var CP = T.complaint[focus.state];
    var policies = [];
    results.forEach(function (r) { (r.responses || []).forEach(function (x) { if (x.effect !== 'neutral' && policies.indexOf(x.policyId) < 0) policies.push(x.policyId); }); });
    var polNames = policies.map(function (id) { var q = G.DATA && G.DATA.policies && G.DATA.policies[id]; return (q && q.name) || id; });
    var polTxt = polNames.length ? polNames.join('、') : DF.policyNames;

    /* ---- 刊頭 ---- */
    var mv = dvars(focus.id, null);
    var masthead = { name: PF(rM, T.masthead.names, mv), series: PF(rM, T.masthead.series, mv), issue: PF(rM, T.masthead.issue, mv), dateLine: PF(rM, T.masthead.dateLine, mv) };

    /* ---- 頭版 ---- */
    var leadEv = lead ? M[lead.eventId] : null, res = lead ? lead.resolution : null, lv = lead ? evVars(lead.eventId) : fvars;
    lv.policyNames = polTxt; lv.policyCount = policies.length;
    var src = leadEv ? ((leadEv.falseAlarm && T.falseAlarm[res]) ? T.falseAlarm[res] : null) : null, O = leadEv ? T.outcomes[res] : null;
    var headline, deck, body1, editor, quote;
    if (!leadEv) {
      var E = T.empty; headline = PF(rF, E.headline, lv); deck = PF(rF, E.deck, lv); body1 = PF(rF, E.body, lv); editor = PF(rF, E.editorNote, lv);
      quote = pick(rQ, E.quote);
    } else {
      headline = PF(rF, (src && src.headline) || O.headline, lv); deck = PF(rF, O.deck, lv); body1 = PF(rF, (src && src.body) || O.body, lv);
      editor = PF(rF, (src && src.editorNote) || O.editorNote, lv);
    }
    var c2 = PF(rF, CP.body, fvars), dn = (T.domainNotes[focus.id] || {})[focus.state];
    if (dn && dn.length) c2 += pick(rF, dn);
    var cnote = PF(rF, CP.note, fvars).replace(/^短評：/, '');
    var useComplaintQuote = !leadEv || (focus.state === 'furious' && res !== 'cured' && res !== 'assisted');
    var prefer = T.speakerByDomain[focus.id];
    function pickQ(list, pref) {
      var pr = list.filter(function (q) { return q.speakerNpcId === pref; });
      return pick(rQ, pr.length ? pr : list);
    }
    if (!leadEv) quote = pickQ(T.empty.quote, prefer);
    else quote = pickQ(useComplaintQuote ? CP.quote : O.quote, prefer);
    var qmood = useComplaintQuote ? (focus.state === 'falling' ? 'better' : (focus.state === 'stable' ? 'same' : 'worse')) : moodOf(res);
    var resident = { domainId: focus.id, who: npcName(quote.speakerNpcId), speakerNpcId: quote.speakerNpcId, text: quote.text, mood: !leadEv ? 'same' : qmood };
    var frontPage = { headline: headline, deck: deck, body: [body1, c2], residentQuote: resident, editorNote: editor + (cnote ? '　另外，' + cnote : ''),
      eventId: leadEv ? leadEv.id : null, resolution: res, domainId: leadEv ? leadEv.domainId : focus.id, policies: polNames };

    /* ---- 側欄短訊 ---- */
    var sideBriefs = [];
    results.forEach(function (r) {
      if (lead && r.eventId === lead.eventId) return;
      if (sideBriefs.length >= Math.min(3, TH.maxSideBriefs)) return;
      var o = T.outcomes[r.resolution], v = evVars(r.eventId);
      sideBriefs.push({ id: 'brief_' + r.eventId, kind: 'event', eventId: r.eventId, resolution: r.resolution, title: o.icon + ' ' + o.label, body: PF(rS, o.brief, v), tone: r.resolution });
    });
    var others = ord.filter(function (d) { return d !== focus.id && (dom[d].state !== 'stable'); }).sort(function (a, b) { return Math.abs(dom[b].delta) - Math.abs(dom[a].delta); });
    if (others.length && sideBriefs.length < TH.maxSideBriefs) {
      var od = others[0], oc = T.complaint[dom[od].state];
      sideBriefs.push({ id: 'brief_domain_' + od, kind: 'complaint', domainId: od, state: dom[od].state, title: oc.icon + ' ' + domainNameOf(od) + oc.label, body: PF(rS, oc.headline, dvars(od, null)), tone: dom[od].state });
    }
    if (!sideBriefs.length) {
      var sc = T.complaint.stable; sideBriefs.push({ id: 'brief_domain_' + focus.id, kind: 'complaint', domainId: focus.id, state: focus.state, title: sc.icon + ' ' + domainNameOf(focus.id) + (T.complaint[focus.state].label), body: PF(rS, T.complaint[focus.state].headline, fvars), tone: focus.state });
    }

    /* ---- 民怨看板 ---- */
    var complaintBoard = ord.map(function (d) {
      var x = dom[d], v = dvars(d, null);
      return { domainId: d, name: domainNameOf(d), icon: domainIconOf(d), from: x.from, to: x.to, delta: x.delta, tier: x.tier.id, tierLabel: x.tier.label, trend: x.state, text: PF(rB, T.board[x.state], v) };
    });

    /* ---- 延續到下季 ---- */
    var carryOver = [], seen = {};
    function addCarry(kind, id, C, v) {
      var key = kind + ':' + id; if (seen[key] || carryOver.length >= TH.maxCarry) return; seen[key] = 1;
      carryOver.push({ kind: kind, id: id, title: PF(rC, C.title, v), body: PF(rC, C.body, v) });
    }
    (sr.pending || []).concat(sr.aftermath || []).forEach(function (p) {
      if (!p || !M[p.eventId]) return;
      var from = p.fromEventId && M[p.fromEventId] ? p.fromEventId : null;
      var v = from ? evVars(from) : evVars(p.eventId);
      v.nextEventTitle = M[p.eventId].title; v.chainLabel = p.label || DF.chainLabel;
      addCarry('pending', p.eventId, T.carryOver.pending, v);
    });
    results.forEach(function (r) { if (r.resolution === 'palliative') addCarry('rebound', r.eventId, T.carryOver.rebound, evVars(r.eventId)); });
    results.forEach(function (r) { if (r.severityAfter > 0) addCarry('unresolved', r.eventId, T.carryOver.unresolved, evVars(r.eventId)); });
    ord.filter(function (d) { return dom[d].tier.id === 'upset' || dom[d].tier.id === 'furious'; }).sort(function (a, b) { return dom[b].to - dom[a].to; }).slice(0, 2)
      .forEach(function (d) { addCarry('high', d, T.carryOver.high, dvars(d, null)); });
    if (!carryOver.length) carryOver.push({ kind: 'none', id: 'none', title: PF(rC, T.carryOver.none.title, fvars), body: PF(rC, T.carryOver.none.body, fvars) });

    /* ---- 居民引言（可直接給 monthly_paper.js 的 quotes） ---- */
    var quotes = [resident];
    ord.filter(function (d) { return d !== focus.id && dom[d].state !== 'stable'; }).sort(function (a, b) { return Math.abs(dom[b].delta) - Math.abs(dom[a].delta); }).slice(0, 3).forEach(function (d) {
      var c = T.complaint[dom[d].state], q = pickQ(c.quote, T.speakerByDomain[d]);
      quotes.push({ domainId: d, who: npcName(q.speakerNpcId), speakerNpcId: q.speakerNpcId, text: q.text, mood: dom[d].state === 'falling' ? 'better' : 'worse' });
    });
    var closing = PF(rM, T.closing, mv);
    var mayorNews = null;
    try {
      var mcomp = {}; ord.forEach(function (d) { mcomp[d] = dom[d].to; });
      mayorNews = pickMayorNews({ seed: seed, cycle: cycle, complaints: mcomp, focusDomainId: focus.id, resolution: res, vars: lv, eventTitle: leadEv ? leadEv.title : '', recentMemeIds: next.recentMayorMemeIds || prev.recentMayorMemeIds || dr.recentMayorMemeIds || sr.recentMayorMemeIds }, { placement: 'monthly' });
    } catch (e) { mayorNews = null; }
    var kicker = leadEv ? (T.outcomes[res].icon + ' ' + T.outcomes[res].label + '・' + domainNameOf(leadEv.domainId)) : '本月平靜';
    return {
      masthead: masthead, frontPage: frontPage, sideBriefs: sideBriefs, complaintBoard: complaintBoard, carryOver: carryOver, quotes: quotes, closing: closing, mayorNews: mayorNews,
      /* 與 G.MonthlyPaper.compose 模型同名的欄位，可直接 Object.assign 覆蓋 */
      modelPatch: { masthead: masthead.name, issue: masthead.issue, kicker: kicker, title: headline, lede: deck + ' ' + body1,
        quotes: quotes.map(function (q) { return { domainId: q.domainId, who: q.who, text: q.text, mood: q.mood, icon: domainIconOf(q.domainId), domain: domainNameOf(q.domainId), tierLabel: dom[q.domainId] ? dom[q.domainId].tier.label : '', moodIcon: { worse: '😠', same: '😒', better: '🙂' }[q.mood] }; }),
        carry: carryOver.map(function (c) { return { kind: c.kind, id: c.id, label: c.title, note: c.body }; }) },
      meta: { seed: seed, cycle: cycle, season: season, leadEventId: leadEv ? leadEv.id : null, resolution: res, focusDomainId: focus.id, focusState: focus.state }
    };
  }

  /* ---------- 職員反應句＋下一步建議（G.DATA.staffReactive；見 docs/STAFF_REACTIVE.md） ---------- */
  var EFF_SCORE = { cure: 3, assist: 2, palliative: 1 };
  function sdata() { return (G.DATA && G.DATA.staffReactive) || null; }
  function evMetaOf(eid) {
    var P = pool(), ev = null; ((P && P.events) || []).forEach(function (e) { if (e.id === eid) ev = e; });
    return ev ? { title: ev.title, domainId: ev.domainId, severity: ev.severity } : { title: eid, domainId: null, severity: 1 };
  }
  function polNameOf(pid) { var p = G.DATA && G.DATA.policies && G.DATA.policies[pid]; return p ? p.name : pid; }
  function varsIn(t) { var m = String(t).match(/\{(\w+)\}/g) || []; return m.map(function (x) { return x.slice(1, -1); }); }
  function canFill(t, v) { return varsIn(t).every(function (k) { return v[k] != null && v[k] !== ''; }); }
  function domainStreak(report, d) {
    var s = report.ignoredStreak && report.ignoredStreak[d]; if (s != null) return s | 0;
    var hist = report.history || [], cyc = report.cycle | 0, n = 0, bad = { ignored: 1, backfired: 1 };
    var cur = (report.results || []).some(function (r) { return r.domainId === d && (bad[r.resolution] || r.resolved === false); });
    if (cur) n = 1; else return 0;
    for (var c = cyc - 1; c >= 0; c--) {
      var hit = hist.some(function (h) { return h.cycle === c && evMetaOf(h.eventId).domainId === d && bad[h.resolution]; });
      if (!hit) break; n++;
    }
    return n;
  }
  function recommendFor(staff, report, opts) {
    var M = G.DATA && G.DATA.eventPolicyMap, POL = G.DATA && G.DATA.policies, D = sdata();
    var comp = report.complaints || {}, ord = domainOrder();
    if (!M || !POL) return { ids: [], text: '', domainId: null };
    var tgt = null, best = -1;
    (staff.domains || []).forEach(function (d) { var v = comp[d] != null ? comp[d] : 30; if (v > best) { best = v; tgt = d; } });
    if (tgt == null || best < 25) { var gb = -1; ord.forEach(function (d) { var v = comp[d] != null ? comp[d] : 30; if (v > gb) { gb = v; tgt = d; } }); }
    var unres = [];
    (report.results || []).forEach(function (r) { if (r.resolved === false || r.resolution === 'ignored' || r.resolution === 'backfired') unres.push(r.eventId); });
    (report.pending || []).forEach(function (p) { unres.push(p.eventId); });
    var rows = M.events.filter(function (r) { return r.domainId === tgt; });
    var focus = rows.filter(function (r) { return unres.indexOf(r.eventId) >= 0; }); if (!focus.length) focus = rows;
    var sc = {}, bad = {}, kind = {}, topic = {};
    focus.forEach(function (r) {
      var sev = evMetaOf(r.eventId).severity || 1;
      ['cure', 'assist', 'palliative'].forEach(function (k) {
        r[k].forEach(function (x) {
          sc[x.policyId] = (sc[x.policyId] || 0) + EFF_SCORE[k] * (x.when ? 0.6 : 1) * (0.8 + 0.2 * sev);
          if (!kind[x.policyId] || EFF_SCORE[k] > EFF_SCORE[kind[x.policyId]]) kind[x.policyId] = k;
          if (!topic[x.policyId]) topic[x.policyId] = (r.topicLabels || []).slice(0, 2).join('、');
        });
      });
    });
    rows.forEach(function (r) { r.backfire.forEach(function (x) { if (!x.when) bad[x.policyId] = 1; }); });
    var fb = ((G.DATA.staff || {}).fitByPolicy) || {};
    var owned = report.owned || [], pts = opts.points;
    var cand = Object.keys(sc).filter(function (pid) { return !bad[pid] && POL[pid] && (pts == null || POL[pid].costPoints <= pts); }).map(function (pid) {
      var adv = staff.adviceByPolicy && staff.adviceByPolicy[pid], st = adv ? adv.stance : 'hold', f = 0;
      (fb[pid] || []).forEach(function (x) { if (x.staffId === staff.id) f = x.fit; });
      var s = sc[pid] + (st === 'support' ? 0.6 : st === 'oppose' ? -0.8 : 0) + f - POL[pid].costPoints * 0.15 - (owned.indexOf(pid) >= 0 ? 0.5 : 0);
      return { pid: pid, score: Math.round(s * 1000) / 1000 };
    }).sort(function (a, b) { return b.score - a.score || (a.pid < b.pid ? -1 : 1); });
    var ids = [];
    if (cand.length) ids.push(cand[0].pid);
    if (cand.length > 1) { for (var i = 1; i < cand.length; i++) if (POL[cand[i].pid].policyType !== POL[ids[0]].policyType) { ids.push(cand[i].pid); break; } }
    var r2 = rngFor(report.seed != null ? report.seed : 'staff', report.cycle | 0, 'staffAdvice:' + staff.id), T = D.adviceTemplates, parts = [];
    ids.forEach(function (pid) {
      var p = POL[pid], k = (p.slow && p.policyType === 'info' && kind[pid] !== 'cure') ? 'edu' : kind[pid];
      parts.push(fill(pick(r2, T[k] || T.assist), { cardName: p.name, topic: topic[pid] || domainNameOf(tgt) }));
    });
    var text = ids.length ? '下一步（' + domainNameOf(tgt) + '）：' + parts.join(' 另外，') : pick(r2, T.none);
    return { ids: ids, text: text, domainId: tgt };
  }
  function staffReact(report, opts) {
    report = report || {}; opts = opts || {};
    var D = sdata(); if (!D) return [];
    var cycle = report.cycle | 0, seed = report.seed != null ? report.seed : 'staff';
    var comp = report.complaints || {}, prev = report.prevComplaints || {}, results = report.results || [], played = report.played || [];
    var sit = {}; D.situations.forEach(function (s) { sit[s.id] = s; });
    var staffs = ((G.DATA.staff && G.DATA.staff.staff) || []).filter(function (s) { return !opts.staffIds || opts.staffIds.indexOf(s.id) >= 0; });
    var last = opts.lastLineIds || {};
    var isRes = function (r) { return r.resolved !== false && (r.resolution === 'cured' || r.resolution === 'assisted' || r.resolution === 'palliative'); };
    return staffs.map(function (s) {
      var doms = s.domains || [], inDom = function (d) { return doms.indexOf(d) >= 0; };
      var rel = results.filter(function (r) { return inDom(r.domainId); });
      var cur = { id: 'stable', domain: null, ev: null, card: null, streak: 0 };
      var stanceOf = function (pid) { var a = s.adviceByPolicy && s.adviceByPolicy[pid]; return a ? a.stance : 'hold'; };
      var found = false, i;
      for (i = 0; i < rel.length && !found; i++) { var r = rel[i], bf = (r.responses || []).filter(function (x) { return x.effect === 'backfire'; })[0];
        if (r.resolution === 'backfired' || bf) { cur = { id: 'backfire', domain: r.domainId, ev: r.eventId, card: bf ? bf.policyId : (played[0] || null) }; found = true; } }
      if (!found) { var fd = null; doms.forEach(function (d) { if ((comp[d] != null ? comp[d] : 0) >= 75 && (fd == null || comp[d] > comp[fd])) fd = d; }); if (fd) { cur = { id: 'furious_warning', domain: fd }; found = true; } }
      if (!found) { var sd = null, sn = 1; doms.forEach(function (d) { var n = domainStreak(report, d); if (n >= 2 && n > sn) { sn = n; sd = d; } });
        if (sd) { var ue = rel.filter(function (r) { return r.domainId === sd && r.resolved === false; })[0]; cur = { id: 'unresolved_streak', domain: sd, streak: sn, ev: ue ? ue.eventId : null }; found = true; } }
      if (!found) {
        var M = G.DATA.eventPolicyMap;
        for (i = 0; i < rel.length && !found; i++) { var r3 = rel[i]; if (r3.resolved !== false && r3.resolution !== 'ignored') continue;
          var row = M && M.events.filter(function (x) { return x.eventId === r3.eventId; })[0], pid = null;
          if (row) ['cure', 'assist'].forEach(function (k) { row[k].forEach(function (x) { if (!pid && stanceOf(x.policyId) === 'support' && played.indexOf(x.policyId) < 0) pid = x.policyId; }); });
          if (pid) { cur = { id: 'advised_ignored', domain: r3.domainId, ev: r3.eventId, card: pid }; found = true; } }
      }
      if (!found) {
        for (i = 0; i < rel.length && !found; i++) { var r4 = rel[i]; if (r4.resolution !== 'cured' && r4.resolution !== 'assisted') continue;
          var pl = (r4.responses || []).filter(function (x) { return (x.effect === 'cure' || x.effect === 'assist') && played.indexOf(x.policyId) >= 0; });
          var sup = pl.filter(function (x) { return stanceOf(x.policyId) === 'support'; })[0], alt = pl.filter(function (x) { return stanceOf(x.policyId) !== 'support'; })[0];
          if (sup) { cur = { id: 'advised_success', domain: r4.domainId, ev: r4.eventId, card: sup.policyId }; found = true; }
          else if (alt) { cur = { id: 'alt_success', domain: r4.domainId, ev: r4.eventId, card: alt.policyId }; found = true; } }
      }
      if (!found) { var pdm = null; doms.forEach(function (d) { if (prev[d] != null && comp[d] != null && prev[d] - comp[d] >= 8 && (pdm == null || prev[d] - comp[d] > prev[pdm] - comp[pdm])) pdm = d; }); if (pdm) { cur = { id: 'praise_decrease', domain: pdm }; found = true; } }
      if (!found) { var fdm = null; doms.forEach(function (d) { var v = comp[d] != null ? comp[d] : 30; if (fdm == null || v > (comp[fdm] != null ? comp[fdm] : 30)) fdm = d; }); cur = { id: 'stable', domain: fdm }; }
      var d0 = cur.domain, to = comp[d0] != null ? comp[d0] : null, from = prev[d0] != null ? prev[d0] : to;
      var v = { domainName: d0 ? domainNameOf(d0) : '', from: from, to: to, delta: (from != null && to != null) ? Math.abs(from - to) : null, cardName: cur.card ? polNameOf(cur.card) : null,
        eventTitle: cur.ev ? evMetaOf(cur.ev).title : null, staffName: s.name, cycle: cycle + 1, streak: cur.streak || null, catchphrase: s.catchphrase, title: s.title };
      if (v.eventTitle == null && cur.card) { /* 沒有事件時以領域名代替 */ v.eventTitle = v.domainName ? v.domainName + '的狀況' : null; }
      var S = sit[cur.id], voice = D.voices[D.staffVoice[s.id]] || D.voices.precise;
      var bases = S.lines.filter(function (l) { return canFill(l.text, v); });
      if (!bases.length) { S = sit.stable; cur.id = 'stable'; bases = S.lines.filter(function (l) { return canFill(l.text, v); }); }
      var combos = [];
      bases.forEach(function (b, bi) { voice.leads.forEach(function (ld, li) { combos.push({ id: s.id + '|' + S.id + '|' + b.id.split(':')[1] + '-' + (li + 1), text: fill(ld, v) + fill(b.text, v) }); }); });
      var avoid = last[s.id] || [], pool0 = combos.filter(function (c) { return avoid.indexOf(c.id) < 0; }); if (!pool0.length) pool0 = combos;
      var pk = pick(rngFor(seed, cycle, 'staffReact:' + s.id), pool0);
      var rec = recommendFor(s, report, opts);
      return { staffId: s.id, staffName: s.name, line: pk.text, advice: rec.text, recommendCardIds: rec.ids, situation: cur.id, lineId: pk.id, tone: S.tone,
        voiceTag: D.staffVoice[s.id], domainId: d0, adviceDomainId: rec.domainId, eventId: cur.ev || null, cardId: cur.card || null };
    });
  }

  G.EventPool = { rngFor: rngFor, xmur3: xmur3, seasonOf: function (st) { return seasonOf(st, pool()); }, evalCond: evalCond, draw: draw, assemble: assemble, respond: respond, settle: settle, compose: compose, composeMonthly: composeMonthly, pickMayorNews: pickMayorNews, staffReact: staffReact, version: 5 };
})(typeof window !== 'undefined' ? window : globalThis);
