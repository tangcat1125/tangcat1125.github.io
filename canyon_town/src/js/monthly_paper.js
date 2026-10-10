/* 《貓貓快報》本月號（第二份報紙）— 只讀、只預覽：不寫任何 ctx／民怨／事件池狀態。
 * G.MonthlyPaper.compose(ctx) → 資料模型（純函式）；open(ctx,{onClose}) / close() / isOpen()。
 * 與第一份快報（G.Newspaper：0.72 閱讀門檻、must-expand、解鎖）完全分離：無門檻、無解鎖 CTA。 */
(function (global) {
  'use strict';
  var G = global.Game = global.Game || {};
  var RES_LABEL = { cured: '對症解決', assisted: '有幫助', palliative: '只治標', backfired: '反效果', ignored: '未處理' };
  var RES_ICON = { cured: '✅', assisted: '🟢', palliative: '🩹', backfired: '⚠️', ignored: '❌' };
  var MOOD_ICON = { worse: '😠', same: '😒', better: '🙂' };
  var overlay = null, lastFocus = null, onCloseCb = null, keyBound = false;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function copy() { var r = G.DATA && G.DATA.reportCopy; return (r && (r.monthly || r.monthlyPaper)) || {}; }
  function fill(t, m) { return String(t).replace(/\{(\w+)\}/g, function (_, k) { return m[k] != null ? m[k] : ''; }); }
  function policyName(id) { var p = G.DATA && G.DATA.policies && G.DATA.policies[id]; return (p && p.name) || id; }
  function poolTitle(id) {
    var P = G.DATA && G.DATA.eventPool, e = P && P.events && P.events.filter(function (x) { return x.id === id; })[0];
    return (e && e.title) || id;
  }
  function npcName(id) {
    var n = G.DATA && G.DATA.npcs, list = Array.isArray(n) ? n : (n && n.npcs) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return id;
  }
  function domainDefs() {
    var C = G.DATA && G.DATA.complaints; var m = {};
    ((C && C.domains) || []).forEach(function (d) { m[d.id] = d; });
    return m;
  }
  function tierOfVal(v) { try { return G.Complaint.tierOf(v); } catch (e) { return { id: v >= 75 ? 'furious' : v >= 50 ? 'upset' : v >= 25 ? 'grumble' : 'calm', label: v >= 75 ? '爆怒' : v >= 50 ? '不滿' : v >= 25 ? '抱怨' : '平靜' }; } }

  /** 純讀取：從 ctx 組出「本月快報」資料。不呼叫 settle／commit。 */
  function compose(ctx) {
    ctx = ctx || (G.state && G.state.ctx);
    var cp = copy();
    var season = ctx.season || {}, n = (ctx.monthIndex || 0) + 1;
    var st = ctx.complaints, pend = st && st.pending;
    var played = (pend && pend.played) || (ctx.pool && ctx.pool.played) || ctx.policiesPlayed || [];
    var poolRes = (ctx.pool && ctx.pool.preview && ctx.pool.preview.results) || null;
    var poolPending = (ctx.pool && ctx.pool.preview && ctx.pool.preview.pending) || [];
    var defs = domainDefs();

    /* 核心問題（舊制：排水／市集） */
    var cores = (season.coreProblemIds || []).map(function (id) {
      var e = G.DATA.events && G.DATA.events[id];
      return { id: id, label: e ? e.title : id, done: !!ctx.problems && ctx.problems[id] === 0 };
    });
    var openCores = cores.filter(function (c) { return !c.done; });

    /* 民怨變化（Complaint.settle 預覽） */
    var lines = (G.Complaint && st) ? G.Complaint.previewLines(ctx) : [];
    lines = lines.map(function (l) {
      var o = tierOfVal(l.from);
      var s = {}; for (var k in l) s[k] = l[k];
      s.fromTierLabel = o.label; s.fromTier = o.id; return s;
    });
    var deepest = lines.slice().sort(function (a, b) { return b.to - a.to; })[0] || null;

    /* 事件結果 */
    var events = [];
    if (poolRes) {
      poolRes.forEach(function (r) {
        events.push({
          id: r.eventId, title: poolTitle(r.eventId), domainId: r.domainId, resolution: r.resolution,
          label: RES_LABEL[r.resolution] || r.resolution, icon: RES_ICON[r.resolution] || '•',
          resolved: !!r.resolved, severityAfter: r.severityAfter, source: 'pool',
          by: (r.responses || []).filter(function (x) { return x.effect !== 'ignored'; }).map(function (x) { return policyName(x.policyId); }),
          spawned: (r.spawned || []).map(function (s) { return s.label; }).filter(Boolean)
        });
      });
    } else {
      cores.forEach(function (c) {
        events.push({
          id: c.id, title: c.label, domainId: c.id === 'event_flood_risk' ? 'drain' : c.id === 'event_market_slump' ? 'market' : '',
          resolution: c.done ? 'cured' : 'ignored', label: c.done ? '已解決' : '未解決', icon: c.done ? '✅' : '❌',
          resolved: c.done, severityAfter: c.done ? 0 : 1, source: 'legacy', by: [], spawned: []
        });
      });
    }
    var handled = events.filter(function (e) { return e.resolved; });
    var open = events.filter(function (e) { return !e.resolved; });

    /* 頭條 */
    var good = { cured: '對症解決', assisted: '有了進展', palliative: '暫時壓下', 已解決: '解決了' };
    var bad = { ignored: '仍沒人處理', backfired: '反而更糟', assisted: '只改善一半', palliative: '', cured: '', 未解決: '還沒解決' };
    var parts = [];
    if (handled.length) parts.push('「' + handled[0].title + '」' + (good[handled[0].resolution] || '處理了'));
    if (open.length) parts.push('「' + open[0].title + '」' + (bad[open[0].resolution] || bad[open[0].label] || '尚待處理'));
    var title;
    if (!events.length) title = '本月平靜收場';
    else if (!open.length) title = '本月全數過關：' + parts.join('，');
    else if (!handled.length) title = '本月告急：' + parts.join('，');
    else title = parts.join('，');
    var kicker = cp.kicker || (open.length ? '本月成績單・仍有待辦' : '本月成績單・順利過關');
    var polTxt = played.length ? '你本月出手：' + played.map(policyName).join('、') + '。' : '你本月沒有買任何政策卡。';
    var deepTxt = deepest ? '民怨最深在 ' + deepest.icon + deepest.name + ' ' + deepest.to + '（' + deepest.tierLabel + '）。' : '';
    var lede = polTxt + ' 本月共 ' + events.length + ' 件事，處理 ' + handled.length + ' 件、' + open.length + ' 件還懸著。' + deepTxt;

    /* 延續到下季 */
    var carry = [];
    var ign = Array.isArray(ctx.ignoredIssues) ? ctx.ignoredIssues : [];
    ign.forEach(function (it) { carry.push({ kind: 'carried', id: it.id, label: it.label, note: (it.monthLabel || '上季') + ' 選擇忽略，仍在下季快報上' }); });
    openCores.forEach(function (c) {
      if (ign.some(function (it) { return it.id === c.id; })) return;
      carry.push({ kind: 'open', id: c.id, label: c.label, note: '目前未解決；按「忽略，繼續下一季」會記到下季快報' });
    });
    if (poolRes) open.forEach(function (e) {
      if (openCores.some(function (c) { return c.id === e.id; }) || carry.some(function (c) { return c.id === e.id; })) return;
      carry.push({ kind: 'open-event', id: e.id, label: e.title, note: e.label + '，嚴重度還剩 ' + e.severityAfter });
    });
    poolPending.forEach(function (p) {
      carry.push({ kind: 'pending', id: p.eventId, label: p.label || poolTitle(p.eventId), note: '後續事件，預計下季出現' });
    });
    var ignoreNotes = [];
    if (pend && pend.steps) {
      Object.keys(pend.steps).forEach(function (id) {
        (pend.steps[id] || []).forEach(function (s) {
          if (s[0] === 'ignore' && s[1]) ignoreNotes.push({ id: id, name: (defs[id] && defs[id].name) || id, plus: s[1] });
        });
      });
    }
    var ignoreText = ignoreNotes.length
      ? '沒處理的領域民怨會加碼：' + ignoreNotes.map(function (x) { return x.name + ' +' + x.plus; }).join('、') + '（已含在上方數字；連續被忽略會加更多）。'
      : '忽略不處理的問題會讓民怨加碼，連續被忽略加更多；本季沒有額外加碼。';

    /* 居民反應 3–5 句 */
    var quotes = [];
    var ordered = lines.slice().sort(function (a, b) { return (Math.abs(b.delta) - Math.abs(a.delta)) || (b.to - a.to); });
    ordered.forEach(function (l) {
      var d = defs[l.id]; if (!d) return;
      var mood = l.delta > 0 ? 'worse' : l.delta < 0 ? 'better' : 'same';
      var tq = (d.quotesByTier && d.quotesByTier[l.tier]) || d.quote;
      var text = (l.tier === 'furious' || l.tier === 'upset') && d.quote ? d.quote : tq;
      if (mood === 'better' && l.tier !== 'furious' && l.tier !== 'upset') text = tq;
      quotes.push({ domainId: l.id, icon: l.icon, domain: l.name, mood: mood, moodIcon: MOOD_ICON[mood], tierLabel: l.tierLabel,
        who: (d.speaker && d.speaker.npcName) || '居民', text: text, source: 'complaints' });
    });
    quotes = quotes.slice(0, 4);
    /* 再補 1 句：未處理領域的街頭怨言（dialogues complaint／chat） */
    var dl = (G.DATA.dialogues && G.DATA.dialogues.season_01) || [];
    var quoted = quotes.map(function (q) { return q.domainId; });
    var cand = open.map(function (e) { return e.domainId; }).concat(ordered.map(function (l) { return l.id; }), Object.keys(defs));
    var pickDom = cand.filter(function (id) { return id && quoted.indexOf(id) < 0; })[0];
    var extra = pickDom && dl.filter(function (x) { return x.domainId === pickDom && (x.category === 'complaint' || x.category === 'chat') && x.lines && x.lines[0]; })[0];
    if (extra) {
      var dd = defs[pickDom] || {};
      var ln = lines.filter(function (l) { return l.id === pickDom; })[0];
      var md = ln ? (ln.delta > 0 ? 'worse' : ln.delta < 0 ? 'better' : 'same') : 'same';
      quotes.push({ domainId: pickDom, icon: dd.icon || '💬', domain: dd.name || '', mood: md, moodIcon: MOOD_ICON[md],
        tierLabel: ln ? ln.tierLabel : '', who: npcName(extra.speakerNpcId), text: extra.lines[0], source: 'dialogues' });
    }
    quotes = quotes.slice(0, 5);

    var model = {
      n: n, masthead: cp.masthead || '貓貓快報 本月號', issue: fill(cp.issue || '本月快報・第{n}季結果', { n: n }),
      monthLabel: season.monthLabel || '', seasonTitle: season.title || '', mode: poolRes ? 'pool' : 'legacy',
      kicker: kicker, title: title, lede: lede, played: played.map(function (id) { return { id: id, name: policyName(id) }; }),
      events: events, cores: cores, lines: lines, deepest: deepest, carry: carry, ignoreText: ignoreText, ignoreNotes: ignoreNotes, quotes: quotes,
      textSource: 'code', mp: null, briefs: [], editorNote: '', closing: '', boardTexts: {}, mayorMemes: [], photos: []
    };
    /* 資料驅動文案：G.EventPool.composeMonthly（G.DATA.monthlyPaper；docs/MONTHLY_PAPER.md §5）。缺資料或丟錯 → 沿用上面的程式組字。
     * 只讀：composeMonthly 是純函式，不寫任何狀態。同名欄位以 modelPatch 覆蓋。 */
    try {
      var pl = ctx.pool;
      if (pl && pl.preview && pl.dr && lines.length && G.EventPool && G.EventPool.composeMonthly && G.DATA && G.DATA.monthlyPaper) {
        var prev = { cycle: pl.cycle, season: pl.dr.season, monthLabel: model.monthLabel, complaints: {} };
        var nxt = { cycle: pl.cycle, season: pl.dr.season, monthLabel: model.monthLabel, complaints: {} };
        lines.forEach(function (l) { prev.complaints[l.id] = l.from; nxt.complaints[l.id] = l.to; });
        var mp = G.EventPool.composeMonthly(pl.preview, prev, nxt, pl.dr, pl.pack);
        var pt = mp && mp.modelPatch;
        if (pt && pt.title && pt.lede) {
          model.mp = mp; model.textSource = 'monthlyPaper';
          if (pt.masthead) model.masthead = pt.masthead;
          if (pt.issue) model.issue = pt.issue;
          if (pt.kicker) model.kicker = pt.kicker;
          model.title = pt.title; model.lede = pt.lede;
          var pq = (pt.quotes || []).filter(function (q) { return q && q.text; }).map(function (q) {
            return { domainId: q.domainId, icon: q.icon || '💬', domain: q.domain || '', mood: q.mood || 'same', moodIcon: q.moodIcon || MOOD_ICON[q.mood] || '',
              tierLabel: q.tierLabel || '', who: q.who || '居民', text: q.text, source: 'monthlyPaper' };
          });
          if (pq.length >= 3) model.quotes = pq.slice(0, 5);
          else if (pq.length) model.quotes = pq.concat(model.quotes.filter(function (q) { return !pq.some(function (x) { return x.text === q.text; }); })).slice(0, 5);
          var keep = model.carry.filter(function (c) { return c.kind === 'carried' || c.kind === 'open'; });
          var pc = (pt.carry || []).filter(function (c) { return c && (c.label || c.title); }).map(function (c) {
            return { kind: c.kind, id: c.id, label: c.label || c.title, note: c.note || c.body || '' };
          }).filter(function (c) { return c.kind !== 'none' || !keep.length; });
          model.carry = keep.concat(pc.filter(function (c) { return !keep.some(function (k) { return k.id === c.id; }); }));
          model.briefs = (mp.sideBriefs || []).slice(0, 4);
          model.editorNote = (mp.frontPage && mp.frontPage.editorNote) || '';
          model.closing = mp.closing || '';
          model.mayorNews = mp.mayorNews || null; /* 本月快報小專欄（html(m) 有值才畫） */
          /* 市長梗 hook：composeMonthly / modelPatch 有 mayorMemes（或 memes）陣列、或資料 G.DATA.monthlyPaper.mayorMemes 就渲染；沒有就略過 */
          var mm = mp.mayorMemes || pt.mayorMemes || mp.memes || pt.memes || (G.DATA.monthlyPaper && G.DATA.monthlyPaper.mayorMemes);
          if (mm && mm.length) model.mayorMemes = mm.slice(0, 4).map(function (x) { return typeof x === 'string' ? { text: x } : x; }).filter(function (x) { return x && x.text; });
          (mp.complaintBoard || []).forEach(function (b) { if (b && b.domainId) model.boardTexts[b.domainId] = b.text || ''; });
        }
      }
    } catch (err) { if (global.console) console.warn('[MonthlyPaper] composeMonthly failed, code text kept', err); }
    /* 照片欄：用現成美術當「新聞照片」——本月出手的政策卡圖＋最嗆居民的肖像（檔案不存在就略過，見 open()） */
    try {
      model.played.slice(0, 2).forEach(function (pp) {
        var P = G.DATA.policies && G.DATA.policies[pp.id];
        var src = P && P.art && P.art.card;
        if (src) model.photos.push({ kind: 'card', src: src, caption: '本月出手：' + pp.name });
      });
      var top = model.quotes.filter(function (q) { return q.mood !== 'better'; })[0] || model.quotes[0];
      var dom = top && (G.DATA.complaints && G.DATA.complaints.domains || []).filter(function (d) { return d.id === top.domainId; })[0];
      var spId = dom && dom.speaker && (typeof dom.speaker === 'string' ? dom.speaker : dom.speaker.npcId);
      var npcDef = (G.DATA.npcs || []).filter(function (n) { return n.id === spId; })[0];
      if (spId) model.photos.push({ kind: 'npc', src: 'assets/sprites/npc/npc_' + ((npcDef && npcDef.spriteAlias) || spId) + '.webp', caption: (top.who || '居民') + '：' + (top.text.length > 22 ? top.text.slice(0, 22) + '…' : top.text) });
    } catch (e2) { /* 沒照片也行 */ }
    return model;
  }

  function html(m) {
    var ev = m.events.map(function (e) {
      return '<li class="mp-ev ' + (e.resolved ? 'is-good' : 'is-bad') + '" data-event="' + esc(e.id) + '" data-resolution="' + esc(e.resolution) + '">' +
        '<span class="mp-ev__icon" aria-hidden="true">' + e.icon + '</span><span class="mp-ev__name">' + esc(e.title) + '</span>' +
        '<span class="mp-ev__res">' + esc(e.label) + '</span>' +
        (e.by.length ? '<span class="mp-ev__by">靠：' + esc(e.by.join('、')) + '</span>' : '') +
        (e.spawned.length ? '<span class="mp-ev__by">後續：' + esc(e.spawned.join('、')) + '</span>' : '') + '</li>';
    }).join('');
    var cores = m.cores.map(function (c) {
      return '<li class="mp-ev ' + (c.done ? 'is-good' : 'is-bad') + '" data-issue="' + esc(c.id) + '"><span class="mp-ev__icon" aria-hidden="true">' + (c.done ? '✅' : '⚠️') + '</span>' +
        '<span class="mp-ev__name">' + esc(c.label) + '</span><span class="mp-ev__res">' + (c.done ? '已解決' : '未解決') + '</span></li>';
    }).join('');
    var rows = m.lines.map(function (l) {
      var arrow = l.delta < 0 ? '▼' : l.delta > 0 ? '▲' : '＝';
      var cls = l.delta < 0 ? 'is-down' : l.delta > 0 ? 'is-up' : 'is-flat';
      return '<li class="mp-cmp ' + cls + '" data-domain="' + esc(l.id) + '" data-from="' + l.from + '" data-to="' + l.to + '" data-delta="' + l.delta + '">' +
        '<span class="mp-cmp__name">' + esc(l.icon) + ' ' + esc(l.name) + '</span>' +
        '<span class="mp-cmp__val">' + l.from + '<small>' + esc(l.fromTierLabel) + '</small> → <b>' + l.to + '</b></span>' +
        '<span class="mp-cmp__delta">' + arrow + ' ' + (l.delta > 0 ? '+' : '') + l.delta + '</span>' +
        '<span class="mp-cmp__tier" style="border-color:' + esc(l.color) + '">' + esc(l.tierLabel) + '</span>' +
        (m.boardTexts && m.boardTexts[l.id] ? '<span class="mp-cmp__text">' + esc(m.boardTexts[l.id]) + '</span>' : '') + '</li>';
    }).join('');
    var carry = m.carry.length ? m.carry.map(function (c) {
      return '<li data-kind="' + c.kind + '" data-issue="' + esc(c.id) + '"><b>' + esc(c.label) + '</b><span>' + esc(c.note) + '</span></li>';
    }).join('') : '<li class="mp-carry__none" data-kind="none">沒有要延續的問題 🎉</li>';
    var quotes = m.quotes.map(function (q) {
      return '<blockquote class="mp-quote is-' + q.mood + '" data-domain="' + esc(q.domainId) + '" data-mood="' + q.mood + '">' +
        '<span class="mp-quote__face" aria-hidden="true">' + q.moodIcon + '</span><p>「' + esc(q.text) + '」</p>' +
        '<cite>— ' + esc(q.who) + '（' + esc(q.icon + ' ' + q.domain) + (q.tierLabel ? '・' + esc(q.tierLabel) : '') + '）</cite></blockquote>';
    }).join('');
    var pol = m.played.length ? m.played.map(function (p) { return '<li>' + esc(p.name) + '</li>'; }).join('') : '<li>（沒有買政策卡）</li>';
    return '<article class="newspaper newspaper--monthly" id="monthly-sheet" role="dialog" aria-modal="true" aria-labelledby="monthly-title" tabindex="-1">' +
      '<div class="mp-toolbar"><button type="button" class="newspaper__btn newspaper__btn--primary mp-back" id="btn-monthly-back">↩ 回到結報</button>' +
      '<span class="mp-ribbon" id="monthly-ribbon">本月號</span></div>' +
      '<header class="newspaper__masthead mp-masthead">' +
      '<h1 class="newspaper__title np-masthead__name" id="monthly-masthead">' + esc(m.masthead) + '</h1>' +
      '<div class="newspaper__meta"><span class="mp-issue" id="monthly-issue"><strong>' + esc(m.issue) + '</strong></span><span>' + esc(m.monthLabel) + '</span><span>' + esc(m.seasonTitle) + '</span></div></header>' +
      '<div class="newspaper__body"><div class="newspaper__main">' +
      '<section class="newspaper__headline" id="monthly-headline"><span class="kicker">' + esc(m.kicker) + '</span><h2 id="monthly-title">' + esc(m.title) + '</h2><p class="lede">' + esc(m.lede) + '</p></section>' +
      '<section class="np-box mp-box" id="monthly-events"><h3 class="np-box__head">本月事件處理結果</h3><ul class="mp-evlist">' + ev + '</ul>' +
      (m.mode === 'pool' ? '<h4 class="mp-sub">核心問題</h4><ul class="mp-evlist">' + cores + '</ul>' : '') + '</section>' +
      (m.editorNote ? '<p class="mp-editor" id="monthly-editor">🖊️ 記者短評：' + esc(m.editorNote) + '</p>' : '') +
      '<section class="np-box mp-box" id="monthly-quotes"><h3 class="np-box__head">居民反應</h3>' + quotes + '</section>' +
      '</div><aside class="newspaper__aside">' +
      (m.photos && m.photos.length ? '<section class="np-box mp-box mp-photos" id="monthly-photos"><h3 class="np-box__head">本月照片</h3>' + m.photos.map(function (ph) {
        return '<figure class="mp-photo mp-photo--' + esc(ph.kind) + '"><img src="' + esc(ph.src) + '" alt="' + esc(ph.caption) + '"><figcaption>' + esc(ph.caption) + '</figcaption></figure>'; }).join('') + '</section>' : '') +
      '<section class="np-box mp-box" id="monthly-complaint"><h3 class="np-box__head">民怨變化（本季結果）</h3><ul class="mp-cmplist">' + rows + '</ul></section>' +
      '<section class="np-box mp-box" id="monthly-carry"><h3 class="np-box__head">延續到下季的問題</h3><ul class="mp-carry" id="monthly-carry-list">' + carry + '</ul><p class="np-box__note" id="monthly-ignore-note">' + esc(m.ignoreText) + '</p></section>' +
      (m.briefs && m.briefs.length ? '<section class="np-box mp-box" id="monthly-briefs"><h3 class="np-box__head">本月短訊</h3><ul class="mp-brief">' + m.briefs.map(function (b) {
        return '<li data-kind="' + esc(b.kind) + '"><b>' + esc(b.title) + '</b><span>' + esc(b.body) + '</span></li>'; }).join('') + '</ul></section>' : '') +
      '<section class="np-box mp-box" id="monthly-policies"><h3 class="np-box__head">本月你出手的政策</h3><ul class="mp-pol">' + pol + '</ul></section>' +
      '</aside></div>' +
      (m.mayorMemes && m.mayorMemes.length ? '<section class="np-box mp-box" id="monthly-memes"><h3 class="np-box__head">市長梗</h3><ul class="mp-memes">' + m.mayorMemes.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('') + '</ul></section>' : '') +
      (m.mayorNews ? (function (n) {
        var nick = (G.DATA.mayorNews && G.DATA.mayorNews.names && G.DATA.mayorNews.names.mayorNick) || '市長';
        return '<section class="np-box mp-box mp-mayor-news" id="monthly-mayor-news" data-meme="' + esc(n.memeId || '') + '">' +
          '<h3 class="np-box__head">' + esc(n.headline || '市長小專欄') + (n.rumorFlag ? ' <span class="mp-rumor-tag">傳聞</span>' : '') + '</h3>' +
          (n.deck ? '<p class="mp-mayor-deck">' + esc(n.deck) + '</p>' : '') +
          (n.body ? '<p class="mp-mayor-body">' + esc(n.body) + '</p>' : '') +
          (n.mayorQuote ? '<p class="mp-mayor-quote">' + esc(nick) + '：「' + esc(n.mayorQuote) + '」</p>' : '') +
          ((n.residentReactions || []).length ? '<ul class="mp-mayor-react">' + n.residentReactions.slice(0, 2).map(function (r) { return '<li>' + esc(r.speaker || '居民') + '：' + esc(r.text || '') + '</li>'; }).join('') + '</ul>' : '') +
          (n.editorNote ? '<p class="mp-mayor-editor">🖊️ ' + esc(n.editorNote) + '</p>' : '') +
          (n.rumorFlag && n.checkHint ? '<p class="mp-mayor-check">查證提示：' + esc(n.checkHint) + '</p>' : '') +
          '<p class="np-box__note">虛構報導</p></section>'; })(m.mayorNews) : '') +
      (m.closing ? '<p class="mp-closing" id="monthly-closing">' + esc(m.closing) + '</p>' : '') +
      '<div class="mp-footer"><button type="button" class="newspaper__btn newspaper__btn--primary mp-back" id="btn-monthly-back-2">↩ 回到結報</button></div></article>';
  }

  function ensure() {
    if (overlay && overlay.parentNode) return overlay;
    overlay = document.getElementById('monthly-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'monthly-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
    }
    overlay.addEventListener('click', function (e) {
      var t = e.target;
      if (t === overlay || (t.closest && t.closest('.mp-back'))) close();
    });
    if (!keyBound) {
      keyBound = true;
      document.addEventListener('keydown', function (e) {
        if (isOpen() && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); e.stopPropagation(); close(); }
      }, true);
    }
    return overlay;
  }

  function isOpen() { return !!(overlay && overlay.classList.contains('is-open')); }

  function open(ctx, opts) {
    opts = opts || {};
    var o = ensure();
    var m = compose(ctx);
    o.innerHTML = html(m);
    if (G.StaffDrawer && G.StaffDrawer.isOpen && G.StaffDrawer.isOpen()) G.StaffDrawer.close();
    lastFocus = document.activeElement;
    onCloseCb = opts.onClose || null;
    o.classList.add('is-open');
    o.setAttribute('aria-hidden', 'false');
    /* 圖片失敗的後備：報頭 logo 讀不到 → 顯示文字報頭；照片讀不到 → 拿掉該張 */
    try {
      var probe = new Image();
      probe.onerror = function () { var mh = o.querySelector('.mp-masthead'); if (mh) mh.classList.add('mp-logo-failed'); };
      probe.src = 'assets/ui/ui_monthly_masthead_logo.webp';
      [].forEach.call(o.querySelectorAll('.mp-photo img'), function (im) {
        im.addEventListener('error', function () { var f = im.closest('figure'); if (f && f.parentNode) f.parentNode.removeChild(f); });
      });
    } catch (e3) {}
    var sheet = o.querySelector('#monthly-sheet');
    if (sheet) { sheet.scrollTop = 0; try { sheet.focus({ preventScroll: true }); } catch (e) {} }
    return m;
  }

  function close() {
    if (!isOpen()) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '';
    var cb = onCloseCb; onCloseCb = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    if (cb) cb();
  }

  G.MonthlyPaper = { compose: compose, open: open, close: close, isOpen: isOpen, ready: true };
})(window);
