/**
 * pool_flow.js — 隨機事件池接線（Stage C）。依 docs/EVENT_RANDOM.md §4／§11。
 * G.PoolFlow：
 *   init(ctx)            建立 ctx.poolState（seed／mode／history／pending／owned）；?seed=XYZ、?mode=locked 讀 URL
 *   applyLanding()       入口畫面按「開始遊戲」時讀 #seed-input／#seed-locked（教師設定）
 *   beginCycle(ctx)      每季街景回合條開始前：draw + assemble → ctx.pool（同一季只抽一次）
 *   paperFor(ctx)        用 assemble 結果組出本季快報資料（沿用靜態版面與閘門，只換 articles／頭條／選項）
 *   streetPack(ctx)      給 G.StreetClues 的 {schedule, dialogues, clues, rng}（缺資料回傳 null＝走舊排程）
 *   settle(ctx, played)  結報時算 EventPool.settle 預覽（純函式，不寫回；重複呼叫不會重複累加）
 *   commit(ctx)          離開結報（進下一季）才把 history／pending／owned 寫回
 *   resultHtml(ctx)      結報視窗的「本季事件結果」區塊
 * 缺 G.EventPool／G.DATA.eventPool 時一切退回靜態內容（ctx.pool = null）。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var RES_LABEL = { cured: '對症解決', assisted: '有幫助', palliative: '只治標', backfired: '反效果', ignored: '未處理' };
  var RES_CLASS = { cured: 'is-good', assisted: 'is-good', palliative: 'is-mid', backfired: 'is-bad', ignored: 'is-bad' };
  var DOMAIN_ICON = { drain: '🌊', market: '🛍️', logistics: '🚚', traffic: '🚗', health: '💧', safety: '🛟' };

  function qs(name) {
    try {
      var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(global.location.search || '');
      return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    } catch (e) { return ''; }
  }
  function randomSeed() {
    var s = '';
    for (var i = 0; i < 6; i++) s += 'abcdefghjkmnpqrstuvwxyz23456789'.charAt(Math.floor(Math.random() * 31));
    return s;
  }
  function usable() { return !!(G.EventPool && G.DATA && G.DATA.eventPool && G.DATA.eventPool.events && qs('pool') !== 'off'); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function init(ctx) {
    var urlSeed = String(qs('seed')).trim();
    var mode = qs('mode') === 'locked' ? 'locked' : 'adaptive';
    ctx.poolState = {
      seed: urlSeed || randomSeed(),
      seedSource: urlSeed ? 'url' : 'random',
      mode: mode,
      cycle: 0,
      history: [],
      pending: [],
      owned: [],
      log: []
    };
    ctx.pool = null;
    renderSeed(ctx);
  }

  function applyLanding() {
    var ctx = G.state && G.state.ctx;
    if (!ctx || !ctx.poolState) return;
    var inp = global.document.getElementById('seed-input');
    var lock = global.document.getElementById('seed-locked');
    var v = inp ? String(inp.value || '').trim() : '';
    var ps = ctx.poolState;
    if (v) { ps.seed = v; ps.seedSource = 'teacher'; }
    if (lock && lock.checked) ps.mode = 'locked';
    renderSeed(ctx);
  }

  function renderSeed(ctx) {
    var ps = ctx.poolState; if (!ps) return;
    var src = ps.seedSource === 'random' ? '隨機' : (ps.seedSource === 'url' ? '網址' : '教師');
    var txt = '種子：' + ps.seed + '（' + src + (ps.mode === 'locked' ? '·固定劇本' : '') + '）';
    var d = global.document.getElementById('dbg-seed'); if (d) d.textContent = txt;
    var r = global.document.getElementById('round-seed'); if (r) { r.textContent = txt; r.title = '同一個種子＝同一串事件（除非玩家選擇不同）'; }
  }

  function drawState(ctx) {
    var ps = ctx.poolState, c = ctx.complaints || {};
    return {
      cycle: ps.cycle,
      complaints: clone(c.values || {}),
      ignoredStreak: clone(c.ignoreStreak || {}),
      policiesOwned: ps.owned.slice(),
      policiesBoughtNow: [],
      history: ps.history.slice(),
      pending: clone(ps.pending),
      seed: ps.seed,
      mode: ps.mode,
      recentMayorMemeIds: (ps.recentMayorMemeIds || []).slice()
    };
  }

  /* 避免連續兩季同一個市長梗：記最近 3 個 memeId（draw/assemble/composeMonthly 都讀 st.recentMayorMemeIds） */
  function rememberMayorMeme(ctx, id) {
    var ps = ctx.poolState; if (!ps || !id) return;
    ps.recentMayorMemeIds = (ps.recentMayorMemeIds || []).filter(function (x) { return x !== id; }).concat(id).slice(-3);
  }

  function beginCycle(ctx) {
    var ps = ctx.poolState;
    if (!ps) return null;
    var cyc = (ctx.monthIndex || 0) + 1;
    if (ctx.pool && ctx.pool.cycle === cyc) return ctx.pool; /* 同一季只抽一次 */
    ps.cycle = cyc;
    ctx.pool = null;
    restoreDecisionVoiceOptions();
    if (!usable()) return null;
    try {
      var st = drawState(ctx);
      var dr = G.EventPool.draw(st, { seed: ps.seed, mode: ps.mode });
      var pack = G.EventPool.assemble(dr, st);
      ctx.pool = { cycle: cyc, seed: ps.seed, mode: ps.mode, state: st, dr: dr, pack: pack, paper: derivePaper(pack, dr, st), preview: null };
      if (ctx.pool.paper && ctx.pool.paper.mayorNews) rememberMayorMeme(ctx, ctx.pool.paper.mayorNews.memeId);
      ps.log.push({ cycle: cyc, seed: ps.seed, mode: ps.mode, events: dr.events.map(function (e) { return e.eventId; }), headline: pack.headlineEventId });
    } catch (e) {
      ctx.pool = null; /* 退回靜態快報／舊排程 */
      restoreDecisionVoiceOptions();
      if (global.console) console.warn('[PoolFlow] draw failed, fallback to static', e);
    }
    renderSeed(ctx);
    return ctx.pool;
  }

  /* ---------- 決策欄行動選項（由 policyMatrix / 事件 responses 產生） ---------- */
  var VERDICT_OF = { cure: '對症', assist: '搭配', palliative: '治標' };          /* 搭配＝輔助（沿用 verdictLegend 用字） */
  var VERDICT_RANK = { cure: 0, assist: 1, palliative: 2 };
  var OPT_CAP = 4;                                                                   /* 每則報導最多列幾張，避免洗版 */
  function poolEvent(id) {
    var P = G.DATA && G.DATA.eventPool, ev = null;
    ((P && P.events) || []).forEach(function (e) { if (e.id === id) ev = e; });
    return ev;
  }
  /* 政策類型（硬建設／管制／補助獎勵／公私協力／資訊溝通）：由卡片 tags／typeLabel 判定；讓同一則報導的選項盡量涵蓋不同類型 */
  var TYPE_LABEL = { hard: '硬建設', reg: '管制', subsidy: '補助獎勵', ppp: '公私協力', info: '資訊溝通', stopgap: '治標應急' };
  function typeOfPolicy(pol) {
    /* 以 event_policy_map.cards[].policyType 為準（呆呆的對照表）；沒有才用 tags 推 */
    if (pol && TYPE_LABEL[pol.policyType]) return TYPE_LABEL[pol.policyType]; /* 資料欄位 policy.policyType（hard／reg／subsidy／ppp／info／stopgap） */
    var mc = G.DATA && G.DATA.eventPolicyMap && G.DATA.eventPolicyMap.cards && pol && G.DATA.eventPolicyMap.cards[pol.id];
    if (mc && TYPE_LABEL[mc.policyType]) return TYPE_LABEL[mc.policyType];
    var t = ((pol && pol.tags) || []).join('|') + '|' + ((pol && pol.card && pol.card.typeLabel) || '');
    if (/資訊|溝通|查證|信任/.test(t)) return '資訊溝通';
    if (/秩序|稽查|管制/.test(t)) return '管制';
    if (/治標/.test(t) && /經濟/.test(t)) return '補助獎勵';
    if (/^經濟\|治標|消費券|補助|獎勵/.test(t) || (/經濟/.test(t) && !/工程|觀光|市集|秩序/.test(t))) return '補助獎勵';
    if (/社區|機動|協力|市集|公車/.test(t)) return '公私協力';
    return '硬建設';
  }
  /* 這個事件「現在」有哪些卡有效：回傳 [{policyId, effect, verdict, note}]，只含 cure/assist/palliative（backfire／neutral 不列） */
  function matchesFor(eventId, st, activeIds) {
    var ev = poolEvent(eventId), out = [];
    if (!ev || !ev.responses) return out;
    var order = (G.DATA && G.DATA.policyOrder) || Object.keys(G.DATA.policies || {});
    var stx = clone(st || {}); stx.activeIds = activeIds || [eventId];
    order.forEach(function (pid) {
      if (!G.DATA.policies[pid] || !ev.responses[pid]) return;
      var r;
      try { r = G.EventPool.respond(eventId, stx, [pid])[0]; } catch (e) { r = null; }
      if (!r || !VERDICT_OF[r.effect]) return;
      out.push({ policyId: pid, effect: r.effect, verdict: VERDICT_OF[r.effect], note: String(r.note || '').replace('（預設）', '') });
    });
    return out;
  }
  /* 選項挑選（對照 event_policy_map.optionRule）：cure 在前 → assist → palliative；上限 4；盡量不同類型；補助獎勵最多 1 張；至少 1 張資訊溝通（若有）。
     preferred＝對照表為這個事件預排的 optionPolicyIds（優先採用，但仍須通過 respond 驗證才列出）。 */
  function pickDiverse(cands, preferred) {
    var rank = function (a, b) { return VERDICT_RANK[a.effect] - VERDICT_RANK[b.effect]; };
    cands = cands.slice().sort(rank);
    var chosen = [], types = {}, subs = 0;
    function can(c) { return chosen.length < OPT_CAP && chosen.indexOf(c) < 0 && !(c.type === '補助獎勵' && subs >= 1); }
    function take(c) { chosen.push(c); types[c.type] = true; if (c.type === '補助獎勵') subs++; }
    var pref = (preferred || []).map(function (id) { return cands.filter(function (c) { return c.policyId === id; })[0]; }).filter(Boolean);
    pref.forEach(function (c) { if (can(c) && !types[c.type]) take(c); });
    cands.forEach(function (c) { if (can(c) && !types[c.type]) take(c); });
    pref.forEach(function (c) { if (can(c)) take(c); });
    cands.forEach(function (c) { if (can(c)) take(c); });
    /* 至少 1 張資訊溝通：滿了又沒有，就換掉最後一張非 cure */
    if (!chosen.some(function (c) { return c.type === '資訊溝通'; })) {
      var edu = cands.filter(function (c) { return c.type === '資訊溝通' && chosen.indexOf(c) < 0; })[0];
      if (edu) {
        if (chosen.length < OPT_CAP) chosen.push(edu);
        else {
          for (var i = chosen.length - 1; i >= 0; i--) if (chosen[i].effect !== 'cure') { chosen[i] = edu; break; }
        }
      }
    }
    return chosen.sort(rank);
  }
  /* 逐事件選項文字：data newspapers.actionOptions 中 act_<eventId>__<policy>（文字取自「該事件對該卡」的說明）。只借文字欄位，verdict／effect 一律由 respond 重算。 */
  var DEF_INDEX = null;
  function optionDefs() {
    if (DEF_INDEX) return DEF_INDEX;
    DEF_INDEX = {};
    var N = G.DATA && G.DATA.newspapers && G.DATA.newspapers.newspaper_season_01;
    ((N && N.actionOptions) || []).forEach(function (o) { if (o.poolEventId && o.policyId) DEF_INDEX[o.poolEventId + '|' + o.policyId] = o; });
    return DEF_INDEX;
  }
  /* entries: [{article, poolEventId}]（顯示順序＝頭條在前）。回傳 actionOptions 陣列。
     規則：選項＝該事件對照表 optionPolicyIds（經 respond 驗證只留 cure／assist／palliative）；同一則報導內不重複；
     跨報導預設不重複，但若某則報導因此少於 2 張或失去它的對症卡，才允許重複列（o.repeat=true）。 */
  function buildOptions(dr, st, entries) {
    var activeIds = (dr && dr.events || []).map(function (e) { return e.eventId; });
    var defs = optionDefs();
    var used = {}, out = [];
    entries.forEach(function (en) {
      var art = en.article; if (!art) return;
      var eid = en.poolEventId || art.poolEventId;
      var ev = poolEvent(eid);
      var mapEv = ((G.DATA.eventPolicyMap && G.DATA.eventPolicyMap.events) || []).filter(function (e) { return e.eventId === eid; })[0];
      var cands = matchesFor(eid, st, activeIds).map(function (m) { m.type = typeOfPolicy(G.DATA.policies[m.policyId]); return m; });
      var fresh = cands.filter(function (c) { return !used[c.policyId]; });
      var chosen = pickDiverse(fresh, mapEv && mapEv.optionPolicyIds);
      var hasCureCand = cands.some(function (c) { return c.effect === 'cure'; });
      if (chosen.length < 2 || (hasCureCand && !chosen.some(function (c) { return c.effect === 'cure'; }))) {
        cands.filter(function (c) { return chosen.indexOf(c) < 0; }).sort(function (a, b) { return VERDICT_RANK[a.effect] - VERDICT_RANK[b.effect]; }).forEach(function (c) {
          if (chosen.length < OPT_CAP && (chosen.length < 2 || (c.effect === 'cure' && !chosen.some(function (x) { return x.effect === 'cure'; })))) { c.repeat = true; chosen.push(c); }
        });
        chosen.sort(function (a, b) { return VERDICT_RANK[a.effect] - VERDICT_RANK[b.effect]; });
      }
      chosen.forEach(function (c) {
        used[c.policyId] = used[c.policyId] || eid;
        var pol = G.DATA.policies[c.policyId], card = pol.card || {}, d = defs[eid + '|' + c.policyId] || {};
        var o = {
          id: d.id || ('act_' + eid + '__' + c.policyId.replace(/^policy_/, '')),
          articleId: art.id, relatedEventId: art.relatedEventId || (ev && ev.legacyEventId) || eid, poolEventId: eid,
          policyId: c.policyId, verdict: c.verdict, effect: c.effect, policyType: c.type, typeLabel: pol.typeLabel || '',
          verb: d.verb || ('用「' + pol.name + '」'),
          label: d.label || card.shopLine || pol.shopBlurb || pol.blurb || pol.name,
          why: d.why || c.note || card.effectLine || pol.blurb || '',
          tradeoff: d.tradeoff || card.tradeoffLine || pol.sideEffect || '',
          staffIds: (d.staffIds || (pol.staffFit && pol.staffFit.bestStaffIds) || []).slice(), voiceIds: [],
          slow: !!pol.slow
        };
        if (c.repeat) o.repeat = true;
        if (c.effect !== 'cure' && (ev.responses[c.policyId] || []).some(function (r) { return r.effect === 'cure' && r.when; })) o.conditionalCure = true;
        out.push(o);
      });
      if (!chosen.length) {
        out.push({
          id: 'act_none_' + eid, articleId: art.id, relatedEventId: art.relatedEventId || eid, poolEventId: eid,
          policyId: '', verdict: '無對應', effect: 'none', policyType: '', verb: '目前沒有對應政策卡',
          label: '目前沒有對應政策卡：這類事件只能靠觀察、等待或公職委任。',
          why: '政策×事件對照表裡沒有任何一張卡對這件事有效。', tradeoff: '', staffIds: [], voiceIds: [], none: true
        });
      }
    });
    return out;
  }
  /* 決策欄「行動選項」面板（newspaper.js buildActionsHtml）讀的是 G.DATA.decisionVoices.actionOptions；pool 模式下換成本季事件的選項，pool=off 時還原靜態版本 */
  function setDecisionVoiceOptions(list) {
    var dv = G.DATA && G.DATA.decisionVoices; if (!dv) return;
    if (!dv._origActionOptions) dv._origActionOptions = dv.actionOptions;
    dv.actionOptions = list;
  }
  function restoreDecisionVoiceOptions() {
    var dv = G.DATA && G.DATA.decisionVoices;
    if (dv && dv._origActionOptions) dv.actionOptions = dv._origActionOptions;
  }

  /* ---------- 快報 ---------- */
  function derivePaper(pack, dr, st) {
    var base = G.DATA && G.DATA.newspapers && G.DATA.newspapers.newspaper_season_01;
    if (!base || !pack || !pack.articles || !pack.articles.length) return null;
    var p = clone(base);
    var arts = pack.articles.slice().sort(function (a, b) {
      if (a.id === pack.headlineEventId) return -1;
      if (b.id === pack.headlineEventId) return 1;
      return (b.severity || 0) - (a.severity || 0);
    });
    p.articles = arts.map(function (a) {
      return {
        id: a.id, relatedEventId: a.relatedEventId, poolEventId: a.poolEventId, kicker: a.kicker, title: a.title,
        blurb: a.blurb, body: a.body, clues: a.clues || [], takeaway: a.takeaway, storyStage: a.storyStage || 'clue',
        actionOptionIds: a.actionOptionIds || [], complaintDomainIds: a.complaintDomainIds || [], severity: a.severity, domainId: a.domainId
      };
    });
    var h = arts[0];
    var others = arts.slice(1).map(function (a) { return a.title; });
    var head = { kicker: '本季頭條 · ' + (h.kicker || '貓貓快報'), title: h.title, lede: h.blurb + (others.length ? '　另有 ' + others.length + ' 則：' + others.join('、') : '') };
    p.headline = head;
    p.headlineByStage = p.headlineByStage || {};
    p.headlineByStage.read = head;
    if (p.headlineByStage.clue) p.headlineByStage.clue = head;
    var dec = p.headlineByStage.decide;
    if (dec) {
      p.headlineByStage.decide = {
        kicker: dec.kicker, title: dec.title,
        lede: '本季事件：' + arts.map(function (a) { return a.title; }).join('；') + '。線索你已經畫好了，請對照居民心聲，挑最對症的政策卡。'
      };
    }
    /* 政策選項：一律由「該事件的 responses（政策 × 事件對照）」產生，只列有 對症／搭配／治標 的卡；不再退回固定卡。 */
    var built = buildOptions(dr, st, arts.map(function (a) { return { article: p.articles.filter(function (x) { return x.id === a.id; })[0], poolEventId: a.poolEventId }; }));
    p.actionOptions = built;
    p._optionsFromMatrix = true;
    setDecisionVoiceOptions(built);

    if (p.investigation) {
      p.investigation.body = (p.investigation.body || '') + '　本季判斷重點：' + arts.map(function (a) { return (a.takeaway || ''); }).filter(Boolean).join(' ');
    }
    p._pool = { cycle: dr.cycle, seed: dr.seed, events: dr.events.map(function (e) { return e.eventId; }) };
    /* 動態文字（側欄／社論／線索框／天氣）：G.EventPool.compose().paperPatch；缺資料或丟錯就沿用靜態文字。閘門數字（unlockPolicyAfter）不碰。 */
    try {
      if (st && G.EventPool && G.EventPool.compose && G.DATA && G.DATA.dynamicText) {
        var cm = G.EventPool.compose(dr, st, pack), pp = cm && cm.paperPatch;
        if (pp) {
          if (pp.sidebar) p.sidebar = Object.assign({}, p.sidebar || {}, pp.sidebar);
          if (pp.clueBox) p.clueBox = Object.assign({}, p.clueBox || {}, pp.clueBox);
          if (pp.opEd && pp.opEd.body) p.opEd = Object.assign({}, p.opEd || {}, pp.opEd);
          if (pp.footerBand && pp.footerBand.weather) p.footerBand = Object.assign({}, p.footerBand || {}, { weather: pp.footerBand.weather });
          p.composed = cm; /* 供 HUD／QA 讀 weather、clueBox.items、editorial */
          if (cm && cm.mayorNews) p.mayorNews = cm.mayorNews; /* 頭版小專欄（docs/MAYOR_NEWS.md §5）；memeId 的記憶在 beginCycle */
          p._dynamic = true;
        }
      }
    } catch (e) { if (global.console) console.warn('[PoolFlow] compose paperPatch failed, static text kept', e); }
    return p;
  }
  function paperFor(ctx) { return (ctx && ctx.pool && ctx.pool.paper) || null; }

  /* ---------- 街景 ---------- */
  function streetPack(ctx) {
    var pl = ctx && ctx.pool;
    if (!pl || !pl.pack || !pl.pack.schedule || !pl.pack.schedule.length) return null;
    var ps = ctx.poolState;
    return {
      schedule: pl.pack.schedule, dialogues: pl.pack.dialogues || [], clues: pl.pack.clues || [], events: pl.dr.events,
      rng: G.EventPool.rngFor(ps.seed, pl.cycle, 'schedule-fill')
    };
  }

  /* ---------- 結報 ---------- */
  function settle(ctx, played) {
    var pl = ctx.pool;
    if (!pl) { ctx.poolFeed = null; return null; }
    try {
      var st = clone(pl.state);
      st.policiesBoughtNow = (played || []).slice();
      var res = G.EventPool.settle(pl.dr, st, played || []);
      pl.preview = res; pl.played = (played || []).slice();
      var doms = {}, ex = res.extraComplaintDelta || {};
      pl.dr.events.forEach(function (e) { doms[e.domainId] = doms[e.domainId] || { sevAfter: 0, drawn: true }; });
      res.results.forEach(function (r) { var d = doms[r.domainId]; if (d) d.sevAfter = Math.max(d.sevAfter, r.severityAfter || 0); });
      ctx.poolFeed = { domains: doms, extra: ex };
      return res;
    } catch (e) {
      ctx.poolFeed = null; pl.preview = null;
      if (global.console) console.warn('[PoolFlow] settle failed', e);
      return null;
    }
  }
  function commit(ctx) {
    var pl = ctx.pool, ps = ctx.poolState;
    if (!pl || !ps || !pl.preview || pl.committed) { ctx.poolFeed = null; return; }
    var res = pl.preview;
    ps.history = ps.history.concat(res.history);
    ps.pending = res.pending.slice();
    (pl.played || []).forEach(function (id) { if (ps.owned.indexOf(id) < 0) ps.owned.push(id); });
    var lg = ps.log[ps.log.length - 1];
    if (lg && lg.cycle === pl.cycle) { lg.results = res.results.map(function (r) { return r.eventId + ':' + r.resolution; }); lg.played = (pl.played || []).slice(); lg.legacyFired = res.legacyFired.slice(); }
    pl.committed = true;
    ctx.poolFeed = null;
  }

  function titleOf(ctx, eventId) {
    var P = G.DATA.eventPool, ev = P && P.events.filter(function (e) { return e.id === eventId; })[0];
    return (ev && ev.title) || eventId;
  }
  function resultHtml(ctx) {
    var pl = ctx.pool, res = pl && pl.preview;
    if (!res) return '';
    var lis = res.results.map(function (r) {
      var sp = (r.spawned || []).map(function (s) { return s.label; }).filter(Boolean);
      return '<li class="' + (RES_CLASS[r.resolution] || '') + '" data-event="' + r.eventId + '" data-resolution="' + r.resolution + '">' +
        '<span class="rp-name">' + (DOMAIN_ICON[r.domainId] || '') + ' ' + titleOf(ctx, r.eventId) + '</span>' +
        '<span class="rp-res">' + (RES_LABEL[r.resolution] || r.resolution) + '</span>' +
        (sp.length ? '<span class="rp-next">後續：' + sp.join('、') + '</span>' : '') + '</li>';
    }).join('');
    var next = (res.pending || []).length ? '<p class="rp-pending">下一季可能再出現：' + res.pending.map(function (p) { return p.label || titleOf(ctx, p.eventId); }).join('、') + '</p>' : '';
    return '<div class="result-pool"><h3>本季事件處理結果</h3><ul>' + lis + '</ul>' + next + '</div>';
  }

  G.PoolFlow = {
    init: init, applyLanding: applyLanding, beginCycle: beginCycle, paperFor: paperFor, streetPack: streetPack,
    settle: settle, commit: commit, resultHtml: resultHtml, buildOptions: buildOptions, matchesFor: matchesFor, typeOfPolicy: typeOfPolicy, renderSeed: renderSeed, usable: usable, ready: true
  };
})(typeof window !== 'undefined' ? window : globalThis);
