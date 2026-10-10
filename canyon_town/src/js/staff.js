/**
 * staff.js — 公職官員星芒圖 + 委任任務 UI（MVP scaffold）。
 * 政策階段／選卡後彈出；接受後寫入 ctx.commissionsAccepted（結報提示用）。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  var AXIS_KEYS = ['logistics', 'safety', 'health', 'engineering', 'economy', 'communication'];
  var AXIS_LABELS = {
    logistics: '物流',
    safety: '治安',
    health: '衛生',
    engineering: '工務',
    economy: '經濟',
    communication: '溝通'
  };

  function getRoster() {
    var raw = (G.DATA && G.DATA.staff) || null;
    if (!raw) return { staff: [], radarAxes: [] };
    if (Array.isArray(raw)) return { staff: raw, radarAxes: [] };
    return {
      staff: raw.staff || [],
      radarAxes: raw.radarAxes || []
    };
  }

  function getCommissionsPack() {
    var raw = (G.DATA && G.DATA.commissions) || null;
    if (!raw) return { commissions: [], trigger: {} };
    if (Array.isArray(raw)) return { commissions: raw, trigger: {} };
    return {
      commissions: raw.commissions || [],
      trigger: raw.trigger || {},
      intro: raw.intro || ''
    };
  }

  function findStaff(id) {
    var list = getRoster().staff;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function radarFitScore(staff, minRadar) {
    if (!staff || !staff.radar || !minRadar) return 1;
    var keys = Object.keys(minRadar);
    if (!keys.length) return 1;
    var ok = 0;
    keys.forEach(function (k) {
      if ((staff.radar[k] || 0) >= (minRadar[k] || 0)) ok += 1;
    });
    return ok / keys.length;
  }

  /** 依已選政策／核心問題挑一則尚未處理的委任 */
  function pickCommission(ctx) {
    var pack = getCommissionsPack();
    var list = pack.commissions || [];
    var selected = (ctx && ctx.policiesSelected) || [];
    var accepted = (ctx && ctx.commissionsAccepted) || [];
    var declined = (ctx && ctx.commissionsDeclined) || [];
    var done = {};
    accepted.concat(declined).forEach(function (id) { done[id] = true; });
    var problems = (ctx && ctx.problems) || {};
    var coreIds = (ctx && ctx.season && ctx.season.coreProblemIds) || [];

    function matchesPolicies(c) {
      var ids = c.relatedPolicyIds || [];
      if (!ids.length) return false;
      for (var i = 0; i < ids.length; i++) {
        if (selected.indexOf(ids[i]) >= 0) return true;
      }
      return false;
    }

    function matchesCore(c) {
      var eids = c.relatedEventIds || [];
      for (var i = 0; i < eids.length; i++) {
        if (coreIds.indexOf(eids[i]) >= 0 && (problems[eids[i]] == null || problems[eids[i]] > 0)) {
          return true;
        }
      }
      return false;
    }

    // 1) 與已選政策對上的
    var i, c, staff, score;
    var ranked = [];
    for (i = 0; i < list.length; i++) {
      c = list[i];
      if (done[c.id]) continue;
      if (!matchesPolicies(c)) continue;
      staff = findStaff(c.staffId);
      score = radarFitScore(staff, c.minRadar) + 2;
      ranked.push({ c: c, score: score, staff: staff });
    }
    // 2) 政策階段／報紙解鎖：核心問題相關或 newspaperUnlock
    if (!ranked.length) {
      for (i = 0; i < list.length; i++) {
        c = list[i];
        if (done[c.id]) continue;
        var when = c.appearWhen || '';
        var ok = false;
        if (when === 'newspaperUnlock' || when === 'policyPhaseOrCoreProblem') ok = true;
        if (matchesCore(c)) ok = true;
        if (!ok && !when && matchesCore(c)) ok = true;
        if (!ok) continue;
        staff = findStaff(c.staffId);
        score = radarFitScore(staff, c.minRadar);
        ranked.push({ c: c, score: score, staff: staff });
      }
    }
    ranked.sort(function (a, b) { return b.score - a.score; });
    return ranked.length ? ranked[0] : null;
  }

  function buildRadarSvg(radar, size) {
    size = size || 240;
    var cx = size / 2;
    var cy = size / 2;
    var rMax = size * 0.36;
    var n = AXIS_KEYS.length;
    var roster = getRoster();
    var labelMap = {};
    (roster.radarAxes || []).forEach(function (a) {
      if (a && a.key) labelMap[a.key] = a.label;
    });

    function pt(i, t) {
      var ang = (-Math.PI / 2) + (i * 2 * Math.PI / n);
      var rr = rMax * Math.max(0, Math.min(1, t));
      return {
        x: cx + Math.cos(ang) * rr,
        y: cy + Math.sin(ang) * rr
      };
    }

    var grids = '';
    var levels = [0.2, 0.4, 0.6, 0.8, 1];
    levels.forEach(function (lv) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var p = pt(i, lv);
        pts.push(p.x.toFixed(1) + ',' + p.y.toFixed(1));
      }
      grids += '<polygon class="grid" points="' + pts.join(' ') + '"/>';
    });

    var axes = '';
    var labels = '';
    for (var i = 0; i < n; i++) {
      var tip = pt(i, 1);
      axes += '<line class="grid" x1="' + cx + '" y1="' + cy +
        '" x2="' + tip.x.toFixed(1) + '" y2="' + tip.y.toFixed(1) + '"/>';
      var lab = pt(i, 1.22);
      var key = AXIS_KEYS[i];
      var text = labelMap[key] || AXIS_LABELS[key] || key;
      labels += '<text class="axis-label" text-anchor="middle" dominant-baseline="middle" x="' +
        lab.x.toFixed(1) + '" y="' + lab.y.toFixed(1) + '">' + text + '</text>';
    }

    var polyPts = [];
    for (i = 0; i < n; i++) {
      var v = (radar && radar[AXIS_KEYS[i]]) || 0;
      var p2 = pt(i, v / 5);
      polyPts.push(p2.x.toFixed(1) + ',' + p2.y.toFixed(1));
    }

    return '<svg class="staff-radar" viewBox="0 0 ' + size + ' ' + size +
      '" role="img" aria-label="能力星芒圖">' +
      grids + axes +
      '<polygon class="poly" points="' + polyPts.join(' ') + '"/>' +
      labels +
      '</svg>';
  }

  function ensureOverlay() {
    var el = document.getElementById('staff-commission-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'staff-commission-overlay';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }

  function hide() {
    var el = document.getElementById('staff-commission-overlay');
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '';
  }

  /**
   * 顯示委任面板。opts: { ctx, commission?, onAccept, onDecline, onSkip }
   * 若未傳 commission，會依 ctx 自動挑一則；沒有則 onSkip。
   */
  function show(opts) {
    opts = opts || {};
    var ctx = opts.ctx || {};
    var picked = opts.commission
      ? { c: opts.commission, staff: findStaff(opts.commission.staffId) }
      : pickCommission(ctx);
    if (!picked || !picked.c) {
      if (typeof opts.onSkip === 'function') opts.onSkip();
      return false;
    }
    var c = picked.c;
    var staff = picked.staff || findStaff(c.staffId) || {
      name: '公職',
      title: '官員',
      org: '市公所',
      avatar: '',
      radar: {},
      speakLine: ''
    };
    var fit = radarFitScore(staff, c.minRadar);
    var fitPct = Math.round(fit * 100);
    var overlay = ensureOverlay();
    var avatar = staff.avatar || '';
    overlay.innerHTML =
      '<div class="staff-panel" role="dialog" aria-modal="true" aria-labelledby="staff-mission-title">' +
        '<div class="staff-panel__head">' +
          (avatar
            ? '<img class="staff-panel__avatar" src="' + avatar + '" alt="' + staff.name + '" width="72" height="72"/>'
            : '<div class="staff-panel__avatar" aria-hidden="true"></div>') +
          '<div class="staff-panel__who">' +
            '<h2>' + staff.name + ' · ' + (staff.title || '') + '</h2>' +
            '<div class="org">' + (staff.org || '') + '　提出委任</div>' +
          '</div>' +
        '</div>' +
        '<div class="staff-panel__body">' +
          '<h3 class="staff-panel__mission-title" id="staff-mission-title">' + c.title + '</h3>' +
          '<p class="staff-panel__blurb">' + (c.blurb || '') + '</p>' +
          '<p class="staff-panel__speak">「' + (staff.speakLine || '') + '」</p>' +
          '<p class="staff-panel__fit">星芒適配約 ' + fitPct + '%' +
            (c.radarFitHint ? '　（' + c.radarFitHint + '）' : '') +
            '　— 對照下圖再決定要不要委託</p>' +
          '<div class="staff-radar-wrap">' + buildRadarSvg(staff.radar || {}) + '</div>' +
        '</div>' +
        '<div class="staff-panel__actions">' +
          '<button type="button" class="newspaper__btn newspaper__btn--primary" id="staff-btn-accept">接受委任</button>' +
          '<button type="button" class="newspaper__btn" id="staff-btn-decline">婉拒</button>' +
        '</div>' +
        '<p class="staff-panel__hint">' +
          (c.acceptHint || '') + '<br>' + (c.declineHint || '') +
        '</p>' +
      '</div>';

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    var btnA = overlay.querySelector('#staff-btn-accept');
    var btnD = overlay.querySelector('#staff-btn-decline');
    if (btnA) {
      btnA.onclick = function () {
        if (!ctx.commissionsAccepted) ctx.commissionsAccepted = [];
        if (ctx.commissionsAccepted.indexOf(c.id) < 0) ctx.commissionsAccepted.push(c.id);
        if (!ctx.commissionHints) ctx.commissionHints = [];
        if (c.replayHint) ctx.commissionHints.push(c.replayHint);
        hide();
        if (typeof opts.onAccept === 'function') opts.onAccept(c, staff);
      };
    }
    if (btnD) {
      btnD.onclick = function () {
        if (!ctx.commissionsDeclined) ctx.commissionsDeclined = [];
        if (ctx.commissionsDeclined.indexOf(c.id) < 0) ctx.commissionsDeclined.push(c.id);
        hide();
        if (typeof opts.onDecline === 'function') opts.onDecline(c, staff);
      };
    }
    return true;
  }

  /** 政策變更時嘗試彈出相關委任（已開著則不重開） */
  function maybeOfferForPolicies(ctx, policyIds) {
    var overlay = document.getElementById('staff-commission-overlay');
    if (overlay && overlay.classList.contains('is-open')) return false;
    ctx.policiesSelected = policyIds || ctx.policiesSelected || [];
    return show({ ctx: ctx });
  }

  G.StaffCommissionUI = {
    show: show,
    hide: hide,
    pickCommission: pickCommission,
    maybeOfferForPolicies: maybeOfferForPolicies,
    findStaff: findStaff,
    AXIS_KEYS: AXIS_KEYS,
    AXIS_LABELS: AXIS_LABELS
  };
})(window);
