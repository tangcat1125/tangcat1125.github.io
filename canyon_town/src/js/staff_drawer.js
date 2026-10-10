/**
 * staff_drawer.js — 「公所貓貓」左側抽屜（Stage D）。載入順序：staff.js 之後、main.js 之前。
 * 資料：G.DATA.staff（14 位）、G.DATA.staffDiscussions（byPolicy → discussions）、G.DATA.commissions。
 * 樣式：app.css「STUDIO STAFF DRAWER」（米米）＋「STAGE D」補充。
 * 委任：沿用 G.StaffCommissionUI.show({ctx, commission})（staff.js 本身不改），所以接受／婉拒後的 ctx.commissionsAccepted 等行為與原本相同。
 *
 * G.StaffDrawer：init({getCtx, hooks:{banner, debug}})、setAvailable(bool)、open()、close()、toggle()、isOpen()、
 *   onPolicies(ids)（選卡變動時由 main.js 呼叫）、summon(policyId, {next})、showStaff(id)、back()、state()、syncLayout()。
 * DOM：#staff-drawer（aside.staff-drawer）、#staff-drawer-toggle（.staff-drawer__toggle，≥48px）、#staff-policybar、
 *   #staff-list > li > button.staff-card[data-staff-id][data-role]、#staff-detail、.staff-discussion、.staff-chat__line、
 *   .staff-recommend、.staff-drawer__radar（SVG 星芒）、button.staff-recommend__hire（委任他）。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var doc = global.document;
  var STANCE = {
    support: { icon: '👍', label: '贊成', cls: 'stance--support' },
    hold: { icon: '🤔', label: '保留', cls: 'stance--hold' },
    oppose: { icon: '👎', label: '反對', cls: 'stance--oppose' }
  };
  var AXIS_FALLBACK = [
    { key: 'logistics', label: '物流' }, { key: 'safety', label: '治安' }, { key: 'health', label: '衛生' },
    { key: 'engineering', label: '工務' }, { key: 'economy', label: '經濟' }, { key: 'communication', label: '溝通' }
  ];
  var ST = {
    inited: false, available: false, open: false, mode: 'roster', filter: 'all',
    policies: [], active: null, staffId: null, discId: null, discPolicy: null, fallback: false,
    steps: {}, getCtx: function () { return {}; }, hooks: {}, els: {}, imgOk: {}, timer: null
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return doc.getElementById(id); }
  function roster() { var r = G.DATA && G.DATA.staff; return (r && r.staff) || (Array.isArray(r) ? r : []); }
  function axes() { var r = G.DATA && G.DATA.staff; return (r && r.radarAxes && r.radarAxes.length) ? r.radarAxes : AXIS_FALLBACK; }
  function findStaff(id) { var l = roster(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function policyOf(id) { return (G.DATA && G.DATA.policies && G.DATA.policies[id]) || null; }
  function policyName(id) { var p = policyOf(id); return p ? p.name : id; }
  function commissions() { var c = G.DATA && G.DATA.commissions; return (c && c.commissions) || (Array.isArray(c) ? c : []); }
  function findCommission(id) { var l = commissions(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function discData() { return (G.DATA && G.DATA.staffDiscussions) || null; }
  function findDisc(id) { var d = discData(); var l = (d && d.discussions) || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function discIdsFor(policyId) { var d = discData(); return (d && d.byPolicy && d.byPolicy[policyId]) || []; }
  function ctx() { return ST.getCtx() || {}; }

  /* ---------- 頭像：avatar 圖，缺檔／載入失敗用 fallbackEmoji ---------- */
  function applyFallback(el, s) {
    el.classList.add('is-fallback');
    el.style.backgroundImage = 'none';
    el.textContent = s.fallbackEmoji || '🐱';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', s.name || '職員');
  }
  function avatarEl(s, size) {
    var el = doc.createElement('span');
    el.className = 'staff-avatar' + (size === 'lg' ? ' staff-avatar--lg' : (size === 'sm' ? ' staff-avatar--sm' : ''));
    el.setAttribute('data-role', s.artAlias || '');
    el.setAttribute('data-staff-id', s.id);
    var url = s.avatar || '';
    if (!url) { applyFallback(el, s); return el; }
    el.style.backgroundImage = 'url("' + url + '")';
    if (ST.imgOk[url] === false) { applyFallback(el, s); return el; }
    if (ST.imgOk[url] === undefined) {
      var im = new global.Image();
      im.onload = function () { ST.imgOk[url] = true; };
      im.onerror = function () {
        ST.imgOk[url] = false;
        var all = doc.querySelectorAll('.staff-avatar[data-staff-id="' + s.id + '"]');
        for (var i = 0; i < all.length; i++) applyFallback(all[i], s);
      };
      im.src = url;
    }
    return el;
  }
  function avatarHtml(s, size) {
    var tmp = doc.createElement('div'); tmp.appendChild(avatarEl(s, size)); return tmp.innerHTML;
  }

  /* ---------- 星芒圖（SVG，6 軸；樣式內嵌，不依賴報紙 CSS 變數） ---------- */
  function radarSvg(radar, name) {
    var A = axes(), n = A.length, size = 240, cx = size / 2, cy = size / 2, rMax = size * 0.34;
    function pt(i, t) {
      var ang = -Math.PI / 2 + i * 2 * Math.PI / n, rr = rMax * Math.max(0, Math.min(1, t));
      return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
    }
    var g = '';
    [0.2, 0.4, 0.6, 0.8, 1].forEach(function (lv) {
      var pts = []; for (var i = 0; i < n; i++) { var p = pt(i, lv); pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
      g += '<polygon class="grid" fill="none" stroke="#d4c8a8" stroke-width="1" points="' + pts.join(' ') + '"/>';
    });
    var ax = '', lb = '', pp = [], vals = [];
    for (var i = 0; i < n; i++) {
      var tip = pt(i, 1), lab = pt(i, 1.24), v = (radar && radar[A[i].key]) || 0;
      ax += '<line class="grid" stroke="#d4c8a8" stroke-width="1" x1="' + cx + '" y1="' + cy + '" x2="' + tip[0].toFixed(1) + '" y2="' + tip[1].toFixed(1) + '"/>';
      lb += '<text class="axis-label" fill="#1a1a1a" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="middle" x="' + lab[0].toFixed(1) + '" y="' + lab[1].toFixed(1) + '">' + esc(A[i].label) + v + '</text>';
      var p2 = pt(i, v / 5); pp.push(p2[0].toFixed(1) + ',' + p2[1].toFixed(1));
      vals.push(A[i].label + v);
    }
    return '<svg class="staff-radar-svg" viewBox="0 0 ' + size + ' ' + size + '" role="img" data-axes="' + n + '" aria-label="' + esc((name || '') + '能力星芒圖：' + vals.join('、')) + '">' +
      g + ax + '<polygon class="poly" fill="rgba(196,30,30,0.35)" stroke="#c41e1e" stroke-width="2" points="' + pp.join(' ') + '"/>' + lb + '</svg>';
  }
  function radarBox(s) { return '<div class="staff-drawer__radar" data-staff-id="' + s.id + '">' + radarSvg(s.radar, s.name) + '</div>'; }

  function stanceTag(stance, labelOverride) {
    var s = STANCE[stance] || STANCE.hold;
    return '<span class="staff-stance ' + s.cls + '" data-stance="' + esc(stance) + '"><span class="staff-stance__icon" aria-hidden="true">' + s.icon + '</span>' + esc(labelOverride || s.label) + '</span>';
  }

  /* ---------- 名單 ---------- */
  function hiredSet() {
    var acc = ctx().commissionsAccepted || [], out = {};
    acc.forEach(function (id) { var c = findCommission(id); if (c) out[c.staffId] = true; });
    return out;
  }
  function relatedSet(policyId) {
    var out = {};
    if (!policyId) return out;
    discIdsFor(policyId).forEach(function (id) { var d = findDisc(id); if (d) (d.panel || []).forEach(function (sid) { out[sid] = true; }); });
    roster().forEach(function (s) { if ((s.preferredPolicyIds || []).indexOf(policyId) >= 0) out[s.id] = true; });
    commissions().forEach(function (c) { if ((c.relatedPolicyIds || []).indexOf(policyId) >= 0 && c.staffId !== 'staff_cheng') out[c.staffId] = true; });
    return out;
  }
  function renderPolicyBar() {
    var bar = ST.els.policybar; if (!bar) return;
    if (!ST.policies.length) {
      bar.innerHTML = '<p class="staff-drawer__hint" id="staff-hint">選一張政策卡，召喚相關職員討論</p>';
      return;
    }
    bar.innerHTML = '<p class="staff-drawer__hint">已選政策卡——按下召喚，三位職員會針對這張卡討論：</p>' +
      ST.policies.map(function (pid) {
        return '<button type="button" class="staff-drawer__btn staff-summon' + (pid === ST.discPolicy && ST.mode === 'discuss' ? ' is-active' : '') + '" data-policy="' + esc(pid) + '">💬 召喚討論：' + esc(policyName(pid)) + '</button>';
      }).join('');
  }
  function renderList() {
    var ul = ST.els.list; if (!ul) return;
    var hired = hiredSet(), rel = relatedSet(ST.active), list = roster().slice();
    if (ST.active) list.sort(function (a, b) { return (rel[b.id] ? 1 : 0) - (rel[a.id] ? 1 : 0); });
    if (ST.filter === 'related') list = list.filter(function (s) { return rel[s.id]; });
    ul.innerHTML = '';
    list.forEach(function (s) {
      var li = doc.createElement('li');
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'staff-card' + (hired[s.id] ? ' is-hired' : '') + (ST.staffId === s.id ? ' is-selected' : '') + (rel[s.id] ? ' is-related' : '');
      b.setAttribute('data-staff-id', s.id);
      b.setAttribute('data-role', s.artAlias || '');
      b.appendChild(avatarEl(s));
      var mid = doc.createElement('span');
      mid.className = 'staff-card__mid';
      mid.innerHTML = '<b class="staff-card__name">' + esc(s.name) + '</b>' +
        '<span class="staff-card__title">' + esc(s.title || '') + (s.org ? '・' + esc(s.org) : '') + (rel[s.id] ? ' <em class="staff-card__rel">★ 與所選卡相關</em>' : '') + '</span>' +
        '<span class="staff-card__phrase">「' + esc(s.catchphrase || '') + '」</span>' +
        '<span class="staff-card__chips">' + (s.domainLabels || s.domains || []).map(function (d) { return '<span class="staff-chip">' + esc(d) + '</span>'; }).join('') + '</span>';
      b.appendChild(mid);
      var tag = doc.createElement('span'); tag.className = 'staff-card__tag'; tag.textContent = s.section || s.org || '公所';
      b.appendChild(tag);
      li.appendChild(b); ul.appendChild(li);
    });
    var cnt = doc.querySelector('.staff-drawer__count'); if (cnt) cnt.textContent = roster().length + ' 位職員';
    var f = doc.querySelectorAll('.staff-drawer__filter');
    for (var i = 0; i < f.length; i++) f[i].classList.toggle('is-active', f[i].getAttribute('data-filter') === ST.filter);
  }

  /* ---------- 詳情 ---------- */
  function setDetail(html, mode) {
    ST.mode = mode;
    var d = ST.els.detail; d.hidden = !html; d.innerHTML = html || '';
    ST.els.drawer.classList.toggle('is-detail', !!html);
    ST.els.drawer.classList.toggle('is-discuss', mode === 'discuss');
    d.scrollTop = 0;
  }
  function backBtn() { return '<button type="button" class="staff-drawer__btn staff-drawer__btn--ghost staff-back">← 返回職員名單</button>'; }
  function showStaff(id) {
    var s = findStaff(id); if (!s) return;
    ST.staffId = id; ST.discId = null;
    var order = ST.policies.slice(); Object.keys((s.adviceByPolicy || {})).forEach(function (p) { if (order.indexOf(p) < 0) order.push(p); });
    var adv = order.filter(function (p) { return s.adviceByPolicy && s.adviceByPolicy[p]; }).map(function (p) {
      var a = s.adviceByPolicy[p];
      return '<li class="staff-advice' + (ST.policies.indexOf(p) >= 0 ? ' is-selected' : '') + '" data-policy="' + esc(p) + '"><div><b>' + esc(policyName(p)) + '</b> ' + stanceTag(a.stance, a.stanceLabel) + '</div><p>' + esc(a.line) + '</p><small>理由：' + esc(a.reason) + '</small></li>';
    }).join('');
    var html = backBtn() +
      '<div class="staff-dialog staff-dialog--profile">' + avatarHtml(s, 'lg') +
        '<div class="staff-dialog__bubble"><span class="staff-dialog__name">' + esc(s.name) + '・' + esc(s.title || '') + '</span>' +
        esc(s.opener || s.speakLine || s.catchphrase || '') +
        '<p class="staff-dialog__sub">個性：' + esc(s.personality || '') + '</p>' +
        '<p class="staff-dialog__sub">口頭禪：「' + esc(s.catchphrase || '') + '」</p>' +
        (s.speakLine && s.speakLine !== s.catchphrase ? '<p class="staff-dialog__sub">委任時會說：「' + esc(s.speakLine) + '」</p>' : '') + '</div></div>' +
      radarBox(s) +
      '<p class="staff-drawer__fit">專長：' + esc((s.domainLabels || s.domains || []).join('、')) + '　（星芒 1–5，越外圈越強）</p>' +
      '<h4 class="staff-h4">對各政策卡的看法</h4><ul class="staff-advice-list">' + adv + '</ul>';
    setDetail(html, 'staff');
    renderList(); renderPolicyBar();
  }

  function fitPct(s, c) {
    if (!s || !c || !c.minRadar) return null;
    var ks = Object.keys(c.minRadar); if (!ks.length) return null;
    var ok = 0; ks.forEach(function (k) { if ((s.radar[k] || 0) >= c.minRadar[k]) ok++; });
    return Math.round(ok / ks.length * 100);
  }
  /* 沒有討論資料時：用各職員的 adviceByPolicy 湊一組（相關度最高的 3 位） */
  function fallbackDiscussion(policyId) {
    var rel = relatedSet(policyId), coms = commissions().filter(function (c) { return (c.relatedPolicyIds || []).indexOf(policyId) >= 0; });
    var comStaff = {}; coms.forEach(function (c) { comStaff[c.staffId] = c; });
    var scored = roster().filter(function (s) { return s.adviceByPolicy && s.adviceByPolicy[policyId]; }).map(function (s) {
      var a = s.adviceByPolicy[policyId];
      return { s: s, score: (rel[s.id] ? 2 : 0) + (comStaff[s.id] ? 1 : 0) + (a.stance === 'support' ? 1 : 0) };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
    var panel = scored.map(function (x) { return x.s.id; });
    var best = null;
    scored.forEach(function (x) { if (comStaff[x.s.id] && !best) best = { staffId: x.s.id, commissionId: comStaff[x.s.id].id }; });
    if (!best && coms.length) best = { staffId: coms[0].staffId, commissionId: coms[0].id };
    return {
      id: 'fallback_' + policyId, policyId: policyId, policyName: policyName(policyId), title: policyName(policyId) + '：職員怎麼看？', fallback: true,
      panel: panel, opener: '', rounds: scored.map(function (x) { var a = x.s.adviceByPolicy[policyId]; return { speakerId: x.s.id, stance: a.stance, line: a.line, reason: a.reason }; }),
      recommend: best ? { staffId: best.staffId, commissionId: best.commissionId, reason: '這位職員的專長與委任任務跟這張卡最相關。', fit: null } : null,
      takeaway: '沒有現成的討論稿，先看各課室對這張卡的立場與理由。'
    };
  }

  function summon(policyId, opts) {
    opts = opts || {};
    if (!policyId) return null;
    var ids = discIdsFor(policyId).filter(function (id) { return !!findDisc(id); });
    var d, c = ctx(), cyc = (c.poolState && c.poolState.cycle) || (c.monthIndex || 0) + 1, key = policyId + '|' + cyc;
    if (ids.length) {
      if (ST.steps[key] === undefined) {
        var seed = (c.poolState && c.poolState.seed) || 'staff', r = (G.EventPool && G.EventPool.rngFor) ? G.EventPool.rngFor(seed, cyc, 'staff:' + policyId)() : Math.random();
        ST.steps[key] = Math.floor(r * ids.length);
      } else if (opts.next) ST.steps[key] = (ST.steps[key] + 1) % ids.length;
      d = findDisc(ids[ST.steps[key] % ids.length]);
      ST.fallback = false;
    } else { d = fallbackDiscussion(policyId); ST.fallback = true; }
    ST.discId = d.id; ST.discPolicy = policyId; ST.staffId = null;
    if (!ST.open) open();
    var panel = (d.panel || []).map(findStaff).filter(Boolean);
    var first = panel[0] || findStaff((d.rounds[0] || {}).speakerId);
    var rec = d.recommend, recS = rec && findStaff(rec.staffId), comm = rec && findCommission(rec.commissionId);
    var accepted = comm && (ctx().commissionsAccepted || []).indexOf(comm.id) >= 0;
    var html = backBtn() +
      '<section class="staff-discussion" data-discussion-id="' + esc(d.id) + '" data-policy-id="' + esc(policyId) + '" data-fallback="' + (d.fallback ? 1 : 0) + '">' +
      '<h3 class="staff-discussion__title">' + esc(d.title) + '</h3>' +
      '<p class="staff-discussion__policy">政策卡：<b>' + esc(policyName(policyId)) + '</b></p>' +
      '<ul class="staff-panel-mini" aria-label="討論小組">' + panel.map(function (s) { return '<li data-staff-id="' + s.id + '">' + avatarHtml(s, 'sm') + '<span>' + esc(s.name) + '</span></li>'; }).join('') + '</ul>' +
      (d.opener && first ? '<div class="staff-dialog staff-dialog--opener">' + avatarHtml(first, 'sm') + '<div class="staff-dialog__bubble"><span class="staff-dialog__name">' + esc(first.name) + '（開場）</span>' + esc(d.opener) + '</div></div>' : '') +
      '<ol class="staff-chat">' + (d.rounds || []).map(function (r) {
        var s = findStaff(r.speakerId); if (!s) return '';
        return '<li class="staff-chat__line ' + (STANCE[r.stance] || STANCE.hold).cls + '" data-speaker="' + s.id + '" data-stance="' + esc(r.stance) + '">' + avatarHtml(s, 'sm') +
          '<div class="staff-chat__main"><div class="staff-chat__who"><b>' + esc(s.name) + '</b>' + stanceTag(r.stance) + '</div><p>' + esc(r.line) + '</p>' + (r.reason ? '<small>理由：' + esc(r.reason) + '</small>' : '') + '</div></li>';
      }).join('') + '</ol>' +
      (rec && recS ? '<div class="staff-recommend" data-staff-id="' + recS.id + '" data-commission-id="' + esc(rec.commissionId || '') + '">' +
        '<h4 class="staff-h4">⭐ 推薦人選</h4>' +
        '<div class="staff-dialog staff-dialog--rec">' + avatarHtml(recS, 'lg') + '<div class="staff-dialog__bubble"><span class="staff-dialog__name">' + esc(recS.name) + '・' + esc(recS.title || '') + '</span>' + esc(rec.reason || '') +
          (rec.fit != null ? '<p class="staff-dialog__sub">適配度 ' + Math.round(rec.fit * 100) + '%' + (rec.fitBestInPanel ? '（小組內最高）' : '') + '</p>' : (fitPct(recS, comm) != null ? '<p class="staff-dialog__sub">星芒適配約 ' + fitPct(recS, comm) + '%</p>' : '')) + '</div></div>' +
        radarBox(recS) +
        (comm ? '<p class="staff-drawer__fit">可委任任務：<b>' + esc(comm.title) + '</b>——' + esc(comm.blurb || '') + '</p>' : '') +
      '</div>' : '<p class="staff-drawer__fit">這張卡目前沒有可直接委任的人選。</p>') +
      '<p class="staff-takeaway"><b>小結：</b>' + esc(d.takeaway || '') + '</p>' +
      '<div class="staff-drawer__actions">' +
        (comm ? '<button type="button" class="staff-drawer__btn staff-recommend__hire" data-commission="' + esc(comm.id) + '"' + (accepted ? ' disabled' : '') + '>' + (accepted ? '✅ 已委任' : '📨 委任他') + '</button>' : '') +
        (ids.length > 1 ? '<button type="button" class="staff-drawer__btn staff-drawer__btn--ghost staff-next">🔄 換一組討論</button>' : '') +
      '</div></section>';
    setDetail(html, 'discuss');
    renderList(); renderPolicyBar();
    return d;
  }

  /* ---------- 委任（沿用 staff.js 的委任面板） ---------- */
  function hire(commissionId) {
    var c = findCommission(commissionId); if (!c || !G.StaffCommissionUI) return false;
    var cx = ctx();
    return G.StaffCommissionUI.show({
      ctx: cx, commission: c,
      onAccept: function (cm, staff) {
        if (ST.hooks.banner) ST.hooks.banner('已委託 ' + (staff && staff.name ? staff.name : '公職') + '：「' + (cm && cm.title ? cm.title : '') + '」— 確認並結報，貓貓市照常日常運行', true);
        if (ST.hooks.debug) ST.hooks.debug();
        refresh();
      },
      onDecline: function () {
        if (ST.hooks.banner) ST.hooks.banner('已婉拒委任 — 仍可用點數買政策卡後確認並結報', true);
        refresh();
      }
    });
  }
  function refresh() {
    renderList(); renderPolicyBar();
    if (ST.mode === 'discuss' && ST.discPolicy) summonKeep();
  }
  function summonKeep() { /* 重畫目前討論（不換組） */
    var p = ST.discPolicy; if (p) summon(p);
  }

  /* ---------- 開關與版面 ---------- */
  function syncLayout() {
    var d = ST.els.drawer, t = ST.els.toggle; if (!d) return;
    var bar = $('round-bar'), np = $('newspaper-overlay');
    var barOn = bar && !bar.hidden && !(np && np.classList.contains('is-open'));
    var top = barOn ? Math.max(0, Math.ceil(bar.getBoundingClientRect().bottom)) : 0;
    d.style.top = top ? top + 'px' : '';
    var want = Math.round(global.innerHeight * 0.4);
    t.style.top = (top && want < top + 12) ? (top + 12) + 'px' : '';
  }
  function open() {
    if (!ST.inited) return;
    ST.open = true;
    ST.els.drawer.classList.add('is-open'); ST.els.drawer.setAttribute('aria-hidden', 'false');
    ST.els.toggle.setAttribute('aria-expanded', 'true'); ST.els.toggle.classList.add('is-open');
    syncLayout(); renderList(); renderPolicyBar();
  }
  function close() {
    ST.open = false;
    ST.els.drawer.classList.remove('is-open'); ST.els.drawer.setAttribute('aria-hidden', 'true');
    ST.els.toggle.setAttribute('aria-expanded', 'false'); ST.els.toggle.classList.remove('is-open');
  }
  function toggle() { if (ST.open) close(); else open(); }
  function back() { ST.staffId = null; ST.discId = null; setDetail('', 'roster'); renderList(); renderPolicyBar(); }

  function onPolicies(ids) {
    var prev = ST.policies;
    ST.policies = (ids || []).slice();
    var added = ST.policies.filter(function (p) { return prev.indexOf(p) < 0; });
    ST.active = ST.policies.length ? ST.policies[ST.policies.length - 1] : null;
    if (!ST.inited) return;
    if (ST.mode === 'discuss') {
      if (!ST.policies.length) back();
      else if (added.length) summon(added[added.length - 1]);
      else if (ST.policies.indexOf(ST.discPolicy) < 0) summon(ST.active);
    }
    renderList(); renderPolicyBar();
    if (ST.mode === 'staff' && ST.staffId) showStaff(ST.staffId);
  }

  function init(opts) {
    if (ST.inited) return;
    opts = opts || {};
    ST.getCtx = opts.getCtx || ST.getCtx; ST.hooks = opts.hooks || {};
    var aside = doc.createElement('aside');
    aside.id = 'staff-drawer'; aside.className = 'staff-drawer'; aside.setAttribute('aria-label', '公所貓貓'); aside.setAttribute('aria-hidden', 'true');
    aside.innerHTML =
      '<div class="staff-drawer__head"><h2 class="staff-drawer__title">🐾 公所貓貓</h2><span class="staff-drawer__count"></span>' +
      '<button type="button" class="staff-drawer__close" id="staff-drawer-close" aria-label="關閉公所貓貓">✕</button></div>' +
      '<div class="staff-drawer__body">' +
        '<div class="staff-drawer__policybar" id="staff-policybar" aria-live="polite"></div>' +
        '<div class="staff-drawer__filters"><button type="button" class="staff-drawer__filter is-active" data-filter="all">全部職員</button><button type="button" class="staff-drawer__filter" data-filter="related">與所選卡相關</button></div>' +
        '<ul class="staff-drawer__list" id="staff-list"></ul>' +
        '<div class="staff-drawer__detail" id="staff-detail" hidden></div>' +
      '</div>';
    var tg = doc.createElement('button');
    tg.type = 'button'; tg.id = 'staff-drawer-toggle'; tg.className = 'staff-drawer__toggle'; tg.hidden = true;
    tg.setAttribute('aria-expanded', 'false'); tg.setAttribute('aria-controls', 'staff-drawer'); tg.setAttribute('aria-label', '打開公所貓貓職員抽屜');
    tg.innerHTML = '公所貓貓<span class="badge">' + roster().length + '</span>';
    doc.body.appendChild(aside); doc.body.appendChild(tg);
    ST.els = { drawer: aside, toggle: tg, list: $('staff-list'), detail: $('staff-detail'), policybar: $('staff-policybar') };
    ST.inited = true;
    tg.addEventListener('click', toggle);
    $('staff-drawer-close').addEventListener('click', close);
    aside.addEventListener('click', function (e) {
      var t = e.target;
      var f = t.closest && t.closest('.staff-drawer__filter'); if (f) { ST.filter = f.getAttribute('data-filter'); renderList(); return; }
      var card = t.closest && t.closest('.staff-card'); if (card) { showStaff(card.getAttribute('data-staff-id')); return; }
      var sm = t.closest && t.closest('.staff-summon'); if (sm) { summon(sm.getAttribute('data-policy')); return; }
      if (t.closest && t.closest('.staff-back')) { back(); return; }
      if (t.closest && t.closest('.staff-next')) { summon(ST.discPolicy, { next: true }); return; }
      var hb = t.closest && t.closest('.staff-recommend__hire'); if (hb && !hb.disabled) { hire(hb.getAttribute('data-commission')); return; }
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ST.open) close(); });
    global.addEventListener('resize', syncLayout);
    ST.timer = global.setInterval(function () { if (ST.available) syncLayout(); }, 500);
    renderList(); renderPolicyBar();
  }
  function setAvailable(on) {
    ST.available = !!on;
    if (ST.els.toggle) ST.els.toggle.hidden = !on;
    if (!on && ST.open) close();
  }

  G.StaffDrawer = {
    init: init, setAvailable: setAvailable, open: open, close: close, toggle: toggle, isOpen: function () { return ST.open; },
    onPolicies: onPolicies, summon: summon, showStaff: showStaff, back: back, hire: hire, syncLayout: syncLayout,
    state: function () { return { open: ST.open, mode: ST.mode, policies: ST.policies.slice(), active: ST.active, staffId: ST.staffId, discussionId: ST.discId, discPolicy: ST.discPolicy, fallback: ST.fallback, available: ST.available }; },
    ready: true
  };
})(typeof window !== 'undefined' ? window : globalThis);
