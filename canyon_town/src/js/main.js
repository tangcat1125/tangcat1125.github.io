/**
 * main.js — 組裝模組、rAF 迴圈、季流程狀態機。
 * 流程：模擬季 → 報紙（＋公所貓貓建議區）→ 政策 → 確認 → 職員執行過程（Stage G #exec-panel；無 StageG 時為日常運行）→ 執行評估 → 本季結報（政策已施行，不能回頭）→ 看本月報紙／繼續下一季。
 * 沒有獨立回放階段：日常運行結束時才呼叫 Replay.simulate 算結果，並在結報時 Complaint.settle 算預覽；繼續下一季時 commit（結報後沒有任何回頭路）；決策前可「不執行任何政策，直接下一季」。
 * Stage H：HUD 常駐「結束任期」（stage_h.js）→ endTerm('forced')；第 20 季或破產（?termSeasons=N 測試）結報鈕改「查看任期結算」→ endTerm('natural')；行為紀錄 G.BehaviorLog 各階段掛點。
 * file:// 經典腳本入口（無 bundler）。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  var PHASE = {
    IDLE: 'idle',
    SIMULATING: 'simulating',
    NEWSPAPER: 'newspaper',
    POLICY: 'policy',
    DAILY: 'daily', /* 確認政策後的日常運行（街景照常跑，倒數後自動結報） */
    RESULT: 'result'
  };

  var ctx = {
    season: null,
    metrics: null,
    baseMetrics: null,
    phase: PHASE.IDLE,
    firedEvents: [],
    problems: {},
    policiesPlayed: [],
    lastDeltas: null,
    monthIndex: 0,
    snapshot: null,
    policiesSelected: [],
    commissionsAccepted: [],
    commissionsDeclined: [],
    commissionHints: [],
    /* 「忽略，繼續下一季」留下的後果：ignoredIssues＝尚未處理的清單（下一季快報顯示）；ignoredLog＝歷史紀錄 */
    ignoredIssues: [],
    ignoredLog: [],
    /* 街景回合蒐集到的線索（street_clues.js 每輪開始時清空）：{id,summary,domainId,importance,season,…} */
    clues: []
  };
  G.state.ctx = ctx; /* 唯讀供除錯／QA 查看（例如 ignoredIssues） */

  var world, npcs, vehicles, hud, hand, dialogue;
  var els = {};

  function $(id) { return document.getElementById(id); }

  function setBanner(text, show) {
    var b = els.banner;
    if (!b) return;
    if (!show) { b.hidden = true; return; }
    b.hidden = false;
    b.textContent = text;
  }

  function setDebug() {
    var cores = (ctx.season && ctx.season.coreProblemIds) || [];
    var resolved = cores.length
      ? cores.every(function (id) { return ctx.problems[id] === 0; })
      : false;
    if (els.dbgSeason) {
      els.dbgSeason.textContent = '季：' + (ctx.season ? ctx.season.id : '—') +
        '／' + (ctx.season ? ctx.season.monthLabel : '');
    }
    if (els.dbgPhase) els.dbgPhase.textContent = '階段：' + (ctx.phase === PHASE.DAILY ? '日常' : ctx.phase);
    if (G.StreetClues) G.StreetClues.setPhase(ctx.phase); /* 回合條階段鏈高亮 */
    if (els.dbgEvents) {
      els.dbgEvents.textContent = '事件：' +
        ((ctx.firedEvents && ctx.firedEvents.length) ? ctx.firedEvents.join(',') : '（無）');
    }
    if (els.dbgResolved) {
      els.dbgResolved.textContent = '核心解決：' + (resolved ? '是' : '否');
    }
  }

  /** P1：貓貓市流量 → 街景密度（開局立即、之後逐步）與 HUD 流量晶片。economy 關閉（?economy=off）時完全不動。 */
  function applyTownDensity(immediate) {
    try {
      if (!G.Economy || !ctx.town || !G.Density) return;
      G.Economy.streetDensity(ctx, { immediate: !!immediate });
    } catch (e) { if (global.console) console.warn('[Economy] density', e); }
  }
  function mixRoster(base, extra) { /* 居民與額外 NPC 交錯排列（額外者均勻插入），避免全擠在街的一側 */
    var total = base.length + extra.length, out = base.slice(), m = extra.length;
    extra.forEach(function (e, j) { out.splice(Math.min(out.length, Math.floor((j + 0.5) * total / m)), 0, e); });
    return out;
  }
  function captureNow() {
    ctx.snapshot = G.Season.captureSnapshot({
      season: ctx.season,
      metrics: ctx.metrics,
      baseMetrics: ctx.baseMetrics,
      npcs: npcs,
      firedEvents: ctx.firedEvents,
      problems: ctx.problems,
      policiesPlayed: ctx.policiesPlayed,
      phase: ctx.phase
    });
    return ctx.snapshot;
  }

  function applySimResult(next) {
    ctx.metrics = next.metrics;
    ctx.firedEvents = next.firedEvents || [];
    ctx.problems = next.problems || {};
    ctx.policiesPlayed = next.policiesPlayed || [];
    ctx.lastDeltas = next.lastDeltas || null;
    hud.render(ctx.metrics, ctx.lastDeltas);
    setDebug();
  }

  function runSimulate(policies) {
    var snap = ctx.snapshot || captureNow();
    snap.baseMetrics = G.Events.clone(ctx.baseMetrics);
    var next = G.Replay.simulate(ctx.season.id, snap, policies || []);
    if (G.Economy && ctx.town) G.Economy.adjustSim(ctx, next, policies || []); /* 舊事件的隨機金額不再進帳；錢只由帳單結算 */
    applySimResult(next);
    return next;
  }

  function mountHandToDecisionHud(hud) {
    if (!hand || !hud || !hud.hand) return;
    hand.remount({
      handEl: hud.hand,
      predictEl: hud.predict,
      confirmBtn: hud.confirm,
      clearBtn: hud.clear,
      onChange: function (selected) {
        ctx.policiesSelected = selected || [];
        if (G.StaffDrawer) G.StaffDrawer.onPolicies(selected || []); /* 公所貓貓抽屜：依所選卡更新召喚討論 */
        if (G.StageG) G.StageG.onSelection(ctx, selected || [], hand, hud); /* Stage G：無關卡提示＋建議區同步 */
        if (ctx.phase === PHASE.POLICY && selected && selected.length && G.StaffCommissionUI && !(G.StaffDrawer && G.StaffDrawer.isOpen())) {
          G.StaffCommissionUI.maybeOfferForPolicies(ctx, selected);
        }
      }
    });
    if (hud.clear) {
      hud.clear.onclick = function () { hand.clear(); };
    }
    mountSkipButton(hud);
    if (hud.confirm) {
      hud.confirm.onclick = function () { confirmPolicies(); };
    }
  }

  /** Stage G：點數＋金錢上限、公所貓貓建議區（決策欄頂部）。 */
  function stageGMount(hud) {
    if (!hand) return;
    hand.setMoney(ctx.town && ctx.baseMetrics ? ctx.baseMetrics.money : null);
    if (G.StageG && hud) { G.StageG.mountAdvice(ctx, hud, hand); G.StageG.onSelection(ctx, hand.getSelected(), hand, hud); }
  }

  /** 決策欄的「不執行任何政策，直接下一季」（#btn-ignore-next）：只在執行政策之前可用。 */
  function mountSkipButton(hud) {
    if (!hud || !hud.confirm || !hud.confirm.parentNode) return;
    var host = hud.confirm.parentNode;
    var b = document.getElementById('btn-ignore-next');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.id = 'btn-ignore-next';
      b.className = 'newspaper__btn np-skip-btn';
      b.textContent = '不執行任何政策，直接下一季';
      b.title = '這季不出手：沒解決的問題會累積到下一季，民怨也會加碼';
    }
    if (b.parentNode !== host) host.appendChild(b);
    b.onclick = skipSeason;
  }

  /** 不執行政策就進下一季：用「零政策」算本季結果 → 記錄未解決核心問題 → advance（commit 一次）。 */
  function skipSeason() {
    if (ctx.phase !== PHASE.POLICY) return;
    if (G.StageG && G.StageG.closePendingCommission) G.StageG.closePendingCommission(ctx); /* 委任彈窗不殘留 */
    var next = runSimulate([]);
    ctx.policiesSelected = [];
    ctx.policiesPlayed = [];
    if (G.PoolFlow) G.PoolFlow.settle(ctx, []);
    if (G.Complaint && ctx.complaints) G.Complaint.settle(ctx, [], next.problems || {});
    var open = (ctx.season.coreProblemIds || []).map(function (id) {
      var e = G.DATA.events[id];
      return { id: id, label: e ? e.title : id, done: next.problems[id] === 0 };
    }).filter(function (c) { return !c.done; });
    ctx.ignoredIssues = (ctx.ignoredIssues || []);
    if (els.newspaper) {
      if (els.newspaper._npApi) els.newspaper._npApi.hide();
      else if (G.Newspaper) G.Newspaper.hide(els.newspaper);
    }
    if (G.BehaviorLog) G.BehaviorLog.ignore(ctx); /* Stage H：忽略次數 */
    hand.clear();
    recordIgnored(open);
    advance();
  }

  /** 快報「民怨榜」資料：平常顯示已寫入值；結報後回看（after）顯示結報預覽值。 */
  function complaintViewForPaper() {
    if (!G.Complaint || !ctx.complaints) return null;
    var pend = ctx.newspaperStage === 'after' && ctx.complaints.pending;
    var v = G.Complaint.view(ctx, pend ? pend.values : null);
    if (v && pend) v.title = v.title + '（結報後）';
    return v;
  }

  function showNewspaper() {
    ctx.phase = PHASE.NEWSPAPER;
    setBanner('貓貓快報：滑讀 → 展開畫重點 → 右側決策欄用點數買政策', true);
    hand.setEnabled(false);
    setDebug();
    G.Newspaper.render(els.newspaper, {
      stage: ctx.newspaperStage || 'read', /* 結報後回看快報 → 'after' 段文案；其餘 read 起算，newspaper.js 依進度切 clue／decide */
      season: ctx.season,
      ignoredIssues: ctx.ignoredIssues || [],
      complaintView: complaintViewForPaper(),
      paper: G.PoolFlow ? G.PoolFlow.paperFor(ctx) : null, /* 事件池組出的快報（無則用靜態 newspaper_season_01） */
      streetClueView: G.StreetClues ? G.StreetClues.view(ctx) : null, /* 街景蒐集到的線索（回合條） */
      metrics: ctx.metrics,
      lastDeltas: ctx.lastDeltas,
      firedEvents: ctx.firedEvents,
      problems: ctx.problems,
      onBanner: function (text) { setBanner(text, true); },
      onGatePass: function (info) {
        // 門檻通過：報紙保持開著，打開右側決策欄並掛上政策店
        enterPolicyPhase({ keepNewspaperOpen: true, hud: info && info.hud });
      },
      onReadyForPolicy: function (info) {
        enterPolicyPhase({ keepNewspaperOpen: true, hud: info && info.hud });
      },
      onDecisionHudOpen: function (hud) {
        mountHandToDecisionHud(hud);
        hand.setPoints(ctx.baseMetrics.points);
        hand.setEnabled(true);
        stageGMount(hud);
      },
      onDismiss: function () {
        setBanner('快報已合上——再點「打開貓貓快報」；門檻通過後可開決策欄買政策', true);
        if (els.btnOpenPaper) els.btnOpenPaper.hidden = false;
        hand.setEnabled(false);
        setDebug();
      }
    });
  }

  function offerStaffCommission(reason) {
    if (!G.StaffCommissionUI) return;
    if (G.StaffDrawer && G.StaffDrawer.isOpen()) return; /* 抽屜開著＝玩家正在自己挑人，不再自動彈委任 */
    ctx.policiesSelected = hand.getSelected();
    G.StaffCommissionUI.show({
      ctx: ctx,
      onAccept: function (c, staff) {
        setBanner('已委託 ' + (staff && staff.name ? staff.name : '公職') + '：「' + (c && c.title ? c.title : '') + '」— 確認並結報，貓貓市照常日常運行', true);
        setDebug();
      },
      onDecline: function () {
        setBanner('已婉拒委任 — 仍可用點數買政策卡後確認並結報', true);
      },
      onSkip: function () { /* 無合適委任 */ }
    });
  }

  function enterPolicyPhase(opts) {
    opts = opts || {};
    ctx.phase = PHASE.POLICY;
    setBanner('決策欄：居民心聲 → 用點數買政策卡 → 公職委任（星芒圖）→ 確認並結報', true);
    var hud = opts.hud;
    if (!hud && els.newspaper && els.newspaper.classList.contains('is-open') && els.newspaper._npApi) {
      hud = els.newspaper._npApi.getHudEls();
      if (els.newspaper._npApi.isGatePassed && els.newspaper._npApi.isGatePassed()) {
        els.newspaper._npApi.setHudOpen(true);
      }
    }
    if (hud && hud.hand) {
      mountHandToDecisionHud(hud);
      var rail = document.getElementById('hand-rail');
      if (rail) {
        rail.classList.add('is-away');
        rail.hidden = true;
      }
    } else {
      /* 無快報決策欄時退回底部手牌（舊流程殘留的退路） */
      hand.remount({
        handEl: $('policy-hand-scroll'),
        predictEl: $('policy-predict'),
        confirmBtn: $('btn-confirm-policies'),
        clearBtn: $('btn-clear-policies'),
        onChange: function (selected) {
          ctx.policiesSelected = selected || [];
        }
      });
    }
    hand.setPoints(ctx.baseMetrics.points);
    hand.setEnabled(true);
    if (!opts.preserveSelection) hand.clear();
    stageGMount(hud && hud.hand ? hud : null);
    if (els.btnOpenPaper) {
      els.btnOpenPaper.hidden = false;
      els.btnOpenPaper.textContent = '打開貓貓快報';
    }
    if (els.btnStart) els.btnStart.hidden = true;
    setDebug();
    setTimeout(function () { offerStaffCommission('policyPhase'); }, 600);
  }

  /** 結報按鈕「看本月報紙」：開啟第二份報紙（本月快報，只讀；不改任何狀態）。 */
  function monthlyPaperBtn() {
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'btn-monthly-paper';
    b.className = 'mvp-btn mvp-btn--primary result-btn result-btn--primary';
    b.textContent = '看本月報紙';
    b.onclick = function () {
      if (G.MonthlyPaper) G.MonthlyPaper.open(ctx, { onClose: function () { try { b.focus({ preventScroll: true }); } catch (e) {} } });
    };
    return b;
  }

  function showResult(next) {
    ctx.phase = PHASE.RESULT;
    ctx.newspaperStage = 'after';
    setBanner(null, false);
    var ok = G.Replay.isResolved(next);
    var modal = els.result;
    modal.hidden = false;
    var cores = (ctx.season.coreProblemIds || []).map(function (id) {
      var e = G.DATA.events[id];
      return { id: id, label: e ? e.title : id, done: next.problems[id] === 0 };
    });
    var open = cores.filter(function (c) { return !c.done; });
    /* 結報：政策已施行，沒有回頭路。settle 算出本季結果（pending），按「繼續下一季」時 commit 寫入一次（commit 皆冪等） */
    if (G.PoolFlow) G.PoolFlow.settle(ctx, next.policiesPlayed || []); /* 事件池結報預覽（advance 才 commit） */
    if (G.Complaint && ctx.complaints) G.Complaint.settle(ctx, next.policiesPlayed || [], next.problems || {});
    var billHtml = '';
    if (G.Economy && ctx.town) { var bl = G.Economy.preview(ctx, next.policiesPlayed || []); if (bl) billHtml = G.Economy.billHtml(ctx, bl); } /* 季度帳單（preview 不寫入；advance 才 commit） */
    var cmpLines = (G.Complaint && ctx.complaints) ? G.Complaint.previewLines(ctx) : [];
    var cmpHtml = cmpLines.length
      ? '<div class="result-complaint"><h3>民怨變化（本季結果）</h3><ul>' + cmpLines.map(function (l) {
          var arrow = l.delta < 0 ? '▼' : (l.delta > 0 ? '▲' : '＝');
          var cls = l.delta < 0 ? 'is-down' : (l.delta > 0 ? 'is-up' : 'is-flat');
          return '<li class="' + cls + '" data-domain="' + l.id + '"><span class="rc-name">' + l.icon + ' ' + l.name + '</span>' +
            '<span class="rc-val">' + l.from + ' → ' + l.to + '</span>' +
            '<span class="rc-delta">' + arrow + ' ' + (l.delta > 0 ? '+' : '') + l.delta + '</span>' +
            '<span class="rc-tier" style="border-color:' + l.color + '">' + l.tierLabel + '</span></li>';
        }).join('') + '</ul></div>'
      : '';
    /* 之前被忽略、這次已解決的問題 → 從待處理清單移除（歷史仍保留在 ignoredLog） */
    ctx.ignoredIssues = (ctx.ignoredIssues || []).filter(function (it) {
      return !cores.some(function (c) { return c.id === it.id && c.done; });
    });
    if (G.BehaviorLog) G.BehaviorLog.result(ctx, next.policiesPlayed || []); /* Stage H：選卡判定 */
    var gHtml = '', endK = null;
    if (G.StageG && G.Economy && ctx.town) { /* Stage G：本季解鎖成就徽章／結局圖（預覽；commit 才寫入） */
      try {
        var pb = G.Economy.bill(ctx);
        gHtml = G.StageG.badgesHtml(G.StageG.achCheck(ctx, pb));
        endK = G.StageG.endingOf(ctx, pb); if (endK) gHtml += G.StageG.endingHtml(endK);
        G.StageG.rememberSettle(ctx, next.policiesPlayed || []);
      } catch (eg) { if (global.console) console.warn('[StageG] result', eg); }
    }
    var EXPLAIN = '<p class="result-explain" id="result-explain">政策已施行，以下為施政數據變化，請評估這季的行政是否正確。</p>';
    var msg = ok
      ? '<h2 class="result-title is-ok">📋 本季結報：✅ 核心問題已緩解！</h2>' + EXPLAIN + '<p>排水與市集對策奏效。</p>'
      : '<h2 class="result-title is-warn">📋 本季結報：⚠️ 問題尚未解決</h2>' + EXPLAIN + '<p class="result-carry-note" id="result-carry-note">核心問題仍在。按「繼續下一季」後，沒解決的問題會累積到下一季快報，民怨也會跟著加碼。</p>';
    var coreLis = cores.map(function (c) {
      return '<li class="result-issue ' + (c.done ? 'is-done' : 'is-open') + '" data-issue="' + c.id + '">' +
        '<span class="result-issue__icon" aria-hidden="true">' + (c.done ? '✅' : '⚠️') + '</span>' +
        '<span class="result-issue__name">' + c.label + '</span>' +
        '<span class="result-issue__state">' + (c.done ? '已解決' : '未解決') + '</span></li>';
    }).join('');
    modal.innerHTML =
      '<div class="result-card ' + (ok ? 'is-resolved' : 'is-unresolved') + '" role="dialog" aria-modal="true">' + billHtml + msg +
      '<ul class="result-issues">' + coreLis + '</ul>' + (G.PoolFlow ? G.PoolFlow.resultHtml(ctx) : '') + cmpHtml + gHtml +
      '<div class="actions result-actions"></div></div>';
    if (billHtml && G.Economy.bindBill) G.Economy.bindBill(modal);
    var actions = modal.querySelector('.actions');
    /* ① 看本月報紙（主要）② 繼續下一季。結報後沒有回頭調整鈕或「忽略」：政策已施行。 */
    actions.appendChild(monthlyPaperBtn());
    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.id = 'btn-next-season';
    nextBtn.className = 'mvp-btn result-btn result-btn--ghost';
    nextBtn.textContent = '繼續下一季';
    nextBtn.onclick = function () {
      modal.hidden = true;
      if (!ok) recordIgnored(open); /* 沒解決的核心問題記入 ignoredIssues／ignoredLog，下一季快報顯示、民怨累積 */
      advance(); /* 唯一一次 commit */
    };
    if (endK && G.StageH) { /* Stage H：自然結束（第 20 季或破產）→ 第二顆鈕改「查看任期結算」 */
      nextBtn.textContent = '查看任期結算';
      nextBtn.setAttribute('data-ending', endK);
      nextBtn.onclick = function () { modal.hidden = true; if (!ok) recordIgnored(open); endTerm('natural', endK); };
    }
    actions.appendChild(nextBtn);
    setDebug();
  }

  /** 忽略未解決的核心問題：記入 ctx.ignoredIssues（下一季快報會顯示）與 ctx.ignoredLog。 */
  function recordIgnored(list) {
    (list || []).forEach(function (c) {
      var rec = {
        id: c.id,
        label: c.label,
        seasonId: ctx.season.id,
        monthIndex: ctx.monthIndex || 0,
        monthLabel: ctx.season.monthLabel
      };
      var dup = (ctx.ignoredIssues || []).some(function (it) { return it.id === c.id; });
      if (!dup) ctx.ignoredIssues.push(rec);
      ctx.ignoredLog.push(rec);
    });
  }

  /** 本季結果寫入（唯一一次 commit）：事件池／民怨／帳單／成就；Stage H 行為紀錄記下季末曲線。 */
  function commitSeason() {
    if (G.StreetClues) G.StreetClues.stop(); /* 保險：不讓觀察計時跨季殘留 */
    ctx.newspaperStage = null;
    var instInfo = G.Installment ? G.Installment.beforeCommit(ctx) : null; /* Stage I：本季到期尾款（帳單已含；忽略季直接算） */
    if (G.PoolFlow) G.PoolFlow.commit(ctx); /* 事件池 history／pending 寫入（下一季抽事件用） */
    if (G.Complaint) G.Complaint.commit(ctx); /* 把本季民怨結算寫入，下一季快報延續顯示 */
    if (G.Economy) G.Economy.commit(ctx); /* 帳單結算：金錢＝季初＋本季淨利；流量／店家寫入 ctx.town */
    if (G.Installment) G.Installment.afterCommit(ctx, instInfo); /* Stage I：扣款／建立合約／罷工後果（民怨、聲望、下季強制鼠群、鎖卡、移除預防卡） */
    if (G.StageG) { G.StageG.commit(ctx); G.StageG.renderShops(ctx); } /* 成就寫入；街景店面依新店家狀態 */
    if (G.BehaviorLog) G.BehaviorLog.seasonEnd(ctx); /* Stage H：民怨／流量／店家／金錢曲線 */
  }

  /** Stage H：結束任期（forced＝HUD「結束任期」確認；natural＝第 20 季或破產）→ 任命狀。結報已看過但未 commit 的季先 commit 再結算。 */
  function endTerm(reason, kind) {
    if (ctx.phase === 'ended') return;
    if (G.StreetClues) G.StreetClues.stop();
    clearInterval(daily.timer); daily.timer = null;
    var d = dailyEls(); if (d.strip) d.strip.hidden = true;
    if (G.StageG && G.StageG.closePendingCommission) G.StageG.closePendingCommission(ctx);
    if (G.StageG && G.StageG.hideLayer) { try { G.StageG.hideLayer(); } catch (e) {} }
    var ev = $('exec-eval'); if (ev && ev.parentNode) ev.parentNode.removeChild(ev);
    if (els.newspaper) { if (els.newspaper._npApi) els.newspaper._npApi.hide(); else if (G.Newspaper) G.Newspaper.hide(els.newspaper); }
    if (G.MonthlyPaper && G.MonthlyPaper.close) { try { G.MonthlyPaper.close(); } catch (e) {} }
    var wasResult = ctx.phase === PHASE.RESULT;
    if (els.result) els.result.hidden = true;
    if (wasResult) commitSeason();
    hand.setEnabled(false);
    if (els.btnOpenPaper) els.btnOpenPaper.hidden = true;
    var T = ctx.town, open = T && T.shops ? T.shops.filter(function (s) { return s.state !== 'closed'; }).length : 1;
    var win = null;
    if (!kind) { /* 強制結束：破產 → bankrupt；達勝利條件（G.StageG.winCheck，不要求滿 20 季）→ victory；其餘 good，等第依六軸表現 */
      if ((ctx.metrics && ctx.metrics.money < 0) || open === 0 || (T && T.bankrupt)) kind = 'bankrupt';
      else { win = G.StageG && G.StageG.winCheck ? G.StageG.winCheck(ctx) : null; kind = win && win.ok ? 'victory' : 'good'; }
    }
    ctx.phase = 'ended';
    if (G.MayorAnan) { G.MayorAnan.close(); G.MayorAnan.show(false); }
    if (G.Fable) G.Fable.stopAll();
    setBanner(null, false);
    if (G.BehaviorLog) G.BehaviorLog.finish(ctx, { reason: reason, kind: kind, win: win });
    if (G.StageH) G.StageH.showEnding(ctx, { reason: reason, kind: kind });
    setDebug();
  }

  function advance() {
    commitSeason();
    G.Season.advanceMonth(ctx);
    ctx.baseMetrics = G.Events.clone(ctx.metrics);
    hand.clear();
    hand.setEnabled(false);
    hud.render(ctx.metrics, { points: 0, money: 0, profit: 0, happiness: 0 });
    applyTownDensity(false); /* 街上人車隨新流量逐步增減 */
    ctx.phase = PHASE.IDLE;
    if (els.btnStart) {
      els.btnStart.hidden = true;
      els.btnStart.setAttribute('aria-hidden', 'true');
    }
    if (els.btnOpenPaper) els.btnOpenPaper.hidden = true;
    setBanner(ctx.season.monthLabel + '開始 — 自動模擬本季', true);
    setDebug();
    captureNow();
    // studio：進下一月也自動開跑（手牌保持 is-away）
    setTimeout(function () { startSeasonSim(); }, 400);
  }

  /** 街景觀察（回合條 30 秒，泡泡＋蒐集線索）→ 時間到或「提早結報」→ 算本季模擬並開快報。
   *  回合條模組（street_clues.js）不在時退回舊的 2.8 秒自動跑。 */
  function startSeasonSim() {
    ctx.phase = PHASE.SIMULATING;
    if (ctx.phase === 'ended') return;
    if (G.PoolFlow) G.PoolFlow.beginCycle(ctx); /* 回合條開始前先抽本季事件（同一季只抽一次） */
    setBanner('本季進行中…貓貓市自動運轉（此時不出手牌）', true);
    if (els.btnStart) els.btnStart.hidden = true;
    hand.setEnabled(false);
    captureNow();
    if (G.BehaviorLog) G.BehaviorLog.seasonStart(ctx); /* Stage H：本季行為紀錄開始 */
    if (G.MayorAnan) G.MayorAnan.seasonStart(ctx); /* Stage I：安安市長本季是否上街（?mayor=1 必出） */
    if (G.Fable) G.Fable.seasonStart(ctx); /* Stage I：童話彩蛋（罷工後鼠群繞市／小紅帽；?fable= 直接播） */
    function toPaper() {
      if (ctx.phase !== PHASE.SIMULATING) return;
      runSimulate([]);
      showNewspaper();
    }
    if (G.StreetClues && G.StreetClues.ready) {
      G.StreetClues.start({
        ctx: ctx,
        hooks: {
          getNpcs: function () { return npcs && npcs.getList ? npcs.getList() : []; },
          dialogue: dialogue,
          getPool: function () { return G.PoolFlow ? G.PoolFlow.streetPack(ctx) : null; },
          banner: function () { setBanner(null, false); }, /* 回合條自己有提示列，頂部橫幅先收起 */
          onFinish: toPaper
        }
      });
      setDebug();
      return;
    }
    var elapsed = 0;
    var duration = 2800;
    function step(ts) {
      if (!step.t0) step.t0 = ts;
      elapsed = ts - step.t0;
      if (elapsed < duration) {
        requestAnimationFrame(step);
        return;
      }
      toPaper();
    }
    requestAnimationFrame(step);
    setDebug();
  }

  /* ---- 確認政策 → 日常運行（街景照常跑）→ 結報 ---- */
  var DAILY_MS = 7000; /* 日常運行秒數；時間到自動結報，也可按「結報」提早 */
  var daily = { timer: null, t0: 0, policies: null };

  function dailyEls() {
    return {
      strip: $('daily-strip'),
      chips: $('daily-strip-chips'),
      count: $('daily-strip-count'),
      fill: $('daily-strip-fill')
    };
  }

  function confirmPolicies() {
    if (ctx.phase === PHASE.DAILY) return;
    var policies = hand.getSelected();
    if (!policies.length) return;
    ctx.policiesSelected = policies;
    ctx.phase = PHASE.DAILY;
    if (els.newspaper) {
      if (els.newspaper._npApi) els.newspaper._npApi.hide();
      else if (G.Newspaper) G.Newspaper.hide(els.newspaper);
    }
    hand.setEnabled(false);
    if (els.btnOpenPaper) els.btnOpenPaper.hidden = true;
    captureNow();
    var names = policies.map(function (id) {
      var p = G.DATA.policies[id];
      return p && p.name ? p.name : id;
    });
    daily.policies = policies;
    if (G.BehaviorLog) G.BehaviorLog.decision(ctx, policies, { pointsAvail: ctx.baseMetrics ? ctx.baseMetrics.points : null }); /* Stage H：選卡／採納建議／委任／點數 */
    if (G.Fable) G.Fable.onPolicies(ctx, policies); /* Stage I：吹笛人執行 → 街景遊行 */
    if (G.StageG) { /* Stage G：日常階段改為「職員執行過程」#exec-panel → 執行評估 → 結報 */
      setBanner('公所貓貓執行中：' + names.join('、'), true);
      G.StageG.runExec(ctx, policies, function () { finishDaily(); });
      setDebug();
      return;
    }
    setBanner('日常運行中：' + names.join('、') + ' 生效', true);
    var d = dailyEls();
    if (d.strip) {
      d.chips.innerHTML = names.map(function (n, i) {
        return '<span class="daily-chip" style="animation-delay:' + (i * 0.35) + 's">✅ ' + n + ' 生效</span>';
      }).join('');
      d.fill.style.width = '0%';
      d.count.textContent = '日常運行中… ' + Math.ceil(DAILY_MS / 1000) + ' 秒後結報';
      d.strip.hidden = false;
    }
    daily.policies = policies;
    daily.t0 = Date.now();
    clearInterval(daily.timer);
    daily.timer = setInterval(function () {
      var el = Date.now() - daily.t0;
      var dd = dailyEls();
      if (dd.fill) dd.fill.style.width = Math.min(100, el / DAILY_MS * 100).toFixed(1) + '%';
      if (dd.count) dd.count.textContent = '日常運行中… ' + Math.max(0, Math.ceil((DAILY_MS - el) / 1000)) + ' 秒後結報';
      if (el >= DAILY_MS) finishDaily();
    }, 100);
    setDebug();
  }

  /** 日常運行結束 → 算結果 → 開「本季結報」。 */
  function finishDaily() {
    if (ctx.phase !== PHASE.DAILY) return;
    clearInterval(daily.timer);
    daily.timer = null;
    var d = dailyEls();
    if (d.strip) d.strip.hidden = true;
    var next = runSimulate(daily.policies || []);
    if (G.StageG) { /* 執行評估卡（結報前）：先算事件池／民怨預覽（結報時會再算一次，皆不寫入） */
      ctx.phase = 'evaluate';
      setBanner('執行評估：看看這季的卡打得準不準', true);
      if (G.PoolFlow) G.PoolFlow.settle(ctx, next.policiesPlayed || []);
      if (G.Complaint && ctx.complaints) G.Complaint.settle(ctx, next.policiesPlayed || [], next.problems || {});
      G.StageG.showEval(ctx, next.policiesPlayed || daily.policies || [], function () { showResult(next); });
      setDebug();
      return;
    }
    showResult(next);
  }

  function loop(ts) {
    if (!loop.last) loop.last = ts;
    var dt = Math.min(40, ts - loop.last);
    loop.last = ts;
    if (world) world.tick(dt);
    if (npcs) npcs.tick(dt);
    if (vehicles) vehicles.tick(dt);
    if (dialogue) dialogue.tick(dt);
    if (G.MayorAnan) G.MayorAnan.tick(dt); /* Stage I */
    requestAnimationFrame(loop);
  }

  function init() {
    els.banner = $('phase-banner');
    els.newspaper = $('newspaper-overlay');
    els.result = $('result-modal');
    els.btnStart = $('btn-start-season');
    els.btnOpenPaper = $('btn-open-paper');
    els.dbgSeason = $('dbg-season');
    els.dbgPhase = $('dbg-phase');
    els.dbgEvents = $('dbg-events');
    els.dbgResolved = $('dbg-resolved');

    ctx.season = G.Season.loadSeason('season_01');
    ctx.metrics = G.Season.initialMetrics(ctx.season);
    ctx.baseMetrics = G.Events.clone(ctx.metrics);
    if (G.Complaint) G.Complaint.init(ctx); /* 民怨值：ctx.complaints（跨季延續） */
    if (G.Economy) G.Economy.init(ctx); /* P1 經濟：ctx.town（流量／店家／聲望／連擊，跨季延續；?economy=off 關閉） */
    if (G.PoolFlow) G.PoolFlow.init(ctx); /* 隨機事件池：ctx.poolState（seed／history／pending 跨季延續） */
    if (G.StaffDrawer) G.StaffDrawer.init({ getCtx: function () { return ctx; }, hooks: { banner: setBanner, debug: setDebug } }); /* 公所貓貓抽屜（入口畫面隱藏，開始後才顯示開關） */

    world = new G.World($('street-stage'));
    world.measure();
    world.observe();
    npcs = new G.NpcManager($('npc-layer'));
    var roster = G.DATA.npcs;
    if (ctx.town && G.Density && G.Density.extraNpcs) roster = mixRoster(roster, G.Density.extraNpcs()); /* P1：路人／遊客／巡守上街 */
    npcs.spawnFromData(roster, world.getStreetWidth());

    vehicles = new G.VehicleManager($('vehicle-layer'));
    var vPack = G.DATA.vehicles || {};
    var typesPack = vPack.types || G.DATA.vehicleTypes || { types: [] };
    var routeKey = (ctx.season && ctx.season.vehicleRoutesId)
      || ('routes_' + (ctx.season && ctx.season.id ? ctx.season.id : 'season_01'));
    var routesPack = vPack[routeKey] || vPack.routes_season_01 || G.DATA.routes_season_01;
    if (routesPack && routesPack.spawns) {
      vehicles.spawnFromRoutes(typesPack, routesPack, world.getStreetWidth());
    } else if (Array.isArray(vPack)) {
      vehicles.spawnFromData(vPack, world.getStreetWidth());
    }

    if (G.Density) { G.Density.attach({ npcs: npcs, vehicles: vehicles, stage: $('street-stage') }); G.Density.start(); applyTownDensity(true); } /* 開局冷清＋放大倍率（data/street/street_density.json） */
    if (G.StageG) G.StageG.renderShops(ctx); /* Stage G：#shop-layer 8 家店（STUDIO SHOPS v2） */
    hud = new G.Hud($('hud-metrics'), $('hud-detail'));
    if (G.StageH) G.StageH.init({ getCtx: function () { return ctx; }, onEnd: function (reason) { endTerm(reason); } }); /* Stage H：HUD 常駐「結束任期」 */
    hud.render(ctx.metrics, { points: 0, money: 0, profit: 0, happiness: 0 });

    hand = new G.PolicyHand({
      handEl: $('policy-hand-scroll'),
      predictEl: $('policy-predict'),
      confirmBtn: $('btn-confirm-policies'),
      clearBtn: $('btn-clear-policies'),
      onChange: function (selected) {
        ctx.policiesSelected = selected || [];
        if (G.StaffDrawer) G.StaffDrawer.onPolicies(selected || []); /* 公所貓貓抽屜：依所選卡更新召喚討論 */
        if (ctx.phase === PHASE.POLICY && selected && selected.length && G.StaffCommissionUI && !(G.StaffDrawer && G.StaffDrawer.isOpen())) {
          G.StaffCommissionUI.maybeOfferForPolicies(ctx, selected);
        }
      }
    });
    hand.setPoints(ctx.metrics.points);
    hand.setEnabled(false);
    hand.render();

    els.btnStart.addEventListener('click', startSeasonSim);
    els.btnOpenPaper.addEventListener('click', function () {
      showNewspaper();
    });
    $('btn-confirm-policies').addEventListener('click', confirmPolicies);
    var btnReport = $('btn-daily-report');
    if (btnReport) btnReport.addEventListener('click', finishDaily);
    $('btn-clear-policies').addEventListener('click', function () {
      hand.clear();
    });
    $('btn-toggle-debug').addEventListener('click', function () {
      var d = $('debug');
      d.classList.toggle('is-collapsed');
      this.textContent = d.classList.contains('is-collapsed') ? '顯示除錯' : '隱藏除錯';
    });

    global.addEventListener('resize', function () {
      world.measure();
      npcs.setStreetWidth(world.getStreetWidth());
      if (vehicles) vehicles.setStreetWidth(world.getStreetWidth());
    });

    if (els.btnStart) {
      els.btnStart.hidden = true;
      els.btnStart.setAttribute('aria-hidden', 'true');
      els.btnStart.classList.add('is-studio-hidden');
    }

    if (G.SpeechBubbleManager) {
      dialogue = new G.SpeechBubbleManager({
        npcManager: npcs,
        seasonId: ctx.season && ctx.season.id
      });
    }

    if (G.Fable) G.Fable.attach({ world: world, dialogue: dialogue, getNpcs: function () { return npcs ? npcs.getList() : []; } }); /* Stage I：#npc-layer 遊行 */
    if (G.MayorAnan) G.MayorAnan.attach({ npcs: npcs, world: world, getCtx: function () { return ctx; } }); /* Stage I：安安市長 */
    setBanner(ctx.season.intro, true);
    setDebug();
    captureNow();
    requestAnimationFrame(loop);

    // 入口畫面（#landing）：按「開始遊戲」才隱藏並自動開跑；沒有 landing 時維持載入後自動開跑。
    // 遊戲內仍然沒有「開始模擬」鈕。
    var landing = $('landing');
    var started = false;
    function beginSeason() {
      if (started) return;
      started = true;
      if (G.StaffDrawer) G.StaffDrawer.setAvailable(true);
      if (G.PoolFlow) G.PoolFlow.applyLanding(); /* 教師亂數種子（#seed-input） */
      if (G.BehaviorLog) { var nm = $('student-name'); G.BehaviorLog.newGame({ seed: ctx.poolState && ctx.poolState.seed, name: nm ? nm.value.trim() : '' }, function () { return ctx; }); } /* Stage H：新局重置紀錄 */
      if (G.StageH) G.StageH.setVisible(true);
      if (landing) {
        landing.classList.add('is-away');
        landing.hidden = true;
        landing.setAttribute('aria-hidden', 'true');
      }
      world.measure();
      setTimeout(function () { startSeasonSim(); }, 400);
    }
    var landingBtn = $('btn-landing-start');
    if (landing && landingBtn) {
      landingBtn.addEventListener('click', beginSeason);
      try { landingBtn.focus(); } catch (e) { /* ignore */ }
    } else {
      beginSeason();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
