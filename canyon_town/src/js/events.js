/**
 * events.js — 事件佇列：讀取內嵌事件、觸發、套用 deltas。
 * 政策可「解決」事件使負面效果不套用。
 * 不負責 UI。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function listEvents() {
    var order = G.DATA.eventOrder || Object.keys(G.DATA.events || {});
    return order.map(function (id) { return G.DATA.events[id]; }).filter(Boolean);
  }

  function solvedSet(policyIds) {
    var set = {};
    (policyIds || []).forEach(function (pid) {
      var p = G.DATA.policies[pid];
      if (!p) return;
      (p.solves || []).forEach(function (eid) { set[eid] = true; });
    });
    return set;
  }

  /**
   * 依政策過濾後，回傳本季會「生效」的事件列表與指標累加。
   */
  function resolveSeasonEvents(policyIds) {
    var solved = solvedSet(policyIds);
    var fired = [];
    var blocked = [];
    var metricDelta = { money: 0, profit: 0, happiness: 0, points: 0 };
    var problems = {};

    listEvents().forEach(function (ev) {
      if (solved[ev.id]) {
        blocked.push(ev.id);
        problems[ev.id] = 0;
      } else {
        fired.push(ev.id);
        problems[ev.id] = ev.baselineSeverity || 1;
        var d = ev.deltas || {};
        metricDelta.money += d.money || 0;
        metricDelta.profit += d.profit || 0;
        metricDelta.happiness += d.happiness || 0;
      }
    });

    return {
      fired: fired,
      blocked: blocked,
      problems: problems,
      metricDelta: metricDelta,
      solved: solved
    };
  }

  function applyPolicyCostsAndDeltas(policyIds, metrics) {
    var m = clone(metrics);
    var spent = 0;
    (policyIds || []).forEach(function (pid) {
      var p = G.DATA.policies[pid];
      if (!p) return;
      spent += p.cost || 0;
      m.points -= p.cost || 0;
      var d = p.deltas || {};
      m.money += d.money || 0;
      m.profit += d.profit || 0;
      m.happiness += d.happiness || 0;
    });
    return { metrics: m, spent: spent };
  }

  G.Events = {
    listEvents: listEvents,
    solvedSet: solvedSet,
    resolveSeasonEvents: resolveSeasonEvents,
    applyPolicyCostsAndDeltas: applyPolicyCostsAndDeltas,
    clone: clone
  };
})(window);
