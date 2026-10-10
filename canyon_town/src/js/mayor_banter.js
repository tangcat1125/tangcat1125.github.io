/**
 * mayor_banter.js — 居民嗆市長／讚賞泡泡（docs/MAYOR_BANTER.md §3–4）。
 * 資料：G.DATA.mayorBanter（data/dialogue/mayor_banter_season_01.json）。只讀 ctx，不寫任何狀態。
 * G.MayorBanter：
 *   stateOf(ctx, domainId) → 'furious' | 'grumble' | 'praise' | null
 *   states(ctx)            → { domainId: state }（六領域；null 的不列）
 *   plan(ctx, n, rng, opt) → [{ entry, domainId, state }]  街景泡泡排程用（furious／praise 交錯，grumble 補位；同一句不重複）
 *   pick(ctx, npcId, opt)  → entry | null                  閒逛泡泡（dialogue.js）用：只回傳 speakerNpcId === npcId 的句子
 * 民怨欄位（complaint.js）：ctx.complaints.values[domain]、ctx.complaints.lastDelta[domain]（上次 commit 的變化）。
 * 事件結果：結報預覽 ctx.pool.preview.results；否則取上一季 ctx.poolState.history（cycle = 本季 − 1）。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};

  function data() { return G.DATA && G.DATA.mayorBanter; }
  function domains() {
    var C = G.DATA && G.DATA.complaints;
    return ((C && C.domains) || []).map(function (d) { return d.id; });
  }
  function tierId(v) {
    try { return G.Complaint.tierOf(v).id; } catch (e) { return v >= 75 ? 'furious' : v >= 50 ? 'upset' : v >= 25 ? 'grumble' : 'calm'; }
  }
  function domainOfEvent(eid) {
    var P = G.DATA && G.DATA.eventPool, e = P && P.events && P.events.filter(function (x) { return x.id === eid; })[0];
    return e && e.domainId;
  }
  /** 該領域本季／上季的事件結果（resolution 陣列） */
  function resolutionsOf(ctx, dom) {
    var out = [];
    var pv = ctx.pool && ctx.pool.preview && ctx.pool.preview.results;
    if (pv) {
      pv.forEach(function (r) { if (r.domainId === dom) out.push(r.resolution); });
      return out;
    }
    var ps = ctx.poolState;
    if (ps && ps.history && ps.history.length) {
      var last = (ps.cycle || 0) - 1;
      ps.history.forEach(function (h) { if (h.cycle === last && domainOfEvent(h.eventId) === dom && h.resolution) out.push(h.resolution); });
    }
    return out;
  }

  var TIER_RANK = { calm: 0, grumble: 1, upset: 2, furious: 3 };
  /** 民怨變好？降幅 ≥ |praiseDeltaMax|，或層級往低走（含降到平靜）。d 為上次 commit 的變化（負＝變好）。 */
  function relief(v, d, TH) {
    if (typeof d !== 'number' || d >= 0) return false;
    var max = typeof (TH || {}).praiseDeltaMax === 'number' ? TH.praiseDeltaMax : -8;
    if (d <= max) return true;
    var now = TIER_RANK[tierId(v)], prev = TIER_RANK[tierId(v - d)];
    return now < prev;
  }

  function stateOf(ctx, dom) {
    var B = data(); if (!B || !ctx || !ctx.complaints || !ctx.complaints.values) return null;
    var TH = B.thresholds || {};
    var v = ctx.complaints.values[dom]; if (typeof v !== 'number') return null;
    var t = tierId(v), d = (ctx.complaints.lastDelta && ctx.complaints.lastDelta[dom]) || 0;
    var rs = resolutionsOf(ctx, dom);
    var bad = rs.some(function (x) { return x === 'ignored' || x === 'backfired'; });
    var soso = bad || rs.indexOf('palliative') >= 0;
    var good = rs.some(function (x) { return x === 'cured' || x === 'assisted'; });
    var improved = relief(v, d, TH);
    if (t === 'furious' || (t === 'upset' && bad)) return 'furious';
    if (improved && !bad) return 'praise'; /* 民怨降幅大／降到更低等級（含降到「平靜」）→ 轉成滿意：優先於碎念 */
    if (t === 'upset' || (t === 'grumble' && soso)) return 'grumble';
    if (good) return 'praise';
    return null;
  }

  function states(ctx) {
    var out = {};
    domains().forEach(function (d) { var s = stateOf(ctx, d); if (s) out[d] = s; });
    return out;
  }

  function weighted(list, rng) {
    if (!list.length) return null;
    var total = list.reduce(function (s, e) { return s + (e.weight || 1); }, 0), x = rng() * total;
    for (var i = 0; i < list.length; i++) { x -= (list[i].weight || 1); if (x <= 0) return list[i]; }
    return list[list.length - 1];
  }

  function plan(ctx, n, rng, opt) {
    var B = data(); rng = rng || Math.random; opt = opt || {};
    if (!B || !n) return [];
    var st = states(ctx), vals = (ctx.complaints && ctx.complaints.values) || {};
    var by = { furious: [], praise: [], grumble: [] };
    Object.keys(st).forEach(function (d) { by[st[d]].push(d); });
    ['furious', 'praise', 'grumble'].forEach(function (k) { by[k].sort(function (a, b) { return (vals[b] || 0) - (vals[a] || 0); }); });
    var order = ['furious', 'praise', 'grumble'].filter(function (k) { return by[k].length; });
    if (!order.length) return [];
    var used = {}, out = [], cursor = { furious: 0, praise: 0, grumble: 0 }, guard = 0;
    var allowed = opt.speakerIds; /* 街上有的居民 id；缺省＝不限制 */
    for (var i = 0; out.length < n && guard++ < 40; i++) {
      var k = order[i % order.length], doms = by[k], dom = doms[cursor[k]++ % doms.length];
      var pool = (B.entries || []).filter(function (e) {
        return e.state === k && (e.domainId === dom || e.domainId === 'any') && !used[e.id] && e.lines && e.lines[0] &&
          (!allowed || allowed.indexOf(e.speakerNpcId) >= 0);
      });
      var e = weighted(pool, rng);
      if (!e) continue;
      used[e.id] = 1; out.push({ entry: e, domainId: dom, state: k });
    }
    return out;
  }

  function pick(ctx, npcId, opt) {
    var B = data(); if (!B || !ctx) return null;
    var st = states(ctx), rng = (opt && opt.rng) || Math.random;
    var doms = Object.keys(st); if (!doms.length) return null;
    if (rng() > (typeof (B.thresholds || {}).mayorBubbleChance === 'number' ? B.thresholds.mayorBubbleChance : 0.6)) return null;
    var pool = (B.entries || []).filter(function (e) {
      return e.speakerNpcId === npcId && e.lines && e.lines[0] && doms.some(function (d) { return st[d] === e.state && (e.domainId === d || e.domainId === 'any'); });
    });
    return weighted(pool, rng);
  }


  /** 滿意度快照（與 HUD 同一份來源：ctx.metrics.happiness、ctx.complaints）。純讀取。
   *  { happiness, domains:{ id:{ value, delta, tier, prevTier, relief, state } }, reliefDomains:[...], calmDomains:[...], satisfied:boolean } */
  function satisfaction(ctx) {
    var out = { happiness: ctx && ctx.metrics ? ctx.metrics.happiness : null, domains: {}, reliefDomains: [], calmDomains: [], satisfied: false };
    var B = data(), TH = (B && B.thresholds) || {};
    if (!ctx || !ctx.complaints || !ctx.complaints.values) return out;
    domains().forEach(function (dom) {
      var v = ctx.complaints.values[dom]; if (typeof v !== 'number') return;
      var d = (ctx.complaints.lastDelta && ctx.complaints.lastDelta[dom]) || 0;
      var rel = relief(v, d, TH), st = stateOf(ctx, dom);
      out.domains[dom] = { value: v, delta: d, tier: tierId(v), prevTier: tierId(v - d), relief: rel, state: st };
      if (rel) out.reliefDomains.push(dom);
      if (tierId(v) === 'calm') out.calmDomains.push(dom);
    });
    out.satisfied = out.reliefDomains.length > 0;
    return out;
  }

  G.getSatisfaction = function () { return satisfaction(G.state && G.state.ctx); };
  G.MayorBanter = { stateOf: stateOf, satisfaction: satisfaction, states: states, plan: plan, pick: pick, ready: true };
})(window);
