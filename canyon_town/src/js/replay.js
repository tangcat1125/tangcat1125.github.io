/**
 * replay.js — 結果運算管線（日常運行／結報用）：snapshot → simulate → isResolved。
 * 沿用模組名 G.Replay 以相容既有呼叫；UI 已無獨立回放階段，確認政策後街景照常日常運行，結報時才呼叫 simulate。
 * 同一季初種子 + 新政策規則，產生下一狀態。
 * 對應 TECH.md 核心 API。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  function simulate(seasonId, snap, policies) {
    var season = G.DATA[seasonId] || G.DATA.season_01;
    var base = G.Events.clone(snap.baseMetrics || snap.metrics);
    // 從前一季「季初資源」起算點數／金錢等
    var startMetrics = {
      points: season.points,
      money: (snap.baseMetrics && snap.baseMetrics.money != null)
        ? snap.baseMetrics.money
        : season.money,
      profit: season.profit,
      happiness: (snap.baseMetrics && snap.baseMetrics.happiness != null)
        ? snap.baseMetrics.happiness
        : season.happiness
    };
    // 若有 baseMetrics（開局或晉級後），以它為季初
    if (snap.baseMetrics) {
      startMetrics = G.Events.clone(snap.baseMetrics);
      startMetrics.points = season.points;
      startMetrics.profit = season.profit;
    }

    var policyIds = policies || [];
    var ev = G.Events.resolveSeasonEvents(policyIds);
    var afterPolicy = G.Events.applyPolicyCostsAndDeltas(policyIds, startMetrics);
    var m = afterPolicy.metrics;
    m.money += ev.metricDelta.money;
    m.profit += ev.metricDelta.profit;
    m.happiness += ev.metricDelta.happiness;

    var lastDeltas = {
      points: m.points - startMetrics.points,
      money: m.money - startMetrics.money,
      profit: m.profit - startMetrics.profit,
      happiness: m.happiness - startMetrics.happiness
    };

    return {
      seasonId: seasonId,
      monthLabel: snap.monthLabel,
      metrics: m,
      baseMetrics: G.Events.clone(snap.baseMetrics || startMetrics),
      firedEvents: ev.fired,
      blockedEvents: ev.blocked,
      problems: ev.problems,
      policiesPlayed: policyIds.slice(),
      coreProblemIds: (season.coreProblemIds || []).slice(),
      lastDeltas: lastDeltas,
      eventQueue: (G.DATA.eventOrder || []).slice()
    };
  }

  function isResolved(next) {
    var cores = next.coreProblemIds || [];
    if (!cores.length) return true;
    return cores.every(function (id) {
      return next.problems[id] === 0;
    });
  }

  G.Replay = {
    simulate: simulate,
    isResolved: isResolved
  };
  // TECH.md 別名
  G.api.simulate = simulate;
  G.api.isResolved = isResolved;
  G.api.captureSnapshot = function (world) {
    return G.Season.captureSnapshot(world);
  };
  G.api.advanceMonth = function (ctx) {
    return G.Season.advanceMonth(ctx);
  };
})(window);
