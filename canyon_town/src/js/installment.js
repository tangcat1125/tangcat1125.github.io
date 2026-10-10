/**
 * installment.js — Stage I 分期合約（G.Installment）。資料：G.DATA.policies[pid].installment（目前只有 policy_pied_piper）。
 *  狀態 ctx.installments = { contracts:[{policyId, boughtCycle, total, status:'active'|'done'|'strike', payments:[{dueCycle, money, label, status:'due'|'paid'|'void'}]}], banned:{pid:true}, strikes:[{policyId, cycle}] }
 *  流程：
 *   - G.Economy.compute → duePreview(ctx, moneyBefore, bankrupt)：本季（cycle＝monthIndex+1）到期尾款；季初金錢 < 該期或已破產 → unpaid（不扣錢）。帳單列「吹笛人尾款 −50」。
 *   - main.js commitSeason：beforeCommit（取本季 preview；忽略季沒有帳單時直接算）→ PoolFlow／Complaint／Economy.commit → afterCommit（扣款、建立新合約、套 onUnpaid）。
 *  規則（咪咪 10/10 平衡審）：
 *   - oneActiveContract：同一份合約尾款付清前不能再買（卡片灰掉，lockOf）。
 *   - onUnpaid.banRestOfTerm：罷工後本任期卡鎖住，顯示「吹笛人不接案了」。
 *   - onUnpaid.noPreventionAfterStrike：罷工後從 poolState.owned 移除，強制出現的鼠群事件不算已持有預防卡。
 *   - onUnpaid 其餘：complaintDelta、reputationDelta、flowDelta（1 季，ctx.town.boost）、forceEventId（poolState.pending，delay forceDelayCycles）、cancelRemaining、cancelPolicyEffect.cardRecurring。
 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  function V(x) { return (x && typeof x === 'object' && 'value' in x) ? x.value : x; }
  function pol(pid) { return (G.DATA && G.DATA.policies || {})[pid] || null; }
  function spec(pid) { var p = pol(pid), i = p && p.installment; return i && i.enabled !== false && (i.payments || []).length ? i : null; }
  function cycleOf(ctx) { return (ctx.monthIndex || 0) + 1; }
  function nameOf(pid) { var p = pol(pid); return (p && (p.titleShort || p.name)) || pid; }
  function vendor(pid) { var i = spec(pid); return (i && i.vendorName) || (pid === 'policy_pied_piper' ? '吹笛人' : nameOf(pid)); }
  function state(ctx) {
    if (!ctx.installments) ctx.installments = { contracts: [], banned: {}, strikes: [] };
    return ctx.installments;
  }
  function active(ctx, pid) {
    return state(ctx).contracts.filter(function (c) { return (!pid || c.policyId === pid) && c.status === 'active'; });
  }

  /** 本季到期尾款（純函式，不寫入） */
  function duePreview(ctx, moneyBefore, bankrupt) {
    var S = ctx && ctx.installments; if (!S || !S.contracts.length) return null;
    var cyc = cycleOf(ctx), out = { cycle: cyc, paid: [], unpaid: [], paidTotal: 0 }, money = +moneyBefore || 0;
    S.contracts.forEach(function (c, ci) {
      if (c.status !== 'active') return;
      var struck = false;
      c.payments.forEach(function (p, pi) {
        if (p.status !== 'due' || p.dueCycle !== cyc || struck) return;
        var row = { contract: ci, payment: pi, policyId: c.policyId, name: vendor(c.policyId), label: p.label, money: p.money, total: c.total };
        if (bankrupt || money < p.money) { out.unpaid.push(row); struck = true; }
        else { out.paid.push(row); out.paidTotal += p.money; money -= p.money; }
      });
    });
    return out.paid.length || out.unpaid.length ? out : null;
  }

  /** 結報 commit 前：取本季 preview（已含在帳單裡）；忽略季（沒有帳單）→ 直接以目前金錢算，afterCommit 時自己扣款 */
  function beforeCommit(ctx) {
    var T = ctx.town, pend = T && T.pending, cyc = cycleOf(ctx);
    if (pend && pend.bill && pend.bill.season === (T.season + 1)) return { cycle: cyc, played: (pend.played || []).slice(), due: pend.bill.installments || null, direct: false };
    var played = (ctx.policiesPlayed || []).slice();
    return { cycle: cyc, played: played, due: duePreview(ctx, ctx.metrics ? ctx.metrics.money : 0, !!(T && T.bankrupt)), direct: true };
  }

  function afterCommit(ctx, info) {
    if (!info) return null;
    var S = state(ctx), ev = { paid: [], unpaid: [], created: [] }, due = info.due;
    if (due) {
      due.paid.forEach(function (r) { var c = S.contracts[r.contract]; if (!c) return; c.payments[r.payment].status = 'paid'; ev.paid.push(r); });
      if (info.direct && due.paidTotal && ctx.metrics) ctx.metrics.money -= due.paidTotal;
      due.unpaid.forEach(function (r) { var c = S.contracts[r.contract]; if (!c) return; strike(ctx, c, r, info.cycle); ev.unpaid.push(r); });
      S.contracts.forEach(function (c) { if (c.status === 'active' && c.payments.every(function (p) { return p.status !== 'due'; })) c.status = 'done'; });
    }
    (info.played || []).forEach(function (pid) {
      var sp = spec(pid); if (!sp || S.banned[pid]) return;
      if (V(sp.oneActiveContract) && active(ctx, pid).length) return;
      var c = { policyId: pid, boughtCycle: info.cycle, total: sp.total, status: 'active', payments: sp.payments.map(function (p) { return { dueCycle: info.cycle + (p.dueSeasonOffset || 1), money: p.money, label: p.label || '尾款', status: 'due' }; }) };
      S.contracts.push(c); ev.created.push(pid);
    });
    S.last = { cycle: info.cycle, paid: ev.paid.length, unpaid: ev.unpaid.length, created: ev.created.slice() };
    return ev;
  }

  function strike(ctx, c, row, cyc) {
    var S = state(ctx), sp = spec(c.policyId) || {}, U = sp.onUnpaid || {}, pid = c.policyId;
    c.status = 'strike';
    if (U.cancelRemaining !== false) c.payments.forEach(function (p) { if (p.status === 'due') p.status = 'void'; });
    S.strikes.push({ policyId: pid, cycle: cyc, label: row.label, money: row.money });
    var cv = ctx.complaints && ctx.complaints.values;
    if (cv && U.complaintDelta) Object.keys(U.complaintDelta).forEach(function (d) { if (d in cv) cv[d] = Math.max(0, Math.min(100, (+cv[d] || 0) + (+U.complaintDelta[d] || 0))); });
    var T = ctx.town;
    if (T) {
      if (U.reputationDelta) T.reputation = Math.max(0, Math.min(100, T.reputation + U.reputationDelta));
      if (U.flowDelta) { T.boost = T.boost || { tourist: 0, foot: 0 }; Object.keys(U.flowDelta).forEach(function (f) { T.boost[f] = (T.boost[f] || 0) + U.flowDelta[f]; }); } /* boost 只作用下一季 */
      if (U.cancelPolicyEffect && U.cancelPolicyEffect.cardRecurring && T.recActive) delete T.recActive[pid];
    }
    var ps = ctx.poolState;
    if (ps && U.forceEventId) {
      ps.pending = (ps.pending || []).filter(function (p) { return p.eventId !== U.forceEventId; });
      ps.pending.push({ eventId: U.forceEventId, fromEventId: U.easterEggId || 'installment_unpaid', dueCycle: cyc + Math.max(1, U.forceDelayCycles || 1), label: U.forceNote || '' });
    }
    if (ps && V(U.noPreventionAfterStrike)) { ps.owned = (ps.owned || []).filter(function (x) { return x !== pid; }); S.noPrevention = S.noPrevention || {}; S.noPrevention[pid] = true; }
    if (V(U.banRestOfTerm)) S.banned[pid] = true;
    if (U.easterEggId) { ctx.easterEggs = ctx.easterEggs || { fired: {}, lastCycle: {} }; ctx.easterEggs.queued = U.easterEggId; } /* 下一季街景開始時播（fable.js） */
    if (G.BehaviorLog && G.BehaviorLog.installmentUnpaid) G.BehaviorLog.installmentUnpaid(ctx, pid);
  }

  /** 卡片鎖：{reason:'banned'|'active', text} 或 null（policy.js 用來灰卡） */
  function lockOf(ctx, pid) {
    if (!ctx || !spec(pid)) return null;
    var S = ctx.installments, sp = spec(pid);
    if (S && S.banned && S.banned[pid]) return { reason: 'banned', text: vendor(pid) + '不接案了' };
    if (V(sp.oneActiveContract) && S && active(ctx, pid).length) {
      var left = 0; active(ctx, pid).forEach(function (c) { c.payments.forEach(function (p) { if (p.status === 'due') left += p.money; }); });
      return { reason: 'active', text: '尾款付清前不能再請（還欠 ' + left + '）' };
    }
    return null;
  }
  /** 只提示不擋：買之前 money < total → 「尾款可能付不出來」 */
  function warnOf(ctx, pid) {
    var sp = spec(pid); if (!sp || !ctx || !ctx.metrics) return '';
    return ctx.metrics.money < (sp.total || 0) ? '尾款可能付不出來' : '';
  }
  function summary(pid) {
    var sp = spec(pid); if (!sp) return '';
    var dep = Math.abs((sp.deposit && sp.deposit.money) || ((pol(pid) || {}).deltas || {}).money || 0);
    var pays = sp.payments.map(function (p) { return p.money; }), same = pays.every(function (m) { return m === pays[0]; });
    return '訂金 ' + dep + '＋尾款 ' + (same ? pays[0] + '×' + pays.length : pays.join('＋')) + '＝' + (sp.total || dep + pays.reduce(function (a, b) { return a + b; }, 0));
  }

  G.Installment = { duePreview: duePreview, beforeCommit: beforeCommit, afterCommit: afterCommit, lockOf: lockOf, warnOf: warnOf, summary: summary, spec: spec, state: state, ready: true };
})(window);
