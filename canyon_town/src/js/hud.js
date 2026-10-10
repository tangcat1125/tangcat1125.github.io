/**
 * hud.js — 常駐指數列：點數｜金錢｜獲利｜幸福度＋增量▲▼。
 * DOM 對齊 game.css #hud-metrics；點擊開說明（非 hover）。
 * 與季節 snapshot 同一組數字。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  var LABELS = [
    { key: 'points', label: '點數', tip: '本季可打出政策卡的決策力。開局固定，打卡會扣除。' },
    { key: 'money', label: '金錢', tip: '市庫現金存量。事件與政策都會增減。' },
    { key: 'profit', label: '獲利', tip: '這一季（或這次結報）賺或賠多少。' },
    { key: 'happiness', label: '幸福度', tip: '居民好不好過。安全、信任、營生都會影響。' }
  ];

  function Hud(rootEl, detailEl) {
    this.root = rootEl;
    this.detail = detailEl;
    this.detailBody = detailEl ? detailEl.querySelector('#hud-detail-body') : null;
    this.prev = null;
    this.pulseTimers = {};
    this._build();
    this._bindDetail();
  }

  Hud.prototype._build = function () {
    var self = this;
    this.root.innerHTML = '';
    this.nodes = {};
    LABELS.forEach(function (meta, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hud-metric';
      btn.dataset.key = meta.key;
      btn.innerHTML =
        '<span class="hud-metric__label">' + meta.label + '</span>' +
        '<span class="hud-metric__row">' +
          '<span class="hud-metric__value">—</span>' +
          '<span class="hud-metric__delta is-flat">— 0</span>' +
        '</span>';
      btn.addEventListener('click', function () {
        self.openDetail(meta);
      });
      self.root.appendChild(btn);
      self.nodes[meta.key] = {
        el: btn,
        value: btn.querySelector('.hud-metric__value'),
        delta: btn.querySelector('.hud-metric__delta')
      };
      // 錯開多項同時變動的脈衝
      self.pulseTimers[meta.key] = null;
    });
  };

  Hud.prototype._bindDetail = function () {
    var self = this;
    if (!this.detail) return;
    var close = this.detail.querySelector('#hud-detail-close');
    if (close) {
      close.onclick = function () { self.closeDetail(); };
    }
    this.detail.addEventListener('click', function (e) {
      if (e.target === self.detail) self.closeDetail();
    });
  };

  Hud.prototype.openDetail = function (meta) {
    if (!this.detail) return;
    var title = this.detail.querySelector('#hud-detail-title');
    if (title) title.textContent = meta.label + '說明';
    if (this.detailBody) {
      this.detailBody.innerHTML =
        '<ul class="hud-detail__list"><li>' + meta.tip + '</li>' +
        '<li>畫面數字與貓貓快報「本季指數」來自同一份 snapshot。</li></ul>';
    }
    this.detail.classList.add('is-open');
    this.detail.setAttribute('aria-hidden', 'false');
  };

  Hud.prototype.closeDetail = function () {
    if (!this.detail) return;
    this.detail.classList.remove('is-open');
    this.detail.setAttribute('aria-hidden', 'true');
  };

  Hud.prototype._pulse = function (key, index) {
    var node = this.nodes[key];
    if (!node) return;
    var delay = (index || 0) * 50;
    var self = this;
    if (this.pulseTimers[key]) clearTimeout(this.pulseTimers[key]);
    setTimeout(function () {
      node.el.classList.remove('is-pulse');
      // force reflow
      void node.el.offsetWidth;
      node.el.classList.add('is-pulse');
      self.pulseTimers[key] = setTimeout(function () {
        node.el.classList.remove('is-pulse');
      }, 500);
    }, delay);
  };

  Hud.prototype.render = function (metrics, explicitDeltas) {
    var self = this;
    var prev = this.prev;
    LABELS.forEach(function (meta, i) {
      var key = meta.key;
      var val = metrics[key];
      var node = self.nodes[key];
      if (!node) return;
      node.value.textContent = String(val);
      var d = explicitDeltas && explicitDeltas[key] != null
        ? explicitDeltas[key]
        : (prev ? val - prev[key] : 0);
      var deltaEl = node.delta;
      deltaEl.classList.remove('is-up', 'is-down', 'is-flat');
      if (!d) {
        deltaEl.textContent = '— 0';
        deltaEl.classList.add('is-flat');
      } else if (d > 0) {
        deltaEl.textContent = '▲ +' + d;
        deltaEl.classList.add('is-up');
        self._pulse(key, i);
      } else {
        deltaEl.textContent = '▼ ' + d;
        deltaEl.classList.add('is-down');
        self._pulse(key, i);
      }
    });
    this.prev = {
      points: metrics.points,
      money: metrics.money,
      profit: metrics.profit,
      happiness: metrics.happiness
    };
    try { /* P1：流量晶片（人流／車流／遊客／治安／店家）與數值同一份 ctx，隨 HUD 一起更新 */
      var c = G.state && G.state.ctx;
      if (G.Economy && c && c.town) G.Economy.renderHud(c, this.root);
    } catch (e) { /* 晶片失敗不影響 HUD */ }
  };

  G.Hud = Hud;
})(window);
