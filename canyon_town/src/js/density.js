/**
 * density.js — 街景密度與比例（G.Density）。資料：優先讀 G.DATA.streetDensity（embed，源 data/street/street_density.json，走呆呆建置）；本檔 DEFAULTS 只是後備。
 * 1) 開局冷清：initialPedestrians／initialVehicles 只顯示部分居民與車；其餘 .is-offstage（不佔畫面，DOM 仍在，qa 數量不變）。
 * 2) G.Density.set(ped, veh, tourists)：之後依指標增減（逐一加入，間隔 spawnInterval 秒）。P1 economy.streetDensity() 之後呼叫它。
 * 3) 比例：scale.npc／scale.vehicle 寫進 CSS 變數 --street-scale-npc／--street-scale-veh（腳底軸不變，高度＝基準×倍率）。
 * 4) 居民要說線索時，若他在場外 → reveal() 讓他先走進畫面（線索不可因密度而消失）；回合結束 relax() 再收回。
 * 不碰：報紙門檻、街景軸線（--npc-bottom／--veh-bottom）、z-index。
 */
(function (global) {
  'use strict';
  var G = global.Game;
  var DEFAULTS = {
    initialPedestrians: 4, initialVehicles: 2, initialTourists: 0,
    maxPedestrians: 13, maxVehicles: 10, maxTourists: 6, maxGuards: 2, spawnInterval: 4,
    extraNpcs: [
      { id: 'walker_elder', name: '散步阿公', gender: '男', kind: 'passerby', role: '路人', speed: 0.4 },
      { id: 'walker_student', name: '放學學生', gender: '女', kind: 'passerby', role: '路人', speed: 0.7 },
      { id: 'walker_office', name: '上班族', gender: '男', kind: 'passerby', role: '路人', speed: 0.8 },
      { id: 'tourist_m_hat', name: '戴帽遊客', gender: '男', kind: 'tourist', role: '遊客', speed: 0.45 },
      { id: 'tourist_f_suitcase', name: '拖箱遊客', gender: '女', kind: 'tourist', role: '遊客', speed: 0.4 },
      { id: 'tourist_m_backpack', name: '背包客', gender: '男', kind: 'tourist', role: '遊客', speed: 0.5 },
      { id: 'tourist_f_photo', name: '拍照遊客', gender: '女', kind: 'tourist', role: '遊客', speed: 0.35 },
      { id: 'tourist_f_map', name: '看地圖遊客', gender: '女', kind: 'tourist', role: '遊客', speed: 0.4 },
      { id: 'tourist_m_selfie', name: '自拍遊客', gender: '男', kind: 'tourist', role: '遊客', speed: 0.45 },
      { id: 'guard_cat', name: '巡守貓', gender: '男', kind: 'guard', role: '巡守', speed: 0.45 },
      { id: 'guard_police', name: '巡邏員警', gender: '男', kind: 'guard', role: '巡守', speed: 0.5 }
    ],
    scale: { npc: 1.33, vehicle: 1.3 },
    mapping: { pedestrians: { max: 13, min: 1 }, vehicles: { max: 10, min: 1, curve: 1.3 }, tourists: { max: 6, from: 20, span: 80 }, guards: { t1: 40, t2: 70 } }
  };
  /* 優先讀 G.DATA.streetDensity（呆呆 embed，源 data/street/street_density.json）；缺的鍵才用上面 DEFAULTS 後備。 */
  var HAD_EMBED = !!G.DATA.streetDensity;
  if (!HAD_EMBED) G.DATA.streetDensity = DEFAULTS; /* 沒有 embed（舊版／單測）才放後備值 */
  var EMBED = null, MERGED = null;
  function merge(src) {
    var out = {}, k;
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    if (src) for (k in src) {
      if (src[k] == null) continue;
      if (typeof src[k] === 'object' && !Array.isArray(src[k]) && DEFAULTS[k] && typeof DEFAULTS[k] === 'object' && !Array.isArray(DEFAULTS[k])) { var o = {}, j; for (j in DEFAULTS[k]) o[j] = DEFAULTS[k][j]; for (j in src[k]) o[j] = src[k][j]; out[k] = o; }
      else out[k] = src[k];
    }
    if (!Array.isArray(out.extraNpcs) || !out.extraNpcs.length) out.extraNpcs = DEFAULTS.extraNpcs;
    out.source = (src && src !== DEFAULTS) ? 'embed' : 'defaults';
    return out;
  }

  var S = { npcs: null, vehicles: null, stage: null, ped: 0, veh: 0, tourists: 0, guards: 0, target: { ped: 0, veh: 0, tourists: 0, guards: 0 }, timer: null, revealed: {} };
  function cfg() {
    var cur = G.DATA.streetDensity || null;
    if (!MERGED || cur !== EMBED) { EMBED = cur; MERGED = merge(EMBED); }
    return MERGED;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function spread(n, k) { /* 從 n 個裡平均挑 k 個的索引 */
    var out = [], i;
    if (k >= n) { for (i = 0; i < n; i++) out.push(i); return out; }
    if (k <= 0) return out;
    if (k === 1) return [Math.floor(n / 2)];
    for (i = 0; i < k; i++) out.push(Math.round(i * (n - 1) / (k - 1)));
    return out;
  }
  function applyScale() {
    var c = cfg(), sc = c.scale || {}, st = S.stage || document.documentElement;
    st.style.setProperty('--street-scale-npc', String(sc.npc || 1));
    st.style.setProperty('--street-scale-veh', String(sc.vehicle || 1));
  }
  function apply() {
    var c = cfg();
    if (S.npcs && S.npcs.setVisibleByKind && S.npcs.hasKinds && S.npcs.hasKinds()) { /* P1：居民＋路人／遊客／巡守分開計數 */
      S.npcs.setVisibleByKind({ ped: clamp(S.ped, 0, c.maxPedestrians), tourist: clamp(S.tourists, 0, c.maxTourists), guard: clamp(S.guards, 0, c.maxGuards == null ? 2 : c.maxGuards) }, spread, S.revealed);
    } else if (S.npcs && S.npcs.setVisibleCount) S.npcs.setVisibleCount(clamp(S.ped, 0, c.maxPedestrians), spread, S.revealed);
    if (S.vehicles && S.vehicles.setVisibleCount) S.vehicles.setVisibleCount(clamp(S.veh, 0, c.maxVehicles), spread);
  }
  function step() {
    S.timer = null;
    var moved = false;
    if (S.ped < S.target.ped) { S.ped++; moved = true; } else if (S.ped > S.target.ped) { S.ped--; moved = true; }
    if (S.veh < S.target.veh) { S.veh++; moved = true; } else if (S.veh > S.target.veh) { S.veh--; moved = true; }
    if (S.tourists < S.target.tourists) { S.tourists++; moved = true; } else if (S.tourists > S.target.tourists) { S.tourists--; moved = true; }
    if (S.guards < S.target.guards) { S.guards++; moved = true; } else if (S.guards > S.target.guards) { S.guards--; moved = true; }
    apply();
    if (moved && (S.ped !== S.target.ped || S.veh !== S.target.veh || S.tourists !== S.target.tourists || S.guards !== S.target.guards)) S.timer = setTimeout(step, Math.max(200, (cfg().spawnInterval || 0) * 1000));
  }

  var Density = {
    attach: function (o) { S.npcs = o.npcs; S.vehicles = o.vehicles; S.stage = o.stage || null; applyScale(); return Density; },
    /** 開局：用 data 的 initial* 直接套用（不漸進） */
    start: function () { var c = cfg(); return Density.set(c.initialPedestrians, c.initialVehicles, c.initialTourists, { immediate: true }); },
    /** 設定目標密度；預設逐一增減（spawnInterval 秒一步），{immediate:true} 則一次到位 */
    set: function (ped, veh, tourists, opts) {
      var c = cfg();
      S.target = { ped: clamp(Math.round(ped || 0), 0, c.maxPedestrians), veh: clamp(Math.round(veh || 0), 0, c.maxVehicles), tourists: clamp(Math.round(tourists || 0), 0, c.maxTourists), guards: clamp(Math.round((opts && opts.guards) || 0), 0, c.maxGuards == null ? 2 : c.maxGuards) };
      if (S.timer) { clearTimeout(S.timer); S.timer = null; }
      if (opts && opts.immediate || !(c.spawnInterval > 0)) { S.ped = S.target.ped; S.veh = S.target.veh; S.tourists = S.target.tourists; S.guards = S.target.guards; apply(); }
      else step();
      return Density.get();
    },
    /** 指標 → 目標密度（BALANCE_FUN §5.1 公式；flows＝{foot, vehicle, tourist, security}，0–100） */
    fromFlows: function (f, opts) {
      var m = cfg().mapping, p = m.pedestrians, v = m.vehicles, t = m.tourists;
      var ped = Math.max(p.min, Math.round(p.max * (f.foot || 0) / 100));
      var veh = clamp(Math.round(v.max * Math.pow((f.vehicle || 0) / 100, v.curve)), v.min, v.max);
      var tour = clamp(Math.round(t.max * ((f.tourist || 0) - t.from) / t.span), 0, t.max);
      var guards = (f.security || 0) >= m.guards.t2 ? 2 : (f.security || 0) >= m.guards.t1 ? 1 : 0;
      Density.set(ped, veh, tour, Object.assign({ guards: guards }, opts || {}));
      return { pedestrians: ped, vehicles: veh, tourists: tour, guards: guards };
    },
    get: function () { return { pedestrians: S.ped, vehicles: S.veh, tourists: S.tourists, guards: S.guards, target: S.target, config: cfg(), source: cfg().source }; },
    /** 居民要說線索卻在場外：讓他走進來（回合結束 relax） */
    reveal: function (id) { S.revealed[id] = true; if (S.npcs && S.npcs.setVisibleCount) S.npcs.revealOne(id); },
    relax: function () { S.revealed = {}; apply(); },
    /** P1：街上額外的路人／遊客／巡守 NPC 定義（main.js 在 economy 開啟時併入居民名冊） */
    extraNpcs: function () { return (cfg().extraNpcs || []).slice(); },
    scale: function () { var sc = cfg().scale || {}; return { npc: sc.npc || 1, vehicle: sc.vehicle || 1 }; }
  };
  G.Density = Density;
})(window);
