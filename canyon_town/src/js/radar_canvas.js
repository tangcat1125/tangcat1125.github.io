/* 六軸星芒圖：canvas 點陣繪製。G.RadarCanvas
 *   draw(o) → <canvas>：o = { w, h, cx, cy, r, scale(預設 2 倍清晰度), vals[0..1], labels[], rings[], ringColor, spokeColor, fill, stroke, lineWidth, dot, dotColor, labelR(倍率), font, labelColor }
 *   imgHtml(o, cls, alt) → '<img src="data:image/png…">'（staff／staff_drawer 等以字串組 HTML 的地方用）
 *   任命狀：stage_h 用同一個 canvas 顯示在螢幕／列印，下載 PNG 時直接 drawImage 這個 canvas。 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var FONT = '"Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei","PingFang TC","Heiti TC",sans-serif';
  function pts(n, cx, cy, r, vals) { return vals.map(function (v, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v]; }); }
  function poly(c, p) { c.beginPath(); p.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }
  function draw(o) {
    o = o || {};
    var k = o.scale || 2, w = o.w || 240, h = o.h || w, n = (o.vals && o.vals.length) || 6;
    var cv = global.document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    var c = cv.getContext('2d'); if (!c) return cv;
    c.scale(k, k);
    var cx = o.cx != null ? o.cx : w / 2, cy = o.cy != null ? o.cy : h / 2, r = o.r || w * 0.34, ones = [];
    for (var i = 0; i < n; i++) ones.push(1);
    c.lineJoin = 'round';
    c.strokeStyle = o.ringColor || '#d4c8a8'; c.lineWidth = o.gridWidth || 1;
    (o.rings || [0.2, 0.4, 0.6, 0.8, 1]).forEach(function (lv) { poly(c, pts(n, cx, cy, r, ones.map(function () { return lv; }))); c.stroke(); });
    c.strokeStyle = o.spokeColor || o.ringColor || '#d4c8a8';
    pts(n, cx, cy, r, ones).forEach(function (q) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(q[0], q[1]); c.stroke(); });
    var vp = pts(n, cx, cy, r, (o.vals || []).map(function (v) { return Math.max(o.minVal || 0, Math.min(1, +v || 0)); }));
    poly(c, vp); c.fillStyle = o.fill || 'rgba(196,30,30,0.35)'; c.fill(); c.strokeStyle = o.stroke || '#c41e1e'; c.lineWidth = o.lineWidth || 2; c.stroke();
    if (o.dot) { c.fillStyle = o.dotColor || o.stroke || '#c41e1e'; vp.forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], o.dot, 0, Math.PI * 2); c.fill(); }); }
    if (o.labels) {
      c.font = o.font || ('800 12px ' + FONT); c.fillStyle = o.labelColor || '#1a1a1a'; c.textAlign = 'center'; c.textBaseline = 'middle';
      pts(n, cx, cy, r * (o.labelR || 1.24), ones).forEach(function (q, i) { if (o.labels[i] != null) c.fillText(String(o.labels[i]), q[0], q[1]); });
    }
    return cv;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function imgHtml(o, cls, alt) {
    var url = ''; try { url = draw(o).toDataURL('image/png'); } catch (e) { url = ''; }
    return '<img class="' + esc(cls || 'radar-img') + '" src="' + url + '" width="' + (o.w || 240) + '" height="' + (o.h || o.w || 240) + '" alt="' + esc(alt || '能力星芒圖') + '" draggable="false">';
  }
  G.RadarCanvas = { draw: draw, imgHtml: imgHtml, pts: pts };
})(window);
