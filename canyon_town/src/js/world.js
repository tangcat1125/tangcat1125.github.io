/**
 * world.js — 峽谷主街場景（對齊 game.css #street-stage 分層）。
 * 鏡頭左右來回巡覽，避免「整條街永遠只往右滑」。
 * 不負責 NPC 或事件邏輯。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  function World(stageEl) {
    this.stage = stageEl;
    this.scrollEl = stageEl.querySelector('#street-scroll');
    this.layersEl = stageEl.querySelector('#street-layers');
    this.width = 640;
    this.worldWidth = 2400;
    this.camX = 0;
    this.camDir = 1;
    this.camPause = 0.8;
  }

  /** 街景尺寸改變（手牌列隱藏／視窗縮放）時自動重量 --sh，人車尺寸跟著走 */
  World.prototype.observe = function () {
    var self = this;
    if (this._ro || !global.ResizeObserver) return;
    this._ro = new global.ResizeObserver(function () { self.measure(); });
    this._ro.observe(this.stage);
  };

  World.prototype.measure = function () {
    this.width = Math.max(320, this.stage.clientWidth || 640);
    // 街景高度 → CSS 變數 --sh（人／車尺寸與軸線皆以此為準）
    this.stage.style.setProperty('--sh', Math.max(240, this.stage.clientHeight || 560) + 'px');
    if (this.layersEl) {
      this.layersEl.style.width = this.worldWidth + 'px';
    }
    return this.width;
  };

  World.prototype.tick = function (dt) {
    var max = Math.max(0, this.worldWidth - this.width);
    var sec = dt / 1000;
    if (this.camPause > 0) {
      this.camPause -= sec;
    } else {
      this.camX += this.camDir * dt * 0.028;
      if (this.camX >= max) {
        this.camX = max;
        this.camDir = -1;
        this.camPause = 1.2;
      } else if (this.camX <= 0) {
        this.camX = 0;
        this.camDir = 1;
        this.camPause = 1.2;
      }
    }
    if (this.scrollEl) {
      this.scrollEl.style.transform = 'translateX(' + Math.round(-this.camX) + 'px)';
    }
  };

  World.prototype.getStreetWidth = function () {
    return this.worldWidth;
  };

  G.World = World;
})(window);