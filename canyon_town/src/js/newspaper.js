/**
 * newspaper.js — 《貓貓快報》+ 右側決策 HUD
 * 左／中：快報滑讀；右：門檻通過後才展開決策欄（居民心聲＋政策店）。
 * 門檻：scrollRatio 0.72 + 至少展開 1 則（unlockPolicyAfter）。
 * 通過後不強制關報；可切換「專注快報／打開決策欄」。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  var LOOP_SHORT = '滑讀 → 展開畫重點 → 用點數買政策卡執行改善';
  var LOOP_FULL =
    '街景觀察 → 貓貓快報滑讀％ → 展開畫重點 → 用既有點數買政策卡 → 公職依卡牌委任 → 看星芒圖決定要不要委託 → 執行改善';

  function fmtDelta(n) {
    if (n == null || n === 0) return { text: '— 0', cls: 'is-flat' };
    if (n > 0) return { text: '▲ +' + n, cls: 'is-up' };
    return { text: '▼ ' + n, cls: 'is-down' };
  }

  /* —— 資料驅動：G.DATA.newspapers.newspaper_season_01 的分段文案 ——
   * 階段 read／clue／decide／after；資料沒有 clue 時沿用 read；全缺則用原本寫死的字。 */
  var STAGE_ORDER = ['read', 'clue', 'decide', 'after'];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function byStage(map, stage) {
    if (!map || typeof map !== 'object') return null;
    if (map[stage] != null) return map[stage];
    if (stage === 'clue' && map.read != null) return map.read;
    return null;
  }

  function stageContent(paper, stage) {
    var out = { headline: null, sideTitle: '', sideTips: null, clueTitle: '', clueHints: null, weather: '', editor: '' };
    if (!paper) return out;
    var h = byStage(paper.headlineByStage, stage);
    if (h && typeof h === 'object') out.headline = h;
    var sb = paper.sidebar || null;
    if (sb) {
      out.sideTitle = sb.title || '';
      var tips = byStage(sb.byStage, stage);
      if (Array.isArray(tips) && tips.length) out.sideTips = tips;
    }
    var cb = paper.clueBox || null;
    if (cb) {
      out.clueTitle = cb.title || '';
      var hints = byStage(cb.byStage, stage);
      if (Array.isArray(hints) && hints.length) out.clueHints = hints;
    }
    var fb = paper.footerBand || null;
    if (fb) {
      var w = byStage(fb.weather, stage);
      var e = byStage(fb.editor, stage);
      if (typeof w === 'string') out.weather = w;
      if (typeof e === 'string') out.editor = e;
    }
    return out;
  }

  function stagebarHtml(paper, stage) {
    var arc = paper && paper.storyArc;
    var list = (arc && arc.stages) || [];
    if (!list.length) return '';
    return list.map(function (st) {
      return '<li class="np-stagebar__item' + (st.id === stage ? ' is-current' : '') +
        '" data-stage="' + esc(st.id) + '">' + esc(st.label || st.id) + '</li>';
    }).join('');
  }

  /* 決策欄「行動選項」：G.DATA.decisionVoices.actionOptions（verdict 對症／搭配／治標＋tradeoff） */
  function verdictClass(v) {
    if (v === '對症') return 'is-match';
    if (v === '搭配') return 'is-combo';
    if (v === '治標') return 'is-patch';
    return 'is-other';
  }

  /* 選項所屬事件名（多事件選項混列時避免誤會）：優先用快報上的報導標題（取第一段，如「週五市集擠到走不動」），否則事件池短名 */
  function shortTitle(t) {
    t = String(t || '').trim(); if (!t) return '';
    /* 先用全形空格／標點切（「豪雨 81 毫米　北坡路積水成河」→「豪雨 81 毫米」）；半形空格常在數字旁，不當分隔 */
    var first = t.split(/[　，,：:！!？?。]/)[0].trim();
    if (first.length < 4) first = t.split(/[\s　，,：:！!？?。]/)[0];
    if (first.length >= 4) t = first;
    return t.length > 14 ? t.slice(0, 13) + '…' : t;
  }
  function actionEvent(a, paperData) {
    var arts = (paperData && paperData.articles) || [];
    var art = null, i;
    for (i = 0; i < arts.length && !art; i++) if (arts[i] && a.articleId && arts[i].id === a.articleId) art = arts[i];
    for (i = 0; i < arts.length && !art; i++) if (arts[i] && a.poolEventId && arts[i].poolEventId === a.poolEventId) art = arts[i];
    var evs = (G.DATA && G.DATA.eventPool && G.DATA.eventPool.events) || [], ev = null;
    for (i = 0; i < evs.length && !ev; i++) if (evs[i].id === a.poolEventId) ev = evs[i];
    var full = (art && art.title) || (ev && ev.title) || '';
    var key = a.poolEventId || a.articleId || a.relatedEventId || '';
    return full ? { key: key, name: shortTitle(full), full: full } : null;
  }

  function buildActionsHtml(paperData) {
    var dv = (G.DATA && G.DATA.decisionVoices) || null;
    var list = dv && Array.isArray(dv.actionOptions) ? dv.actionOptions : [];
    if (!list.length) return '';
    var lastKey = null;
    return '<ul class="np-actions" id="np-decision-actions-list">' + list.map(function (a) {
      var pol = (G.DATA.policies || {})[a.policyId];
      var evn = actionEvent(a, paperData);
      var head = '';
      if (evn && evn.key !== lastKey) {
        head = '<li class="np-actions__group" data-event="' + esc(evn.key) + '">事件：' + esc(evn.full) + '</li>';
        lastKey = evn.key;
      }
      return head + '<li class="np-actions__li"><button type="button" class="np-act ' + verdictClass(a.verdict) +
        '" data-act-id="' + esc(a.id) + '" data-policy-id="' + esc(a.policyId || '') + '"' +
        (evn ? ' data-event="' + esc(evn.key) + '"' : '') +
        ' aria-pressed="false" title="' + esc((evn ? '【' + evn.full + '】' : '') + (a.why || '')) + '">' +
        (evn ? '<span class="np-act__event">【' + esc(evn.name) + '】</span>' : '') +
        '<span class="np-act__verdict">' + esc(a.verdict || '選項') + '</span>' +
        '<span class="np-act__verb">' + esc(a.verb || '') + '</span>' +
        '<span class="np-act__label">' + esc(a.label || '') + '</span>' +
        '<span class="np-act__tradeoff">取捨：' + esc(a.tradeoff || '—') + '</span>' +
        '<span class="np-act__card">' + (pol ? '對應政策卡：' + esc(pol.name) + '（點數 ' + esc(pol.cost) + '）' : '尚無對應政策卡') + '</span>' +
        '</button></li>';
    }).join('') + '</ul>';
  }

  /* 街景線索（回合條蒐集到的 ctx.clues → G.StreetClues.view）：側欄「本輪蒐集」＋決策欄提示 */
  function rcText(k, fallback) {
    var r = (G.DATA && G.DATA.reportCopy && G.DATA.reportCopy.report) || {};
    return r[k] || fallback;
  }
  function policyName(id) {
    var p = G.DATA && G.DATA.policies && G.DATA.policies[id];
    return p ? p.name : id;
  }
  function buildStreetCluesHtml(v) {
    if (!v) return '';
    var title = rcText('cluesTitle', '本輪蒐集 {n} 條線索').replace('{n}', v.count);
    var body = v.count
      ? '<ul class="np-street__list" id="np-street-clue-list">' + (v.items || []).map(function (it) {
          return '<li data-clue-id="' + esc(it.id) + '" data-domain="' + esc(it.domainId) + '">' + esc(it.line) + '</li>';
        }).join('') + '</ul>'
      : '<p class="np-street__empty" id="np-street-empty">' + esc(rcText('noClues', '這輪沒蒐集到線索，下一輪多留意居民的對話泡泡。')) + '</p>';
    var rating = v.rating
      ? '<p class="np-street__rating" data-rating="' + esc(v.rating.id) + '"><b>' + esc(v.rating.label) + '</b>　' + esc(v.rating.line) + '</p>'
      : '';
    return '<section class="np-box np-box--street" id="np-street-clues" data-count="' + v.count + '">' +
      '<h3 class="np-box__head">🔍 ' + esc(title) + '</h3>' + rating + body + '</section>';
  }
  function buildClueHintHtml(v) {
    if (!v) return '';
    var inner;
    if (!v.count || !v.topDomain) {
      inner = '<p class="np-cluehint__empty">' + esc(rcText('hintsEmpty', '線索還不夠，先翻開貓貓快報看看。')) +
        ' 下次觀察街區時，點居民頭上的 🔍 泡泡收線索。</p>';
    } else {
      var top = (v.hints || []).slice(0, 3).map(function (h) {
        return '<li data-policy-id="' + esc(h.policyId) + '"><b>' + esc(policyName(h.policyId)) + '</b>' +
          '<span class="np-cluehint__role">' + esc(h.role) + '</span>' + (h.hint ? '：' + esc(h.hint) : '') + '</li>';
      }).join('');
      var warn = (v.warnings || []).slice(0, 2).map(function (w) {
        return '<li class="is-warn">⚠ 提醒：' + esc(policyName(w.policyId)) + (w.hint ? '（' + esc(w.hint) + '）' : '') + '</li>';
      }).join('');
      inner = '<p class="np-cluehint__top">線索指向最關鍵的問題：<b data-domain="' + esc(v.topDomain) + '">' + esc(v.topName) +
        '</b>（線索分 ' + v.topScore + '）</p>' +
        '<h4 class="np-cluehint__sub">' + esc(rcText('hintsTitle', '線索指向的政策卡')) + '</h4>' +
        '<ul class="np-cluehint__list">' + top + warn + '</ul>';
    }
    return '<section class="np-decision-hud__cluehint" id="np-clue-hint" data-top="' + esc(v.topDomain || '') + '">' +
      '<h3>🔍 線索提示</h3>' + inner + '</section>';
  }

  /* 民怨榜（G.DATA.complaints；數值由 complaint.js 的 ctx.complaints 提供）：橫條圖高→低、顏色＋文字等級、最深處標紅＋怨言＋提示 */
  function buildComplaintHtml(v, boxTitle) {
    if (!v || !v.rows || !v.rows.length) return '';
    var bars = v.rows.map(function (r, i) {
      return '<li class="np-cbar tier-' + esc(r.tier) + (i === 0 ? ' is-deepest' : '') + '" data-domain="' + esc(r.id) +
        '" data-value="' + r.value + '" data-tier="' + esc(r.tier) + '">' +
        '<span class="np-cbar__name">' + esc(r.icon) + ' ' + esc(r.name) + '</span>' +
        '<span class="np-cbar__track" role="img" aria-label="' + esc(r.name + ' ' + r.value + '，' + r.tierLabel) + '">' +
          '<i class="np-cbar__fill" style="width:' + r.value + '%;background:' + esc(r.color) + '"></i></span>' +
        '<span class="np-cbar__val"><b>' + r.value + '</b> <em style="color:' + esc(r.color) + '">' + esc(r.tierLabel) + '</em>' +
          (i === 0 ? ' <u class="np-cbar__tag">最深</u>' : '') + '</span></li>';
    }).join('');
    var notes = (v.notes || []).map(function (n) { return '<li>' + esc(n.text) + '</li>'; }).join('');
    return '<section class="np-box np-box--complaint" id="np-complaint-box" data-zone-el="complaint">' +
      '<h3 class="np-box__head">' + esc(boxTitle || v.title) + '</h3>' +
      '<ul class="np-cbars" id="np-complaint-bars">' + bars + '</ul>' +
      '<p class="np-complaint__legend">' + esc(v.legend) + '</p>' +
      '<div class="np-complaint__deepest" id="np-complaint-deepest">' +
        '<p class="np-complaint__line">' + esc(v.deepestText) + '</p>' +
        '<p class="np-complaint__hint">👉 ' + esc(v.hint) + '</p>' +
      '</div>' +
      (notes ? '<ul class="np-complaint__notes" id="np-complaint-notes">' + notes + '</ul>' : '') +
    '</section>';
  }

  function metricLi(label, value, delta) {
    var d = fmtDelta(delta);
    return '<li><span class="label">' + label + '</span>' +
      '<span class="value">' + value + '</span>' +
      '<span class="delta ' + d.cls + '">' + d.text + '</span></li>';
  }

  function npcName(id) {
    var list = (G.DATA && G.DATA.npcs) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i].name + (list[i].role ? '（' + list[i].role + '）' : '');
    }
    return id || '居民';
  }

  /** 從 dialogue 抽居民心聲，供決策參考 */
  function buildVoicesHtml(ctx) {
    var dlg = (G.DATA && (G.DATA.dialogue || (G.DATA.dialogues && G.DATA.dialogues.season_01))) || [];
    if (!Array.isArray(dlg)) dlg = [];
    var fired = ctx.firedEvents || [];
    var hintMap = {
      event_flood_risk: ['drain', 'waste'],
      event_market_slump: ['market', 'boardwalk', 'bus'],
      event_rumor_well: ['observe'],
      event_supply_delay: ['supply', 'coupon']
    };
    var prefer = {};
    fired.forEach(function (eid) {
      (hintMap[eid] || []).forEach(function (h) { prefer[h] = true; });
    });
    prefer.newspaper = true;
    prefer.observe = true;

    var scored = dlg.map(function (d) {
      var score = 1;
      if (d.seasonHint && prefer[d.seasonHint]) score += 3;
      return { d: d, score: score };
    }).sort(function (a, b) { return b.score - a.score; });

    var picks = [];
    var seen = {};
    scored.forEach(function (row) {
      if (picks.length >= 5) return;
      var d = row.d;
      var key = d.speakerNpcId || d.id;
      if (seen[key] && picks.length >= 3) return;
      seen[key] = true;
      var line = (d.lines && d.lines[0]) || '';
      if (!line) return;
      picks.push({
        name: npcName(d.speakerNpcId),
        line: line,
        hint: d.seasonHint || ''
      });
    });

    if (!picks.length) {
      return '<p class="np-voice np-voice--empty">（本季尚無居民心聲資料）</p>';
    }
    return picks.map(function (v) {
      return '<blockquote class="np-voice">' +
        '<cite>' + v.name + '</cite>' +
        '<p>「' + v.line + '」</p>' +
        '</blockquote>';
    }).join('');
  }

  /** 從每則報導抽出「可執行的行動」＋對症政策卡 → 決策欄思考選項 */
  function buildOptionsHtml(paperData, ctx) {
    var policies = (G.DATA && G.DATA.policies) || {};
    var order = (G.DATA && G.DATA.policyOrder) || Object.keys(policies);
    var events = (G.DATA && G.DATA.events) || {};
    var items = [];
    var acts = (paperData && paperData.actionOptions) || [];
    if (acts.length && paperData.articles) {
      /* 資料驅動：每個 actionOption = 一個思考選項（對症／治標／搭配）＋一張可執行的政策卡 */
      var artTitle = {};
      paperData.articles.forEach(function (a) { artTitle[a.id] = a.title; });
      return '<ol class="np-options">' + acts.map(function (o, n) {
        var p = policies[o.policyId];
        var verdict = o.verdict || '';
        var vcls = verdict === '對症' ? 'is-good' : (verdict === '治標' ? 'is-warn' : 'is-mid');
        var chip = p
          ? '<button type="button" class="np-pick" data-policy="' + o.policyId + '" data-event="' + (o.relatedEventId || '') + '">' +
            '<span class="np-pick__name">' + p.name + '</span><span class="np-pick__cost">點數 ' + p.cost + '</span></button>'
          : '<span class="np-option__none">（此行動沒有對應卡）</span>';
        return '<li class="np-option" data-article="' + (o.articleId || '') + '" data-event="' + (o.relatedEventId || '') + '">' +
          '<div class="np-option__no">選項 ' + (n + 1) + ' · 報導｜' + (artTitle[o.articleId] || '') +
          (verdict ? ' <em class="np-verdict ' + vcls + '">' + verdict + '</em>' : '') + '</div>' +
          '<div class="np-option__q"><b>' + (o.label || o.verb || '') + '</b><span>' + (o.why || '') + '</span></div>' +
          (o.tradeoff ? '<div class="np-option__a">取捨：' + o.tradeoff + '</div>' : '') +
          '<div class="np-option__picks">' + chip + '</div></li>';
      }).join('') + '</ol>';
    }
    if (paperData && paperData.articles && paperData.articles.length) {
      paperData.articles.forEach(function (a) {
        items.push({
          id: a.id,
          eid: a.relatedEventId,
          title: a.title,
          problem: (a.clues && a.clues[0]) || a.blurb || '',
          action: a.takeaway || ''
        });
      });
    } else {
      (ctx.firedEvents || []).forEach(function (eid) {
        var e = events[eid];
        if (e) items.push({ id: eid, eid: eid, title: e.title, problem: e.summary || '', action: '' });
      });
    }
    if (!items.length) return '<p class="np-voice np-voice--empty">（尚無可抽出的行動選項）</p>';
    return '<ol class="np-options">' + items.map(function (it, n) {
      var picks = order.filter(function (pid) {
        var p = policies[pid];
        return p && (p.solves || []).indexOf(it.eid) >= 0;
      });
      var chips = picks.map(function (pid) {
        var p = policies[pid];
        return '<button type="button" class="np-pick" data-policy="' + pid + '" data-event="' + it.eid + '">' +
          '<span class="np-pick__name">' + p.name + '</span>' +
          '<span class="np-pick__cost">點數 ' + p.cost + '</span></button>';
      }).join('');
      if (!chips) chips = '<span class="np-option__none">本季沒有對症卡 — 想想要換哪條法則</span>';
      return '<li class="np-option" data-article="' + it.id + '" data-event="' + it.eid + '">' +
        '<div class="np-option__no">選項 ' + (n + 1) + '</div>' +
        '<div class="np-option__q"><b>報導｜' + it.title + '</b><span>' + it.problem + '</span></div>' +
        (it.action ? '<div class="np-option__a">行動提示：' + it.action + '</div>' : '') +
        '<div class="np-option__picks">' + chips + '</div>' +
        '</li>';
    }).join('') + '</ol>';
  }

  function getHudEls(overlay) {
    return {
      root: overlay.querySelector('#np-decision-hud'),
      voices: overlay.querySelector('#np-decision-voices'),
      predict: overlay.querySelector('#np-decision-predict'),
      hand: overlay.querySelector('#np-decision-hand'),
      confirm: overlay.querySelector('#np-decision-confirm'),
      clear: overlay.querySelector('#np-decision-clear'),
      toggle: overlay.querySelector('#np-decision-toggle'),
      openBtn: overlay.querySelector('#btn-open-decision'),
      options: overlay.querySelector('#np-decision-options'),
      actions: overlay.querySelector('#np-decision-actions'),
      workspace: overlay.querySelector('#np-workspace')
    };
  }

  function setHudOpen(overlay, open) {
    var hud = getHudEls(overlay);
    if (!hud.root || !hud.workspace) return;
    hud.root.classList.toggle('is-open', !!open);
    hud.root.classList.toggle('is-collapsed', !open);
    hud.root.setAttribute('aria-hidden', open ? 'false' : 'true');
    hud.workspace.classList.toggle('has-decision-open', !!open);
    if (hud.toggle) {
      hud.toggle.textContent = open ? '收合決策欄 · 專注快報' : '打開決策欄';
    }
    if (hud.openBtn) {
      hud.openBtn.hidden = !!open;
    }
  }

  function render(overlay, ctx) {
    var season = ctx.season;
    var metrics = ctx.metrics;
    var deltas = ctx.lastDeltas || {};
    var fired = ctx.firedEvents || [];
    var problems = ctx.problems || {};
    var events = G.DATA.events;
    var paperData = null;
    try {
      var papers = (G.DATA && G.DATA.newspapers) || {};
      paperData = papers.newspaper_season_01 || papers[season.newspaperId] || null;
    } catch (e) { paperData = null; }
    if (ctx.paper && ctx.paper.articles && ctx.paper.articles.length) paperData = ctx.paper; /* 事件池組出的快報（已沿用靜態版面與閘門） */
    var unlock = (paperData && paperData.unlockPolicyAfter) || {};
    var scrollRatio = (typeof unlock.scrollRatio === 'number' && isFinite(unlock.scrollRatio))
      ? Math.max(0, Math.min(1, unlock.scrollRatio)) : 0.72;
    var minExpanded = (typeof unlock.minExpanded === 'number' && isFinite(unlock.minExpanded))
      ? Math.max(1, Math.floor(unlock.minExpanded)) : 1;
    var readState = { scrolled: false, expanded: 0, clues: 0, highlights: 0, gate: false, hudOpenedOnce: false };

    var masthead = (paperData && paperData.masthead) || '貓貓快報';
    var edition = (paperData && paperData.editionLabel) || (masthead + ' · 特刊');
    var priceNote = (paperData && paperData.priceNote) || '課堂版';
    var leadId = fired[0];
    var lead = leadId && events[leadId] ? events[leadId] : null;
    var headline = (paperData && paperData.headline && paperData.headline.title)
      ? paperData.headline.title
      : (lead ? lead.title : '本季觀察中');
    var lede = (paperData && paperData.headline && paperData.headline.lede)
      ? paperData.headline.lede
      : (lead ? lead.summary : (season.intro || ''));
    var kicker = (paperData && paperData.headline && paperData.headline.kicker) || '頭版突發';
    /* 資料驅動分段文案（缺資料則保留上面的原本字串） */
    var initStage = (STAGE_ORDER.indexOf(ctx.stage) >= 0) ? ctx.stage : 'read';
    var stageLocked = (initStage === 'after');
    var sc0 = stageContent(paperData, initStage);
    if (sc0.headline) {
      if (sc0.headline.title) headline = sc0.headline.title;
      if (sc0.headline.lede) lede = sc0.headline.lede;
      if (sc0.headline.kicker) kicker = sc0.headline.kicker;
    }
    var sideTitle = sc0.sideTitle || '顧問手冊';
    var clueTitle = sc0.clueTitle || '線索箱 · 畫重點';
    function listHtml(arr) {
      return (arr || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    }

    function storyFromArticle(a) {
      var eid = a.relatedEventId || a.id;
      var urgent = (problems[eid] || 0) >= 3 ? ' is-urgent' : '';
      var clues = (a.clues || []).map(function (ev, i) {
        return '<p class="np-clue" data-clue="' + a.id + '-' + i + '" role="button" tabindex="0" title="點一下畫重點">【線索 ' + (i + 1) + '】' + ev + '</p>';
      }).join('');
      return '<article class="np-story' + urgent + '" data-story="' + a.id + '">' +
        '<button type="button" class="np-story__toggle" aria-expanded="false">' +
          '<span class="np-story__kicker">' + (a.kicker || '地方') + '</span>' +
          '<span class="np-story__title">' + a.title + '</span>' +
          '<span class="np-story__blurb">' + (a.blurb || '') + '</span>' +
          '<span class="np-story__hint">點我展開全文 · 再點線索畫重點</span>' +
        '</button>' +
        '<div class="np-story__body" hidden>' +
          '<p>' + (a.body || '') + '</p>' +
          clues +
          '<p class="np-story__takeaway"><strong>編輯重點：</strong>' + (a.takeaway || '') + '</p>' +
        '</div>' +
      '</article>';
    }

    var stories = '';
    if (paperData && paperData.articles && paperData.articles.length) {
      stories = paperData.articles.map(storyFromArticle).join('');
    } else {
      stories = fired.map(function (id) {
        var e = events[id];
        if (!e) return '';
        var urgent = (problems[id] || 0) >= 3 ? ' is-urgent' : '';
        var bodyExtra = (e.evidence || e.clues || []).map(function (ev, i) {
          return '<p class="np-clue" data-clue="' + id + '-' + i + '" role="button" tabindex="0">【線索 ' + (i + 1) + '】' + ev + '</p>';
        }).join('');
        return '<article class="np-story' + urgent + '" data-story="' + id + '">' +
          '<button type="button" class="np-story__toggle" aria-expanded="false">' +
            '<span class="np-story__kicker">' + (e.tags && e.tags[0] ? e.tags[0] : '地方') +
            ' · ' + e.who + '</span>' +
            '<span class="np-story__title">' + e.title + '</span>' +
            '<span class="np-story__blurb">' + e.summary + '</span>' +
            '<span class="np-story__hint">點我展開全文 · 再點線索畫重點</span>' +
          '</button>' +
          '<div class="np-story__body" hidden>' +
            '<p><strong>問題：</strong>' + (e.newspaperBody || e.problem || '') + '</p>' +
            bodyExtra +
            '<p class="np-story__takeaway"><strong>編輯重點：</strong>對照側欄與右側決策欄心聲，選對症政策。</p>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    var coreLis = (season.coreProblemIds || []).map(function (id) {
      var e = events[id];
      var sev = problems[id];
      var done = sev === 0;
      return '<li class="np-chip" style="' + (done ? 'opacity:.55;text-decoration:line-through' : '') + '">' +
        (e ? e.title : id) + (done ? ' ✓' : '！') + '</li>';
    }).join('');

    var invTitle = (paperData && paperData.investigation && paperData.investigation.title) || '本報調查｜為什麼會這樣？';
    var invBody = (paperData && paperData.investigation && paperData.investigation.body) ||
      '請往下滑，展開報導，點擊線索畫重點，再用點數買政策卡。';
    var opTitle = (paperData && paperData.opEd && paperData.opEd.title) || '讀者投書';
    var opBody = (paperData && paperData.opEd && paperData.opEd.body) ||
      '「貨車卡在泥濘，青菜進不來。」「下雨天步道太滑，觀光客不敢來。」';

    var padBlocks =
      '<section class="np-report">' +
        '<h3>' + invTitle + '</h3>' +
        '<p>' + invBody + '</p>' +
        '<p><strong>教室任務：</strong>' + LOOP_SHORT + '。門檻通過後右側決策欄才會打開。</p>' +
      '</section>' +
      '<section class="np-report">' +
        '<h3>' + opTitle + '</h3>' +
        '<p>' + opBody + '</p>' +
      '</section>' +
      '<section class="np-report np-report--end" id="np-read-end">' +
        '<h3>讀到這裡了嗎？</h3>' +
        '<p>請滑讀至約 ' + Math.round(scrollRatio * 100) + '%，並展開至少一則報導；點擊【線索】可「畫重點」。通過後<strong>右側決策欄</strong>會打開：對照居民心聲，用既有點數買政策卡。</p>' +
      '</section>';

    var voicesHtml = buildVoicesHtml(ctx);
    var optionsHtml = buildOptionsHtml(paperData, ctx);
    var noticeItems = (paperData && paperData.notice && paperData.notice.items) || [];
    var weatherLine = sc0.weather || noticeItems[0] || '雨季將至，請留意排水、步道與車流物資。';
    var editorLine = sc0.editor || season.intro || '';
    var actionsHtml = buildActionsHtml(paperData);
    /* 上季「忽略，繼續下一季」留下的未處理問題（ctx.ignoredIssues）→ 側欄醒目提示 */
    var carry = Array.isArray(ctx.ignoredIssues) ? ctx.ignoredIssues : [];
    var carryHtml = carry.length
      ? '<section class="np-box np-box--carry" id="np-carry-box">' +
          '<h3 class="np-box__head">⚠️ 上季未處理</h3>' +
          '<ul class="np-carry-list" id="np-carry-list">' + carry.map(function (it) {
            return '<li data-issue="' + esc(it.id) + '"><b>' + esc(it.label) + '</b>' +
              '<span>（' + esc(it.monthLabel || '上季') + ' 選擇忽略）</span></li>';
          }).join('') + '</ul>' +
          '<p class="np-box__note">這些問題沒有解決，這季又出現了：請在線索裡找出它們，並優先選對症的政策卡。</p>' +
        '</section>'
      : '';
    var complaintHtml = buildComplaintHtml(ctx.complaintView);
    var streetCluesHtml = buildStreetCluesHtml(ctx.streetClueView);
    var clueHintHtml = buildClueHintHtml(ctx.streetClueView);
    var dvNote = (G.DATA && G.DATA.decisionVoices && G.DATA.decisionVoices.hudNote) || '';
    var adLine = noticeItems[1] || '貓貓雜貨店：雨季特賣・長靴與手電筒買二送一喵。';

    overlay.innerHTML =
      '<div class="np-workspace" id="np-workspace">' +
        '<div class="np-sheet-col">' +
          '<article class="newspaper np-sheet" role="document" id="newspaper-sheet" data-stage="' + initStage + '">' +
            '<div class="newspaper__toolbar">' +
              '<span class="newspaper__page-label">第 1 版／' + edition + '</span>' +
              '<span class="newspaper__read-meter" id="np-read-meter" aria-live="polite">閱讀 0%</span>' +
              '<button type="button" class="newspaper__btn" id="btn-close-newspaper">先合上</button>' +
              '<button type="button" class="newspaper__btn newspaper__btn--primary" id="btn-ready-policy" disabled>請先滑讀並展開畫重點</button>' +
              '<button type="button" class="newspaper__btn newspaper__btn--accent" id="btn-open-decision" hidden>打開決策欄</button>' +
              '<nav class="np-zones" id="np-zones" aria-label="報紙分區進度">' +
                '<span class="np-zone" data-zone="masthead">①報頭</span>' +
                '<span class="np-zone" data-zone="headline">②頭條</span>' +
                '<span class="np-zone" data-zone="stories">③報導</span>' +
                '<span class="np-zone" data-zone="side">④側欄線索</span>' +
                '<span class="np-zone" data-zone="notice">⑤天氣廣告</span>' +
              '</nav>' +
            '</div>' +
            '<header class="newspaper__masthead" data-zone-el="masthead">' +
              '<h1 class="newspaper__title np-masthead__name">' + masthead + '</h1>' +
              '<div class="newspaper__meta">' +
                '<span><strong>' + season.monthLabel + '</strong></span>' +
                '<span>' + season.title + '</span>' +
                '<span>' + priceNote + '</span>' +
              '</div>' +
            '</header>' +
            '<p class="newspaper__mission">' + LOOP_SHORT +
              '<span class="np-loop">' + LOOP_FULL + '</span></p>' +
            (stagebarHtml(paperData, initStage)
              ? '<ol class="np-stagebar" id="np-stagebar" aria-label="本季進度">' + stagebarHtml(paperData, initStage) + '</ol>' : '') +
            '<div class="np-gate-pass" id="np-gate-pass" aria-live="polite"></div>' +
            '<div class="newspaper__body">' +
              '<div class="newspaper__main">' +
                '<section class="newspaper__headline" data-zone-el="headline">' +
                  '<span class="kicker" id="np-headline-kicker">' + kicker + '</span>' +
                  '<h2 id="np-headline-title">' + headline + '</h2>' +
                  '<p class="lede" id="np-headline-lede">' + lede + '</p>' +
                '</section>' +
                '<div class="newspaper__columns" data-zone-el="stories">' + (stories || '<p>本季尚無突發短訊。</p>') + '</div>' +
                padBlocks +
              '</div>' +
              '<aside class="newspaper__aside" data-zone-el="side">' +
                carryHtml +
                complaintHtml +
                streetCluesHtml +
                '<section class="np-box">' +
                  '<h3 class="np-box__head">本季指數</h3>' +
                  '<ul class="np-metrics">' +
                    metricLi('點數', metrics.points, deltas.points) +
                    metricLi('金錢', metrics.money, deltas.money) +
                    metricLi('獲利', metrics.profit, deltas.profit) +
                    metricLi('幸福度', metrics.happiness, deltas.happiness) +
                  '</ul>' +
                '</section>' +
                '<section class="np-box np-box--advisor" id="np-sidebar-box"' + (sc0.sideTips ? '' : ' hidden') + '>' +
                  '<h3 class="np-box__head" id="np-sidebar-title">' + esc(sideTitle) + '</h3>' +
                  '<ul class="np-box__tips" id="np-sidebar-tips">' + listHtml(sc0.sideTips) + '</ul>' +
                '</section>' +
                '<section class="np-box np-box--clues">' +
                  '<h3 class="np-box__head" id="np-cluebox-title">' + esc(clueTitle) + '</h3>' +
                  '<ul class="np-cluebox" id="np-cluebox"><li class="np-cluebox__empty">展開報導、點【線索】就會收進這裡</li></ul>' +
                  '<ul class="np-cluebox__hints" id="np-cluebox-hints"' + (sc0.clueHints ? '' : ' hidden') + '>' + listHtml(sc0.clueHints) + '</ul>' +
                '</section>' +
                '<section class="np-box">' +
                  '<h3 class="np-box__head">本期必須處理</h3>' +
                  '<ul class="np-chip-list">' + coreLis + '</ul>' +
                  '<p class="np-box__note">對照報導線索畫重點；門檻通過後到右側決策欄買政策卡。</p>' +
                '</section>' +
              '</aside>' +
            '</div>' +
            '<div class="newspaper__footer-band" data-zone-el="notice">' +
              '<div class="np-weather"><h3>☁ 天氣／告示</h3><p id="np-footer-weather">' + esc(weatherLine) + '</p></div>' +
              '<div class="np-ad"><h3>廣告</h3><p>' + adLine + '</p></div>' +
              '<div class="np-editor"><h3>編輯室</h3><p id="np-footer-editor">' + esc(editorLine) + '</p></div>' +
            '</div>' +
          '</article>' +
        '</div>' +
        '<aside class="np-decision-hud is-collapsed" id="np-decision-hud" aria-hidden="true" aria-label="決策欄">' +
          '<div class="np-decision-hud__bar">' +
            '<h2 class="np-decision-hud__title">決策欄</h2>' +
            '<button type="button" class="newspaper__btn" id="np-decision-toggle">收合決策欄 · 專注快報</button>' +
          '</div>' +
          '<p class="np-decision-hud__tip">用既有點數買政策卡 · 對照居民心聲 · 確認並結報 · 街景照常日常運行</p>' +
          clueHintHtml +
          '<section class="np-decision-hud__options">' +
            '<h3>思考選項 · 從報導找行動</h3>' +
            '<p class="np-decision-hud__hint">每則報導是一個問題 → 選一張對症政策卡去執行（點按鈕會幫你選卡）</p>' +
            '<div id="np-decision-options">' + optionsHtml + '</div>' +
          '</section>' +
          '<section class="np-decision-hud__voices">' +
            '<h3>居民心聲（決策參考）</h3>' +
            '<div id="np-decision-voices">' + voicesHtml + '</div>' +
          '</section>' +
          (actionsHtml
            ? '<section class="np-decision-hud__acts" id="np-decision-actions">' +
                '<h3>行動選項 · 對症／搭配／治標</h3>' +
                '<p class="np-decision-hud__hint">' + esc(dvNote || '每個選項對應一張政策卡：點選項 = 點那張卡（再點一次取消）') + '</p>' +
                actionsHtml +
              '</section>'
            : '') +
          '<section class="np-decision-hud__shop">' +
            '<h3>政策店 · 點數購物</h3>' +
            '<div id="np-decision-predict" class="policy-predict np-decision-predict" aria-live="polite"></div>' +
            '<div id="np-decision-hand" class="policy-hand-scroll np-decision-hand is-cards-3x4"></div>' +
            '<div class="np-decision-hud__actions">' +
              '<button type="button" class="newspaper__btn" id="np-decision-clear">清空</button>' +
              '<button type="button" class="newspaper__btn newspaper__btn--primary" id="np-decision-confirm" disabled>確認並結報 · 執行改善</button>' +
            '</div>' +
          '</section>' +
        '</aside>' +
      '</div>';

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    setHudOpen(overlay, false);

    var sheet = overlay.querySelector('#newspaper-sheet');
    var meter = overlay.querySelector('#np-read-meter');
    var readyBtn = overlay.querySelector('#btn-ready-policy');
    var closeBtn = overlay.querySelector('#btn-close-newspaper');
    var gatePass = overlay.querySelector('#np-gate-pass');
    var openDecisionBtn = overlay.querySelector('#btn-open-decision');
    var hudEls = getHudEls(overlay);

    function openDecisionHud(fromGate) {
      setHudOpen(overlay, true);
      if (!readState.hudOpenedOnce) {
        readState.hudOpenedOnce = true;
        if (typeof ctx.onGatePass === 'function') {
          ctx.onGatePass({
            highlights: readState.highlights,
            expanded: readState.expanded,
            hud: getHudEls(overlay)
          });
        } else if (typeof ctx.onReadyForPolicy === 'function') {
          ctx.onReadyForPolicy({
            highlights: readState.highlights,
            expanded: readState.expanded,
            hud: getHudEls(overlay),
            keepNewspaperOpen: true
          });
        }
      } else if (typeof ctx.onDecisionHudOpen === 'function') {
        ctx.onDecisionHudOpen(getHudEls(overlay));
      }
      if (fromGate && typeof ctx.onBanner === 'function') {
        ctx.onBanner('決策欄已開：對照居民心聲，用點數買政策卡（可隨時收合回快報）');
      }
    }

    /* —— 報紙分區進度（只讀，不影響門檻）—— */
    function updateZones() {
      if (!sheet) return;
      var top = sheet.getBoundingClientRect().top;
      var limit = sheet.clientHeight * 0.88;
      overlay.querySelectorAll('.np-zone').forEach(function (z) {
        var el = sheet.querySelector('[data-zone-el="' + z.getAttribute('data-zone') + '"]');
        if (!el) return;
        var reached = (el.getBoundingClientRect().top - top) < limit;
        z.classList.toggle('is-reached', reached);
        var z2 = z.getAttribute('data-zone');
        var done = reached;
        if (z2 === 'stories') done = reached && readState.expanded >= minExpanded;
        if (z2 === 'side') done = reached && readState.highlights >= 1;
        z.classList.toggle('is-done', !!done);
      });
    }

    function refreshClueBox() {
      var box = overlay.querySelector('#np-cluebox');
      if (!box) return;
      var hl = overlay.querySelectorAll('.np-clue.is-highlighted');
      if (!hl.length) {
        box.innerHTML = '<li class="np-cluebox__empty">展開報導、點【線索】就會收進這裡</li>';
        return;
      }
      box.innerHTML = '';
      hl.forEach(function (c) {
        var li = document.createElement('li');
        li.textContent = c.textContent.replace(/^【線索 \d+】/, '');
        box.appendChild(li);
      });
    }

    /* —— 決策欄思考選項：按鈕代按對應政策卡（卡牌選取／點數規則仍由 PolicyHand 處理）—— */
    function syncPicks() {
      var handEl = hudEls.hand;
      var optsEl = hudEls.options;
      if (!optsEl) return;
      var selected = {};
      var disabled = {};
      if (handEl) {
        handEl.querySelectorAll('.policy-card').forEach(function (c) {
          var pid = c.getAttribute('data-policy-id');
          if (!pid) return;
          if (c.classList.contains('is-selected')) selected[pid] = true;
          if (c.disabled) disabled[pid] = true;
        });
      }
      optsEl.querySelectorAll('.np-pick').forEach(function (b) {
        var pid = b.getAttribute('data-policy');
        b.classList.toggle('is-picked', !!selected[pid]);
        b.setAttribute('aria-pressed', selected[pid] ? 'true' : 'false');
      });
      optsEl.querySelectorAll('.np-option').forEach(function (li) {
        li.classList.toggle('is-covered', !!li.querySelector('.np-pick.is-picked'));
      });
    }
    if (hudEls.options) {
      hudEls.options.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('.np-pick') : null;
        if (!b || !hudEls.hand) return;
        var card = hudEls.hand.querySelector('.policy-card[data-policy-id="' + b.getAttribute('data-policy') + '"]');
        if (!card || card.disabled) return;
        card.click();
        try { card.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ }
        syncPicks();
      });
    }
    if (hudEls.hand && global.MutationObserver) {
      new MutationObserver(function () { syncPicks(); })
        .observe(hudEls.hand, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
    }

    /* —— 行動選項（decisionVoices.actionOptions）：點選項 = 點對應政策卡；狀態隨卡牌同步 —— */
    function syncActs() {
      var actsEl = hudEls.actions;
      if (!actsEl || !hudEls.hand) return;
      var selected = {};
      var disabled = {};
      var present = {};
      hudEls.hand.querySelectorAll('.policy-card').forEach(function (c) {
        var pid = c.getAttribute('data-policy-id');
        if (!pid) return;
        present[pid] = true;
        if (c.classList.contains('is-selected')) selected[pid] = true;
        if (c.disabled) disabled[pid] = true;
      });
      actsEl.querySelectorAll('.np-act').forEach(function (b) {
        var pid = b.getAttribute('data-policy-id');
        var on = !!selected[pid];
        b.classList.toggle('is-picked', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        var off = !on && (!present[pid] || !!disabled[pid]);
        b.classList.toggle('is-disabled', off);
        b.setAttribute('aria-disabled', off ? 'true' : 'false');
      });
    }
    if (hudEls.actions) {
      hudEls.actions.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('.np-act') : null;
        if (!b || !hudEls.hand) return;
        var card = hudEls.hand.querySelector('.policy-card[data-policy-id="' + b.getAttribute('data-policy-id') + '"]');
        if (!card || card.disabled) return;
        card.click();
        try { card.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ }
        syncActs();
      });
      if (hudEls.hand && global.MutationObserver) {
        new MutationObserver(function () { syncActs(); })
          .observe(hudEls.hand, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
      }
      syncActs();
    }

    /* —— 階段文案（read／clue／decide／after）：只換字，不碰門檻與 .np-clue 行為 —— */
    var curStage = initStage;
    function computeStage() {
      if (stageLocked) return 'after';
      if (readState.gate) return 'decide';
      if (readState.expanded > 0 || readState.highlights > 0) return 'clue';
      return 'read';
    }
    function setStageText(id, text) {
      var el = overlay.querySelector(id);
      if (el && typeof text === 'string' && text) el.textContent = text;
    }
    function setListText(id, arr) {
      var el = overlay.querySelector(id);
      if (!el) return;
      if (!arr || !arr.length) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = listHtml(arr);
    }
    function applyStage(stage) {
      if (stage === curStage) return;
      curStage = stage;
      var c = stageContent(paperData, stage);
      if (sheet) sheet.setAttribute('data-stage', stage);
      if (c.headline) {
        setStageText('#np-headline-kicker', c.headline.kicker);
        setStageText('#np-headline-title', c.headline.title);
        setStageText('#np-headline-lede', c.headline.lede);
      }
      var sbox = overlay.querySelector('#np-sidebar-box');
      if (sbox) sbox.hidden = !(c.sideTips && c.sideTips.length);
      setStageText('#np-sidebar-title', c.sideTitle);
      if (c.sideTips) setListText('#np-sidebar-tips', c.sideTips);
      setStageText('#np-cluebox-title', c.clueTitle);
      setListText('#np-cluebox-hints', c.clueHints);
      setStageText('#np-footer-weather', c.weather);
      setStageText('#np-footer-editor', c.editor);
      overlay.querySelectorAll('#np-stagebar .np-stagebar__item').forEach(function (li) {
        li.classList.toggle('is-current', li.getAttribute('data-stage') === stage);
      });
    }

    function scrollPct() {
      if (!sheet) return 100;
      var max = sheet.scrollHeight - sheet.clientHeight;
      if (max <= 0) return 100;
      return Math.min(100, Math.round((sheet.scrollTop / max) * 100));
    }

    function updateGate() {
      var pct = scrollPct();
      updateZones();
      var scrollReady = (pct / 100) >= scrollRatio;
      if (scrollReady) readState.scrolled = true;
      var wasGate = readState.gate;
      readState.gate = readState.scrolled && readState.expanded >= minExpanded;
      if (readyBtn) {
        readyBtn.disabled = !readState.gate;
        readyBtn.textContent = readState.gate
          ? '打開右側決策欄 · 用點數買政策'
          : '請先滑讀約 ' + Math.round(scrollRatio * 100) + '% 並展開畫重點';
      }
      if (openDecisionBtn) {
        openDecisionBtn.hidden = !readState.gate || (hudEls.root && hudEls.root.classList.contains('is-open'));
      }
      if (meter) {
        var hl = readState.highlights > 0 ? ' · 重點 ' + readState.highlights : '';
        meter.textContent = '閱讀 ' + pct + '%' + hl;
        meter.style.setProperty('--np-read-pct', pct + '%');
        if (sheet) sheet.style.setProperty('--np-read-pct', pct + '%');
      }
      if (gatePass) {
        if (readState.gate) {
          gatePass.classList.add('is-visible');
          gatePass.innerHTML =
            '<strong>門檻通過！</strong>右側<strong>決策欄</strong>可打開：看居民心聲 → 用<strong>既有點數</strong>買政策卡 → 公職委任看星芒圖 → 確認並結報後，貓貓市先日常運行一下，再看本季結報。' +
            '可隨時「收合決策欄」回到快報。<br>' +
            '<span style="font-size:12px;font-weight:700">' + LOOP_FULL + '</span>';
        } else {
          gatePass.classList.remove('is-visible');
          gatePass.innerHTML = '';
        }
      }
      applyStage(computeStage());
      // 首次達門檻：自動打開決策欄（報紙保持開啟）
      if (readState.gate && !wasGate && !readState.hudOpenedOnce) {
        openDecisionHud(true);
      }
    }

    if (sheet) {
      sheet.addEventListener('scroll', function () {
        var pct = scrollPct();
        if ((pct / 100) >= scrollRatio) readState.scrolled = true;
        updateGate();
      }, { passive: true });
      setTimeout(function () {
        if (sheet.scrollHeight <= sheet.clientHeight + 8) {
          readState.scrolled = true;
          updateGate();
        }
      }, 50);
    }

    overlay.querySelectorAll('.np-story__toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var art = btn.closest('.np-story');
        var body = art && art.querySelector('.np-story__body');
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (body) body.hidden = open;
        if (art) art.classList.toggle('is-expanded', !open);
        if (art) {
          var optLi = overlay.querySelector('.np-option[data-article="' + art.getAttribute('data-story') + '"]');
          if (optLi && !open) optLi.classList.add('is-read');
        }
        if (!open) {
          readState.expanded += 1;
          var clues = art ? art.querySelectorAll('.np-clue').length : 0;
          if (clues > 0) {
            readState.clues += clues;
            art.querySelectorAll('.np-clue').forEach(function (c) {
              c.classList.add('is-seen');
            });
          } else {
            readState.clues += 1;
          }
        }
        updateGate();
      });
    });

    overlay.querySelectorAll('.np-clue').forEach(function (clue) {
      function toggleHighlight(ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        var was = clue.classList.contains('is-highlighted');
        clue.classList.toggle('is-highlighted', !was);
        if (!was) readState.highlights += 1;
        else readState.highlights = Math.max(0, readState.highlights - 1);
        refreshClueBox();
        updateGate();
      }
      clue.addEventListener('click', toggleHighlight);
      clue.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') toggleHighlight(ev);
      });
    });

    if (readyBtn) {
      readyBtn.onclick = function () {
        if (!readState.gate) return;
        openDecisionHud(true);
      };
    }
    if (openDecisionBtn) {
      openDecisionBtn.onclick = function () {
        if (!readState.gate) return;
        openDecisionHud(false);
      };
    }
    if (hudEls.toggle) {
      hudEls.toggle.onclick = function () {
        var open = hudEls.root && hudEls.root.classList.contains('is-open');
        if (open) {
          setHudOpen(overlay, false);
          if (typeof ctx.onBanner === 'function') {
            ctx.onBanner('已專注快報 — 需要時再按「打開決策欄」用點數買政策');
          }
        } else if (readState.gate) {
          openDecisionHud(false);
        }
      };
    }

    if (closeBtn) {
      closeBtn.onclick = function () {
        hide(overlay);
        if (typeof ctx.onDismiss === 'function') ctx.onDismiss();
      };
    }

    // 暴露給 main：確認政策時可隱藏
    overlay._npApi = {
      getHudEls: function () { return getHudEls(overlay); },
      setHudOpen: function (on) { setHudOpen(overlay, on); },
      isGatePassed: function () { return !!readState.gate; },
      getStage: function () { return curStage; },
      hide: function () { hide(overlay); }
    };

    updateGate();
  }

  function hide(overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    setHudOpen(overlay, false);
  }

  G.Newspaper = {
    render: render,
    hide: hide,
    getHudEls: getHudEls,
    setHudOpen: setHudOpen,
    LOOP_SHORT: LOOP_SHORT,
    LOOP_FULL: LOOP_FULL
  };
})(window);
