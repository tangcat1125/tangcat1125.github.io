/**
 * stage_h.js — Stage H：強制結束（H1）＋任期結算「貓貓市市長任命狀」（H3）。行為紀錄在 behavior_log.js（H2）。
 * 資料唯一來源：G.DATA.ending = { profileRules, comments, certificate }（呆呆 data/ending/mayor_*.json，docs/ENDING_CERT.md）。
 * DOM hook（給米米換美術／CSS，見 docs/STAGE_H.md）：#btn-force-end、#h-end-confirm（#btn-end-yes／#btn-end-no）、#cert-overlay、#cert-ending、#ending-cert（STUDIO ENDING CERT 根）＞#certificate（.h-cert__*）、
 *   #cert-radar、.h-cert__seal、#cert-name-form（#cert-name-input／#btn-cert-name-ok）、#btn-cert-print、#btn-cert-png、#btn-cert-new。
 * 下載圖片：純 canvas 重繪（不用 html2canvas、不畫外部圖片，避免 file:// 汙染 canvas）→ toDataURL('image/png')。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var opts = { getCtx: null, onEnd: null }, state = { data: null, png: null, ended: false };
  var FONT = '"Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei","PingFang TC","Heiti TC",sans-serif';
  var SERIF = '"Noto Serif TC","Noto Serif CJK TC","PMingLiU","Songti TC",' + FONT;

  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* 唯一來源：G.DATA.ending = { profileRules, comments, certificate }（呆呆 data/ending/mayor_*.json；docs/ENDING_CERT.md）。
   * 計分／排序／評語／任命狀填字＝tools/ending_profile_ref.js 同邏輯（scoreProfile／rankAxes／pickComment／fillCertificate）。 */
  function E() { return G.DATA.ending || {}; }
  function V(x) { return (x && typeof x === 'object' && 'value' in x) ? x.value : x; }
  function num(x) { return typeof x === 'number' && isFinite(x); }
  function fill(t, v) { return String(t == null ? '' : t).replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ''; }); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ================= 計分（G.DATA.ending.profileRules） ================= */
  function axisScore(a, m) {
    var sw = 0, ss = 0;
    var parts = a.components.map(function (c) {
      var v = m[c.metric];
      if (!num(v)) return { metric: c.metric, label: c.label, value: null, score: null, weight: V(c.weight) };
      var lo = V(c.lo), hi = V(c.hi), w = V(c.weight), sc = clamp((v - lo) / (hi - lo), 0, 1) * 100;
      sw += w; ss += w * sc;
      return { metric: c.metric, label: c.label, value: Math.round(v * 1000) / 1000, score: Math.round(sc), weight: w };
    });
    var s = sw ? Math.round(ss / sw) : V(a.noDataScore);
    (a.caps || []).forEach(function (cp) { if (m[cp.when] === true) s = Math.min(s, V(cp.max)); });
    s = clamp(s, V(a.clamp.min), V(a.clamp.max));
    return { parts: parts, score: s, noData: !sw };
  }
  function scoreProfile(m, R) {
    R = R || E().profileRules; m = m || {};
    var axes = R.axes.map(function (a) { var r = axisScore(a, m); return { id: a.id, name: a.name, short: a.short, order: a.order, parts: r.parts, score: r.score, noData: r.noData }; });
    var tw = R.axes.reduce(function (t, a) { return t + V(a.weight); }, 0);
    var overall = Math.round(axes.reduce(function (t, x, i) { return t + x.score * V(R.axes[i].weight); }, 0) / tw);
    var g = R.grades.slice().sort(function (a, b) { return V(b.min) - V(a.min); }).filter(function (x) { return overall >= V(x.min); })[0];
    return { axes: axes, overall: overall, grade: g.id, gradeLabel: g.label };
  }
  function rankAxes(P) {
    var ax = P.axes.slice();
    var byHigh = ax.slice().sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    var strong = byHigh.slice(0, 2).sort(function (a, b) { return a.order - b.order; }).map(function (x) { return x.id; });
    var rest = ax.filter(function (x) { return strong.indexOf(x.id) < 0; }).sort(function (a, b) { return a.score - b.score || b.order - a.order; });
    return { strong: strong, weak: rest[0].id, top: byHigh[0].id };
  }
  function pickComment(P, Cm, seedStr) {
    Cm = Cm || E().comments;
    var rk = rankAxes(P), h = hash(seedStr || 'cert');
    var combo = Cm.combos.filter(function (c) { return c.strong[0] === rk.strong[0] && c.strong[1] === rk.strong[1] && c.weak === rk.weak; })[0];
    var g = Cm.grades.filter(function (x) { return x.id === P.grade; })[0];
    var line = combo.lines[h % combo.lines.length], sum = g.summary[(h >>> 3) % g.summary.length], tips = Cm.tryNext[rk.weak], tip = tips[(h >>> 5) % tips.length];
    return { strong: rk.strong, weak: rk.weak, top: rk.top, comboId: combo.id, lineId: line.id, text: line.text + sum.text, summary: sum.text, title: g.titles[rk.top], tip: tip.text, tipId: tip.id };
  }
  function certVars(cert, o) {
    var P = o.profile, C = o.comment, nm = function (id) { return ((P.axes.filter(function (a) { return a.id === id; })[0]) || {}).name || ''; };
    return { playerName: o.playerName || cert.defaults.playerName, termNo: o.termNo || cert.defaults.termNo, seasons: o.seasons, date: o.date,
      grade: P && P.grade, gradeLabel: P && P.gradeLabel, totalScore: P && P.overall, mayorTitle: C && C.title,
      strongName1: C && nm(C.strong[0]), strongName2: C && nm(C.strong[1]), weakName: C && nm(C.weak), weakTip: C && C.tip };
  }
  var CERT_KEYS = ['title', 'body', 'featureLabel', 'feature', 'expectLabel', 'expect', 'closing', 'issuer', 'signer', 'dateLine', 'seal'];
  function fillCertificate(cert, versionId, o) {
    cert = cert || E().certificate;
    var ver = cert.versions.filter(function (v) { return v.id === (versionId || cert.defaultVersion); })[0] || cert.versions[0], vars = certVars(cert, o || {}), out = { id: ver.id, missing: [] };
    CERT_KEYS.forEach(function (k) { var miss = []; out[k] = String(ver[k] || '').replace(/\{(\w+)\}/g, function (_, x) { if (vars[x] == null || vars[x] === '') { miss.push(x); return ''; } return String(vars[x]); }); out.missing = out.missing.concat(miss); });
    return out;
  }
  function rocDate(d) { d = d || new Date(); return '中華民國 ' + (d.getFullYear() - 1911) + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'; }
  function qs(name) { try { var m = new RegExp('[?&]' + name + '=([^&]*)').exec(global.location.search); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; } }

  /* ================= 六軸星芒圖（螢幕 SVG／下載 canvas）、印章（米米 PNG） ================= */
  function radarPts(n, cx, cy, r, vals) { return vals.map(function (v, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v]; }); }
  var RADAR = { w: 360, h: 352, cx: 180, cy: 176, r: 118 };
  /* 下載 PNG 用：canvas 重繪星芒（radar_canvas.js） */
  function radarCanvas(axes) {
    if (!G.RadarCanvas) return null;
    return G.RadarCanvas.draw({ w: RADAR.w, h: RADAR.h, cx: RADAR.cx, cy: RADAR.cy, r: RADAR.r, scale: 3, rings: [0.25, 0.5, 0.75, 1], ringColor: '#d9c39a', gridWidth: 1.2, spokeColor: '#d9c39a',
      vals: axes.map(function (a) { return Math.max(0.02, a.score / 100); }), fill: 'rgba(214,64,46,0.35)', stroke: '#c0392b', lineWidth: 2.5, dot: 4, dotColor: '#c0392b',
      labels: axes.map(function (a) { return a.short + ' ' + a.score; }), labelR: (RADAR.r + 30) / RADAR.r, font: 'bold 14px ' + FONT, labelColor: '#3b2a12' });
  }
  /* 螢幕／列印：SVG 星芒（用戶 10/10 18:57 指定雷達用 SVG）；下載 PNG：radarCanvas() 同資料重繪（file:// 不汙染 canvas） */
  function radarSvg(axes) {
    var n = axes.length || 6, W = RADAR.w, cx = RADAR.cx, cy = RADAR.cy, r = RADAR.r, out = [];
    [0.25, 0.5, 0.75, 1].forEach(function (k) { out.push('<polygon class="h-radar__ring" points="' + radarPts(n, cx, cy, r, axes.map(function () { return k; })).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>'); });
    radarPts(n, cx, cy, r, axes.map(function () { return 1; })).forEach(function (p) { out.push('<line class="h-radar__spoke" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'); });
    var vp = radarPts(n, cx, cy, r, axes.map(function (a) { return Math.max(0.02, a.score / 100); }));
    out.push('<polygon class="h-radar__value" points="' + vp.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>');
    vp.forEach(function (p) { out.push('<circle class="h-radar__dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4"/>'); });
    radarPts(n, cx, cy, r + 30, axes.map(function () { return 1; })).forEach(function (p, i) {
      out.push('<text class="h-radar__label" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 5).toFixed(1) + '" text-anchor="middle">' + esc(axes[i].short) + ' ' + axes[i].score + '</text>');
    });
    return '<svg id="cert-radar" class="h-radar" viewBox="0 0 ' + W + ' ' + RADAR.h + '" role="img" aria-label="六軸星芒圖：' + esc(axes.map(function (a) { return a.name + ' ' + a.score; }).join('、')) + '">' + out.join('') + '</svg>';
  }
  var SEAL_SRC = 'assets/sprites/ending/seal_cat_city_hall.webp';
  function sealHtml(text) { return '<img class="h-cert__seal-img" src="' + SEAL_SRC + '" alt="' + esc(text || '貓貓市公所印') + '" draggable="false">'; }

  /* ================= H1 強制結束 ================= */
  function mountButton() {
    var b = $('btn-force-end');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'btn-force-end'; b.className = 'h-force-end';
      b.innerHTML = '<img class="h-force-end__icon" src="assets/sprites/ending/ui_force_end.webp" alt="" aria-hidden="true" draggable="false"><span class="h-force-end__text">結束任期</span>';
      b.setAttribute('aria-label', '強制結束：結束任期並查看結算'); b.hidden = true;
      document.body.appendChild(b);
    }
    b.onclick = openConfirm;
    return b;
  }
  function setVisible(on) { var b = mountButton(); b.hidden = !on || state.ended; }
  function openConfirm() {
    if (state.ended) return;
    var d = $('h-end-confirm');
    if (!d) {
      d = document.createElement('div'); d.id = 'h-end-confirm'; d.className = 'h-end-confirm'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'h-end-confirm-msg');
      d.innerHTML = '<div class="h-end-confirm__card"><p id="h-end-confirm-msg" class="h-end-confirm__msg">確定要結束任期並查看結算嗎？</p>' +
        '<p class="h-end-confirm__hint">結束後會產生你的「市長任命狀」，這一局就不能再繼續了。</p>' +
        '<div class="h-end-confirm__btns"><button type="button" id="btn-end-yes" class="h-btn h-btn--danger">確定結束</button><button type="button" id="btn-end-no" class="h-btn">繼續執政</button></div></div>';
      document.body.appendChild(d);
    }
    d.hidden = false;
    $('btn-end-no').onclick = function () { d.hidden = true; try { $('btn-force-end').focus(); } catch (e) {} };
    $('btn-end-yes').onclick = function () { d.hidden = true; if (opts.onEnd) opts.onEnd('forced'); };
    try { $('btn-end-no').focus(); } catch (e) {}
  }

  /* ================= H3 任命狀（G.DATA.ending.certificate） ================= */
  function buildData(ctx, info) {
    var EN = E(), R = EN.profileRules, Cm = EN.comments, Ce = EN.certificate;
    var lg = G.BehaviorLog ? (G.BehaviorLog.get() || G.BehaviorLog.load()) : null;
    var m = G.BehaviorLog ? G.BehaviorLog.metrics(lg, R) : {};
    var P = scoreProfile(m, R), name = (lg && lg.studentName) || '', seasons = m.seasons || 0, kind = info.kind || 'good';
    var C = pickComment(P, Cm, name + '|' + ((lg && lg.seed) || '') + '|' + seasons);
    var date = rocDate(new Date()), termNo = (lg && lg.termNo) || Ce.defaults.termNo;
    var F = fillCertificate(Ce, qs('certVersion') || Ce.defaultVersion, { playerName: name, termNo: termNo, seasons: seasons, date: date, profile: P, comment: C });
    var T = ctx && ctx.town, gr = (Cm.grades.filter(function (g) { return g.id === P.grade; })[0]) || {};
    return {
      townName: Ce.townName || '貓貓市', cert: F, version: F.id, name: name, termNo: termNo, seasons: seasons, kind: kind, reason: info.reason,
      axes: P.axes, overall: P.overall, grade: { id: P.grade, label: P.gradeLabel }, gradeTitles: gr.titles, comment: C.text, mayorTitle: C.title, tip: C.tip, strong: C.strong, weak: C.weak, top: C.top, comboId: C.comboId,
      stats: { finalMoney: m.finalMoney, shops: m.finalShops, shopsTotal: T && T.shops ? T.shops.length : 8, avgComplaint: m.avgComplaint, avgFlow: m.avgFlowRaw },
      date: date, metrics: m, rulesStatus: R && R.status, certStatus: Ce.status,
      fun: { mayorClicks: (lg && lg.mayorAnan && lg.mayorAnan.clicks) || 0, mayorName: (G.DATA.mayorAnanQA && G.DATA.mayorAnanQA.names && G.DATA.mayorAnanQA.names.mayorName) || '安安市長' } /* Stage I 趣味統計（0＝不顯示） */
    };
  }
  function fmt(v, unit) { return v == null ? '—' : (Math.round(v * 10) / 10) + (unit || ''); }
  function nameHtml(text, name) { var t = esc(text), n = esc(name); return n && t.indexOf(n) >= 0 ? t.replace(n, '<b class="h-cert__name">' + n + '</b>') : t; }
  function certHtml(D) {
    var F = D.cert;
    return '<section id="ending-cert" class="h-cert-root" data-version="' + esc(D.version) + '" data-grade="' + esc(D.grade.id) + '" data-ending="' + esc(D.kind) + '" data-reason="' + esc(D.reason || '') + '">' +
      '<article id="certificate" class="h-cert" data-grade="' + esc(D.grade.id) + '" data-ending="' + esc(D.kind) + '" data-reason="' + esc(D.reason || '') + '">' +
      '<div class="h-cert__frame">' +
      '<header class="h-cert__head"><h1 class="h-cert__title">' + esc(F.title) + '</h1><p class="h-cert__sub">' + esc(D.townName) + '・第 ' + esc(D.termNo) + ' 任</p></header>' +
      '<p class="h-cert__body">' + nameHtml(F.body, D.name) + '</p>' +
      '<div class="h-cert__main"><div class="h-cert__radar">' + radarSvg(D.axes) + '</div>' +
      '<div class="h-cert__side"><div class="h-cert__grade"><span class="h-cert__grade-id">' + esc(D.grade.id) + '</span><span class="h-cert__grade-label">' + esc(D.grade.label) + '</span><small class="h-cert__overall">總分 ' + D.overall + '</small>' +
      '<small class="h-cert__title-badge">' + esc(D.mayorTitle) + '</small></div>' +
      '<ul class="h-cert__axes">' + D.axes.map(function (a) { return '<li data-axis="' + esc(a.id) + '" data-score="' + a.score + '"' + (a.noData ? ' data-nodata="1"' : '') + '><span>' + esc(a.name) + '</span><i style="--v:' + a.score + '"></i><b>' + a.score + (a.noData ? '<small class="h-cert__nodata">資料不足</small>' : '') + '</b></li>'; }).join('') + '</ul>' +
      '<p class="h-cert__feature"><b>' + esc(F.featureLabel) + '</b>' + esc(F.feature) + '</p>' +
      '<p class="h-cert__expect"><b>' + esc(F.expectLabel) + '</b>' + esc(F.expect) + '</p>' +
      '<p class="h-cert__comment">' + esc(D.comment) + '</p>' + (F.closing ? '<p class="h-cert__closing">' + esc(F.closing) + '</p>' : '') + '</div></div>' +
      '<dl class="h-cert__stats">' +
      '<div><dt>任期</dt><dd data-stat="seasons">' + D.seasons + ' 季</dd></div>' +
      '<div><dt>最終金錢</dt><dd data-stat="money">' + fmt(D.stats.finalMoney, ' 元') + '</dd></div>' +
      '<div><dt>營業店家</dt><dd data-stat="shops">' + (D.stats.shops == null ? '—' : D.stats.shops + ' / ' + D.stats.shopsTotal) + '</dd></div>' +
      '<div><dt>平均民怨</dt><dd data-stat="complaint">' + fmt(D.stats.avgComplaint) + '</dd></div>' +
      '<div><dt>平均流量</dt><dd data-stat="flow">' + fmt(D.stats.avgFlow) + '</dd></div></dl>' +
      (D.fun && D.fun.mayorClicks > 0 ? '<p class="h-cert__fun" data-stat="mayorAnan">趣味統計：任期內你找' + esc(D.fun.mayorName) + '問了 ' + D.fun.mayorClicks + ' 次問題</p>' : '') +
      '<footer class="h-cert__foot"><div class="h-cert__issuer"><b>' + esc(F.issuer) + '</b><span>' + esc(F.signer) + '</span></div>' +
      '<div class="h-cert__date">' + esc(F.dateLine) + '</div><div class="h-cert__seal">' + sealHtml(F.seal) + '</div></footer>' +
      '</div></article></section>';
  }
  function endingFig(kind) {
    if (G.StageG && G.StageG.endingHtml) return G.StageG.endingHtml(kind).replace('id="result-ending"', 'id="cert-ending"').replace('class="g-ending"', 'class="g-ending h-cert-ending"');
    return '<figure id="cert-ending" class="g-ending h-cert-ending" data-ending="' + esc(kind) + '"><img src="assets/sprites/endings/ending_' + esc(kind) + '.webp" alt=""></figure>';
  }
  function overlay() {
    var o = $('cert-overlay');
    if (!o) { o = document.createElement('div'); o.id = 'cert-overlay'; o.className = 'h-cert-overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', '任期結算'); document.body.appendChild(o); }
    o.hidden = false; return o;
  }
  var NAME_PROMPT = '請輸入你的名字，才能領取市長任命狀';
  function showEnding(ctx, info) {
    info = info || {}; state.ended = true; setVisible(false);
    var cf = $('h-end-confirm'); if (cf) cf.hidden = true;
    var o = overlay(), lg = G.BehaviorLog ? (G.BehaviorLog.get() || G.BehaviorLog.load()) : null;
    o.setAttribute('data-ending', info.kind || 'good'); o.setAttribute('data-reason', info.reason || '');
    if (!(lg && lg.studentName)) {
      o.innerHTML = '<div class="h-cert-wrap">' + endingFig(info.kind || 'good') +
        '<form id="cert-name-form" class="h-name-form" autocomplete="off"><h2>' + esc(NAME_PROMPT) + '</h2>' +
        '<label for="cert-name-input">學生姓名</label><input id="cert-name-input" type="text" maxlength="20" required>' +
        '<button type="submit" id="btn-cert-name-ok" class="h-btn h-btn--primary" disabled>領取任命狀</button></form></div>';
      var inp = $('cert-name-input'), ok = $('btn-cert-name-ok');
      inp.oninput = function () { ok.disabled = !inp.value.trim(); };
      $('cert-name-form').onsubmit = function (ev) {
        ev.preventDefault(); var n = inp.value.trim(); if (!n) return;
        if (G.BehaviorLog) G.BehaviorLog.setName(n);
        showEnding(ctx, info);
      };
      try { inp.focus(); } catch (e) {}
      return null;
    }
    var D = buildData(ctx, info); state.data = D; state.webp = null;
    o.innerHTML = '<div class="h-cert-wrap">' + endingFig(D.kind) + certHtml(D) +
      '<div class="h-cert-actions"><button type="button" id="btn-cert-print" class="h-btn h-btn--primary">列印任命狀</button>' +
      '<button type="button" id="btn-cert-png" class="h-btn">下載成圖片</button><button type="button" id="btn-cert-new" class="h-btn h-btn--ghost">開新局</button></div></div>';
    $('btn-cert-print').onclick = function () { global.print(); };
    $('btn-cert-png').onclick = function () { download(); };
    $('btn-cert-new').onclick = function () { try { global.location.reload(); } catch (e) {} };
    return D;
  }

  /* ================= 下載成圖片：canvas 重繪（A4 橫式 1754×1240） ================= */
  function wrap(cx, text, maxW) {
    var lines = [], line = '';
    var NOHEAD = '，。、；：！？」』）》…';
    String(text).split('').forEach(function (ch) { if (cx.measureText(line + ch).width > maxW && line && NOHEAD.indexOf(ch) < 0) { lines.push(line); line = ch; } else line += ch; }); /* 標點不放行首 */
    if (line) lines.push(line); return lines;
  }
  /* 下載圖美術：G.CertArt（src/js/cert_art.js，tools/build_cert_art.py 由 assets/sprites/ending/ 產生的 data-URI）。沒有就用純 canvas 畫框與印章。 */
  var ART_SCALE = 0.82, art = {};
  function preloadArt() { var A = G.CertArt; if (!A) return; ['bg', 'seal'].forEach(function (k) { if (A[k] && !art[k]) { var im = new Image(); im.src = A[k]; art[k] = im; } }); }
  function artImg(k) { preloadArt(); var im = art[k]; return im && im.complete && im.naturalWidth > 0 ? im : null; }
  function drawPng(D) {
    D = D || state.data; if (!D) return null;
    var F = D.cert, W = 1754, H = 1240, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var cx = cv.getContext('2d'); if (!cx) return null;
    var bgImg = artImg('bg'), sealImg = artImg('seal');
    cx.fillStyle = '#fffaf0'; cx.fillRect(0, 0, W, H);
    if (bgImg) { /* 米米底圖（data-URI，canvas 不受汙染）：花框佔外圈，內容整體縮進框內 */
      cx.drawImage(bgImg, 0, 0, W, H);
      cx.save(); cx.translate(W / 2, H / 2); cx.scale(ART_SCALE, ART_SCALE); cx.translate(-W / 2, -H / 2 + 8);
    } else {
      cx.strokeStyle = '#b8862b'; cx.lineWidth = 14; cx.strokeRect(36, 36, W - 72, H - 72);
      cx.strokeStyle = '#a3241c'; cx.lineWidth = 4; cx.strokeRect(62, 62, W - 124, H - 124);
    }
    cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.fillStyle = '#7a1a12';
    cx.font = 'bold 92px ' + SERIF; cx.fillText(F.title, W / 2, 180);
    cx.font = '30px ' + FONT; cx.fillStyle = '#9a7a3a'; cx.fillText(D.townName + '・第 ' + D.termNo + ' 任', W / 2, 228);
    cx.fillStyle = '#2b1d0e'; cx.font = '36px ' + SERIF;
    wrap(cx, F.body, W - 300).forEach(function (l, i) { cx.fillText(l, W / 2, 296 + i * 50); });
    /* 星芒圖：radar_canvas.js 重繪（與螢幕 SVG 同資料、同配色） */
    var rk = 1.95, rcv = radarCanvas(D.axes);
    if (rcv) cx.drawImage(rcv, 440 - RADAR.cx * rk, 690 - RADAR.cy * rk, RADAR.w * rk, RADAR.h * rk);
    /* 等第＋稱號＋六軸＋施政特色／期許／評語 */
    var x0 = 860; cx.textAlign = 'left';
    cx.fillStyle = '#a3241c'; cx.font = 'bold 120px ' + SERIF; cx.fillText(D.grade.id, x0, 474);
    cx.font = 'bold 46px ' + SERIF; cx.fillText(D.grade.label + '　' + D.mayorTitle, x0 + 106, 430);
    cx.font = '28px ' + FONT; cx.fillStyle = '#5a4520'; cx.fillText('總分 ' + D.overall, x0 + 108, 472);
    D.axes.forEach(function (a, i) {
      var y = 518 + i * 34; cx.fillStyle = '#3b2a12'; cx.font = '26px ' + FONT; cx.fillText(a.name, x0, y);
      cx.fillStyle = '#eadfc6'; cx.fillRect(x0 + 300, y - 20, 360, 20); cx.fillStyle = '#d6402e'; cx.fillRect(x0 + 300, y - 20, 3.6 * a.score, 20);
      cx.fillStyle = '#3b2a12'; cx.font = 'bold 26px ' + FONT; cx.fillText(String(a.score) + (a.noData ? ' 資料不足' : ''), x0 + 676, y);
    });
    var y0 = 744; cx.font = '26px ' + FONT;
    [[F.featureLabel, F.feature], [F.expectLabel, F.expect], ['', D.comment]].forEach(function (pr) {
      var t = (pr[0] ? pr[0] + '：' : '') + pr[1];
      wrap(cx, t, 780).slice(0, 3).forEach(function (l) { cx.fillStyle = '#2b1d0e'; cx.fillText(l, x0, y0); y0 += 34; });
      y0 += 6;
    });
    /* 數據摘要 */
    var st = [['任期', D.seasons + ' 季'], ['最終金錢', fmt(D.stats.finalMoney, ' 元')], ['營業店家', D.stats.shops == null ? '—' : D.stats.shops + ' / ' + D.stats.shopsTotal], ['平均民怨', fmt(D.stats.avgComplaint)], ['平均流量', fmt(D.stats.avgFlow)]];
    cx.textAlign = 'center';
    var stX0 = bgImg ? 360 : 200, stDx = bgImg ? 200 : 250; /* 有底圖時避開四角貓 */
    st.forEach(function (s, i) { var x = stX0 + i * stDx; cx.fillStyle = '#9a7a3a'; cx.font = '24px ' + FONT; cx.fillText(s[0], x, 1046); cx.fillStyle = '#2b1d0e'; cx.font = 'bold 32px ' + FONT; cx.fillText(s[1], x, 1086); });
    /* 發令單位、日期、印章 */
    cx.textAlign = 'left'; cx.fillStyle = '#2b1d0e'; cx.font = 'bold 32px ' + SERIF; cx.fillText(F.issuer + (F.signer ? '　' + F.signer : ''), bgImg ? 330 : 110, 1146);
    cx.textAlign = 'center'; cx.font = '28px ' + SERIF; cx.fillText(F.dateLine, W / 2 + 160, 1146);
    var sx = bgImg ? W - 490 : W - 290, sy = bgImg ? 1010 : 1000, ss = 170, seal = String(F.seal || '貓貓市公所印');
    if (sealImg) { cx.save(); cx.translate(sx + ss / 2, sy + ss / 2); cx.rotate(-0.07); cx.globalCompositeOperation = 'multiply'; cx.drawImage(sealImg, -ss / 2 - 6, -ss / 2 - 6, ss + 12, ss + 12); cx.restore(); }
    else { cx.save(); cx.translate(sx + ss / 2, sy + ss / 2); cx.rotate(-0.08); cx.translate(-(sx + ss / 2), -(sy + ss / 2));
    cx.strokeStyle = 'rgba(200,30,30,0.85)'; cx.lineWidth = 8; cx.strokeRect(sx, sy, ss, ss); cx.lineWidth = 3; cx.strokeRect(sx + 12, sy + 12, ss - 24, ss - 24);
    cx.fillStyle = 'rgba(200,30,30,0.85)'; cx.textAlign = 'center';
    var ch = seal.split(''), cols = Math.ceil(ch.length / 2), fs = Math.min(58, Math.floor((ss - 30) / cols));
    cx.font = 'bold ' + fs + 'px ' + SERIF;
    ch.forEach(function (c, i) { var col = Math.floor(i / 2), row = i % 2; cx.fillText(c, sx + ss - 12 - (col + 0.5) * ((ss - 24) / cols), sy + 76 + row * 62); });
    cx.restore(); }
    if (bgImg) cx.restore();
    var url = cv.toDataURL('image/png'); state.webp = url; return url;
  }
  function download() {
    var url = drawPng(); if (!url) return null;
    var a = document.createElement('a'); a.href = url; a.download = (state.data ? state.data.townName : '貓貓市') + '市長任命狀_' + ((state.data && state.data.name) || '學生') + '.webp';
    document.body.appendChild(a); a.click(); setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
    return url;
  }

  function init(o) { try { preloadArt(); } catch (e) {} opts.getCtx = o && o.getCtx; opts.onEnd = o && o.onEnd; mountButton(); }

  G.StageH = {
    init: init, setVisible: setVisible, openConfirm: openConfirm, showEnding: showEnding,
    scoreProfile: scoreProfile, rankAxes: rankAxes, pickComment: pickComment, fillCertificate: fillCertificate, certVars: certVars, hash: hash, buildData: buildData, certHtml: certHtml, radarSvg: radarSvg, radarCanvas: radarCanvas, drawPng: drawPng, download: download,
    data: function () { return state.data; }, lastPng: function () { return state.webp; }, artReady: function () { return !!(artImg('bg') && artImg('seal')); }, isEnded: function () { return state.ended; }, ready: true
  };
})(window);
