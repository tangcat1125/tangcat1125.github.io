/**
 * landing.js — 入口畫面資料綁定（G.DATA.entryMarquee）。
 * 只填內容：跑馬燈 lines、速度（speedPxPerSec）、CTA 文字（ctaLabel）、a11yLabel。
 * 不處理「開始遊戲」流程（那在 main.js：#btn-landing-start → 隱藏 #landing → 自動開跑）。
 * 資料缺漏時完全保留 index.html 內的靜態文字。須在 data_embed.js 之後載入。
 */
(function (global) {
  'use strict';
  var G = global.Game;
  var doc = global.document;
  var DEFAULT_SPEED = 60;

  function getData() {
    var m = G && G.DATA && G.DATA.entryMarquee;
    if (!m || !Array.isArray(m.lines)) return null;
    var lines = m.lines.filter(function (t) { return typeof t === 'string' && t.trim(); });
    return lines.length ? { m: m, lines: lines } : null;
  }

  function fillTrack(track, lines, sep) {
    track.textContent = '';
    lines.forEach(function (text, i) {
      var span = doc.createElement('span');
      span.className = 'landing-hud__line';
      span.textContent = text;
      track.appendChild(span);
      if (sep) {
        var s = doc.createElement('span');
        s.className = 'landing-hud__sep';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = sep;
        track.appendChild(s);
      }
    });
  }

  /** 動畫時間 = 軌道寬 ÷ 速度（px/s）；軌道每圈位移 = 自身寬度 */
  function applySpeed(hud, tracks, speed) {
    if (!tracks.length) return;
    var w = tracks[0].getBoundingClientRect().width;
    if (!w || !isFinite(w)) return; /* landing 被隱藏時量不到，保留 CSS 預設 */
    var sec = w / speed;
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) sec *= 3;
    tracks.forEach(function (t) { t.style.animationDuration = sec.toFixed(2) + 's'; });
    hud.setAttribute('data-flow-sec', sec.toFixed(2));
    hud.setAttribute('data-flow-px', String(Math.round(w)));
  }

  function init() {
    var d = getData();
    var btn = doc.getElementById('btn-landing-start');
    var hud = doc.querySelector('#landing .landing-hud') || doc.querySelector('.landing-hud');
    if (!d) return;
    var m = d.m;
    if (btn && typeof m.ctaLabel === 'string' && m.ctaLabel.trim()) {
      btn.textContent = m.ctaLabel.trim();
    }
    if (!hud) return;
    var tracks = Array.prototype.slice.call(hud.querySelectorAll('.landing-hud__track'));
    var sep = (typeof m.separator === 'string' ? m.separator.trim() : '');
    tracks.forEach(function (t) { fillTrack(t, d.lines, sep); });
    if (m.a11yLabel) hud.setAttribute('aria-label', m.a11yLabel);
    if (m.pauseOnHover) hud.classList.add('is-pause-hover');
    var speed = (typeof m.speedPxPerSec === 'number' && m.speedPxPerSec > 0) ? m.speedPxPerSec : DEFAULT_SPEED;
    hud.setAttribute('data-marquee-src', 'entryMarquee');
    function recalc() { applySpeed(hud, tracks, speed); }
    recalc();
    global.addEventListener('resize', recalc);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(recalc);
    global.addEventListener('load', recalc);
  }

  G.Landing = { init: init };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
