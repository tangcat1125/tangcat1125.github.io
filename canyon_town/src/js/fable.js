/**
 * fable.js — Stage I 童話彩蛋播放引擎（G.Fable）。
 *  美術／CSS：米米 app.css「STUDIO FABLE PARADE」＋ assets/sprites/fable/（docs/ART.md 2026-10-10）。
 *  DOM：div.parade.parade--pied-piper｜.parade--red-hood[data-dir=right|left]，插入 #npc-layer（z-index 5＝NPC 層，pointer-events:none 不擋點擊）；
 *       容器 animationend（e.target===el）後移除；另有保險計時器（--parade-dur＋2s）確保 DOM 一定會被移除。
 *  為了在畫面內看得到：容器 left＝目前鏡頭 camX、--parade-span＝視窗寬（只橫越目前畫面），--parade-dur 依資料 durationMs（?fableDur=秒 可覆寫）。
 *  資料：G.DATA.easterEggs（eggs[]：parade_pied_piper／piper_unpaid_loop／chase_red_riding_hood；texts）、G.DATA.npcExtraBubbles.eventEntries（appearWhen.easterEgg／policyExecuted）。
 *  觸發：
 *   - onPolicies(ctx, played)：打出 policy_pied_piper → parade_pied_piper（一局最多 maxPerGame）。
 *   - seasonStart(ctx)：上一季吹笛人罷工（ctx.easterEggs.queued）→ piper_unpaid_loop；野狗縱橫在本季且（連續未處理≥1 或 嚴重度估計≥3）→ chase_red_riding_hood（第一次必出、之後 chance，cooldown、maxPerGame）。
 *   - QA：?fable=piper｜wolf｜unpaid → 第一季街景開始直接播放。
 *  狀態：ctx.easterEggs = {fired:{id:n}, lastCycle:{id:cycle}, queued}；G.BehaviorLog seasons[].easterEggs。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var world = null, dialogue = null, getNpcs = null, qaPlayed = false, active = [];
  function qs(n) { try { return new URLSearchParams(global.location.search).get(n); } catch (e) { return null; } }
  function $(id) { return global.document.getElementById(id); }
  function EE() { return (G.DATA && G.DATA.easterEggs) || { eggs: [], texts: {} }; }
  function egg(id) { return (EE().eggs || []).filter(function (e) { return e.id === id; })[0] || null; }
  function texts(key) { var t = EE().texts || {}; return t[key] || []; }
  function pick(a) { return a.length ? a[Math.floor(Math.random() * a.length)] : ''; }
  function st(ctx) { ctx.easterEggs = ctx.easterEggs || { fired: {}, lastCycle: {} }; ctx.easterEggs.fired = ctx.easterEggs.fired || {}; ctx.easterEggs.lastCycle = ctx.easterEggs.lastCycle || {}; return ctx.easterEggs; }
  function cycleOf(ctx) { return (ctx.monthIndex || 0) + 1; }

  var KIND = { /* 播放種類 → 米米 DOM */
    piper: { cls: 'pied-piper', dir: 'right', egg: 'parade_pied_piper', ms: 6000 },
    unpaid: { cls: 'pied-piper', dir: 'left', egg: 'piper_unpaid_loop', ms: 7000, extra: 'parade--offkey' },
    wolf: { cls: 'red-hood', dir: 'right', egg: 'chase_red_riding_hood', ms: 5000 }
  };
  function inner(cls) {
    return cls === 'pied-piper'
      ? ['grey', 'brown', 'white'].map(function (c) { return '<span class="parade__actor parade__actor--rat" data-color="' + c + '"></span>'; }).join('') +
        '<span class="parade__actor parade__actor--piper"></span><span class="parade__fx parade__fx--notes"></span>'
      : '<span class="parade__actor parade__actor--wolf"></span><span class="parade__actor parade__actor--redhood"></span>' +
        '<span class="parade__fx parade__fx--exclaim"></span><span class="parade__fx parade__fx--sweat"></span>';
  }

  /** 播放一段遊行；回傳容器 el（沒有 #npc-layer 時回 null，不報錯） */
  function play(kind, opts) {
    opts = opts || {};
    var K = KIND[kind] || KIND.piper, layer = $('npc-layer');
    if (!layer) return null;
    var e = egg(K.egg), ms = (e && e.animation && e.animation.durationMs) || K.ms;
    var viewW = world ? world.width : ((layer.parentNode && layer.parentNode.clientWidth) || 1280), camX = world ? Math.round(world.camX || 0) : 0;
    var durSec = +qs('fableDur') || opts.durSec || Math.max(5, ms / 1000 * 1.6);
    var el = global.document.createElement('div');
    el.className = 'parade parade--' + K.cls + (K.extra ? ' ' + K.extra : '');
    el.dataset.dir = opts.dir || K.dir; el.dataset.kind = kind; el.dataset.egg = K.egg;
    el.setAttribute('aria-hidden', 'true');
    el.style.left = camX + 'px';
    el.style.setProperty('--parade-span', viewW + 'px');
    el.style.setProperty('--parade-dur', durSec + 's');
    el.innerHTML = inner(K.cls);
    var done = false;
    function remove() { if (done) return; done = true; clearTimeout(el._t); if (el.parentNode) el.parentNode.removeChild(el); active = active.filter(function (x) { return x !== el; }); if (opts.onEnd) opts.onEnd(); }
    el.addEventListener('animationend', function (ev) { if (ev.target === el) remove(); });
    el._t = setTimeout(remove, durSec * 1000 + 2000);
    layer.appendChild(el); active.push(el);
    if (!opts.silent) { toast(pick(texts('egg.' + K.egg + '.toast'))); bubbles(K.egg, kind === 'piper' ? 'policy_pied_piper' : null); }
    return el;
  }
  function toast(text) {
    if (!text) return;
    var stage = $('street-stage'); if (!stage) return;
    var t = global.document.createElement('div');
    t.className = 'fable-toast'; t.setAttribute('role', 'status'); t.textContent = text;
    stage.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }
  /** 呆呆 eventEntries：appearWhen.easterEgg＝egg／policyExecuted＝pid 的路人句，挑一位在場的說話者冒泡 */
  function bubbles(eggId, pid) {
    var E = (G.DATA.npcExtraBubbles && G.DATA.npcExtraBubbles.eventEntries) || [];
    var list = E.filter(function (x) { var w = x.appearWhen || {}; return w.easterEgg === eggId || (pid && w.policyExecuted === pid); });
    if (!list.length || !dialogue || !getNpcs) return;
    var vis = (getNpcs() || []).filter(function (n) { return !n.offstage; });
    var cand = list.filter(function (x) { return vis.some(function (n) { return n.id === x.speakerNpcId; }); });
    var ln = pick(cand); if (!ln) return;
    var npc = vis.filter(function (n) { return n.id === ln.speakerNpcId; })[0];
    setTimeout(function () { try { dialogue._showOn(npc, ln); } catch (e) {} }, 1200);
  }
  function fire(ctx, id) {
    var S = st(ctx); S.fired[id] = (S.fired[id] || 0) + 1; S.lastCycle[id] = cycleOf(ctx);
    if (G.BehaviorLog && G.BehaviorLog.egg) G.BehaviorLog.egg(ctx, id);
  }
  function allowed(ctx, id) {
    var e = egg(id), S = st(ctx); if (!e) return true;
    if (e.maxPerGame && (S.fired[id] || 0) >= e.maxPerGame) return false;
    var lc = S.lastCycle[id]; if (lc != null && e.cooldownSeasons && cycleOf(ctx) - lc <= e.cooldownSeasons) return false;
    return true;
  }

  /* ---------- 觸發 ---------- */
  function onPolicies(ctx, played) {
    if ((played || []).indexOf('policy_pied_piper') < 0 || !allowed(ctx, 'parade_pied_piper')) return null;
    fire(ctx, 'parade_pied_piper');
    return play('piper');
  }
  function ignoredStreak(ctx, eid) {
    var h = (ctx.poolState && ctx.poolState.history) || [], n = 0;
    var mine = h.filter(function (x) { return x.eventId === eid; });
    for (var i = mine.length - 1; i >= 0; i--) { if (mine[i].resolution === 'ignored' || mine[i].resolution === 'backfired') n++; else break; }
    return n;
  }
  function severityNow(ctx, eid) {
    var sv = ctx.poolState && ctx.poolState.severityNow && ctx.poolState.severityNow[eid];
    if (typeof sv === 'number') return sv;
    var ev = ((ctx.pool && ctx.pool.dr && ctx.pool.dr.events) || []).filter(function (e) { return e.eventId === eid; })[0];
    var base = (ev && ev.severity) || 2;
    return base + ignoredStreak(ctx, eid);
  }
  function wolfDue(ctx) {
    var e = egg('chase_red_riding_hood'); if (!e) return false;
    var eid = 'evp_safety_stray_dogs';
    var on = ((ctx.pool && ctx.pool.dr && ctx.pool.dr.events) || []).some(function (x) { return x.eventId === eid; });
    if (!on || !allowed(ctx, e.id)) return false;
    var conds = (e.when && e.when.conditions) || [], ok = conds.some(function (c) {
      if (c.type === 'eventIgnoredStreak') return ignoredStreak(ctx, c.eventId || eid) >= (c.gte || 1);
      if (c.type === 'eventSeverity') return severityNow(ctx, c.eventId || eid) >= (c.gte || 3);
      return false;
    });
    if (!ok) return false;
    var first = !(st(ctx).fired[e.id]), ch = first ? (e.firstTimeChance != null ? e.firstTimeChance : 1) : (e.chance != null ? e.chance : 0.6);
    var r = G.EventPool && G.EventPool.rngFor && ctx.poolState ? G.EventPool.rngFor(ctx.poolState.seed, cycleOf(ctx), 'egg:' + e.id)() : Math.random();
    return r < ch;
  }
  function seasonStart(ctx) {
    var S = st(ctx), q = qs('fable');
    if (q && !qaPlayed) { qaPlayed = true; var k = q === 'wolf' || q === 'redhood' ? 'wolf' : (q === 'unpaid' ? 'unpaid' : 'piper'); setTimeout(function () { fire(ctx, KIND[k].egg); play(k); }, 1500); return k; }
    if (S.queued) { var id = S.queued; S.queued = null; if (allowed(ctx, id)) { setTimeout(function () { fire(ctx, id); play('unpaid'); }, 1500); return 'unpaid'; } }
    if (wolfDue(ctx)) { setTimeout(function () { fire(ctx, 'chase_red_riding_hood'); play('wolf'); }, 2500); return 'wolf'; }
    return null;
  }
  function stopAll() { active.slice().forEach(function (el) { el.classList.add('is-paused'); if (el.parentNode) el.parentNode.removeChild(el); clearTimeout(el._t); }); active = []; }

  G.Fable = {
    attach: function (o) { o = o || {}; world = o.world || world; dialogue = o.dialogue || dialogue; getNpcs = o.getNpcs || getNpcs; },
    play: play, onPolicies: onPolicies, seasonStart: seasonStart, stopAll: stopAll, active: function () { return active.slice(); },
    _ignoredStreak: ignoredStreak, _severityNow: severityNow, ready: true
  };
})(window);
