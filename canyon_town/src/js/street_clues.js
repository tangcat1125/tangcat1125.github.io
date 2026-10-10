/**
 * street_clues.js — 回合條（30 秒街景觀察）＋泡泡排程＋線索蒐集。
 * 只負責：倒數條／階段鏈 UI、泡泡排程（G.DATA.clues.scheduler）、點泡泡收線索、線索摘要（結報／決策提示）。
 * 不負責：報紙／政策畫面（newspaper.js、policy.js 讀 G.StreetClues.view / cardHints）；階段機仍在 main.js。
 * 測試：?roundSec=4 可縮短整輪（泡泡節奏等比縮放）；G.StreetClues.finishNow() 立即結束觀察。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  var ROLE_RANK = { '對症': 3, '搭配': 2, '治標': 1 };
  var S = {
    ctx: null, hooks: null, timer: null, running: false,
    elapsed: 0, last: 0, durMs: 30000, slotMs: 3100, bubbleMs: 5600, clueLifeMs: 7000, pinMs: 4000, graceMs: 3500, bubbles: [], maxBubbles: 2,
    schedule: [], shownIdx: -1, cur: null, bubbleEl: null, npcEl: null,
    log: [], toastT: 0, bound: false, step: 0, pending: [], prevSpeaker: null
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function pack() { return G.DATA && G.DATA.clues; }
  function rc() { return (G.DATA && G.DATA.reportCopy) || {}; }
  function fmt(t, o) { return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] != null ? o[k] : m; }); }
  function isStaffLine(l) { return l.speakerKind === 'staff' || /^staff_/.test(l.speakerNpcId || ''); }
  function isStaffNpc(n) { return !!n && (/^staff_/.test(n.id || '') || n.kind === 'staff'); }
  /* 事件相關句（dlg_evr_／staff 事件句）：只在該事件本季有抽到時才能說；沒抽到（含 ?pool=off）一律不說 */
  function lineEventId(l) { return (l.appearWhen && l.appearWhen.eventId) || l.eventId || null; }
  function appearOk(l, drawn) { var e = lineEventId(l); return !e || !!(drawn && drawn[e]); }
  /* 居民嗆市長／讚賞：把 G.MayorBanter 的句子轉成與靜態對話同形的 line（category 'chat'，不影響線索／怨言數量） */
  function banterLines(ctx, n, rng, npcs) {
    try {
      if (!n || !G.MayorBanter || !G.MayorBanter.ready || !ctx) return [];
      var res = npcs.filter(function (x) { return !isStaffNpc(x); }).map(function (x) { return x.id; });
      return G.MayorBanter.plan(ctx, n, rng || Math.random, { speakerIds: res }).map(function (b) {
        var e = b.entry;
        return { id: e.id, speakerNpcId: e.speakerNpcId, lines: e.lines, weight: e.weight || 1, category: 'chat', categoryLabel: '嗆市長',
          domainId: e.domainId === 'any' ? b.domainId : e.domainId, speakerKind: 'resident', banter: true, banterState: b.state };
      });
    } catch (err) { return []; }
  }

  function domainName(id) {
    var list = (G.Complaint && G.Complaint.domainList && G.Complaint.domainList()) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return id;
  }

  function roundSecFromUrl() {
    var m = /[?&]roundSec=(\d+(\.\d+)?)/.exec(global.location && global.location.search || '');
    return m ? parseFloat(m[1]) : null;
  }

  /* ---------- 排程（純函式，可單獨測） ---------- */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * 排出一輪泡泡：clue/complaint/chat 依 perRoundMix；不重複對話／clueId；線索 ≥4 個領域；
   * 同一位 NPC 不連續說話；公職 staff_* 句只給 id 相同的公職 NPC（街上沒有公職就不會被選到）。
   * 回傳 [{line, speaker, category}]
   */
  function buildSchedule(lines, npcs) {
    var P = pack() || {};
    var mix = (P.scheduler && P.scheduler.perRoundMix) || { clue: 6, complaint: 2, chat: 2 };
    var ids = {}; npcs.forEach(function (n) { ids[n.id] = n; });
    var nonStaffNpcs = npcs.filter(function (n) { return !isStaffNpc(n); });
    /* 可說的句子：公職句必須有同 id 的公職 NPC；居民句優先同 id，沒有就退而求其次任一非公職 NPC */
    var elig = (lines || []).filter(function (l) {
      if (!l.lines || !l.lines[0]) return false;
      if (!appearOk(l, null)) return false; /* 事件相關句：舊排程沒有抽事件，一律不說 */
      if (isStaffLine(l)) return !!ids[l.speakerNpcId];
      return !!ids[l.speakerNpcId] || nonStaffNpcs.length > 0;
    });
    var cat = { clue: [], complaint: [], chat: [] };
    elig.forEach(function (l) { if (cat[l.category]) cat[l.category].push(l); });
    var best = null;
    for (var attempt = 0; attempt < 400; attempt++) {
      var pick = [];
      var clues = [], seenClue = {};
      shuffle(cat.clue).forEach(function (l) {
        if (clues.length < mix.clue && l.clueId && !seenClue[l.clueId]) { seenClue[l.clueId] = 1; clues.push(l); }
      });
      var doms = {}; clues.forEach(function (l) { doms[l.domainId] = 1; });
      if (Object.keys(doms).length < Math.min(4, clues.length)) continue;
      var chats = shuffle(cat.chat).slice(0, mix.chat);
      var bl = banterLines(S.ctx, Math.min(2, chats.length), Math.random, npcs); /* 嗆市長：取代閒聊格（總格數與類別數量不變） */
      chats = bl.concat(chats.slice(bl.length));
      pick = clues.concat(shuffle(cat.complaint).slice(0, mix.complaint), chats);
      var seq = arrange(shuffle(pick), ids, nonStaffNpcs);
      if (seq) { best = seq; break; }
    }
    return best || [];
  }


  /**
   * 事件池排程（G.EventPool.assemble 的 schedule：10 格、5–8 則真線索）。
   * 街上只有居民：staff_* 句子沒有同 id 公職 NPC 就不能說 → 該格丟掉，再用同領域靜態線索／靜態怨言補回
   * （真線索至少 5、至多 8，總數 10）。順序沿用 assemble 的種子順序，只做「同一人不連續」的交換，所以同種子完全重現。
   * 回傳 [{line, speaker, category, eventId?, source?}]；失敗回 []（呼叫端退回舊排程）。
   */
  function buildPoolSchedule(pk, npcs) {
    var ids = {}; npcs.forEach(function (n) { ids[n.id] = n; });
    var nonStaff = npcs.filter(function (n) { return !isStaffNpc(n); });
    var statics = (G.DATA.dialogues && G.DATA.dialogues.season_01) || [];
    var idx = {};
    statics.concat(pk.dialogues || []).forEach(function (l) { idx[l.id] = l; });
    var rng = pk.rng || Math.random;
    function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
    function speakerOf(l) {
      if (!l || !l.lines || !l.lines[0]) return null;
      if (ids[l.speakerNpcId]) return l.speakerNpcId;
      if (isStaffLine(l) || !nonStaff.length) return null;
      return nonStaff[hash(l.id) % nonStaff.length].id;
    }
    function mk(l, extra) {
      var sp = speakerOf(l); if (!sp) return null;
      var o = { line: l, speaker: sp, category: l.category };
      if (extra) { if (extra.eventId) o.eventId = extra.eventId; if (extra.source) o.source = extra.source; }
      return o;
    }
    var out = [], used = {}, usedClue = {};
    (pk.schedule || []).forEach(function (en) {
      var l = idx[en.dialogueId]; if (!l || used[l.id]) return;
      var o = mk(l, { eventId: en.eventId, source: en.source || 'pool' }); if (!o) return;
      if (o.category === 'clue' && (!l.clueId || usedClue[l.clueId])) return;
      used[l.id] = 1; if (l.clueId) usedClue[l.clueId] = 1; out.push(o);
    });
    function nClue() { return out.filter(function (o) { return o.category === 'clue'; }).length; }
    function shuf(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    var drawnDom = {}, drawnEv = {}; (pk.events || []).forEach(function (e) { drawnDom[e.domainId] = 1; if (e.eventId) drawnEv[e.eventId] = 1; });
    /* 補真線索到 ≥5：先補池內還沒排進去的真線索，再補靜態線索（同領域優先） */
    var cand = (pk.dialogues || []).filter(function (l) { return l.category === 'clue' && !used[l.id]; });
    var stClues = statics.filter(function (l) { return l.category === 'clue' && !used[l.id]; });
    cand = shuf(cand).concat(shuf(stClues.filter(function (l) { return drawnDom[l.domainId]; })), shuf(stClues.filter(function (l) { return !drawnDom[l.domainId]; })));
    var MAXN = 10;
    function dropOne() { /* 為補真線索騰位置：先丟閒聊，再丟怨言，最後丟傳聞 */
      var order = ['chat', 'complaint', 'rumor'];
      for (var k = 0; k < order.length; k++) {
        for (var i = out.length - 1; i >= 0; i--) {
          if (out[i].category === order[k]) { out.splice(i, 1); return true; }
        }
      }
      return false;
    }
    for (var ci = 0; ci < cand.length && nClue() < 5; ci++) {
      var l = cand[ci]; if (used[l.id] || !l.clueId || usedClue[l.clueId]) continue;
      var o = mk(l, { source: idx[l.id] && statics.indexOf(l) >= 0 ? 'static' : 'pool' }); if (!o) continue;
      if (out.length >= MAXN && !dropOne()) break;
      used[l.id] = 1; usedClue[l.clueId] = 1; out.push(o);
    }
    /* 湊滿 10 格：靜態怨言（同領域優先）→ 閒聊 */
    var fill = shuf(statics.filter(function (l) { return l.category === 'complaint' && !used[l.id] && appearOk(l, drawnEv); }));
    /* 該事件本季有抽到的居民事件怨言（dlg_evr_）優先，其次同領域，最後其他 */
    fill = fill.filter(function (l) { return lineEventId(l); }).concat(fill.filter(function (l) { return !lineEventId(l) && drawnDom[l.domainId]; }), fill.filter(function (l) { return !lineEventId(l) && !drawnDom[l.domainId]; }),
      shuf(statics.filter(function (l) { return l.category === 'chat' && !used[l.id] && appearOk(l, drawnEv); })));
    for (var fi = 0; fi < fill.length && out.length < MAXN; fi++) {
      var o2 = mk(fill[fi], { source: 'static' }); if (!o2) continue;
      used[fill[fi].id] = 1; out.push(o2);
    }
    /* 居民嗆市長／讚賞（G.MayorBanter）：換掉最多 2 格靜態填充（怨言／閒聊），插在第 3、7 格附近；真線索與池內事件句不動 */
    banterLines(S.ctx, 2, rng, npcs).forEach(function (bl, bi) {
      var ob = mk(bl, { source: 'banter' }); if (!ob || used[bl.id]) return;
      if (out.length >= MAXN) {
        var killed = false;
        for (var q = out.length - 1; q >= 0; q--) {
          if (out[q].source === 'static' && out[q].category !== 'clue') { out.splice(q, 1); killed = true; break; }
        }
        if (!killed) return;
      }
      used[bl.id] = 1; out.splice(Math.min(out.length, bi === 0 ? 3 : 7), 0, ob);
    });
    /* 真線索上限 8 */
    while (nClue() > 8) { for (var r = out.length - 1; r >= 0; r--) if (out[r].category === 'clue') { out.splice(r, 1); break; } }
    if (out.length < 8 || nClue() < 5) return [];
    /* 同一位 NPC 不連續：回溯法，盡量保持原順序（每格先試最前面的、說話者不同於上一位的句子） */
    var res = [];
    function go(rest) {
      if (!rest.length) return true;
      for (var i = 0; i < rest.length; i++) {
        if (res.length && res[res.length - 1].speaker === rest[i].speaker) continue;
        res.push(rest[i]);
        if (go(rest.slice(0, i).concat(rest.slice(i + 1)))) return true;
        res.pop();
      }
      return false;
    }
    return go(out) ? res : [];
  }

  /* 把句子排成「同一位 NPC 不連續」的順序，並定好說話者；回溯法，失敗回 null */
  function arrange(items, ids, nonStaff) {
    var out = [];
    function speakersFor(l) {
      var n = ids[l.speakerNpcId];
      if (n) return [n];
      return shuffle(nonStaff);
    }
    function go(rest) {
      if (!rest.length) return true;
      var tries = shuffle(rest);
      for (var i = 0; i < tries.length; i++) {
        var l = tries[i], sp = speakersFor(l);
        for (var k = 0; k < sp.length; k++) {
          if (out.length && out[out.length - 1].speaker === sp[k].id) continue;
          out.push({ line: l, speaker: sp[k].id, category: l.category });
          if (go(rest.filter(function (x) { return x !== l; }))) return true;
          out.pop();
        }
      }
      return false;
    }
    return go(items) ? out : null;
  }

  /* ---------- 線索摘要（報紙／決策欄／政策卡用） ---------- */
  function summary(ctx) {
    var P = pack() || {};
    var list = (ctx && ctx.clues) || [];
    var scores = {};
    list.forEach(function (c) { scores[c.domainId] = (scores[c.domainId] || 0) + (c.importance || 1); });
    var order = P.domainOrder || [];
    var top = null;
    Object.keys(scores).forEach(function (d) {
      if (top === null || scores[d] > scores[top] ||
          (scores[d] === scores[top] && order.indexOf(d) < order.indexOf(top))) top = d;
    });
    var hints = {}, warns = [];
    list.forEach(function (c) {
      (c.policyHints || []).forEach(function (h) {
        if (h.role === '提醒') { warns.push({ policyId: h.policyId, hint: h.hint, clueId: c.id }); return; }
        var cur = hints[h.policyId];
        var rank = ROLE_RANK[h.role] || 0;
        var w = (c.importance || 1) * 10 + rank + (c.domainId === top ? 100 : 0);
        if (!cur) hints[h.policyId] = { policyId: h.policyId, role: h.role, rank: rank, hint: h.hint, score: w, clueIds: [c.id] };
        else {
          cur.score += w; cur.clueIds.push(c.id);
          if (rank > cur.rank) { cur.role = h.role; cur.rank = rank; cur.hint = h.hint; }
        }
      });
    });
    var hintList = Object.keys(hints).map(function (k) { return hints[k]; })
      .sort(function (a, b) { return (b.rank - a.rank) || (b.score - a.score); });
    var rating = null;
    (P.reportRating || []).forEach(function (r) { if (list.length >= r.min && list.length <= r.max) rating = r; });
    if (!rating && (P.reportRating || []).length && list.length > 0) rating = P.reportRating[P.reportRating.length - 1];
    return {
      count: list.length, scores: scores, topDomain: top, topName: top ? domainName(top) : '',
      topScore: top ? scores[top] : 0, hints: hintList, warnings: warns, rating: rating,
      lines: list.map(function (c) { return c.reportLine || c.summary; })
    };
  }

  function view(ctx) {
    var s = summary(ctx);
    s.items = ((ctx && ctx.clues) || []).map(function (c) {
      return { id: c.id, domainId: c.domainId, line: c.reportLine || c.summary, importance: c.importance };
    });
    return s;
  }

  /** 政策卡用：policyId → {role, hint, score}（沒收到線索回 null） */
  function cardHints(ctx) {
    var s = summary(ctx);
    if (!s.count) return null;
    var out = {};
    s.hints.forEach(function (h) { out[h.policyId] = h; });
    return out;
  }

  /* ---------- UI ---------- */
  function setStep(i) {
    S.step = i;
    var items = document.querySelectorAll('#round-chain li');
    for (var k = 0; k < items.length; k++) items[k].classList.toggle('is-current', k === i);
  }
  var PHASE_STEP = { simulating: 0, newspaper: 1, result: 1, policy: 2, daily: 3 };
  function setPhase(p) { if (PHASE_STEP[p] != null) setStep(PHASE_STEP[p]); }

  function toast(text) {
    var t = $('round-toast'); if (!t) return;
    t.textContent = text; t.hidden = false;
    clearTimeout(S.toastT);
    S.toastT = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function renderClueList() {
    var list = (S.ctx && S.ctx.clues) || [];
    var n = $('round-clue-n'); if (n) n.textContent = String(list.length);
    var ul = $('round-clue-list'); if (!ul) return;
    ul.innerHTML = list.length
      ? list.map(function (c) {
          return '<li data-clue-id="' + esc(c.id) + '" data-domain="' + esc(c.domainId) + '"><b>' + esc(domainName(c.domainId)) + '</b> ' + esc(c.summary) + '</li>';
        }).join('')
      : '<li class="round-clue-empty">還沒有線索。點居民頭上的 🔍 泡泡就能收進來。</li>';
  }

  function bindOnce() {
    if (S.bound) return; S.bound = true;
    var early = $('btn-round-early');
    if (early) early.addEventListener('click', function () { finishNow(); });
    var tg = $('btn-clue-toggle');
    if (tg) tg.addEventListener('click', function () {
      var p = $('round-clue-panel'); if (!p) return;
      p.hidden = !p.hidden;
      tg.setAttribute('aria-expanded', p.hidden ? 'false' : 'true');
    });
    var layer = $('npc-layer');
    if (layer) layer.addEventListener('click', function (e) {
      var npcEl = e.target && e.target.closest && e.target.closest('.npc');
      if (!npcEl || !S.running || !S.bubbles.length) return;
      var hit = S.bubbles.filter(function (x) { return x.e.speaker === npcEl.dataset.id; })[0];
      if (hit) tapBubble(hit);
    });
  }

  /* ---------- 泡泡 ---------- */
  /* 泡泡壽命 ≥5.5 秒（線索泡泡約 7 秒，點一下釘住再延長）；同時最多 2 個，新泡泡可與舊泡泡重疊。 */
  function removeBubble(en) {
    if (en.el && en.el.parentNode) en.el.parentNode.removeChild(en.el);
    var still = S.bubbles.filter(function (x) { return x !== en && x.npcEl === en.npcEl; }).length;
    if (en.npcEl && !still) en.npcEl.classList.remove('has-bubble-tap');
    S.bubbles = S.bubbles.filter(function (x) { return x !== en; });
    if (S.bubbleEl === en.el) {
      var last = S.bubbles[S.bubbles.length - 1];
      S.bubbleEl = last ? last.el : null; S.npcEl = last ? last.npcEl : null; S.cur = last ? last.e : null;
    }
  }
  function hideBubble() {
    S.bubbles.slice().forEach(removeBubble);
    S.bubbles = [];
    S.bubbleEl = null; S.npcEl = null; S.cur = null;
  }
  function expireBubbles() {
    S.bubbles.slice().forEach(function (en) { if (S.elapsed >= en.until) removeBubble(en); });
  }

  var TAGS = { clue: '🔍', complaint: '😠', chat: '💬', rumor: '🗣️' };
  var BANTER_TAG = { furious: '😤', grumble: '😒', praise: '👏' };

  /* 街景鏡頭會左右平移，畫面外的 NPC 說話看不到：每一格從「尚未說」的句子裡，優先挑說話者目前在畫面內、且不是上一位的那句
   * （只改順序，不改內容，所以 6/2/2、不重複、≥4 領域、不連續同人的規則都維持）。 */
  function onScreen(npcEl) {
    var st = $('street-stage'); if (!st || !npcEl) return true;
    var a = st.getBoundingClientRect(), r = npcEl.getBoundingClientRect(), cx = (r.left + r.right) / 2;
    return cx >= a.left + 110 && cx <= a.right - 110;
  }
  function pickNext() {
    var npcs = S.hooks.getNpcs() || [], el = {};
    npcs.forEach(function (n) { el[n.id] = n.el; });
    var pool = S.pending.filter(function (e) { return e.speaker !== S.prevSpeaker; });
    if (!pool.length) pool = S.pending.slice();
    /* 只選「剩下的句子還排得出『同一人不連續』」的那一句（避免最後兩句同一位說話者） */
    var okPool = pool.filter(function (e) {
      var rest = S.pending.filter(function (x) { return x !== e; }), n = rest.length, c = {};
      if (!n) return true;
      rest.forEach(function (x) { c[x.speaker] = (c[x.speaker] || 0) + 1; });
      return Object.keys(c).every(function (k) { return c[k] <= (k === e.speaker ? Math.floor(n / 2) : Math.ceil(n / 2)); });
    });
    if (okPool.length) pool = okPool;
    var vis = pool.filter(function (e) { return onScreen(el[e.speaker]); });
    var pickFrom = vis.length ? vis : pool;
    var e = pickFrom[0];
    S.pending.splice(S.pending.indexOf(e), 1);
    return e;
  }

  function showSlot(idx) {
    var e = S.pending.length ? pickNext() : null;
    if (e) S.prevSpeaker = e.speaker;
    S.schedule[idx] = e || S.schedule[idx];
    e = S.schedule[idx];
    var npcs = S.hooks.getNpcs() || [];
    var npc = null;
    for (var i = 0; i < npcs.length; i++) if (npcs[i].id === e.speaker) npc = npcs[i];
    if (!npc || !npc.el) return;
    if (G.Density && npc.offstage) G.Density.reveal(npc.id); /* 場外的居民要說線索：先走進畫面（密度只影響閒逛的人，不吃線索） */
    /* 同一位居民的舊泡泡先收掉；最多同時 2 個（先收最舊、未被釘住的） */
    S.bubbles.filter(function (x) { return x.npcEl === npc.el; }).forEach(removeBubble);
    while (S.bubbles.length >= S.maxBubbles) {
      var victim = S.bubbles.filter(function (x) { return !x.pinned; })[0] || S.bubbles[0];
      removeBubble(victim);
    }
    var lift = !(S.bubbles.length && S.bubbles[0].lift);
    var b = document.createElement('div');
    b.className = 'npc-bubble npc-bubble--tap npc-bubble--' + e.category;
    b.setAttribute('role', 'button');
    b.setAttribute('data-category', e.category);
    b.setAttribute('data-dialogue-id', e.line.id);
    b.setAttribute('data-speaker', e.speaker);
    if (e.line.clueId) b.setAttribute('data-clue-id', e.line.clueId);
    if (e.line.domainId) b.setAttribute('data-domain', e.line.domainId);
    if (e.line.banter) { b.classList.add('npc-bubble--banter', 'is-' + e.line.banterState); b.setAttribute('data-banter', e.line.banterState); }
    var done = e.category === 'clue' && hasClue(e.line.clueId);
    b.innerHTML = '<span class="npc-bubble__tag">' + (done ? '✅' : (e.line.banter ? BANTER_TAG[e.line.banterState] : TAGS[e.category]) || '') + '</span>' +
      '<span class="npc-bubble__text">' + esc(e.line.lines[0]) + '</span>';
    if (done) b.classList.add('is-collected');
    var en = { el: b, npcEl: npc.el, e: e, born: S.elapsed, until: S.elapsed + (e.category === 'clue' ? S.clueLifeMs : S.bubbleMs), lift: S.bubbles.length ? lift : false, pinned: false };
    if (en.lift) b.classList.add('npc-bubble--lift');
    b.addEventListener('click', function (ev) { ev.stopPropagation(); tapBubble(en); });
    npc.el.appendChild(b);
    if (G.clampBubble) G.clampBubble(b);
    npc.el.classList.add('has-bubble-tap');
    S.bubbles.push(en);
    S.bubbleEl = b; S.npcEl = npc.el; S.cur = e;
    S.log.push({ idx: idx, dialogueId: e.line.id, clueId: e.line.clueId || null, category: e.category,
      speaker: e.speaker, domainId: e.line.domainId || null, eventId: e.eventId || e.line.eventId || null, t: Math.round(S.elapsed),
      banter: e.line.banter ? e.line.banterState : null });
  }

  function hasClue(id) {
    return ((S.ctx && S.ctx.clues) || []).some(function (c) { return c.id === id; });
  }

  /* 線索定義：先找本季事件池組出的線索，再找靜態 G.DATA.clues */
  function clueDef(clueId) {
    var def = null;
    ((S.poolClues) || []).forEach(function (c) { if (c.id === clueId) def = c; });
    if (!def) ((pack() || {}).clues || []).forEach(function (c) { if (c.id === clueId) def = c; });
    return def;
  }

  function collect(clueId) {
    var P = pack(); if (!P || !S.ctx) return false;
    if (hasClue(clueId)) return false;
    var def = clueDef(clueId);
    if (!def) return false;
    S.ctx.clues.push({
      id: def.id, summary: def.summary, domainId: def.domainId, importance: def.importance,
      season: S.ctx.season && S.ctx.season.id, reportLine: def.reportLine, policyHints: def.policyHints || [],
      npcName: def.npcName
    });
    renderClueList();
    return true;
  }

  function tapCurrent() {
    var en = S.bubbles[S.bubbles.length - 1]; if (en) tapBubble(en);
  }
  function tapBubble(en) {
    if (!en || !en.el) return;
    var e = en.e;
    en.pinned = true; en.until = Math.max(en.until, S.elapsed + S.pinMs); /* 點一下釘住並延長 */
    en.el.classList.add('is-pinned');
    var flow = rc().flow || {};
    en.el.classList.add('is-tapped');
    if (e.category === 'clue') {
      var added = collect(e.line.clueId);
      en.el.classList.add('is-collected');
      var tag = en.el.querySelector('.npc-bubble__tag'); if (tag) tag.textContent = '✅';
      var def = clueDef(e.line.clueId);
      toast(added ? fmt(flow.collectToast || '蒐集到線索：{summary}', { summary: def ? def.summary : '' })
                  : '這條線索已經在線索簿裡了');
    } else if (e.category === 'rumor') {
      toast('🗣️ 這是傳聞，還不能算線索：找第二個獨立來源（另一位居民或公所紀錄）再相信。');
    } else if (e.category === 'complaint') {
      toast('😠 聽到了：這是居民的怨言（' + domainName(e.line.domainId) + '）');
    } else {
      toast('💬 閒聊一句，不影響線索');
    }
  }

  /* ---------- 流程 ---------- */
  function updateUi() {
    var left = Math.max(0, S.durMs - S.elapsed);
    var flow = rc().flow || {};
    var c = $('round-count');
    if (c) c.textContent = fmt(flow.countdown || '資料蒐集中，剩 {sec} 秒', { sec: Math.ceil(left / 1000 * (30000 / S.durMs)) });
    var f = $('round-fill'); if (f) f.style.width = (left / S.durMs * 100).toFixed(1) + '%';
    var sn = $('round-sec-n'); if (sn) sn.textContent = String(Math.ceil(left / 1000 * (30000 / S.durMs)));
  }

  function tick() {
    if (!S.running) return;
    var now = (global.performance && performance.now) ? performance.now() : Date.now();
    var dt = Math.min(250, Math.max(0, now - S.last)); S.last = now;
    S.elapsed += dt;
    var idx = Math.floor(S.elapsed / S.slotMs);
    if (idx < S.schedule.length) {
      if (S.shownIdx !== idx) { S.shownIdx = idx; showSlot(idx); }
    }
    expireBubbles();
    if (G.clampBubble) S.bubbles.forEach(function (x) { G.clampBubble(x.el); }); /* NPC 在走：泡泡持續夾在街景左右邊內 */
    updateUi();
    /* 時間到後，最後的泡泡再多留一小段（graceMs）才結束，讓最後一句也能讀完 */
    if (S.elapsed >= S.durMs && (!S.bubbles.length || S.elapsed >= S.durMs + S.graceMs)) finishNow();
  }

  function start(opts) {
    stop();
    S.ctx = opts.ctx; S.hooks = opts.hooks || {};
    var P = pack() || {};
    var cy = P.cycle || {};
    var sec = roundSecFromUrl() || cy.durationSec || 30;
    var scale = sec / (cy.durationSec || 30);
    S.durMs = sec * 1000;
    S.bubbleMs = 5600 * scale;      /* 泡泡至少顯示 5.5 秒（街景教室投影要讀得完） */
    S.clueLifeMs = 7000 * scale;     /* 線索泡泡約 7 秒，點一下釘住再 +4 秒 */
    S.pinMs = 4000 * scale;
    S.graceMs = 3500 * scale;
    S.bubbles = [];
    S.slotMs = ((cy.bubbleSec || 2.6) + (cy.gapSec || 0.5)) * 1000 * scale;
    S.ctx.clues = [];
    S.log = [];
    var lines = (G.DATA.dialogues && (G.DATA.dialogues[(S.ctx.season && S.ctx.season.id) || 'season_01'] || G.DATA.dialogues.season_01)) || [];
    var pk = S.hooks.getPool ? S.hooks.getPool() : null;
    S.poolClues = (pk && pk.clues) || [];
    S.schedule = [];
    S.source = 'static';
    if (pk) {
      try { S.schedule = buildPoolSchedule(pk, S.hooks.getNpcs() || []); } catch (err) { S.schedule = []; }
      if (S.schedule.length) S.source = 'pool';
    }
    if (!S.schedule.length) { S.poolClues = []; S.schedule = buildSchedule(lines, S.hooks.getNpcs() || []); }
    S.shownIdx = -1; S.elapsed = 0; S.pending = S.schedule.slice(); S.prevSpeaker = null;
    S.last = (global.performance && performance.now) ? performance.now() : Date.now();
    S.running = true;
    bindOnce();
    var bar = $('round-bar'); if (bar) bar.hidden = false;
    var panel = $('round-clue-panel'); if (panel) panel.hidden = true;
    var tg = $('btn-clue-toggle'); if (tg) tg.setAttribute('aria-expanded', 'false');
    var tip = $('round-tip'); if (tip) tip.textContent = (rc().flow || {}).tapHint || '點居民的泡泡，把線索收進線索簿。';
    var labels = ['觀察街區', (rc().terms && rc().terms.report) || '結報', '決策', '日常'];
    var items = document.querySelectorAll('#round-chain li');
    for (var i = 0; i < items.length; i++) if (labels[i]) items[i].textContent = labels[i];
    setStep(0);
    renderClueList();
    updateUi();
    if (S.hooks.dialogue) S.hooks.dialogue.setEnabled(false);
    if (S.hooks.banner) S.hooks.banner((rc().flow || {}).collecting || '街景自動運轉，注意居民說的話，蒐集線索。');
    S.timer = setInterval(tick, 100);
  }

  function stop() {
    clearInterval(S.timer); S.timer = null;
    var was = S.running; S.running = false;
    hideBubble();
    if (G.Density) G.Density.relax(); /* 為說線索而進場的居民回到場外（若不在目前密度內） */
    var bar = $('round-bar'); if (bar) bar.hidden = true;
    clearTimeout(S.toastT);
    var t = $('round-toast'); if (t) t.hidden = true;
    if (was && S.hooks && S.hooks.dialogue) S.hooks.dialogue.setEnabled(true);
    return was;
  }

  /** 結束觀察（倒數到 0、「提早結報」、QA 皆走這裡）→ onFinish(summary)。 */
  function finishNow() {
    if (!S.running) return false;
    var hooks = S.hooks, ctx = S.ctx;
    stop();
    if (hooks && hooks.onFinish) hooks.onFinish(summary(ctx));
    return true;
  }

  G.StreetClues = {
    ready: true,
    start: start, stop: stop, finishNow: finishNow, setPhase: setPhase,
    summary: summary, view: view, cardHints: cardHints, buildSchedule: buildSchedule, buildPoolSchedule: buildPoolSchedule, getSource: function () { return S.source; },
    collect: collect, isRunning: function () { return S.running; },
    getLog: function () { return S.log.slice(); },
    getSchedule: function () { return S.schedule.slice(); },
    getTiming: function () { return { durMs: S.durMs, slotMs: S.slotMs, bubbleMs: S.bubbleMs, clueLifeMs: S.clueLifeMs, pinMs: S.pinMs, graceMs: S.graceMs, maxBubbles: S.maxBubbles }; },
    getBubbles: function () { return S.bubbles.map(function (b) { return { speaker: b.e.speaker, category: b.e.category, lift: b.lift, pinned: b.pinned }; }); }
  };
})(window);
