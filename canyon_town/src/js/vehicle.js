/**
 * vehicle.js — 街景車流（VehicleManager）。
 * 單一車道軸（2026-10-02）：所有車共用同一條 Y（CSS --veh-bottom）；
 * lane 只決定行進方向（near→右、far→左）；速度比步行快且各車錯開；端點 wrap 重生。
 * MVP：只做可見車流，不改 metrics／報紙門檻／isResolved。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  /** 路點名 → 街寬比例（0～1） */
  var WAYPOINTS = {
    east_gate: 0.92,
    farm_road: 0.08,
    warehouse: 0.12,
    bus_stop_a: 0.18,
    bus_stop_b: 0.82,
    residential: 0.22,
    dump_gate: 0.88,
    depot: 0.10,
    school_well: 0.55,
    market: 0.48
  };

  /** types.id → CSS sprite kind class（reuse 既有 PNG） */
  var TYPE_TO_KIND = {
    scooter: 'scooter',
    scooter_delivery: 'scooter',
    scooter_cargo: 'scooter',
    bicycle: 'bicycle',
    light_truck: 'truck',
    bus: 'bus',
    garbage_truck: 'garbage',
    water_truck: 'truck',
    works_truck: 'truck',
    truck: 'truck',
    garbage: 'garbage'
  };

  var SPRITE_FILE = {
    scooter: 'vehicle_scooter_right_0.webp',
    scooter_delivery: 'vehicle_scooter_right_1.webp',
    scooter_cargo: 'vehicle_scooter_right_2.webp',
    bicycle: 'vehicle_bicycle_right_0.webp',
    light_truck: 'vehicle_truck_right_0.webp',
    bus: 'vehicle_bus_right_0.webp',
    garbage_truck: 'vehicle_garbage_right_0.webp',
    water_truck: 'vehicle_water_truck_right_0.webp',
    works_truck: 'vehicle_works_truck_right_0.webp'
  };
  var SPRITE_DIR = 'assets/sprites/vehicles/';
  /* 快取破壞：沿用 index.html 腳本的 ?v=（避免舊圖卡在瀏覽器快取） */
  var SPRITE_VER = (function () {
    try {
      var sc = document.querySelector('script[src*="vehicle.js"]');
      var m = sc && /[?&]v=([^&]+)/.exec(sc.getAttribute('src') || '');
      return m ? m[1] : '';
    } catch (e) { return ''; }
  })();
  /** 依行進方向取圖：向右 *_right_*、向左 *_left_*（不再用 scaleX(-1) 翻面，避免雙重翻轉） */
  function spriteFor(typeId, dir) {
    var right = SPRITE_FILE[typeId] || SPRITE_FILE.light_truck;
    return dir < 0 ? right.replace('_right_', '_left_') : right;
  }

  function typeIndex(typesPack) {
    var map = {};
    var list = (typesPack && typesPack.types) || [];
    for (var i = 0; i < list.length; i++) {
      map[list[i].id] = list[i];
    }
    return map;
  }

  function wpX(name, streetWidth) {
    var t = WAYPOINTS[name];
    if (typeof t !== 'number') t = 0.5;
    return Math.round(t * streetWidth);
  }

  function resolveLane(spawn, fromX, toX) {
    if (spawn.lane === 'near' || spawn.lane === 'far') return spawn.lane;
    // 未標 lane：往右近、往左遠
    return (toX >= fromX) ? 'near' : 'far';
  }

  function VehicleManager(layerEl) {
    this.layer = layerEl;
    this.list = [];
    this.streetWidth = 2400;
    this.typesById = {};
    this.routes = null;
    this.metrics = null;
  }

  /**
   * 由 types + routes.spawns 生成車隊。
   */
  VehicleManager.prototype.spawnFromRoutes = function (typesPack, routesPack, streetWidth) {
    var self = this;
    this.streetWidth = streetWidth || 2400;
    this.typesById = typeIndex(typesPack);
    this.routes = routesPack || null;
    this.metrics = (routesPack && routesPack.metrics) || null;
    this.layer.innerHTML = '';
    this.list = [];

    var spawns = (routesPack && routesPack.spawns) || [];
    spawns.forEach(function (spawn, i) {
      var t = self.typesById[spawn.vehicleType] || {
        id: spawn.vehicleType || 'truck',
        name: spawn.vehicleType || '車',
        class: 'freight',
        speed: 0.8
      };
      var fromX = wpX(spawn.from, self.streetWidth);
      var toX = wpX(spawn.to, self.streetWidth);
      var lane = resolveLane(spawn, fromX, toX);
      // near 固定往右 (+1)；far 固定往左 (-1)
      var dir = lane === 'far' ? -1 : 1;
      var kind = TYPE_TO_KIND[t.id] || 'truck';

      var el = document.createElement('div');
      el.className = 'vehicle vehicle--' + kind +
        ' vehicle--' + t.id +
        ' vehicle--lane-' + lane +
        ' vehicle-class--' + (t.class || 'freight');
      el.dataset.id = 'veh_' + i + '_' + t.id;
      el.dataset.type = t.id;
      el.dataset.lane = lane;
      el.dataset.cargo = spawn.cargo || '';
      el.dataset.from = spawn.from || '';
      el.dataset.to = spawn.to || '';
      el.title = (t.name || t.id) + (spawn.cargo ? '（' + spawn.cargo + '）' : '');
      el.style.setProperty('--veh-face', String(dir));
      el.innerHTML = '<span class="vehicle-label">' + (t.name || t.id) + '</span>';
      self.layer.appendChild(el);

      var intervalSec = Math.max(2, (spawn.interval || 120) / 60);
      var startPause = (i * 0.35) + Math.random() * 0.4;
      // 交錯初始 X：near 從左半段、far 從右半段
      var startX;
      if (lane === 'near') {
        startX = 40 + (i * 220) % Math.max(400, self.streetWidth - 200);
      } else {
        startX = self.streetWidth - 80 - ((i * 220) % Math.max(400, self.streetWidth - 200));
      }

      self.list.push({
        id: el.dataset.id,
        typeId: t.id,
        name: t.name,
        cargo: spawn.cargo || '',
        className: t.class || 'freight',
        lane: lane,
        fromX: fromX,
        toX: toX,
        x: startX,
        speed: Math.max(0.75, (t.speed || 0.8)) * (0.9 + ((i * 37) % 10) / 40) * (0.96 + Math.random() * 0.08),
        dir: dir,
        pause: startPause,
        intervalSec: intervalSec,
        el: el
      });
    });
    this.list.forEach(function (v) { self._face(v); });
    this.render();
    return this.list;
  };

  /** 相容舊呼叫 */
  VehicleManager.prototype.spawnFromData = function (rosterOrTypes, streetWidthOrRoutes, maybeWidth) {
    if (rosterOrTypes && rosterOrTypes.types && streetWidthOrRoutes && streetWidthOrRoutes.spawns) {
      return this.spawnFromRoutes(rosterOrTypes, streetWidthOrRoutes, maybeWidth);
    }
    var roster = rosterOrTypes || [];
    var fakeRoutes = {
      spawns: roster.map(function (d, i) {
        return {
          vehicleType: d.kind || d.vehicleType || 'light_truck',
          cargo: d.cargo || '',
          from: 'farm_road',
          to: 'east_gate',
          interval: 180,
          lane: (i % 2 === 0) ? 'near' : 'far'
        };
      })
    };
    var fakeTypes = {
      types: roster.map(function (d) {
        return {
          id: d.kind || d.id || 'truck',
          name: d.name || d.kind || '車',
          class: 'freight',
          speed: d.speed || 1
        };
      })
    };
    return this.spawnFromRoutes(fakeTypes, fakeRoutes, streetWidthOrRoutes);
  };

  VehicleManager.prototype.setStreetWidth = function (w) {
    var old = this.streetWidth || 2400;
    this.streetWidth = w;
    if (!old || old === w) return;
    var scale = w / old;
    this.list.forEach(function (v) {
      v.x *= scale;
      v.fromX *= scale;
      v.toX *= scale;
    });
  };

  VehicleManager.prototype._face = function (v) {
    var face = v.dir < 0 ? -1 : 1;
    if (v.faceApplied === face) return;
    v.faceApplied = face;
    var file = spriteFor(v.typeId, face);
    v.el.style.setProperty('--veh-face', String(face));
    v.el.style.backgroundImage = 'url("' + SPRITE_DIR + file + (SPRITE_VER ? '?v=' + SPRITE_VER : '') + '")';
    v.el.style.transform = 'none';
    v.el.dataset.facing = face < 0 ? 'left' : 'right';
    v.el.dataset.sprite = file;
    var label = v.el.querySelector('.vehicle-label');
    if (label) label.style.transform = 'translateX(-50%)';
  };

  VehicleManager.prototype.tick = function (dt) {
    var sec = dt / 1000;
    var self = this;
    var w = this.streetWidth;
    var margin = 40;
    this.list.forEach(function (v) {
      if (v.pause > 0) {
        v.pause -= sec;
        self._face(v);
        return;
      }
      v.x += v.dir * v.speed * dt * 0.15;

      // 固定方向 wrap：near 出右端 → 回左；far 出左端 → 回右
      if (v.dir > 0 && v.x > w + 40) {
        v.x = margin - 20;
        v.pause = Math.min(3.5, 0.5 + v.intervalSec * 0.12);
      } else if (v.dir < 0 && v.x < -80) {
        v.x = w + 20;
        v.pause = Math.min(3.5, 0.5 + v.intervalSec * 0.12);
      }
      self._face(v);
    });
    this.render();
  };

  /** 密度：只顯示 n 輛（平均分布；其餘 .is-offstage，仍在 DOM、仍會移動，之後加入時不會「瞬間生成在同一點」） */
  VehicleManager.prototype.setVisibleCount = function (n, spread) {
    var keep = {};
    spread(this.list.length, n).forEach(function (i) { keep[i] = true; });
    this.visibleCount = n;
    this.list.forEach(function (v, i) { v.offstage = !keep[i]; v.el.classList.toggle('is-offstage', !keep[i]); });
  };

  VehicleManager.prototype.render = function () {
    this.list.forEach(function (v) {
      v.el.style.left = Math.round(v.x) + 'px';
    });
  };

  VehicleManager.prototype.snapshotPositions = function () {
    return this.list.map(function (v) {
      return { id: v.id, typeId: v.typeId, cargo: v.cargo, lane: v.lane, x: v.x, dir: v.dir };
    });
  };

  VehicleManager.prototype.getTrafficMetrics = function () {
    return this.metrics ? {
      congestion: this.metrics.congestion,
      onTimeRate: this.metrics.onTimeRate
    } : null;
  };

  VehicleManager.prototype.count = function () {
    return this.list.length;
  };

  G.VehicleManager = VehicleManager;
  G.VEHICLE_WAYPOINTS = WAYPOINTS;
  G.VEHICLE_SPRITE_FILE = SPRITE_FILE;
  G.VEHICLE_SPRITE_FOR = spriteFor;
  G.VEHICLE_TYPE_TO_KIND = TYPE_TO_KIND;
})(window);
