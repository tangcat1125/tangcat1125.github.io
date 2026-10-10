/**
 * mayor_anan.js — Stage I 街上 NPC「安安市長」（G.MayorAnan）。
 *  資料：G.DATA.mayorAnanQA（呆呆 data/dialogue/mayor_anan_qa.json：names／npc／selection／correctRule／idle／topics[{match,qa[],interviews[]}]）。
 *  美術：米米 assets/sprites/npc/mayor_anan/＋app.css「STUDIO MAYOR ANAN」。
 *  DOM：#npc-layer > button.mayor-anan[data-dir=right|left] > div.npc-mayor-anan.npc-mayor-anan--walk|--interview|--idle
 *       外層不用 scaleX 鏡像，只設 data-dir（CSS 換 _left 圖）→ 不會雙重翻轉。外層不是 .npc（不吃 game.css 偽精靈、不被密度／泡泡管理器挑到）。
 *       命中區 ≥48px、pointer-events:auto、可 Tab 聚焦、Enter／Space 觸發。
 *  行為：每季 seasonStart 擲 npc.spawn.chancePerSeason（?mayor=1 必出）；沿 NPC 地平線閒逛；每 idleEverySec 秒自言自語泡泡；
 *       每 interview.cooldownSec 秒（?mayorInterval=秒 覆寫，且必訪問）以 chancePerWalk 走向在場路人 askerNpcId → 路人停下面向市長 → 泡泡 問→答→反應。
 *       點擊 → .mayor-qa-dialog（問句依本季事件／最高民怨領域選主題；答對規則見 correctRule）；點擊次數寫 G.BehaviorLog（mayorAnan.clicks）與 ctx.anan.tapCount。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var npcs = null, world = null, getCtx = null, el = null, sprite = null, dlg = null;
  var me = { on: false, x: 300, dir: 1, mode: 'walk', idleT: 6, ivT: 8, pauseT: 0, target: null, iv: null, bubbles: [], lastTapAt: 0, lastQa: null, usedQa: {} };
  function qs(n) { try { return new URLSearchParams(global.location.search).get(n); } catch (e) { return null; } }
  function $(id) { return global.document.getElementById(id); }
  function Q() { return (G.DATA && G.DATA.mayorAnanQA) || null; }
  function NPC() { var q = Q(); return (q && q.npc) || {}; }
  function names() { var q = Q(); return (q && q.names) || { mayorName: '安安市長', mayorNick: '安安' }; }
  function fill(s) { var N = names(); return String(s || '').replace(/\{mayorName\}/g, N.mayorName).replace(/\{mayorNick\}/g, N.mayorNick); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pick(a, r) { return a && a.length ? a[Math.floor((r != null ? r : Math.random()) * a.length) % a.length] : null; }
  function cycleOf(ctx) { return (ctx.monthIndex || 0) + 1; }
  function A(ctx) { ctx.anan = ctx.anan || { lastCorrectCycle: null, tapCount: 0, correctThisSeason: 0, seasonCycle: null }; return ctx.anan; }
  function streetW() { return (world && world.getStreetWidth && world.getStreetWidth()) || 2400; }

  function build() {
    var layer = $('npc-layer'); if (!layer || el) return;
    el = global.document.createElement('button');
    el.type = 'button'; el.className = 'mayor-anan'; el.id = 'mayor-anan'; el.dataset.id = 'mayor_anan'; el.dataset.dir = 'right';
    el.setAttribute('aria-label', names().mayorName + '（點我問問題）'); el.hidden = true;
    el.innerHTML = '<div class="npc-mayor-anan npc-mayor-anan--walk"></div><span class="mayor-anan__label">' + esc(names().mayorName) + '</span>';
    sprite = el.firstChild;
    el.addEventListener('click', function (ev) { ev.stopPropagation(); tap(); });
    layer.appendChild(el);
    dlg = global.document.createElement('div');
    dlg.className = 'mayor-qa-dialog'; dlg.id = 'mayor-qa-dialog'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'false'); dlg.setAttribute('aria-labelledby', 'mayor-qa-q'); dlg.hidden = true; dlg.tabIndex = -1;
    dlg.innerHTML = '<img class="mayor-qa__avatar" src="assets/sprites/npc/mayor_anan/mayor_anan_avatar.webp" alt="' + esc(names().mayorName) + '">' +
      '<div class="mayor-qa__body"><p class="mayor-qa__q" id="mayor-qa-q"></p><p class="mayor-qa__a"></p><span class="mayor-qa__fx"></span><p class="mayor-qa__tag"></p></div>' +
      '<button class="mayor-qa__close" type="button" aria-label="關閉"></button>';
    dlg.querySelector('.mayor-qa__close').addEventListener('click', close);
    dlg.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
    global.document.body.appendChild(dlg);
  }
  function setMode(m) {
    if (!sprite || me.mode === m) return; me.mode = m;
    sprite.className = 'npc-mayor-anan npc-mayor-anan--' + m;
  }
  function render() {
    if (!el) return;
    el.style.left = Math.round(me.x) + 'px';
    el.dataset.dir = me.dir < 0 ? 'left' : 'right';
    me.bubbles.forEach(function (b) { b.el.style.left = Math.round(b.x()) + 'px'; });
  }

  /* ---------- 主題與答句 ---------- */
  var TIE = ['stray_dog', 'rat', 'food_safety'];
  function evTags(eid) { var P = G.DATA.eventPool, ev = P && (P.events || []).filter(function (e) { return e.id === eid; })[0]; return (ev && (ev.topicTags || ev.tags)) || []; }
  function cval(ctx, d) { var v = ctx.complaints && ctx.complaints.values; return v && typeof v[d] === 'number' ? v[d] : 0; }
  function topicMatchesEvent(t, eid) { var m = t.match || {}; if ((m.eventIds || []).indexOf(eid) >= 0) return true; var tg = evTags(eid); return (m.topicTags || []).some(function (x) { return tg.indexOf(x) >= 0; }); }
  function chooseTopic(ctx, r) {
    var q = Q(); if (!q) return null; var T = q.topics || [];
    var evs = ((ctx.pool && ctx.pool.dr && ctx.pool.dr.events) || []).map(function (e) { return e.eventId; });
    var hit = T.filter(function (t) { return evs.some(function (eid) { return topicMatchesEvent(t, eid); }); });
    if (hit.length) {
      hit.sort(function (a, b) { var d = cval(ctx, b.match.gameDomain) - cval(ctx, a.match.gameDomain); if (d) return d; var ia = TIE.indexOf(a.id), ib = TIE.indexOf(b.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      return { topic: hit[0], why: 'event' };
    }
    var v = (ctx.complaints && ctx.complaints.values) || {}, top = null;
    Object.keys(v).forEach(function (d) { if (top == null || v[d] > v[top]) top = d; });
    if (top) {
      var byDom = T.filter(function (t) { return (t.match.domains || []).indexOf(top) >= 0; })[0];
      if (!byDom && top === 'health') byDom = T.filter(function (t) { return t.id === 'food_safety'; })[0];
      if (byDom) return { topic: byDom, why: 'complaint', domain: top };
    }
    return { topic: pick(T, r), why: 'random' };
  }
  function correctOk(ctx, topic) {
    var q = Q(), CR = (q && q.correctRule) || {}, a = A(ctx), cyc = cycleOf(ctx);
    if (cval(ctx, topic.match.gameDomain) >= 35) return false;
    if (a.correctSeason === cyc && (a.correctThisSeason || 0) >= (CR.maxPerSeason || 1)) return false;
    if (a.lastCorrectCycle != null && a.lastCorrectCycle !== cyc && cyc - a.lastCorrectCycle <= (CR.cooldownSeasons || 1)) return false;
    var evs = ((ctx.pool && ctx.pool.dr && ctx.pool.dr.events) || []).map(function (e) { return e.eventId; }).filter(function (eid) { return topicMatchesEvent(topic, eid); });
    if (!evs.length) return true;
    var lg = ctx.poolState && ctx.poolState.log, last = lg && lg[lg.length - 1];
    var res = (last && last.cycle === cyc && last.results) || [];
    return evs.every(function (eid) { return res.indexOf(eid + ':cured') >= 0; });
  }
  function rng(ctx, salt) {
    if (G.EventPool && G.EventPool.rngFor && ctx.poolState) return G.EventPool.rngFor(ctx.poolState.seed, cycleOf(ctx), 'anan:' + salt);
    return Math.random;
  }
  function pickQa(ctx, topic, r) {
    var q = Q(), CR = (q && q.correctRule) || {}, ok = correctOk(ctx, topic), want = ok && r() < (CR.chance != null ? CR.chance : 0.2) ? 'correct' : 'miss';
    var used = me.usedQa[cycleOf(ctx)] = me.usedQa[cycleOf(ctx)] || {};
    var pool = (topic.qa || []).filter(function (x) { return x.kind === want; });
    if (!pool.length) pool = (topic.qa || []).filter(function (x) { return x.kind === 'miss'; });
    var fresh = pool.filter(function (x) { return !used[x.id]; }); if (fresh.length) pool = fresh;
    var it = pick(pool, r()); if (!it) return null;
    used[it.id] = 1;
    if (it.kind === 'correct') { var a = A(ctx), cyc = cycleOf(ctx); if (a.correctSeason !== cyc) { a.correctSeason = cyc; a.correctThisSeason = 0; } a.correctThisSeason++; a.lastCorrectCycle = cyc; }
    return it;
  }

  /* ---------- 點擊問答 ---------- */
  function tap() {
    var ctx = getCtx && getCtx(); if (!ctx || !dlg) return;
    var a = A(ctx); a.tapCount++;
    var cd = ((NPC().tap || {}).cooldownSec || 15) * 1000, now = Date.now(), chosen;
    if (me.lastQa && now - me.lastTapAt < cd) chosen = me.lastQa; /* 冷卻中：同一題再開一次 */
    else {
      var r = rng(ctx, 'tap' + a.tapCount), ct = chooseTopic(ctx, r()); if (!ct) return;
      var it = pickQa(ctx, ct.topic, r); if (!it) return;
      chosen = { topic: ct.topic.id, label: ct.topic.label, why: ct.why, qa: it }; me.lastQa = chosen; me.lastTapAt = now;
    }
    var it2 = chosen.qa, N = names();
    dlg.querySelector('.mayor-qa__q').innerHTML = '<span class="mayor-qa__who">你</span>' + esc(fill(it2.q));
    dlg.querySelector('.mayor-qa__a').innerHTML = '<span class="mayor-qa__who">' + esc(N.mayorName) + '</span>' + esc(fill(it2.a));
    var fx = dlg.querySelector('.mayor-qa__fx'); fx.textContent = it2.kind === 'correct' ? '！' : ''; fx.hidden = false;
    dlg.querySelector('.mayor-qa__tag').textContent = it2.kind === 'correct' ? '難得答對了！' : '答非所問…';
    dlg.dataset.topic = chosen.topic; dlg.dataset.kind = it2.kind; dlg.dataset.qaId = it2.id; dlg.dataset.why = chosen.why;
    dlg.hidden = false;
    try { dlg.querySelector('.mayor-qa__close').focus({ preventScroll: true }); } catch (e) {}
    if (G.BehaviorLog && G.BehaviorLog.mayorClick) G.BehaviorLog.mayorClick(ctx, { topic: chosen.topic, kind: it2.kind, qaId: it2.id });
  }
  function close() { if (!dlg || dlg.hidden) return; dlg.hidden = true; try { if (el && !el.hidden) el.focus({ preventScroll: true }); } catch (e) {} }

  /* ---------- 泡泡 ---------- */
  function bubble(text, xFn, cls, ms) {
    var layer = $('npc-layer'); if (!layer || !text) return null;
    var b = global.document.createElement('div');
    b.className = 'anan-bubble ' + (cls || ''); b.setAttribute('role', 'status'); b.textContent = fill(text);
    layer.appendChild(b);
    var rec = { el: b, x: xFn }; me.bubbles.push(rec); render();
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); me.bubbles = me.bubbles.filter(function (x) { return x !== rec; }); }, ms || 2600);
    return b;
  }
  function selfX() { return me.x + 30; }
  function idleSay() { var q = Q(); var it = q && pick(q.idle || []); if (it) bubble(it.text, selfX, 'anan-bubble--mayor anan-bubble--idle', 3000); }

  /* ---------- 訪問路人 ---------- */
  function findTarget(ctx) {
    var vis = (npcs && npcs.getVisibleList ? npcs.getVisibleList() : []).filter(function (n) { return !n.el.querySelector('.npc-bubble'); });
    if (!vis.length) return null;
    var r = rng(ctx, 'iv' + Date.now()), ct = chooseTopic(ctx, r()); if (!ct) return null;
    var ok = correctOk(ctx, ct.topic);
    var ivs = (ct.topic.interviews || []).filter(function (iv) { return (iv.kind !== 'correct' || ok) && vis.some(function (n) { return n.id === iv.askerNpcId; }); });
    if (!ivs.length) { /* 主題沒有在場路人 → 換其他主題 */
      (Q().topics || []).some(function (t) { ivs = (t.interviews || []).filter(function (iv) { return iv.kind !== 'correct' && vis.some(function (n) { return n.id === iv.askerNpcId; }); }); if (ivs.length) { ct = { topic: t }; return true; } return false; });
    }
    var iv = pick(ivs, r()); if (!iv) return null;
    return { npc: vis.filter(function (n) { return n.id === iv.askerNpcId; })[0], iv: iv, topic: ct.topic.id };
  }
  function startInterview(t) {
    var n = t.npc; me.target = t; me.mode = me.mode; setMode('interview');
    me.dir = n.x > me.x ? 1 : -1;
    n.pause = 9; n.dir = me.x > n.x ? 1 : -1; n.el.classList.add('is-interviewed');
    var nX = function () { return n.x + 10; };
    bubble(t.iv.q, nX, 'anan-bubble--asker', 2600);
    setTimeout(function () { bubble(t.iv.a, selfX, 'anan-bubble--mayor', 2800); }, 2600);
    setTimeout(function () { var R = t.iv.reaction || {}; bubble((R.typeLabel ? R.typeLabel + '：' : '') + (R.text || ''), nX, 'anan-bubble--asker anan-bubble--reaction is-' + (R.type || 'stunned'), 2600); }, 5400);
    me.pauseT = 8.2; me.ivCount = (me.ivCount || 0) + 1;
    el.dataset.interviews = String(me.ivCount); el.dataset.lastInterview = t.iv.id;
    setTimeout(function () { n.el.classList.remove('is-interviewed'); if (n.pause > 1) n.pause = 0.4; }, 8200);
  }

  function tick(dt) {
    if (!me.on || !el) return;
    var sec = dt / 1000, ctx = getCtx && getCtx(), N = NPC(), sp = N.spawn || {}, IV = N.interview || {};
    var W = streetW(), minX = 60, maxX = W - 140;
    if (me.pauseT > 0) { me.pauseT -= sec; if (me.pauseT <= 0) { me.target = null; setMode('walk'); } render(); return; }
    if (me.target) { /* 走向受訪者 */
      var n = me.target.npc, gap = n.x - me.x;
      if (n.offstage) { me.target = null; }
      else if (Math.abs(gap) < 90) { startInterview(me.target); render(); return; }
      else { me.dir = gap > 0 ? 1 : -1; n.pause = Math.max(n.pause, 0.5); }
    }
    me.x += me.dir * (sp.walkSpeed || 0.5) * 90 * sec * (me.target ? 2.2 : 1);
    if (me.x > maxX) { me.x = maxX; me.dir = -1; }
    if (me.x < minX) { me.x = minX; me.dir = 1; }
    me.idleT -= sec;
    if (me.idleT <= 0) { me.idleT = +qs('mayorIdle') || sp.idleEverySec || 12; if (!me.target) idleSay(); }
    me.ivT -= sec;
    if (me.ivT <= 0 && !me.target && ctx) {
      var forced = +qs('mayorInterval');
      me.ivT = forced || IV.cooldownSec || 40;
      if (forced || Math.random() < (IV.chancePerWalk || 0.3)) me.target = findTarget(ctx);
    }
    render();
  }

  function show(on) {
    if (!el) return; me.on = !!on; el.hidden = !on;
    if (on) { var cam = world ? world.camX || 0 : 0, vw = world ? world.width : 1280; me.x = Math.round(cam + vw * 0.35); me.ivT = +qs('mayorInterval') || 8; me.idleT = 4; setMode('walk'); render(); }
  }
  function seasonStart(ctx) {
    build(); if (!Q()) return false;
    var force = qs('mayor') === '1', ch = (NPC().spawn || {}).chancePerSeason; if (ch == null) ch = 0.6;
    var on = force || rng(ctx, 'spawn')() < ch;
    show(on); if (el) el.dataset.season = String(cycleOf(ctx));
    return on;
  }

  G.MayorAnan = {
    attach: function (o) { o = o || {}; npcs = o.npcs || npcs; world = o.world || world; getCtx = o.getCtx || getCtx; build(); },
    seasonStart: seasonStart, tick: tick, tap: tap, close: close, show: show,
    state: function () { return { on: me.on, x: me.x, dir: me.dir, mode: me.mode, target: me.target ? me.target.iv.id : null, interviews: me.ivCount || 0, bubbles: me.bubbles.length }; },
    _chooseTopic: chooseTopic, ready: true
  };
})(window);
