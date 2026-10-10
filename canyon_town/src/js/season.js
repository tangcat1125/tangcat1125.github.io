/**
 * season.js — 季進度：snapshot、月份標籤、核心問題 id。
 * 提供 captureSnapshot / advanceMonth 骨架。
 * 模擬細節委派 replay.js。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  function loadSeason(id) {
    var s = G.DATA[id] || G.DATA.season_01;
    if (!s) throw new Error('找不到季節資料');
    return G.Events.clone(s);
  }

  function initialMetrics(season) {
    return {
      points: season.points,
      money: season.money,
      profit: season.profit,
      happiness: season.happiness
    };
  }

  function captureSnapshot(ctx) {
    return {
      seasonId: ctx.season.id,
      monthLabel: ctx.season.monthLabel,
      metrics: G.Events.clone(ctx.metrics),
      baseMetrics: G.Events.clone(ctx.baseMetrics || ctx.metrics),
      npcs: ctx.npcs ? ctx.npcs.snapshotPositions() : [],
      eventQueue: (G.DATA.eventOrder || []).slice(),
      firedEvents: (ctx.firedEvents || []).slice(),
      problems: G.Events.clone(ctx.problems || {}),
      policiesPlayed: (ctx.policiesPlayed || []).slice(),
      coreProblemIds: (ctx.season.coreProblemIds || []).slice(),
      phase: ctx.phase || 'idle'
    };
  }

  function advanceMonth(ctx) {
    // MVP：第一季解決後進入「四月」標籤（仍用同一季資料示範）
    ctx.monthIndex = (ctx.monthIndex || 0) + 1;
    var labels = ['三月', '四月', '五月', '六月'];
    ctx.season.monthLabel = labels[Math.min(ctx.monthIndex, labels.length - 1)];
    ctx.season.title = '峽谷小鎮・第' + (ctx.monthIndex + 1) + '月示範';
    // 重置點數，保留部分金錢／幸福度作為教學延續
    ctx.metrics.points = 8;
    ctx.baseMetrics = G.Events.clone(ctx.metrics);
    ctx.policiesPlayed = [];
    ctx.firedEvents = [];
    ctx.problems = {};
    ctx.phase = 'idle';
    return ctx;
  }

  G.Season = {
    loadSeason: loadSeason,
    initialMetrics: initialMetrics,
    captureSnapshot: captureSnapshot,
    advanceMonth: advanceMonth
  };
})(window);
