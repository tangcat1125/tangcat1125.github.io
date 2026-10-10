/**
 * npc.js — NPC 左右走；僅在端點暫停轉身（無中途隨機轉身）。
 * 半數由左往右、半數由右往左；走距接近 worldWidth。
 * PNG 精靈靠 CSS background；面向用 --npc-face。
 * 街景整理（2026-10-02）：所有人共用同一條地面軸（CSS --npc-bottom）；
 * 每人只在自己的 X 區間來回（ZONE_W 比例，錯開排列）；速度整體慢於車流。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  /** 每位 NPC 的 X 活動區間佔街寬比例（錯開排列，中段互相重疊） */
  var ZONE_W = 0.46;
  /** 步行速度整體係數（車流在 vehicle.js 另有 1.6~2 倍以上速度） */
  var WALK_SCALE = 0.8;

  function NpcManager(layerEl) {
    this.layer = layerEl;
    this.list = [];
    this.streetWidth = 2400;
  }

  NpcManager.prototype.spawnFromData = function (roster, streetWidth) {
    var self = this;
    this.streetWidth = streetWidth || 2400;
    this.layer.innerHTML = '';
    var n = (roster || []).length;
    this.list = (roster || []).map(function (def, i) {
      var el = document.createElement('div');
      var female = def.gender === '女';
      el.className = 'npc npc--sidewalk ' + (female ? 'is-female' : 'is-male');
      el.dataset.id = def.id;
      if (def.kind) el.dataset.kind = def.kind;
      var accent = def.color || (female ? '#b05088' : '#3a6aaa');
      el.style.setProperty('--npc-accent', accent);
      el.style.setProperty('--npc-face', '1');
      el.innerHTML = '<span class="npc-label">' + def.name + '</span>';
      self.layer.appendChild(el);

      // 方向：def.dir / def.side 優先；否則半數左→右、半數右→左
      var dir;
      if (typeof def.dir === 'number' && def.dir !== 0) {
        dir = def.dir > 0 ? 1 : -1;
      } else if (def.side === 'right') {
        dir = -1;
      } else if (def.side === 'left') {
        dir = 1;
      } else {
        dir = (i < Math.ceil(n / 2)) ? 1 : -1;
      }

      // X 區間：依序錯開（0=最左、n-1=最右），可用 def.zone=[a,b]（0~1）覆寫
      var za, zb;
      if (def.zone && def.zone.length === 2) {
        za = def.zone[0]; zb = def.zone[1];
      } else {
        var t = n > 1 ? i / (n - 1) : 0;
        za = t * (1 - ZONE_W);
        zb = za + ZONE_W;
      }
      var b = self._bounds({ za: za, zb: zb });
      var startX;
      if (typeof def.x === 'number') {
        startX = Math.min(b.max, Math.max(b.min, def.x));
      } else {
        startX = dir > 0 ? b.min + 20 + (i % 3) * 36 : b.max - 20 - (i % 3) * 36;
        startX = Math.min(b.max, Math.max(b.min, startX));
      }

      return {
        id: def.id,
        name: def.name,
        gender: def.gender,
        role: def.role,
        kind: def.kind || 'resident',
        color: def.color,
        x: startX,
        za: za,
        zb: zb,
        speed: (def.speed || 0.55) * WALK_SCALE * (0.9 + Math.random() * 0.3),
        dir: dir,
        pause: 0.1 + Math.random() * 0.35,
        el: el
      };
    });
    this.render();
    return this.list;
  };

  /** 由區間比例算像素邊界 */
  NpcManager.prototype._bounds = function (n) {
    var margin = 40;
    var w = this.streetWidth;
    var min = Math.max(margin, Math.round(n.za * w));
    var max = Math.min(w - 80, Math.round(n.zb * w));
    if (max < min + 60) max = min + 60;
    return { min: min, max: max };
  };

  NpcManager.prototype.setStreetWidth = function (w) {
    this.streetWidth = w;
  };

  /** 密度：只顯示 n 位（平均分布）；revealed＝要說線索而被叫進場的居民（一定顯示）。其餘 .is-offstage（DOM 仍在） */
  NpcManager.prototype.setVisibleCount = function (n, spread, revealed) {
    var self = this, keep = {}, extra = 0;
    revealed = revealed || {};
    this.list.forEach(function (p) { if (revealed[p.id]) { keep[p.id] = true; extra++; } }); /* 要說線索進場的居民一定在，但仍計入總數 */
    var want = Math.max(0, n - extra);
    var rest = this.list.filter(function (p) { return !keep[p.id]; });
    spread(rest.length, want).forEach(function (i) { keep[rest[i].id] = true; });
    this.visibleCount = n;
    this.list.forEach(function (p) {
      var on = !!keep[p.id];
      p.offstage = !on;
      p.el.classList.toggle('is-offstage', !on);
    });
  };
  NpcManager.prototype.hasKinds = function () { return this.list.some(function (p) { return p.kind && p.kind !== 'resident'; }); };
  /** P1：依類別顯示人數。ped＝居民＋路人（平均分布）、tourist＝遊客、guard＝巡守；revealed 的居民一定在場。其餘 .is-offstage */
  NpcManager.prototype.setVisibleByKind = function (n, spread, revealed) {
    var self = this, keep = {}; revealed = revealed || {};
    function pool(kinds) { return self.list.filter(function (p) { return kinds.indexOf(p.kind || 'resident') >= 0; }); }
    var ped = pool(['resident', 'passerby']), extra = 0;
    ped.forEach(function (p) { if (revealed[p.id]) { keep[p.id] = true; extra++; } });
    var restPed = ped.filter(function (p) { return !keep[p.id]; });
    spread(restPed.length, Math.max(0, (n.ped || 0) - extra)).forEach(function (i) { keep[restPed[i].id] = true; });
    var tr = pool(['tourist']); spread(tr.length, n.tourist || 0).forEach(function (i) { keep[tr[i].id] = true; });
    var gd = pool(['guard']); spread(gd.length, n.guard || 0).forEach(function (i) { keep[gd[i].id] = true; });
    this.visibleCount = (n.ped || 0) + (n.tourist || 0) + (n.guard || 0);
    this.list.forEach(function (p) { var on = !!keep[p.id]; p.offstage = !on; p.el.classList.toggle('is-offstage', !on); });
  };
  /** 場外居民要說線索：他進場，同時換掉一位沒在說話的在場居民（畫面人數不變） */
  NpcManager.prototype.revealOne = function (id) {
    var target = null, self = this;
    this.list.forEach(function (p) { if (p.id === id) target = p; });
    if (!target || !target.offstage) return;
    target.offstage = false; target.el.classList.remove('is-offstage');
    var vis = this.list.filter(function (p) { return !p.offstage; });
    var want = this.visibleCount != null ? this.visibleCount : vis.length;
    vis.filter(function (p) { return p !== target && !p.el.classList.contains('has-bubble-tap') && !p.el.querySelector('.npc-bubble'); }).forEach(function (p) {
      if (self.list.filter(function (q) { return !q.offstage; }).length > want) { p.offstage = true; p.el.classList.add('is-offstage'); }
    });
  };
  NpcManager.prototype.getVisibleList = function () {
    return this.list.filter(function (p) { return !p.offstage; });
  };

  NpcManager.prototype.getList = function () {
    return this.list;
  };

  NpcManager.prototype._face = function (n) {
    var face = n.dir < 0 ? -1 : 1;
    n.el.style.setProperty('--npc-face', String(face));
    n.el.classList.toggle('face-left', face < 0);
    n.el.classList.toggle('face-right', face > 0);
    if (n.pause > 0) {
      n.el.style.transform = 'scaleX(' + face + ')';
    } else {
      n.el.style.transform = '';
    }
    var label = n.el.querySelector('.npc-label');
    if (label) {
      label.style.transform = face < 0
        ? 'translateX(-50%) scaleX(-1)'
        : 'translateX(-50%)';
    }
  };

  NpcManager.prototype.tick = function (dt) {
    var sec = dt / 1000;
    var self = this;
    this.list.forEach(function (n) {
      if (n.pause > 0) {
        n.pause -= sec;
        n.el.classList.remove('is-walking');
        self._face(n);
        return;
      }

      n.el.classList.add('is-walking');
      n.x += n.dir * n.speed * dt * 0.1;
      var bd = self._bounds(n);
      var margin = bd.min;
      var maxX = bd.max;

      // 僅端點轉身（無中途隨機轉身）
      if (n.x > maxX) {
        n.x = maxX;
        n.dir = -1;
        n.pause = 0.45 + Math.random() * 0.55;
      } else if (n.x < margin) {
        n.x = margin;
        n.dir = 1;
        n.pause = 0.45 + Math.random() * 0.55;
      }

      self._face(n);
    });
    this.render();
  };

  NpcManager.prototype.render = function () {
    this.list.forEach(function (n) {
      n.el.style.left = Math.round(n.x) + 'px';
    });
  };

  NpcManager.prototype.snapshotPositions = function () {
    return this.list.map(function (n) {
      return { id: n.id, x: n.x, dir: n.dir, pause: n.pause || 0 };
    });
  };

  NpcManager.prototype.applyPositions = function (positions) {
    var map = {};
    (positions || []).forEach(function (p) { map[p.id] = p; });
    var self = this;
    this.list.forEach(function (n) {
      var p = map[n.id];
      if (p) {
        n.x = p.x;
        n.dir = p.dir;
        if (typeof p.pause === 'number') n.pause = p.pause;
      }
      self._face(n);
    });
    this.render();
  };

  G.NpcManager = NpcManager;
})(window);
