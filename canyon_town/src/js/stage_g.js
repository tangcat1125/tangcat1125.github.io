/**
 * stage_g.js — Stage G：公所貓貓建議區／選卡限制提示／無關卡提示／職員執行過程／執行評估／街景店面／成就徽章與結局圖。
 * 流程（結報不可回頭）：快報（月報）→ 公所貓貓建議區（決策欄頂部）→ 選卡（點數／金錢限制）→ 確認並執行 → #exec-panel 職員執行過程
 *   → 執行評估卡 → 本季結報（帳單在頂部；只有「看本月報紙」「繼續下一季」）。
 * 資料只讀：G.DATA.advisorPanel（docs/ADVISOR_PANEL.md）、G.EventPool.staffReact（docs/STAFF_REACTIVE.md）、policy.solvesPool／solvesPoolConditional、
 *   policy.fx.effect（只作動畫／預覽：流量與民怨仍只由 card_recurring／complaintDelta 套一次，這裡不重算）、economy.achievements。
 * 不改報紙門檻、不碰 .npc 定位。狀態：ctx.stageG（跨季：staffLastLineIds、lastEvalIds、achievements）。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var FLOWS = ['foot', 'vehicle', 'tourist', 'security'];
  var FLOW_NAME = { foot: '人流', vehicle: '車流', tourist: '遊客', security: '治安' };
  var RES_OF_EFFECT = { cure: 'cure', assist: 'assist', palliative: 'palliative', backfire: 'backfire', neutral: 'none' };
  var VERDICT = { cure: '對症', assist: '輔助', palliative: '治標', backfire: '反效果', none: '無關' };
  var RANK = { cure: 0, assist: 1, palliative: 2, backfire: 3, none: 4 };
  var NEUTRAL_HINT = '這張卡和本季還沒解決的事件都沒有關係：點數照扣、不退費，帳單會多一列「無關卡」。';
  var SHOP_SLOTS = [1, 3, 5, 7, 8, 10, 12, 14];

  function D() { return G.DATA || {}; }
  function AP() { return D().advisorPanel || null; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function pol(pid) { return (D().policies || {})[pid] || null; }
  function polName(pid) { var p = pol(pid); return p ? p.name : ''; }
  function staffList() { return (D().staff && D().staff.staff) || []; }
  function staffById(id) { var s = null; staffList().forEach(function (x) { if (x.id === id) s = x; }); return s; }
  function poolEv(id) { var P = D().eventPool, ev = null; ((P && P.events) || []).forEach(function (e) { if (e.id === id) ev = e; }); return ev; }
  function domainName(id) { var C = D().complaints, n = id; ((C && C.domains) || []).forEach(function (d) { if (d.id === id) n = d.name; }); return n || ''; }
  function st(ctx) { if (!ctx.stageG) ctx.stageG = { staffLastLineIds: {}, lastEvalIds: {}, assign: {}, ach: { unlocked: {}, cured: 0, noIgnore: 0, low: false }, lastResults: null }; return ctx.stageG; }
  function seedOf(ctx) { return String((ctx.poolState && ctx.poolState.seed) || 'seed'); }
  function cycleOf(ctx) { return (ctx.pool && ctx.pool.cycle) | 0; }
  function rng(ctx, tag) { try { if (G.EventPool && G.EventPool.rngFor) return G.EventPool.rngFor(seedOf(ctx), cycleOf(ctx), tag); } catch (e) {} var s = 7; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function pick(r, arr) { return arr.length ? arr[Math.floor(r() * arr.length) % arr.length] : null; }
  function qs(name) { try { var m = new RegExp('[?&]' + name + '=([^&]*)').exec(global.location.search); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; } }
  function varsIn(t) { return (String(t).match(/\{(\w+)\}/g) || []).map(function (x) { return x.slice(1, -1); }); }
  function fill(t, v) { return String(t).replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ''; }); }
  function canFill(t, v) { return varsIn(t).every(function (k) { return v[k] != null && v[k] !== ''; }); }
  function activeEvents(ctx) { var dr = ctx.pool && ctx.pool.dr; return (dr && dr.events) || []; }
  function placeOf(ctx, eid) {
    var e = null; activeEvents(ctx).forEach(function (x) { if (!e && (!eid || x.eventId === eid)) e = x; });
    var v = e && (e.vars || e.filled || e.slots);
    if (v && typeof v.place === 'string' && v.place) return v.place;
    var ev = poolEv(e && e.eventId), pv = ev && ev.vars && ev.vars.place;
    if (Array.isArray(pv) && pv.length) return pv[0];
    return '街區';
  }
  function isOpp(eid) { var ev = poolEv(eid); return !!(ev && ev.polarity === 'opportunity'); }
  function cardRes(ctx, pid, skipOpp) { /* 本季事件池對這張卡的最佳效果：cure／assist／palliative／backfire／none（與 eventPool.responses 一致）；skipOpp＝只看非機會事件 */
    var evs = activeEvents(ctx); if (skipOpp) evs = evs.filter(function (e) { return !isOpp(e.eventId); });
    if (!evs.length || !G.EventPool || !ctx.pool) return { res: 'none', eventId: null };
    var stx = JSON.parse(JSON.stringify(ctx.pool.state || {})); stx.activeIds = evs.map(function (e) { return e.eventId; });
    var best = { res: 'none', eventId: null };
    evs.forEach(function (e) {
      var r; try { r = G.EventPool.respond(e.eventId, stx, [pid])[0]; } catch (err) { r = null; }
      var k = r ? (RES_OF_EFFECT[r.effect] || 'none') : 'none';
      if (RANK[k] < RANK[best.res]) best = { res: k, eventId: e.eventId };
    });
    return best;
  }
  /** 選到的卡中，對本季所有進行中「非機會」事件都沒回應（none／條件未達成）的卡；只提示、不擋（advisorPanel.irrelevantCardHint.trigger） */
  function neutralCards(ctx, selected) {
    if (!activeEvents(ctx).some(function (e) { return !isOpp(e.eventId); })) return [];
    return (selected || []).filter(function (pid) { return cardRes(ctx, pid, true).res === 'none'; });
  }
  /** 無關卡提示句：G.DATA.advisorPanel.irrelevantCardHint.lines[].text，種子 rngFor(seed, cycle, "irrelevantHint:"+cardId)（同季同卡同句）；沒有資料才用暫用句 */
  function irrelevantHint(ctx, pid) {
    var a = AP(), H = a && a.irrelevantCardHint, lines = ((H && H.lines) || []).filter(function (l) { return l && l.text && !varsIn(l.text).length; });
    if (!lines.length) return { id: null, text: neutralText() };
    var r; try { r = G.EventPool.rngFor(seedOf(ctx), cycleOf(ctx), 'irrelevantHint:' + pid); } catch (e) { r = rng(ctx, 'irrelevantHint:' + pid); }
    var l = pick(r, lines); return { id: l.id || null, text: l.text };
  }
  function neutralText() {
    var a = AP(), n = a && (a.neutralCard || (a.panel && a.panel.neutralCard));
    var h = n && (n.hint || n.text);
    if (Array.isArray(h)) h = h[0] && (h[0].text || h[0]);
    return (typeof h === 'string' && h) ? h : NEUTRAL_HINT; /* 舊預留鍵；正式文案在 advisorPanel.irrelevantCardHint（見 irrelevantHint） */
  }
  function cureLabel(ctx, pid) { /* 對症判斷用 solvesPool／solvesPoolConditional（不顯示 evp_ id，只顯示事件名） */
    var p = pol(pid); if (!p) return '';
    var act = {}; activeEvents(ctx).forEach(function (e) { act[e.eventId] = 1; });
    var hit = (p.solvesPool || []).filter(function (id) { return act[id]; }), cond = (p.solvesPoolConditional || []).filter(function (id) { return act[id]; });
    var nm = function (id) { var ev = poolEv(id); return ev ? ev.title : ''; };
    if (hit.length) return '對症：' + hit.map(nm).filter(Boolean).join('、');
    if (cond.length) return '情境對症：' + cond.map(nm).filter(Boolean).join('、');
    return '';
  }

  /* ================= G1 公所貓貓建議區 ================= */
  function situationTitle(ctx, sid) {
    var a = AP(), s = null; ((a && a.staffReact && a.staffReact.situations) || []).forEach(function (x) { if (x.id === sid) s = x; });
    if (!s) return { title: '', short: '' };
    var r = rng(ctx, 'advisor:zone'), v = { domain: '', staff: '', card: '', event: '', n: '', place: placeOf(ctx) };
    var t = (s.titles || []).filter(function (x) { return canFill(x.text, v); }), sh = (s.shorts || []).filter(function (x) { return canFill(x.text, v); });
    var tp = pick(r, t), sp = pick(r, sh);
    return { title: tp ? fill(tp.text, v) : '', short: sp ? fill(sp.text, v) : '' };
  }
  function adviceFor(ctx, points, money) {
    if (!G.EventPool || !G.EventPool.staffReact) return [];
    var S = st(ctx), evs = activeEvents(ctx), doms = {};
    evs.forEach(function (e) { var ev = poolEv(e.eventId); if (ev) doms[ev.domainId] = 1; });
    var report = {
      seed: seedOf(ctx), cycle: cycleOf(ctx), complaints: (ctx.complaints && ctx.complaints.values) || {},
      prevComplaints: (ctx.complaints && ctx.complaints.lastValues) || {}, results: S.lastResults || [], played: S.lastPlayed || [],
      history: (ctx.poolState && ctx.poolState.history) || [], pending: evs.map(function (e) { return { eventId: e.eventId }; }), owned: (ctx.poolState && ctx.poolState.owned) || []
    };
    var out;
    try { out = G.EventPool.staffReact(report, { lastLineIds: S.staffLastLineIds, points: points }); } catch (e) { if (global.console) console.warn('[StageG] staffReact', e); return []; }
    var items = [];
    out.forEach(function (o) {
      var s = staffById(o.staffId); if (!s) return;
      var rel = (s.domains || []).some(function (d) { return doms[d]; });
      var rec = (o.recommendCardIds || []).filter(function (pid) { var p = pol(pid); return p && (money == null || costMoney(p) <= money); });
      var best = null;
      rec.forEach(function (pid) { var r = cardRes(ctx, pid); if (!best || RANK[r.res] < RANK[best.r.res]) best = { pid: pid, r: r }; });
      if (!rel && !(best && best.r.res !== 'none')) return;
      items.push({ o: o, s: s, pid: best ? best.pid : null, res: best ? best.r.res : 'none', score: (best ? 4 - RANK[best.r.res] : 0) + (rel ? 2 : 0) });
    });
    items.sort(function (a, b) { return b.score - a.score || (a.s.id < b.s.id ? -1 : 1); });
    var seen = {}, out2 = [];
    items.forEach(function (it) { if (out2.length >= 3) return; if (it.pid && seen[it.pid]) return; if (it.pid) seen[it.pid] = 1; out2.push(it); });
    return out2;
  }
  function costMoney(p) { return p && p.deltas && p.deltas.money ? -p.deltas.money : 0; }
  function mountAdvice(ctx, hudEls, hand) {
    var root = hudEls && hudEls.root; if (!root) return null;
    var zone = root.querySelector('#staff-advice-zone');
    if (!zone) {
      zone = document.createElement('section'); zone.id = 'staff-advice-zone'; zone.setAttribute('aria-label', '公所貓貓建議');
      var before = root.querySelector('.np-decision-hud__options') || root.querySelector('.np-decision-hud__shop');
      if (before) root.insertBefore(zone, before); else root.appendChild(zone);
    }
    var pts = hand ? hand.availablePoints : null, money = hand ? hand.availableMoney : null;
    var list = adviceFor(ctx, pts, money), S = st(ctx), A = AP(), head = (A && A.panel && A.panel.title) || '公所貓貓建議區';
    var sid = list[0] ? list[0].o.situation : 'stable', sit = situationTitle(ctx, sid);
    var evs0 = activeEvents(ctx);
    if (sid === 'stable' && evs0.length) { /* 「平穩」但本季仍有待解事件：副標改列待解事件名（不顯示 evp_ id） */
      var nms = evs0.map(function (e) { var ev = poolEv(e.eventId); return ev ? ev.title : ''; }).filter(Boolean);
      sit = { title: '本季待解 ' + nms.length + ' 件', short: nms.join('、') };
    }
    S.zoneSituation = sid;
    var html = '<h3 class="advice-zone__head">' + esc(A && A.panel && A.panel.sections ? '公所貓貓建議' : head) +
      (sit.title ? '<span class="advice-zone__sub">' + esc(sit.title) + (sit.short ? '｜' + esc(sit.short) : '') + '</span>' : '') + '</h3>';
    if (!list.length) html += '<p class="advice-zone__empty">' + esc((A && A.panel && A.panel.empty && A.panel.empty.advise) || '本季還沒有建議，先讀讀報紙吧。') + '</p>';
    else {
      html += '<ul class="advice-zone__list">' + list.map(function (it) {
        var p = pol(it.pid), adv = it.pid && it.s.adviceByPolicy && it.s.adviceByPolicy[it.pid];
        var stance = adv ? adv.stance : 'hold', stLabel = adv ? adv.stanceLabel : '保留';
        var fx = p && p.fx && p.fx.effect, trade = p && ((p.card && p.card.tradeoffLine) || p.sideEffect);
        var why = p ? ('推薦「' + p.name + '」（點數 ' + p.cost + (costMoney(p) ? '・' + costMoney(p) + ' 元' : '') + '）' + (cureLabel(ctx, it.pid) ? '｜' + cureLabel(ctx, it.pid) : '｜' + VERDICT[it.res])) : '目前沒有合適的卡';
        return '<li class="advice-item" data-staff="' + esc(it.s.id) + '" data-stance="' + esc(stance) + '" data-policy="' + esc(it.pid || '') + '" data-res="' + it.res + '" data-line-id="' + esc(it.o.lineId) + '">' +
          '<img class="advice-item__avatar" src="' + esc(it.s.avatar || '') + '" alt="' + esc(it.s.name) + '" onerror="this.style.visibility=\'hidden\'">' +
          '<div class="advice-item__body"><span class="advice-item__name">' + esc(it.s.name) + '</span> <span class="staff-stance" data-stance="' + esc(stance) + '">' + esc(stLabel) + '</span>' +
          '<p class="advice-item__line">' + esc(it.o.line) + '</p>' +
          (it.o.advice ? '<p class="advice-item__advice">' + esc(it.o.advice) + '</p>' : '') +
          '<span class="advice-item__reason">' + esc(why) + (adv && adv.reason ? '：' + esc(adv.reason) : '') + '</span>' +
          (fx && fx.summary ? '<span class="advice-item__reason g-advice-fx">預期效果：' + esc(fx.summary) + '</span>' : '') +
          (trade ? '<span class="advice-item__reason g-advice-trade">取捨：' + esc(trade) + '</span>' : '') +
          '</div>' +
          (p ? '<button type="button" class="advice-item__pick" data-policy="' + esc(it.pid) + '" data-staff="' + esc(it.s.id) + '">派他去</button>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    zone.setAttribute('data-policy', list[0] && list[0].pid ? list[0].pid : '');
    zone.innerHTML = html;
    list.forEach(function (it) { S.staffLastLineIds[it.s.id] = [it.o.lineId]; });
    S.adviceList = list.map(function (it) { return { staff: it.s.id, pid: it.pid || null, res: it.res }; }); /* Stage H：行為紀錄判斷是否採納建議 */
    zone.onclick = function (ev) {
      var b = ev.target.closest ? ev.target.closest('.advice-item__pick') : null;
      if (!b || b.disabled || !hand) return;
      var pid = b.getAttribute('data-policy'), sid2 = b.getAttribute('data-staff');
      var already = hand.getSelected().indexOf(pid) >= 0;
      if (S.assign[pid] === sid2 && already) { delete S.assign[pid]; hand.toggle(pid); }
      else { S.assign[pid] = sid2; if (!already) hand.toggle(pid); }
      syncAdvice(ctx, hand);
    };
    syncAdvice(ctx, hand);
    return zone;
  }
  function syncAdvice(ctx, hand) {
    var zone = $('staff-advice-zone'); if (!zone || !hand) return;
    var sel = hand.getSelected(), S = st(ctx);
    Object.keys(S.assign).forEach(function (pid) { if (sel.indexOf(pid) < 0) delete S.assign[pid]; });
    zone.querySelectorAll('.advice-item').forEach(function (li) {
      var pid = li.getAttribute('data-policy'), sid = li.getAttribute('data-staff'), b = li.querySelector('.advice-item__pick');
      var on = !!pid && sel.indexOf(pid) >= 0 && S.assign[pid] === sid;
      li.classList.toggle('is-selected', on);
      if (!b) return;
      b.textContent = on ? '已委任' : '派他去';
      var card = hand.handEl && hand.handEl.querySelector('.policy-card[data-policy-id="' + pid + '"]');
      b.disabled = !on && (!card || card.disabled);
      if (b.disabled && card && card.getAttribute('data-short')) b.textContent = card.getAttribute('data-short');
    });
  }

  /* ================= G3 無關卡提示（決策欄） ================= */
  function onSelection(ctx, selected, hand, hudEls) {
    var root = (hudEls && hudEls.root) || $('np-decision-hud'); if (!root) return;
    var box = root.querySelector('#np-neutral-hint');
    if (!box) {
      box = document.createElement('div'); box.id = 'np-neutral-hint'; box.className = 'g-neutral-hint'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); box.hidden = true;
      var shop = root.querySelector('.np-decision-hud__shop'), pr = root.querySelector('#np-decision-predict');
      if (shop && pr) shop.insertBefore(box, pr); else root.appendChild(box);
    }
    var n = neutralCards(ctx, selected);
    if (!n.length) { box.hidden = true; box.innerHTML = ''; }
    else {
      var cost = n.reduce(function (a, pid) { return a + costMoney(pol(pid)); }, 0);
      box.hidden = false;
      var hs = n.map(function (pid) { return { pid: pid, h: irrelevantHint(ctx, pid) }; });
      box.setAttribute('data-hint-ids', hs.map(function (x) { return x.h.id || 'fallback'; }).join(','));
      box.innerHTML = '<strong>⚠ 無關卡：' + esc(n.map(polName).join('、')) + '</strong>' +
        hs.map(function (x) { return '<span class="g-neutral-hint__line" data-policy="' + esc(x.pid) + '">' + (hs.length > 1 ? esc(polName(x.pid)) + '：' : '') + esc(x.h.text) + '</span>'; }).join('') +
        '<small>只提示、不擋；' + (cost ? '這季會多花 ' + cost + ' 元，' : '') + '不退費，帳單另列「無關卡」。</small>';
    }
    if (hand) syncAdvice(ctx, hand);
  }

  /* ================= G4 職員執行過程 ================= */
  function execCard(pid) { var a = AP(), c = null; ((a && a.execution && a.execution.cards) || []).forEach(function (x) { if (x.cardId === pid) c = x; }); return c; }
  function staffFor(ctx, pid) {
    var S = st(ctx);
    if (S.assign[pid]) return staffById(S.assign[pid]);
    var C = D().commissions, acc = ctx.commissionsAccepted || [], sid = null;
    ((C && C.commissions) || []).forEach(function (c) { if (!sid && acc.indexOf(c.id) >= 0 && (c.relatedPolicyIds || []).indexOf(pid) >= 0) sid = c.staffId; });
    if (sid) return staffById(sid);
    var ec = execCard(pid); if (ec && ec.staffIds && ec.staffIds[0] && staffById(ec.staffIds[0])) return staffById(ec.staffIds[0]);
    var p = pol(pid), b = p && p.staffFit && p.staffFit.bestStaffIds; if (b && b[0] && staffById(b[0])) return staffById(b[0]);
    return staffList()[0] || null;
  }
  function shopNote(fx) {
    var s = fx && fx.shops; if (!s) return '';
    var parts = [];
    if (s.revenuePct) parts.push('店家營收 ' + (s.revenuePct > 0 ? '+' : '') + Math.round(s.revenuePct * 100) + '%' + (s.durationSeasons && s.durationSeasons < 99 ? '（' + s.durationSeasons + ' 季）' : ''));
    if (s.healthBonus) parts.push('店家體力 +' + s.healthBonus);
    if (s.reopenMoneyDelta) parts.push('重新開張 ' + (s.reopenMoneyDelta < 0 ? '便宜 ' + (-s.reopenMoneyDelta) : '多 ' + s.reopenMoneyDelta) + ' 元');
    return parts.length ? '店家：' + parts.join('、') + (s.delaySeasons ? '（下季起）' : '') : '';
  }
  var EX = { timer: null, onDone: null, finished: false, queue: [], i: 0 };
  function ensureLayer() {
    var L = $('g-exec-layer');
    if (!L) { L = document.createElement('div'); L.id = 'g-exec-layer'; L.className = 'g-exec-layer'; L.hidden = true; document.body.appendChild(L); }
    return L;
  }
  function closePendingCommission(ctx) { /* 玩家沒回應委任就確認：自動關閉彈窗，不算接受也不算婉拒，執行改用推薦／預設職員 */
    var o = $('staff-commission-overlay');
    if (!o || !o.classList.contains('is-open')) return false;
    if (G.StaffCommissionUI && G.StaffCommissionUI.hide) G.StaffCommissionUI.hide();
    else { o.classList.remove('is-open'); o.setAttribute('aria-hidden', 'true'); o.innerHTML = ''; }
    st(ctx).commissionAutoClosed = (st(ctx).commissionAutoClosed | 0) + 1;
    return true;
  }
  function runExec(ctx, policies, onDone) {
    closePendingCommission(ctx);
    var L = ensureLayer(), A = AP(), btn = (A && A.panel && A.panel.buttons) || {};
    var fast = qs('execFast'), scale = fast ? Math.max(0.05, +fast || 0.25) : 1;
    var cards = (policies || []).map(function (pid) {
      var ec = execCard(pid), p = pol(pid), s = staffFor(ctx, pid), r = cardRes(ctx, pid);
      var v = { staff: s ? s.name : '公所貓貓', place: placeOf(ctx, r.eventId), card: p ? p.name : pid };
      var steps = ((ec && ec.steps) || [{ id: 'x1', text: '{staff}出發執行「{card}」', durationHint: 1200 }, { id: 'x2', text: '現場施作中', durationHint: 1800 }, { id: 'x3', text: '回報：執行完成', durationHint: 1400 }])
        .map(function (x) { return { id: x.id, text: fill(x.text, v), ms: x.durationHint || 1500 }; });
      var fx = p && p.fx && p.fx.effect;
      return { pid: pid, staff: s, name: v.card, steps: steps, summary: (ec && ec.resultHint) || (fx && fx.summary) || '', shop: shopNote(fx), executeId: (p && p.executeId) || (ec && ec.executeId) || '' };
    });
    var total = 0; cards.forEach(function (c) { c.steps.forEach(function (s) { total += s.ms; }); });
    var fit = total > 9000 * Math.max(1, cards.length / 2) ? 9000 * Math.max(1, cards.length / 2) / total : 1; /* 多張卡時壓縮，避免拖太久 */
    cards.forEach(function (c) { c.steps.forEach(function (s) { s.ms = Math.max(120, Math.round(s.ms * fit * scale)); }); });
    EX = { timer: null, onDone: onDone, finished: false, queue: cards, i: 0, ctx: ctx };
    L.hidden = false; L.classList.remove('is-eval');
    L.innerHTML = '<div id="exec-panel" data-state="running" role="dialog" aria-modal="true" aria-label="政策執行過程">' +
      '<div class="exec-head"><img class="exec-avatar" alt=""><div class="exec-title"></div><span class="g-exec-count"></span></div>' +
      '<div class="exec-bar"><div class="exec-bar__fill" style="--p:0"></div></div>' +
      '<ol class="exec-steps"></ol><p class="exec-log"></p>' +
      '<div class="g-exec-btns"><button type="button" class="g-exec-skip">' + esc(btn.skip || '跳過動畫') + '</button>' +
      '<button type="button" class="exec-ok">' + esc('看執行評估') + '</button></div></div>';
    L.querySelector('.g-exec-skip').onclick = function () { finishAll(true); };
    L.querySelector('.exec-ok').onclick = function () { if (EX.finished) { var f = EX.onDone; EX.onDone = null; if (f) f(); } };
    if (!cards.length) { finishAll(true); return; }
    playCard(0);
  }
  function panel() { return $('exec-panel'); }
  function playCard(i) {
    var P = panel(); if (!P) return;
    var c = EX.queue[i]; EX.i = i;
    var av = P.querySelector('.exec-avatar');
    av.src = (c.staff && c.staff.avatar) || ''; av.alt = c.staff ? c.staff.name : '';
    av.onerror = function () { av.style.visibility = 'hidden'; };
    P.querySelector('.exec-title').textContent = (c.staff ? c.staff.name + ' · ' : '') + '執行中：' + c.name;
    P.querySelector('.g-exec-count').textContent = EX.queue.length > 1 ? (i + 1) + '／' + EX.queue.length : '';
    P.setAttribute('data-policy', c.pid); P.setAttribute('data-execute-id', c.executeId); P.setAttribute('data-staff', c.staff ? c.staff.id : '');
    P.querySelector('.exec-steps').innerHTML = c.steps.map(function (s) { return '<li class="exec-step" data-state="pending" data-step="' + esc(s.id) + '">' + esc(s.text) + '</li>'; }).join('');
    P.querySelector('.exec-log').textContent = '';
    var lis = P.querySelectorAll('.exec-step'), total = 0, done = 0;
    c.steps.forEach(function (s) { total += s.ms; });
    function step(k) {
      if (EX.finished) return;
      if (k > 0) lis[k - 1].setAttribute('data-state', 'done');
      if (k >= c.steps.length) {
        P.querySelector('.exec-log').textContent = c.summary + (c.shop ? '；' + c.shop : '');
        if (i + 1 < EX.queue.length) { EX.timer = setTimeout(function () { playCard(i + 1); }, 700); }
        else finishAll(false);
        return;
      }
      lis[k].setAttribute('data-state', 'running');
      var before = done; done += c.steps[k].ms;
      setFill((i + before / total) / EX.queue.length);
      EX.timer = setTimeout(function () { setFill((i + done / total) / EX.queue.length); step(k + 1); }, c.steps[k].ms);
    }
    step(0);
  }
  function setFill(p) { var f = panel() && panel().querySelector('.exec-bar__fill'); if (f) f.style.setProperty('--p', String(Math.max(0, Math.min(1, p)))); }
  function finishAll(skipped) {
    if (EX.finished) return;
    clearTimeout(EX.timer); EX.finished = true;
    var P = panel(); if (!P) { var f0 = EX.onDone; EX.onDone = null; if (f0) f0(); return; }
    if (skipped) {
      var last = EX.queue[EX.queue.length - 1];
      if (last && EX.i !== EX.queue.length - 1) playCardStatic(last);
      P.querySelectorAll('.exec-step').forEach(function (li) { li.setAttribute('data-state', 'done'); });
      if (last) P.querySelector('.exec-log').textContent = EX.queue.map(function (c) { return c.name + '：' + c.summary + (c.shop ? '；' + c.shop : ''); }).join('　');
    }
    setFill(1);
    P.setAttribute('data-state', 'done');
    var sk = P.querySelector('.g-exec-skip'); if (sk) sk.hidden = true;
    var ok = P.querySelector('.exec-ok'); if (ok) { try { ok.focus({ preventScroll: true }); } catch (e) {} }
  }
  function playCardStatic(c) {
    var P = panel(); if (!P) return;
    P.querySelector('.exec-title').textContent = (c.staff ? c.staff.name + ' · ' : '') + '執行完成：' + c.name;
    P.querySelector('.exec-steps').innerHTML = c.steps.map(function (s) { return '<li class="exec-step" data-state="done">' + esc(s.text) + '</li>'; }).join('');
  }
  function hideLayer() { var L = $('g-exec-layer'); if (L) { L.hidden = true; L.innerHTML = ''; } }

  /* ================= G5 執行評估卡 ================= */
  function evalLine(ctx, res, v, sevDir, wantNext) {
    var a = AP(), br = a && a.evaluation && a.evaluation.byResult && a.evaluation.byResult[res]; if (!br) return null;
    var S = st(ctx), last = S.lastEvalIds[res] || [];
    var cand = br.lines.filter(function (l) { return !!l.nextStep === !!wantNext && (l.severity === 'any' || l.severity === sevDir) && canFill(l.text, v); });
    var fresh = cand.filter(function (l) { return last.indexOf(l.id) < 0; }); if (fresh.length) cand = fresh;
    var l = pick(rng(ctx, 'advisor:' + v._pid + (wantNext ? ':next' : '')), cand);
    return l ? { id: l.id, text: fill(l.text, v) } : null;
  }
  function evaluate(ctx, policies, bill) {
    var res = ctx.pool && ctx.pool.preview, results = (res && res.results) || [];
    var cmp = (G.Complaint && ctx.complaints && ctx.complaints.pending) ? G.Complaint.previewLines(ctx) : [];
    return (policies || []).map(function (pid) {
      var best = { res: 'none', r: null };
      results.forEach(function (r) { (r.responses || []).forEach(function (x) { if (x.policyId !== pid) return; var k = RES_OF_EFFECT[x.effect] || 'none'; if (RANK[k] < RANK[best.res]) best = { res: k, r: r }; }); });
      var r = best.r, ev = r && poolEv(r.eventId), s = staffFor(ctx, pid);
      var sevFrom = r ? r.severity : null, sevTo = r ? r.severityAfter : null;
      if (best.res === 'backfire' && r) sevTo = Math.min(5, (r.severity || 1) + 1);
      var dir = best.res === 'backfire' ? 'up' : (r && sevTo < sevFrom ? 'down' : 'same');
      var p = pol(pid), dl = p && p.complaintDelta || {}, dkey = r ? r.domainId : null, dn = null;
      cmp.forEach(function (l) { if (l.id === dkey) dn = l.delta; });
      var v = { _pid: pid, staff: s ? s.name : '', card: p ? p.name : '', event: ev ? ev.title : '', domain: dkey ? domainName(dkey) : '', n: dn != null ? Math.abs(dn) : '', sevFrom: sevFrom != null ? sevFrom : '', sevTo: sevTo != null ? sevTo : '', place: placeOf(ctx, r && r.eventId) };
      if (best.res === 'none') { var top = activeEvents(ctx)[0], tev = top && poolEv(top.eventId); v.event = tev ? tev.title : ''; v.domain = tev ? domainName(tev.domainId) : ''; v.sevFrom = tev ? tev.severity : ''; }
      var a = evalLine(ctx, best.res, v, dir, false), b = evalLine(ctx, best.res, v, dir, true);
      return { pid: pid, res: best.res, verdict: VERDICT[best.res], staff: s, eventTitle: ev ? ev.title : '', sevFrom: sevFrom, sevTo: sevTo, line: a, next: b, cmpDelta: dn };
    });
  }
  function showEval(ctx, policies, onNext) {
    var L = ensureLayer(), A = AP(), bill = null;
    try { if (G.Economy && ctx.town) bill = G.Economy.preview(ctx, policies || []); } catch (e) { bill = null; }
    var list = evaluate(ctx, policies, bill), S = st(ctx);
    list.forEach(function (e) { [e.line, e.next].forEach(function (l) { if (!l) return; var k = e.res; S.lastEvalIds[k] = (S.lastEvalIds[k] || []).concat([l.id]).slice(-4); }); });
    var score = list.length ? list.reduce(function (a, e) { return a + ({ cure: 100, assist: 65, palliative: 40, backfire: 0, none: 10 }[e.res]); }, 0) / list.length : 0;
    var lvl = score >= 80 ? '大成功' : score >= 55 ? '成功' : score >= 35 ? '普通' : '待改進';
    var cmp = (G.Complaint && ctx.complaints && ctx.complaints.pending) ? G.Complaint.previewLines(ctx) : [];
    var down = cmp.filter(function (l) { return l.delta < 0; }).sort(function (a, b) { return a.delta - b.delta; }).slice(0, 2);
    var up = cmp.filter(function (l) { return l.delta > 0; }).sort(function (a, b) { return b.delta - a.delta; }).slice(0, 1);
    var flowTxt = bill ? FLOWS.map(function (f) { var x = bill.flows[f]; return FLOW_NAME[f] + ' ' + (x.delta > 0 ? '+' : '') + x.delta; }).join('、') : '';
    L.hidden = false; L.classList.add('is-eval');
    L.innerHTML = '<section id="exec-eval" class="g-eval" role="dialog" aria-modal="true" aria-label="執行評估" data-score="' + Math.round(score) + '">' +
      '<h3 class="g-eval__title">' + esc((A && A.panel && A.panel.sections && A.panel.sections.evaluate) || '執行評估') + '<span class="g-eval__lvl" data-lvl="' + lvl + '">成功度：' + lvl + '（' + Math.round(score) + '）</span></h3>' +
      '<ul class="g-eval__list">' + list.map(function (e) {
        return '<li class="g-eval__item" data-policy="' + esc(e.pid) + '" data-res="' + e.res + '">' +
          '<img class="g-eval__avatar" src="' + esc(e.staff && e.staff.avatar || '') + '" alt="' + esc(e.staff ? e.staff.name : '') + '" onerror="this.style.visibility=\'hidden\'">' +
          '<div class="g-eval__body"><div class="g-eval__head"><b>' + esc(polName(e.pid)) + '</b><em class="g-eval__verdict" data-res="' + e.res + '">' + esc(e.verdict) + '</em>' +
          (e.eventTitle ? '<span class="g-eval__ev">' + esc(e.eventTitle) + (e.sevFrom != null ? '・嚴重度 ' + e.sevFrom + '→' + e.sevTo : '') + '</span>' : '') + '</div>' +
          (e.line ? '<p class="g-eval__line">' + esc((e.staff ? e.staff.name + '：' : '') + e.line.text) + '</p>' : '') +
          (e.next ? '<p class="g-eval__next">' + esc(e.next.text) + '</p>' : '') + '</div></li>';
      }).join('') + '</ul>' +
      '<p class="g-eval__stats">' + (down.length ? '民怨下降：' + down.map(function (l) { return l.name + ' ' + l.delta; }).join('、') : '民怨沒有明顯下降') +
      (up.length ? '；上升：' + up.map(function (l) { return l.name + ' +' + l.delta; }).join('、') : '') + (flowTxt ? '<br>流量：' + esc(flowTxt) : '') + '</p>' +
      '<button type="button" class="exec-ok g-eval__next-btn" id="btn-eval-next">看本季結報</button></section>';
    $('btn-eval-next').onclick = function () { hideLayer(); if (onNext) onNext(); };
    return list;
  }
  /** 結報後記住本季結果（下季建議區 staffReact 用） */
  function rememberSettle(ctx, played) { var S = st(ctx), res = ctx.pool && ctx.pool.preview; S.lastResults = res ? res.results : null; S.lastPlayed = (played || []).slice(); }

  /* ================= G6 街景店面 ================= */
  function renderShops(ctx) {
    var host = $('shop-layer');
    if (!host) {
      var mid = document.querySelector('#street-layers .layer--mid_buildings');
      if (!mid || !mid.parentNode) return;
      host = document.createElement('div'); host.id = 'shop-layer'; host.setAttribute('aria-hidden', 'true');
      mid.parentNode.insertBefore(host, mid.nextSibling);
    }
    var T = ctx && ctx.town; if (!T) { host.innerHTML = ''; return; }
    host.innerHTML = T.shops.slice(0, SHOP_SLOTS.length).map(function (s, i) {
      return '<div class="shop" data-id="' + esc(s.id) + '" data-slot="' + SHOP_SLOTS[i] + '" data-state="' + esc(s.state || 'open') + '" data-name="' + esc(s.name) + '"></div>';
    }).join('');
  }

  /* ================= G7 成就徽章／結局圖 ================= */
  function achDefs() { var E = D().economy; return (E && E.achievements && E.achievements.achievements) || []; }
  function achCheck(ctx, bill) { /* 以結報預覽（pending）判斷「這季會解鎖」的成就；commit 時才寫入 */
    if (!bill || !ctx.town) return [];
    var S = st(ctx), A = S.ach, T = ctx.town, nx = T.pending && T.pending.next, money = T.pending ? T.pending.moneyAfter : 0;
    var cured = A.cured + (bill.cured || 0), noIg = bill.ignored ? 0 : A.noIgnore + 1, owned = ((ctx.poolState && ctx.poolState.owned) || []).concat(bill.cards || []);
    var allPol = Object.keys(D().policies || {}), grades = (nx && nx.grades) || {};
    var up = FLOWS.every(function (f) { return bill.flows[f] && bill.flows[f].delta > 0; });
    var prevented = (bill.opportunities || []).some(function (o) { return o.kind === 'crisis' && o.prevented; });
    var out = [];
    achDefs().forEach(function (a) {
      if (A.unlocked[a.id]) return;
      var c = a.condition || {}, ok = false;
      switch (c.type) {
        case 'cureCount': ok = cured >= c.gte; break;
        case 'cureStreak': ok = (nx ? nx.combo : 0) >= c.gte; break;
        case 'flowsAllUp': ok = up; break;
        case 'noIgnoreStreak': ok = noIg >= c.gte; break;
        case 'finalMoney': ok = bill.season >= 20 && money > c.gt; break;
        case 'chainPrevented': ok = prevented; break;
        case 'seasonNet': ok = bill.net >= c.gte; break;
        case 'reputation': ok = bill.reputation >= c.gte; break;
        case 'gradeCount': ok = (grades[c.grade] || 0) >= c.gte; break;
        case 'comeback': ok = A.low && money > c.thenAbove; break;
        case 'cardsUsed': ok = allPol.length > 0 && allPol.every(function (p) { return owned.indexOf(p) >= 0; }); break;
        case 'seasonsCompleted': ok = bill.season >= c.gte; break;
      }
      if (ok) out.push(a);
    });
    S.achPending = { list: out.map(function (a) { return a.id; }), cured: cured, noIgnore: noIg, low: A.low || money < ((achDefs().filter(function (a) { return a.id === 'comeback'; })[0] || { condition: { moneyBelow: 100 } }).condition.moneyBelow) };
    return out;
  }
  function badgeImg(a, cls) {
    return '<img class="' + (cls || 'g-badge__img') + '" src="assets/sprites/achievements/badge_' + esc(a.id) + '.webp" alt="' + esc(a.name) + '" data-emoji="' + esc(a.emoji || '🏅') + '" ' +
      'onerror="var s=document.createElement(\'span\');s.className=\'g-badge__emoji\';s.textContent=this.getAttribute(\'data-emoji\');this.replaceWith(s)">';
  }
  function badgesHtml(list) {
    if (!list || !list.length) return '';
    return '<div class="g-badges" id="result-badges"><h3>本季解鎖成就</h3><ul>' + list.map(function (a) {
      return '<li class="g-badge" data-ach="' + esc(a.id) + '">' + badgeImg(a) + '<span class="g-badge__name">' + esc(a.name) + '</span><span class="g-badge__text">' + esc(a.text || a.desc || '') + '</span></li>';
    }).join('') + '</ul></div>';
  }
  function commit(ctx) {
    var S = st(ctx), P = S.achPending; S.assign = {};
    if (!P) return;
    P.list.forEach(function (id) { S.ach.unlocked[id] = true; });
    S.ach.cured = P.cured; S.ach.noIgnore = P.noIgnore; S.ach.low = P.low; S.achPending = null;
  }
  var ENDING = { victory: { title: '勝利結局：貓貓市大翻身', text: '流量、店家、金錢與幸福度都達標，全市熱鬧又安心！' }, good: { title: '優良結局：貓貓市穩穩前進', text: '撐過了 20 季，貓貓市比當初更好了。' }, bankrupt: { title: '破產結局：公所沒錢了', text: '金錢見底、貸款也用完了。回頭看看哪些錢花得不值得？' } };
  function endingOf(ctx, bill) {
    var T = ctx.town; if (!T || !bill) return null;
    if (bill.bankrupt || (bill.shopsOpen === 0)) return 'bankrupt';
    var W = (G.Economy && G.Economy.rules) ? G.Economy.rules() : {}, seasons = W['win.seasons'] || 20;
    var tq = +qs('termSeasons'); if (tq > 0) seasons = Math.min(seasons, Math.floor(tq)); /* 測試參數：?termSeasons=N 提早到第 N 季自然結束 */
    if (bill.season < seasons) return null;
    var avg = FLOWS.reduce(function (a, f) { return a + bill.flows[f].value; }, 0) / 4;
    var req = avg >= (W['win.flowAvg'] || 70) && bill.shopsOpen >= (W['win.openShops'] || 7);
    var mOk = bill.balanceAfter >= (W['start.money'] || 1000) * (W['win.moneyMult'] || 2.5);
    var hOk = ctx.metrics && ctx.metrics.happiness >= (W['win.happiness'] || 75);
    return req && mOk && hOk ? 'victory' : 'good';
  }
  /* Stage H：強制結束用的勝利判定（同 endingOf 的勝利條件 economy_rules win.*，但不要求滿 20 季）：
   * 四項流量平均 ≥ win.flowAvg、營業店家 ≥ win.openShops、金錢 ≥ start.money × win.moneyMult、幸福度 ≥ win.happiness。 */
  function winCheck(ctx) {
    var T = ctx && ctx.town, W = (G.Economy && G.Economy.rules) ? G.Economy.rules() : {};
    if (!T || !T.flows) return { ok: false, parts: {} };
    var avg = FLOWS.reduce(function (a, f) { var v = T.flows[f]; return a + (typeof v === 'object' && v ? v.value : (+v || 0)); }, 0) / FLOWS.length;
    var open = (T.shops || []).filter(function (x) { return x.state !== 'closed'; }).length;
    var money = ctx.metrics ? ctx.metrics.money : 0, happy = ctx.metrics ? ctx.metrics.happiness : 0;
    var need = { flowAvg: W['win.flowAvg'] || 70, openShops: W['win.openShops'] || 7, money: (W['start.money'] || 1000) * (W['win.moneyMult'] || 2.5), happiness: W['win.happiness'] || 75 };
    var parts = { flowAvg: avg >= need.flowAvg, openShops: open >= need.openShops, money: money >= need.money, happiness: happy >= need.happiness };
    return { ok: parts.flowAvg && parts.openShops && parts.money && parts.happiness, parts: parts, values: { flowAvg: Math.round(avg * 10) / 10, openShops: open, money: money, happiness: happy }, need: need };
  }
  function endingHtml(kind) {
    var e = ENDING[kind]; if (!e) return '';
    return '<figure class="g-ending" id="result-ending" data-ending="' + kind + '"><img src="assets/sprites/endings/ending_' + kind + '.webp" alt="' + esc(e.title) + '" onerror="this.hidden=true">' +
      '<figcaption><b>' + esc(e.title) + '</b><span>' + esc(e.text) + '</span></figcaption></figure>';
  }

  G.StageG = {
    mountAdvice: mountAdvice, syncAdvice: syncAdvice, onSelection: onSelection, neutralCards: neutralCards, cardRes: cardRes,
    runExec: runExec, finishExec: function () { finishAll(true); }, hideLayer: hideLayer, showEval: showEval, evaluate: evaluate, rememberSettle: rememberSettle,
    renderShops: renderShops, achCheck: achCheck, badgesHtml: badgesHtml, commit: commit, endingOf: endingOf, winCheck: winCheck, endingHtml: endingHtml,
    neutralText: neutralText, irrelevantHint: irrelevantHint, closePendingCommission: closePendingCommission, ready: true
  };
})(typeof window !== 'undefined' ? window : globalThis);
