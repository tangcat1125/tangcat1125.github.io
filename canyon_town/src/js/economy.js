/**
 * economy.js — 經濟模型 G.Economy（docs/BALANCE_FUN.md v2.1 §2、§5、§6.3；參考實作 tools/sim_economy.js runGame）。
 * 人流／車流／遊客／治安 → 8 家店客流 → 營收 → 稅收；事件結果決定流量；補助／獎勵／維運／政策支出 → 季度帳單。
 * 只讀資料 G.DATA.economy.*（file:// 內嵌），不碰 newspaper.js、不改報紙門檻、不動街景軸線。
 * 狀態 ctx.town（跨季）；preview 為純函式（不改 ctx.town，可重複呼叫），commit 才寫入（advance() 唯一一次）。
 * 介面：enabled, init, preview, commit, bill, snapshot, streetDensity, reopen, streetMatch, streetLines, hudState, rules
 * 關閉：?economy=off（維持舊行為）。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var FLOWS = ['foot', 'vehicle', 'tourist', 'security'];
  var FLOW_NAME = { foot: '人流', vehicle: '車流', tourist: '遊客', security: '治安' };
  var SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  /* 校準旋鈕（與 sim_economy.js SIM_DEFAULTS 同值；economy_rules.sim 有寫就以資料為準） */
  var SIM = { recCap: 10, goodWordCap: 8, unresolvedLife: 2, assistReward: 10, cureLagFull: 1, impactScale: 1, ignorePenaltyOnce: 1, crisisMode: 1, crisisLossScale: 1, oppChanceScale: 1, gradeProfitDiv: 3, gradeFlowMult: 5, tourismFailBoost: 4, reputationRevenue: 200 };

  var _R = null;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function off() { try { return /[?&]economy=off\b/.test(global.location.search); } catch (e) { return false; } }
  function econ() { return (G.DATA && G.DATA.economy) || null; }
  function enabled() { var e = econ(); return !!(e && e.rules && e.shops && !off()); }

  /** 展平 {value,note} 規則為 'a.b.c' → value */
  function rules() {
    if (_R) return _R;
    var e = econ(); if (!e || !e.rules) return {};
    var flat = {};
    (function walk(o, p) {
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        if ('value' in o && 'note' in o) { flat[p] = o.value; return; }
        Object.keys(o).forEach(function (k) { if (!p && /^(id|seasonId|version|note)$/.test(k)) return; walk(o[k], p ? p + '.' + k : k); });
      } else flat[p] = o;
    })(e.rules, '');
    var sim = e.rules.sim; /* 日後校準值可放 rules.sim */
    var S = {}; Object.keys(SIM).forEach(function (k) { S[k] = SIM[k]; });
    if (sim && typeof sim === 'object') Object.keys(sim).forEach(function (k) { S[k] = (sim[k] && sim[k].value != null) ? sim[k].value : sim[k]; });
    flat._sim = S;
    return (_R = flat);
  }
  function R(k) { var r = rules(); return r[k]; }

  /* ---- 小型種子亂數（機會事件用；同種子同結果） ---- */
  function xmur(str) { var h = 1779033703 ^ str.length; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; }
  function rngFor(seed, tag) { var a = xmur(seed + '|' + tag)(); return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function eventDef(id) { var P = G.DATA && G.DATA.eventPool; return (P && P.events || []).filter(function (e) { return e.id === id; })[0] || null; }
  function flowImpact(id, sev) {
    var fi = econ().eventFlowImpact, ev = fi && fi.events && fi.events[id];
    var out = {};
    if (ev) { FLOWS.forEach(function (f) { out[f] = +ev[f] || 0; }); return out; }
    var def = eventDef(id), dd = fi && fi.domainDefaults && def && fi.domainDefaults[def.domainId];
    FLOWS.forEach(function (f) { out[f] = dd ? (+dd[f] || 0) * (sev || (def && def.severity) || 1) : 0; });
    return out;
  }
  function policyOf(pid) { return (G.DATA.policies || {})[pid] || null; }
  function cardCost(pid) { var p = policyOf(pid); return p && p.deltas && p.deltas.money ? -p.deltas.money : 0; }
  function shopDefs() { return econ().shops.shops || econ().shops; }

  /* ---------------- 初始化 ---------------- */
  function init(ctx, difficulty) {
    if (!enabled()) { ctx.town = null; return null; }
    var d = clamp(typeof difficulty === 'number' ? difficulty : 1, 0, 2), f0 = R('start.flows');
    var fl = {}, tr = {}; FLOWS.forEach(function (f) { fl[f] = f0; tr[f] = 'flat'; });
    ctx.town = {
      flows: fl, trends: tr, prevFlows: clone(fl), reputation: R('start.reputation'), combo: 0, season: 0,
      difficulty: d, subsidySeasons: (R('difficulty.subsidySeasons') || [4, 8, 12])[d], closeAfter: (R('difficulty.closeAfter') || [3, 4, 5])[d],
      shops: shopDefs().map(function (s) { return { id: s.id, name: s.name, emoji: s.emoji, health: s.startHealth || R('start.shopHealth'), state: 'open', warnStreak: 0, c: 0, justReopened: false }; }),
      issues: [], goodWord: [], recActive: {}, ignoredStreak: {}, boost: { tourist: 0, foot: 0 }, loans: 0, loanDebt: 0,
      bankrupt: null, grades: {}, history: [], pending: null, lastBill: null, startMoney: null, avgStart: f0
    };
    return ctx.town;
  }

  function comboMult(n) { return n >= 4 ? 1 + R('income.combo.streak4plus') : n === 3 ? 1 + R('income.combo.streak3') : n === 2 ? 1 + R('income.combo.streak2') : 1; }
  function trendOf(delta) { var big = R('hud.arrowBig') || 8, small = R('hud.arrowSmall') || 2; return delta >= big ? 'up2' : delta >= small ? 'up' : delta <= -big ? 'down2' : delta <= -small ? 'down' : 'flat'; }
  var ARROW = { up2: '▲▲', up: '▲', flat: '▬', down: '▼', down2: '▼▼' };

  /* ---------------- 季結算（純函式）：回傳 { bill, next } ---------------- */
  function compute(ctx, played) {
    var T0 = ctx.town, S = SIM, SS = rules()._sim, T = clone(T0);
    var seasonName = SEASONS[T.season % 4];
    var results = (ctx.pool && ctx.pool.preview && ctx.pool.preview.results) || [];
    var rk = rngFor(String((ctx.poolState && ctx.poolState.seed) || 'seed'), 'econ:' + T.season);
    var B = { shopRevenue: 0, tax: 0, subsidyBase: 0, subsidyPerf: 0, rewardCure: 0, rewardMinor: 0, penaltyBackfire: 0, penaltyIgnored: 0, eventLoss: 0, preventSaved: 0, opportunity: 0, upkeep: 0, cardCost: 0, loanIn: 0, loanRepay: 0, reopenCost: 0 };
    played = played || [];
    var owned = {}; ((ctx.poolState && ctx.poolState.owned) || []).forEach(function (p) { owned[p] = 1; });
    var ownedBefore = clone(owned);
    played.forEach(function (pid) { B.cardCost += cardCost(pid); owned[pid] = 1; var r = econ().cardRecurring.cards[pid]; if (r && (r.foot || r.vehicle || r.tourist || r.security) && r.durationSeasons > 0 && !T.recActive[pid]) T.recActive[pid] = { left: r.durationSeasons >= 99 ? 1e9 : r.durationSeasons }; });

    var handled = 0, cured = 0, bad = 0, ignoredN = 0, nEv = 0, bestBlame = null, bestBoost = null, cureDomains = {};
    var impactSum = {}, trustShort = 0, goodWordNew = [], mult0 = comboMult(T.combo); FLOWS.forEach(function (f) { impactSum[f] = 0; });
    var lines = []; /* 逐事件說明（帳單因果句用） */
    var newIssues = [], seen = {};
    results.forEach(function (r) {
      var def = eventDef(r.eventId); if (!def) return; nEv++; seen[r.eventId] = 1;
      var opportunity = def.polarity === 'opportunity', res = r.resolution || 'ignored';
      var old = T.issues.filter(function (i) { return i.id === r.eventId; })[0], age = old ? old.age : 0, sev = old ? old.sev : (r.severity || def.severity);
      var base = flowImpact(r.eventId, def.severity);
      FLOWS.forEach(function (f) { base[f] = (base[f] || 0) * SS.impactScale; });
      var stack = Math.min(R('flow.ignoreStackCap'), Math.pow(R('flow.ignoreStack'), age)), mult = 0, keep = true, sevAfter = sev;
      if (res === 'cured') { mult = SS.cureLagFull; keep = false; cured++; handled++; B.rewardCure += (R('income.reward.cureBase') + R('income.reward.perSeverity') * def.severity) * mult0; goodWordNew.push(FLOWS.map(function (f) { return base[f] < 0; })); cureDomains[def.domainId] = 1; }
      else if (res === 'assisted') { mult = sev / def.severity; sevAfter = sev - 1; keep = sevAfter > 0; handled++; B.rewardMinor += SS.assistReward; }
      else if (res === 'palliative') { mult = R('flow.palliativeMult'); keep = false; handled++; B.rewardMinor += R('income.reward.palliative'); }
      else if (res === 'backfired') { mult = stack * R('flow.backfireMult'); bad++; B.penaltyBackfire += R('income.reward.backfire'); }
      else { mult = stack; if (!opportunity) { ignoredN++; if (!SS.ignorePenaltyOnce || age === 0) B.penaltyIgnored += R('income.reward.ignored'); } }
      if (opportunity) { if (res === 'cured' || res === 'assisted') mult = 1; else { mult = 0; keep = false; } }
      var contrib = {};
      FLOWS.forEach(function (f) { var v = base[f] * mult; if (res === 'backfired' && base[f] < 0) v += R('flow.backfireExtra'); impactSum[f] += v; contrib[f] = v; });
      if (def.domainId === 'health' && !opportunity) trustShort += -Math.min(0, base.foot) * mult;
      if (res === 'ignored' || res === 'backfired') T.ignoredStreak[def.domainId] = (T.ignoredStreak[def.domainId] || 0) + 1;
      var loss = 0, topF = null; FLOWS.forEach(function (f) { if (contrib[f] < loss) { loss = contrib[f]; topF = f; } });
      if (topF && res !== 'cured' && (!bestBlame || loss < bestBlame.loss)) bestBlame = { eventId: r.eventId, title: def.title, flow: topF, n: Math.round(-loss), loss: loss, res: res };
      var gain = 0, gF = null; FLOWS.forEach(function (f) { if (base[f] < 0 && -base[f] > gain && res === 'cured') { gain = -base[f]; gF = f; } });
      if (gF && (!bestBoost || gain > bestBoost.n)) bestBoost = { eventId: r.eventId, title: def.title, flow: gF, n: Math.round(gain), card: (r.responses && r.responses[0] && r.responses[0].policyId) || null };
      lines.push({ eventId: r.eventId, res: res, contrib: contrib });
      if (keep) newIssues.push({ id: r.eventId, sev: sevAfter, age: age + 1, domainId: def.domainId });
    });
    /* 先前留下、本季沒再抽到的問題：淡出前仍拖累（該領域本季有對症則視為整頓完畢） */
    T.issues.forEach(function (i) {
      if (seen[i.id]) return;
      if (cureDomains[i.domainId] || i.age > SS.unresolvedLife) return;
      var base = flowImpact(i.id), stack = Math.min(R('flow.ignoreStackCap'), Math.pow(R('flow.ignoreStack'), i.age));
      FLOWS.forEach(function (f) { impactSum[f] += (base[f] || 0) * SS.impactScale * stack * 0.5; }); /* 殘留影響取一半：事件本季沒再出現 */
      newIssues.push({ id: i.id, sev: i.sev, age: i.age + 1, domainId: i.domainId });
    });
    newIssues = newIssues.filter(function (i) { return i.age <= SS.unresolvedLife + 1; });
    T.issues = newIssues;
    Object.keys(cureDomains).forEach(function (d) { T.ignoredStreak[d] = 0; });
    T.goodWord = T.goodWord.concat(goodWordNew.map(function (m) { return { left: R('flow.goodWordSeasons'), start: T.season + 1, mask: m }; }));

    /* 目標流量 */
    var happy = clamp(ctx.metrics && typeof ctx.metrics.happiness === 'number' ? ctx.metrics.happiness : R('start.happiness'), 0, 100);
    var rec = {}, gw = {}, pre = {}, target = {};
    FLOWS.forEach(function (f) { rec[f] = 0; gw[f] = 0; });
    Object.keys(T.recActive).forEach(function (pid) { var r = econ().cardRecurring.cards[pid]; if (r) FLOWS.forEach(function (f) { rec[f] += (+r[f] || 0); }); });
    FLOWS.forEach(function (f) { rec[f] = Math.min(SS.recCap, rec[f]); });
    T.goodWord.forEach(function (g) { if (g.start <= T.season && g.left > 0) FLOWS.forEach(function (f, k) { if (g.mask[k]) gw[f] += R('flow.goodWordBonus'); }); });
    FLOWS.forEach(function (f) { gw[f] = Math.min(SS.goodWordCap, gw[f]); pre[f] = R('flow.base') + impactSum[f] + rec[f] + gw[f]; });
    var dV = Math.max(0, R('flow.base') - pre.vehicle), dS = Math.max(0, R('flow.base') - pre.security);
    target.foot = pre.foot - R('flow.couplings.security->foot') * dS + R('flow.happinessToFoot') * (happy - R('start.happiness')) + T.boost.foot;
    target.vehicle = pre.vehicle;
    target.tourist = pre.tourist - R('flow.couplings.vehicle->tourist') * dV - R('flow.couplings.security->tourist') * dS - R('flow.couplings.trust->tourist') * trustShort + R('flow.reputationToTourist') * (T.reputation - R('start.reputation')) + T.boost.tourist;
    target.security = pre.security;
    var closed = T.shops.filter(function (x) { return x.state === 'closed'; }).length;
    target.foot += R('flow.closedShopPenalty.foot') * closed; target.tourist += R('flow.closedShopPenalty.tourist') * closed; target.security += R('flow.closedShopPenalty.security') * closed;
    T.boost = { tourist: 0, foot: 0 };
    var oldF = clone(T.flows);
    FLOWS.forEach(function (f) { var tg = clamp(target[f], R('flow.min'), R('flow.max')), rate = tg < T.flows[f] ? R('flow.rateDown') : R('flow.rateUp'); T.flows[f] = clamp(T.flows[f] + (tg - T.flows[f]) * rate, R('flow.min'), R('flow.max')); });
    Object.keys(T.recActive).forEach(function (pid) { T.recActive[pid].left--; if (T.recActive[pid].left <= 0) delete T.recActive[pid]; });
    T.goodWord.forEach(function (g) { if (g.start <= T.season) g.left--; });
    T.goodWord = T.goodWord.filter(function (g) { return g.left > 0; });

    /* 店家 */
    var repCoef = 1 + (T.reputation - 50) / SS.reputationRevenue, defs = {}; shopDefs().forEach(function (s) { defs[s.id] = s; });
    var worst = null, events = [];
    T.shops.forEach(function (x) {
      var def = defs[x.id], w = def.weights, wasState = x.state; x.justReopened = false;
      x.c = FLOWS.reduce(function (a, f) { return a + (w[f] || 0) * T.flows[f] / 100; }, 0);
      if (x.state === 'closed') return;
      var rev = x.c * (def.maxRevenue || R('shop.maxRevenue')) * repCoef, net = rev - (def.fixedCost || R('shop.fixedCost'));
      B.shopRevenue += rev; B.tax += rev * R('shop.taxRate');
      if (net > 0) x.health = Math.min(100, x.health + R('shop.healthUp')); else x.health -= R('shop.healthDown') + (-net) / 5;
      if (x.health <= R('shop.warnHealth')) { x.state = 'warning'; x.warnStreak++; } else { x.state = 'open'; x.warnStreak = 0; }
      if (x.warnStreak >= T.closeAfter || x.health <= 0) x.state = 'closed';
      if (x.state !== wasState && (x.state === 'warning' || x.state === 'closed')) events.push({ shop: x.id, name: x.name, state: x.state });
      if (!worst || x.c < worst.c) worst = x;
    });
    T.shops.forEach(function (x) { if (x.state === 'closed') x.c = FLOWS.reduce(function (a, f) { return a + (defs[x.id].weights[f] || 0) * T.flows[f] / 100; }, 0); });

    /* 補助、維運、機會與危機 */
    var inSub = T.season < T.subsidySeasons;
    if (inSub) { B.subsidyBase = R('income.subsidyBase'); if (handled > 0 || played.length > 0) B.subsidyPerf = R('income.subsidyPerformance'); }
    B.upkeep = -R('cost.upkeep');
    var oppNotes = [];
    var OE = econ().opportunityEvents || {};
    (OE.opportunities || []).forEach(function (o) {
      var tr = o.trigger || {}, roll = rk(); if (roll >= (tr.chancePerSeason || 0) * SS.oppChanceScale) return;
      if ((o.kind === 'award' || o.kind === 'sponsor') && T.reputation >= (tr.reputationMin || 0) && T.season + 1 >= (tr.seasonMin || 0)) { B.opportunity += o.effect.money; oppNotes.push({ kind: o.kind, name: o.name, amount: o.effect.money }); }
      else if (o.kind === 'tourism_festival' && T.flows.tourist >= (tr.touristMin || 0) && T.season + 1 >= (tr.seasonMin || 0)) { var okb = T.flows.vehicle >= 45 && T.flows.security >= 45; T.boost.tourist += okb ? (o.effect.flow && o.effect.flow.tourist) || R('opportunity.tourismFestivalBoost') : SS.tourismFailBoost; oppNotes.push({ kind: o.kind, name: o.name, amount: 0 }); }
    });
    (OE.crisisPrevention || []).forEach(function (c) {
      results.forEach(function (r) {
        if (c.eventIds.indexOf(r.eventId) < 0) return;
        if (SS.crisisMode === 1 && r.resolution === 'cured') return;
        var prevented = c.preventedByCardIds.some(function (x) { return ownedBefore[x]; }), full = Math.round(c.loss.full * (SS.crisisLossScale == null ? 1 : SS.crisisLossScale)), loss = prevented ? Math.round(full * (c.loss.preventedMult != null ? c.loss.preventedMult : 0.5)) : full;
        B.eventLoss += loss; if (prevented) B.preventSaved += (loss - full); oppNotes.push({ kind: 'crisis', name: c.name, amount: loss, prevented: prevented });
      });
    });
    if (T.loanDebt > 0) { var rp = Math.min(R('loan.repayPerSeason'), T.loanDebt); B.loanRepay = -rp; T.loanDebt -= rp; }

    var moneyBefore = ctx.baseMetrics && typeof ctx.baseMetrics.money === 'number' ? ctx.baseMetrics.money : 0;
    /* Stage I 分期尾款（G.Installment；policy.installment）：先扣到期尾款再算本季帳單；付不出（季初金錢 < 該期或已破產）→ 不扣、記 unpaid（commit 時套 onUnpaid） */
    var inst = G.Installment && G.Installment.duePreview ? G.Installment.duePreview(ctx, moneyBefore, !!T0.bankrupt) : null;
    B.installment = inst ? -inst.paidTotal : 0;
    var income = B.tax + B.subsidyBase + B.subsidyPerf + B.rewardCure + B.rewardMinor + B.opportunity;
    var outgo = B.penaltyBackfire + B.penaltyIgnored + B.eventLoss + B.upkeep + B.loanRepay - B.cardCost + B.installment;
    var net = Math.round(income + outgo);
    var moneyAfter = moneyBefore + net;
    if (moneyAfter < 0) { if (T.loans < R('loan.maxLoans')) { T.loans++; moneyAfter += R('loan.amount'); B.loanIn = R('loan.amount'); T.loanDebt += R('loan.amount'); } else if (!T.bankrupt) T.bankrupt = T.season + 1; }

    /* 評等、聲望、連擊 */
    var avg = FLOWS.reduce(function (a, f) { return a + T.flows[f]; }, 0) / 4, prevAvg = FLOWS.reduce(function (a, f) { return a + oldF[f]; }, 0) / 4;
    var cureRate = nEv ? (cured + 0.5 * (handled - cured)) / nEv : 0.5;
    var score = R('grade.weights.cureRate') * 100 * cureRate + R('grade.weights.flowChange') * clamp(50 + SS.gradeFlowMult * (avg - prevAvg), 0, 100) + R('grade.weights.profit') * clamp(50 + net / SS.gradeProfitDiv, 0, 100) + R('grade.weights.happiness') * happy;
    var g = score >= R('grade.thresholds.S') ? 'S' : score >= R('grade.thresholds.A') ? 'A' : score >= R('grade.thresholds.B') ? 'B' : score >= R('grade.thresholds.C') ? 'C' : 'D';
    T.grades[g] = (T.grades[g] || 0) + 1; T.reputation = clamp(T.reputation + R('grade.reputationDelta.' + g), 0, 100);
    var comboBefore = T.combo; T.combo = cured > 0 ? T.combo + 1 : 0;
    FLOWS.forEach(function (f) { T.trends[f] = trendOf(T.flows[f] - oldF[f]); });
    T.prevFlows = oldF; T.season++;
    var openN = T.shops.filter(function (x) { return x.state !== 'closed'; }).length;
    /* Stage G 無關卡：對本季所有進行中「非機會」事件都沒回應（無 cure／assist／palliative／backfire）的卡；只歸因、不退費 */
    var oppOf = function (eid) { var P = G.DATA.eventPool, hit = false; ((P && P.events) || []).forEach(function (e) { if (e.id === eid && e.polarity === 'opportunity') hit = true; }); return hit; };
    var nonOpp = results.filter(function (r) { return r.polarity ? r.polarity !== 'opportunity' : !oppOf(r.eventId); });
    var neutralIds = nonOpp.length ? played.filter(function (pid) { return nonOpp.every(function (r) { return (r.responses || []).every(function (x) { return x.policyId !== pid || x.effect === 'neutral' || x.effect === 'none'; }); }); }) : [];

    var bill = {
      season: T0.season + 1, seasonName: seasonName, grade: g, score: Math.round(score), combo: T.combo, comboBefore: comboBefore, comboMult: mult0,
      flows: {}, shopsOpen: openN, shopsTotal: T.shops.length, shopRevenue: Math.round(B.shopRevenue), taxRate: R('shop.taxRate'),
      parts: B, net: net, balanceBefore: moneyBefore, balanceAfter: moneyAfter, cards: played.slice(), events: events, opportunities: oppNotes,
      blame: bestBlame, boost: bestBoost, worstShop: worst ? { id: worst.id, name: worst.name, c: worst.c } : null, reputation: T.reputation, bankrupt: T.bankrupt,
      cured: cured, handled: handled, ignored: ignoredN, backfired: bad,
      installments: inst, /* Stage I：本季到期尾款 {paid:[], unpaid:[], paidTotal} */
      neutralCards: neutralIds, neutralCost: neutralIds.reduce(function (a, pid) { return a + cardCost(pid); }, 0) /* Stage G：對本季所有事件都 neutral 的卡（不退費，帳單另列） */
    };
    FLOWS.forEach(function (f) { bill.flows[f] = { value: Math.round(T.flows[f]), delta: Math.round(T.flows[f] - oldF[f]), trend: T.trends[f], arrow: ARROW[T.trends[f]], name: FLOW_NAME[f] }; });
    bill.rows = rowsOf(bill, played);
    return { bill: bill, next: T, moneyAfter: moneyAfter, avg: avg };
  }

  /* 帳單列（最多 6 行；每行 {kind, sign, label, amount, why}） */
  function reasonText(cat, vars, seed) {
    var br = econ().billReasons, c = br && br.categories && br.categories[cat], arr = c && c.lines || [];
    if (!arr.length) return '';
    var i = Math.abs((seed | 0)) % arr.length;
    return arr[i].replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
  }
  function names(ids) { return ids.map(function (p) { var o = policyOf(p); return (o && (o.titleShort || o.name)) || p; }); }
  function rowsOf(b, played) {
    var P = b.parts, rows = [], sd = b.season * 7;
    rows.push({ kind: 'tax', sign: 1, label: '店家稅收', amount: Math.round(P.tax), why: b.shopsOpen + ' 家店營收 ' + b.shopRevenue + '，稅率 ' + Math.round(b.taxRate * 100) + '%' });
    var sub = P.subsidyBase + P.subsidyPerf;
    if (sub) rows.push({ kind: 'subsidy', sign: 1, label: '里長補助', amount: sub, why: P.subsidyPerf ? '保底 ' + P.subsidyBase + ' ＋ 績效 ' + P.subsidyPerf : '保底補助，無條件入帳' });
    var rw = P.rewardCure + P.rewardMinor + P.opportunity;
    if (rw) rows.push({ kind: 'reward', sign: 1, label: P.opportunity && !P.rewardCure ? '機會獎勵' : '對症獎勵', amount: Math.round(rw), why: b.cured ? '對症 ' + b.cured + ' 件' + (b.comboMult > 1 ? '（連擊 ×' + Math.round((b.comboMult - 1) * 100) / 100 + '）' : '') : (b.handled ? '有處理 ' + b.handled + ' 件' : '') });
    var nIds = b.neutralCards || [], used = played.filter(function (p) { return nIds.indexOf(p) < 0; }), nCost = b.neutralCost || 0;
    if (used.length) rows.push({ kind: 'policy', sign: -1, label: '政策', amount: -(P.cardCost - nCost), why: names(used).join('、') });
    if (nIds.length) rows.push({ kind: 'neutral', sign: -1, label: '無關卡', amount: -nCost, why: (reasonText('irrelevantCard', { amount: nCost }, b.season + nIds.length) || ('無關卡花了 ' + nCost + ' 元')) + '：' + names(nIds).join('、') + '（不退費）' });
    var pen = P.penaltyBackfire + P.penaltyIgnored + P.eventLoss;
    if (pen) rows.push({ kind: 'penalty', sign: -1, label: P.eventLoss ? '災損／罰款' : '忽略罰款', amount: Math.round(pen), why: b.ignored ? '忽略 ' + b.ignored + ' 件' : (P.eventLoss ? '危機災損' : '') });
    var IS = b.installments;
    if (IS && IS.paid.length) rows.push({ kind: 'installment', sign: -1, label: IS.paid[0].name + '尾款', amount: -IS.paidTotal, why: IS.paid.map(function (x) { return x.label + ' ' + x.money; }).join('、') + '（合約共 ' + IS.paid[0].total + '）' });
    if (IS && IS.unpaid.length) rows.push({ kind: 'installment-unpaid', sign: -1, label: IS.unpaid[0].name + '尾款付不出', amount: 0, why: IS.unpaid[0].label + ' ' + IS.unpaid[0].money + ' 元付不出來 → ' + IS.unpaid[0].name + '罷工，剩餘尾款作廢' });
    rows.push({ kind: 'upkeep', sign: -1, label: '維運', amount: Math.round(P.upkeep + P.loanRepay), why: P.loanRepay ? '維運 ' + (-P.upkeep) + ' ＋ 還款 ' + (-P.loanRepay) : '公所日常維運' });
    return rows;
  }

  /* ---------------- 公開介面 ---------------- */
  function preview(ctx, played) {
    if (!enabled() || !ctx.town) return null;
    var r = compute(ctx, played);
    ctx.town.pending = { bill: r.bill, next: r.next, moneyAfter: r.moneyAfter, played: (played || []).slice() };
    return r.bill;
  }
  function commit(ctx) {
    var T = ctx && ctx.town; if (!T || !T.pending) return false;
    var p = T.pending, nx = p.next;
    nx.pending = null; nx.lastBill = p.bill;
    nx.history = (T.history || []).concat([{ season: p.bill.season, net: p.bill.net, grade: p.bill.grade, flows: clone(p.bill.flows), money: p.moneyAfter }]).slice(-40);
    ctx.town = nx; G.state && (G.state.town = nx);
    if (ctx.metrics) { ctx.metrics.money = p.moneyAfter; ctx.metrics.profit = p.bill.net; } /* 帳單淨利 = 本季金錢變動；profit 欄顯示本季淨利 */
    return true;
  }
  function bill(ctx) { var T = ctx && ctx.town; return T ? ((T.pending && T.pending.bill) || T.lastBill) : null; }
  function snapshot(ctx) {
    var T = ctx && ctx.town; if (!T) return null;
    return { flows: clone(T.flows), trends: clone(T.trends), reputation: T.reputation, combo: T.combo, openShops: T.shops.filter(function (s) { return s.state !== 'closed'; }).length, shops: T.shops.map(function (s) { return { id: s.id, state: s.state }; }), money: ctx.metrics && ctx.metrics.money, happiness: ctx.metrics && ctx.metrics.happiness };
  }
  /** 重新開張（API；P1 暫無按鈕）：條件客流指數 ≥ minCustomerIndex，花 points／money */
  function reopen(ctx, shopId) {
    var T = ctx.town; if (!T) return { ok: false, why: 'no-town' };
    var s = T.shops.filter(function (x) { return x.id === shopId; })[0];
    if (!s || s.state !== 'closed') return { ok: false, why: 'not-closed' };
    if (s.c < R('shop.reopen.minCustomerIndex')) return { ok: false, why: 'low-traffic' };
    if (ctx.metrics.points < R('shop.reopen.points') || ctx.metrics.money < R('shop.reopen.money')) return { ok: false, why: 'cost' };
    ctx.metrics.points -= R('shop.reopen.points'); ctx.metrics.money -= R('shop.reopen.money');
    s.state = 'open'; s.health = R('shop.reopen.health'); s.warnStreak = 0; s.justReopened = true; T.boost.foot += R('shop.reopen.footBoost');
    return { ok: true };
  }
  /** 街景密度（BALANCE §5.1；公式與 G.Density.fromFlows 同源） */
  function streetDensity(ctx, opts) {
    var T = ctx && ctx.town; if (!T || !G.Density || !G.Density.fromFlows) return null;
    var d = G.Density.fromFlows({ foot: T.flows.foot, vehicle: T.flows.vehicle, tourist: T.flows.tourist, security: T.flows.security }, opts || {}); /* 同時套用到街景 */
    d.vehicleSpeed = (R('street.vehicleSpeed.base') || 0.6) + (R('street.vehicleSpeed.slope') || 0.4) * T.flows.vehicle / (R('street.vehicleSpeed.divisor') || 100);
    return d;
  }
  /** HUD 用狀態（開局冷清／漸漸熱鬧） */
  function hudState(ctx) {
    var T = ctx && ctx.town; if (!T) return null;
    var avg = FLOWS.reduce(function (a, f) { return a + T.flows[f]; }, 0) / 4;
    var cold = avg < (R('hud.coldStartAvg') || 35), warm = !cold && avg - T.avgStart >= (R('hud.warmingUpGain') || 8) && avg < (R('hud.warmingUpMax') || 60);
    return { avg: avg, state: cold ? 'cold_start' : warm ? 'warming_up' : 'normal' };
  }

  /* ---------------- 街景泡泡 street 狀態 ---------------- */
  function activeDomains(ctx) {
    var out = {}, dr = ctx && ctx.pool && ctx.pool.dr; (dr && dr.events || []).forEach(function (e) { var d = e.domainId || (eventDef(e.eventId) || {}).domainId; if (d) out[d] = 1; }); return out;
  }
  /** appearWhen.street 條件判斷：{flow,lt,gte,gt,lte}｜{any:[…]}｜{all:[…]}｜{eventDomainActive:[…]}｜{shopState}｜{shopJustReopened} */
  function streetMatch(c, ctx) {
    if (!c) return true;
    var T = ctx && ctx.town; if (!T) return false;
    if (c.any) return c.any.some(function (x) { return streetMatch(x, ctx); });
    if (c.all) return c.all.every(function (x) { return streetMatch(x, ctx); });
    if (c.flow) { var v = T.flows[c.flow]; if (typeof v !== 'number') return false; return (c.lt == null || v < c.lt) && (c.lte == null || v <= c.lte) && (c.gt == null || v > c.gt) && (c.gte == null || v >= c.gte); }
    if (c.eventDomainActive) { var ad = activeDomains(ctx); return c.eventDomainActive.some(function (d) { return ad[d]; }); }
    if (c.shopState) return T.shops.some(function (s) { return s.state === c.shopState; });
    if (c.shopJustReopened) return T.shops.some(function (s) { return s.justReopened; }) || (T.lastBill && T.lastBill.events || []).some(function (e) { return e.state === 'open'; });
    return false;
  }
  /** npc 的 street 泡泡候選：G.DATA.npcExtraBubbles.entries 中 speakerNpcId 相同，且 appearWhen.street 成立（沒寫＝neutral 日常）。 */
  function streetLines(ctx, npcId) {
    var B = G.DATA && G.DATA.npcExtraBubbles, out = [];
    if (!B || !B.entries || !ctx || !ctx.town) return out;
    B.entries.forEach(function (e) {
      if (e.speakerNpcId !== npcId || !e.lines || !e.lines[0]) return;
      if (e.appearWhen && !streetMatch(e.appearWhen.street, ctx)) return;
      out.push(e);
    });
    /* 有特殊狀態（冷清／壅塞／治安／髒亂／店家）的句子優先；日常只在沒有特殊狀態時出現或偶爾補位 */
    var special = out.filter(function (e) { return e.street && e.street !== 'neutral'; });
    var neutral = out.filter(function (e) { return !e.street || e.street === 'neutral'; });
    if (special.length) return special.concat(Math.random() < 0.25 ? neutral : []);
    return neutral;
  }
  /** 目前街上狀態標籤（除錯／測試用）：['cold','jam',…] */
  function streetStates(ctx) {
    var B = G.DATA && G.DATA.npcExtraBubbles, out = {};
    if (!B || !ctx || !ctx.town) return [];
    (B.entries || []).forEach(function (e) { if (e.street && e.street !== 'neutral' && (!e.appearWhen || streetMatch(e.appearWhen.street, ctx))) out[e.street] = 1; });
    return Object.keys(out);
  }


  /* ---------------- 結報帳單 DOM（docs/BALANCE_FUN.md §5.3、§6.4；樣式 STUDIO BILL／FLOW 在 app.css） ---------------- */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sgn(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)); }
  var KIND_ICON = { tax: 'tax', subsidy: 'subsidy', reward: 'reward', policy: 'policy', neutral: 'policy', upkeep: 'upkeep', penalty: 'upkeep' };
  var CAT = { tax: 'flowIncome', subsidy: 'subsidyBase', reward: 'cureReward', policy: 'policyCost', upkeep: 'upkeep', penalty: 'ignorePenalty' };
  function flowChipsHtml(flows, shopsOpen, shopsTotal, id) {
    var h = FLOWS.map(function (f) { var v = flows[f]; return '<span class="flow-chip" data-key="' + f + '" data-trend="' + v.trend + '" title="' + FLOW_NAME[f] + ' ' + v.value + '"><span class="flow-chip__val">' + v.value + '</span></span>'; }).join('');
    if (shopsTotal) h += '<span class="flow-chip" data-key="shop" data-trend="flat" title="營業店家"><span class="flow-chip__val">' + shopsOpen + '/' + shopsTotal + '</span></span>';
    return h;
  }
  function blameText(ctx, b) {
    var T = ctx.town, br = econ().billReasons, bl = b.blame, bo = b.boost;
    if (!br) return '';
    var defs = {}; shopDefs().forEach(function (s) { defs[s.id] = s; });
    function pick(entry, tpls) {
      var best = null; T.shops.forEach(function (s) { if (s.state === 'closed') return; var w = (defs[s.id].weights[entry.flow] || 0); if (!best || w > best.w) best = { s: s, w: w }; });
      var lost = best ? best.w * entry.n / 100 : 0, p = best ? clamp(Math.round(100 * lost / Math.max(0.01, best.s.c + lost)), 1, 90) : 0; /* 損失的客流佔「原本客流」的比例 */
      var t = tpls[(b.season * 3) % tpls.length];
      return t.replace(/\{(\w+)\}/g, function (_, k) { return { event: String(entry.title || '').slice(0, 6), flow: FLOW_NAME[entry.flow], n: entry.n, shop: best ? best.s.name : '店家', p: p, card: entry.card ? names([entry.card])[0] : '政策' }[k]; });
    }
    if (bl && bl.n >= 2) return '最大拖累：' + pick(bl, br.blame.templates);
    if (bo && bo.n >= 2) return '最大助力：' + pick(bo, br.boost.templates);
    return '';
  }
  function billHtml(ctx, b) {
    b = b || bill(ctx); if (!b) return '';
    var stars = Math.max(0, Math.min(5, Math.round(b.reputation / 20))), st = '';
    for (var i = 0; i < 5; i++) st += '<span class="bill-star' + (i < stars ? '' : ' is-off') + '"></span>';
    var gradeLine = (econ().grades && econ().grades.grades && econ().grades.grades[b.grade]) || [];
    var rows = b.rows.map(function (r) {
      var pos = r.amount >= 0, cat = CAT[r.kind], detail = reasonText(cat, { n: Math.abs(Math.round(r.amount)), shop: b.worstShop ? b.worstShop.name : '', flow: '人流', card: names(b.cards)[0] || '', event: '' }, b.season + r.kind.length);
      return '<li><button type="button" class="bill-row ' + (pos ? 'is-pos' : 'is-neg') + '" data-kind="' + (KIND_ICON[r.kind] || r.kind) + '" data-line="' + r.kind + '" aria-expanded="false">' +
        '<span class="bill-row__label">' + esc(r.label) + '</span><span class="bill-row__amount">' + sgn(r.amount) + '</span><span class="bill-row__why">' + esc(r.why) + '</span>' +
        '<span class="bill-row__detail" hidden>' + esc(detail || r.why) + '</span></button></li>';
    }).join('');
    var sum = 0; b.rows.forEach(function (r) { sum += r.amount; });
    var comboTxt = b.combo >= 2 ? '連擊 ×' + b.combo : '';
    return '<section id="bill-card" aria-label="本季帳單" data-season="' + b.season + '">' +
      '<h3 class="bill-title"><span>本季帳單</span><span>第 ' + b.season + ' 季</span></h3>' +
      '<header class="bill-head"><span id="bill-grade" data-grade="' + b.grade + '"><span class="bill-grade__txt">評等 ' + b.grade + '</span></span>' +
      '<span id="bill-combo"' + (comboTxt ? '' : ' hidden class="is-off"') + '>' + esc(comboTxt) + '</span><span class="bill-stars" title="市長聲望 ' + b.reputation + '">' + st + '</span></header>' +
      (gradeLine.length ? '<p class="bill-grade-line" id="bill-grade-line">' + esc(gradeLine[(b.season * 5) % gradeLine.length]) + '</p>' : '') +
      '<div id="bill-flows" class="bill-flows">' + flowChipsHtml(b.flows, b.shopsOpen, b.shopsTotal) + '</div>' +
      '<div id="bill-net" class="' + (b.net >= 0 ? 'is-pos' : 'is-neg') + '" data-net="' + b.net + '"><span class="bill-net__label">本季淨利</span><span class="bill-net__amount">' + sgn(b.net) + '</span><span class="bill-net__bal">餘額 ' + Math.round(b.balanceBefore) + ' → ' + Math.round(b.balanceAfter) + '</span></div>' +
      '<p id="bill-blame" class="bill-blame">' + esc(blameText(ctx, b)) + '</p>' +
      '<ul class="bill-rows">' + rows + '</ul>' +
      (b.events.length ? '<p class="bill-shopmsg" id="bill-shopmsg">' + b.events.map(function (e) { return esc(e.name + (e.state === 'closed' ? ' 歇業了' : ' 快撐不住')); }).join('；') + '</p>' : '') + '</section>';
  }
  /** 點列展開／收合原因（結報 modal 建好後呼叫一次） */
  function bindBill(root) {
    var rows = root.querySelectorAll('#bill-card .bill-row');
    for (var i = 0; i < rows.length; i++) rows[i].addEventListener('click', function () {
      var on = this.classList.toggle('is-open'); this.setAttribute('aria-expanded', on ? 'true' : 'false');
      var d = this.querySelector('.bill-row__detail'); if (d) d.hidden = !on;
    });
  }
  /** HUD 流量晶片（#hud-flow、#hud-shops）；container 為 #hud-metrics。與帳單同一份 ctx.town */
  function renderHud(ctx, container) {
    var T = ctx && ctx.town; if (!T || !container) return;
    var el = container.querySelector('#hud-flow');
    if (!el) { el = document.createElement('div'); el.id = 'hud-flow'; el.className = 'hud-flow'; el.setAttribute('aria-label', '貓貓市流量'); container.appendChild(el); }
    var openN = T.shops.filter(function (s) { return s.state !== 'closed'; }).length, fl = {};
    FLOWS.forEach(function (f) { fl[f] = { value: Math.round(T.flows[f]), trend: T.trends[f] }; });
    el.innerHTML = flowChipsHtml(fl, openN, T.shops.length);
    var hs = container.querySelector('#hud-shops'); if (hs) hs.textContent = openN + '/' + T.shops.length;
  }
  /** 日常金錢：棄用舊事件的隨機金額（無收入來源的根因），只留這季打出的卡片費用；幸福度夾 0–100 */
  function adjustSim(ctx, next, policies) {
    if (!ctx.town || !next || !next.metrics) return next;
    var base = ctx.baseMetrics && typeof ctx.baseMetrics.money === 'number' ? ctx.baseMetrics.money : next.metrics.money, sum = 0;
    (policies || []).forEach(function (pid) { var p = policyOf(pid); if (p && p.deltas && p.deltas.money) sum += p.deltas.money; });
    next.metrics.money = base + sum;
    next.metrics.happiness = clamp(next.metrics.happiness, 0, 100);
    if (next.lastDeltas) { next.lastDeltas.money = sum; next.lastDeltas.happiness = next.metrics.happiness - (ctx.baseMetrics ? ctx.baseMetrics.happiness : next.metrics.happiness); }
    return next;
  }

  G.Economy = { enabled: enabled, init: init, preview: preview, commit: commit, bill: bill, snapshot: snapshot, reopen: reopen, streetDensity: streetDensity, hudState: hudState, streetMatch: streetMatch, streetLines: streetLines, streetStates: streetStates, billHtml: billHtml, bindBill: bindBill, renderHud: renderHud, adjustSim: adjustSim, rules: rules, ARROW: ARROW, FLOW_NAME: FLOW_NAME, ready: true };
})(typeof window !== 'undefined' ? window : globalThis);
