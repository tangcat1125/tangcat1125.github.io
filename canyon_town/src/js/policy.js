/**
 * policy.js — 政策手牌（對齊 #hand-rail / .policy-card）。
 * 花費點數、預測 deltas；確認前預覽。
 * 不執行結果運算（交給 replay.js）。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  function PolicyHand(opts) {
    this.handEl = opts.handEl;
    this.predictEl = opts.predictEl;
    this.confirmBtn = opts.confirmBtn;
    this.clearBtn = opts.clearBtn;
    this.selected = [];
    this.availablePoints = 0;
    this.availableMoney = null; /* Stage G：季初金錢（null＝不限制）；卡片金錢花費＝-deltas.money */
    this.enabled = true;
    this.onChange = opts.onChange || function () {};
  }

  PolicyHand.prototype.setEnabled = function (on) {
    this.enabled = !!on;
    if (this.handEl) {
      var inDecisionHud = this.handEl.closest
        ? this.handEl.closest('#np-decision-hud')
        : null;
      var rail = this.handEl.closest ? this.handEl.closest('#hand-rail') : null;
      if (!rail && this.handEl.id === 'hand-rail') rail = this.handEl;
      if (!rail && this.handEl.parentElement) {
        rail = this.handEl.parentElement.id === 'hand-rail'
          ? this.handEl.parentElement
          : this.handEl.parentElement.closest('#hand-rail');
      }
      if (inDecisionHud) {
        /* 政策店掛在右側決策欄：底部 #hand-rail 一律收起 */
        var bottom = document.getElementById('hand-rail');
        if (bottom) {
          bottom.classList.add('is-away');
          bottom.classList.add('is-locked');
          bottom.hidden = true;
          bottom.setAttribute('aria-disabled', 'true');
        }
      } else if (rail) {
        /* 模擬／日常運行季：整列隱藏；僅政策階段 setEnabled(true) 才出現 */
        rail.classList.toggle('is-away', !this.enabled);
        rail.classList.toggle('is-locked', !this.enabled);
        rail.setAttribute('aria-disabled', this.enabled ? 'false' : 'true');
        rail.hidden = !this.enabled;
      }
    }
    this.render();
  };

  PolicyHand.prototype.setPoints = function (pts) {
    this.availablePoints = pts;
    this.render();
  };
  /** Stage G：金錢上限（點數與金錢都夠才可選；不夠的卡灰掉並顯示「還差 N 點／元」） */
  PolicyHand.prototype.setMoney = function (money) {
    this.availableMoney = (typeof money === 'number' && isFinite(money)) ? money : null;
    this.render();
  };
  function moneyCost(p) { return p && p.deltas && p.deltas.money < 0 ? -p.deltas.money : 0; }
  PolicyHand.prototype.spentMoney = function () {
    return this.selected.reduce(function (sum, id) { return sum + moneyCost(G.DATA.policies[id]); }, 0);
  };
  /** 這張卡還差多少：{points, money}（0＝夠） */
  PolicyHand.prototype.shortOf = function (id) {
    var p = G.DATA.policies[id]; if (!p) return { points: 0, money: 0 };
    var pts = Math.max(0, this.spentPoints() + (p.cost || 0) - this.availablePoints);
    var mon = this.availableMoney == null ? 0 : Math.max(0, Math.ceil(this.spentMoney() + moneyCost(p) - Math.max(0, this.availableMoney)));
    return { points: pts, money: mon };
  };
  /** 改掛載到決策欄（或其它容器）；保留 selected / points */
  PolicyHand.prototype.remount = function (opts) {
    opts = opts || {};
    if (opts.handEl) this.handEl = opts.handEl;
    if (opts.predictEl) this.predictEl = opts.predictEl;
    if (opts.confirmBtn) this.confirmBtn = opts.confirmBtn;
    if (opts.clearBtn) this.clearBtn = opts.clearBtn;
    if (opts.onChange) this.onChange = opts.onChange;
    this.render();
  };


  PolicyHand.prototype.getSelected = function () {
    return this.selected.slice();
  };

  PolicyHand.prototype.clear = function () {
    this.selected = [];
    this.render();
    this.onChange(this.selected);
  };

  PolicyHand.prototype.spentPoints = function () {
    var self = this;
    return this.selected.reduce(function (sum, id) {
      var p = G.DATA.policies[id];
      return sum + (p ? p.cost : 0);
    }, 0);
  };

  PolicyHand.prototype.predict = function () {
    var deltas = { points: 0, money: 0, profit: 0, happiness: 0 };
    var solves = {};
    this.selected.forEach(function (id) {
      var p = G.DATA.policies[id];
      if (!p) return;
      deltas.points -= p.cost || 0;
      var d = p.deltas || {};
      deltas.money += d.money || 0;
      deltas.profit += d.profit || 0;
      deltas.happiness += d.happiness || 0;
      (p.solves || []).forEach(function (eid) { solves[eid] = true; });
    });
    var remainingBad = { money: 0, profit: 0, happiness: 0 };
    (G.DATA.eventOrder || []).forEach(function (eid) {
      var e = G.DATA.events[eid];
      if (!e || solves[eid]) return;
      var d = e.deltas || {};
      remainingBad.money += d.money || 0;
      remainingBad.profit += d.profit || 0;
      remainingBad.happiness += d.happiness || 0;
    });
    return {
      policyDeltas: deltas,
      solves: Object.keys(solves),
      netPreview: {
        points: deltas.points,
        money: deltas.money + remainingBad.money,
        profit: deltas.profit + remainingBad.profit,
        happiness: deltas.happiness + remainingBad.happiness
      }
    };
  };

  /** 無 PNG 時的 CSS 後備卡面圖示（卡面一律直式 3:4） */
  var CARD_ICON = {
    policy_clear_drain: '🧹',
    policy_boardwalk: '🪵',
    policy_coupon: '🎫',
    policy_water_test: '💧',
    policy_logistics_hub: '📦'
  };

  /** 圖載入成功 → 以絕對 URL 設 --card-art（避免 CSS 變數內相對路徑解析到 css 資料夾）；
   *  失敗 → 改顯示 emoji（CSS 後備卡面仍是直式 3:4）。結果快取，重繪不閃。 */
  var ART_STATE = {};
  function applyCardFallback(btn, src, emoji) {
    function ok(abs) { btn.style.setProperty('--card-art', 'url("' + abs + '")'); btn.classList.remove('is-art-fallback'); }
    function bad() {
      btn.style.setProperty('--card-emoji', '"' + emoji + '"');
      btn.classList.add('is-art-fallback');
    }
    var st = ART_STATE[src];
    if (st && st.done) { if (st.ok) ok(st.abs); else bad(); return; }
    if (st && st.waiting) { st.waiting.push({ ok: ok, bad: bad }); return; } /* 同一張圖已在載入：排隊等結果，不重複送出請求（缺圖時避免洗出一堆 404） */
    var wait = [{ ok: ok, bad: bad }];
    ART_STATE[src] = { done: false, waiting: wait };
    var img = new Image();
    img.onload = function () { ART_STATE[src] = { done: true, ok: true, abs: img.src }; wait.forEach(function (w) { w.ok(img.src); }); };
    img.onerror = function () { ART_STATE[src] = { done: true, ok: false }; wait.forEach(function (w) { w.bad(); }); };
    img.src = src;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** 卡面 deltaChips：優先 policy.card.deltaChips[{key,label,value,text}]；缺資料退回 policy.deltas 三項。 */
  function chipsFor(p) {
    var c = p.card && typeof p.card === 'object' ? p.card : null;
    var arr = c && Array.isArray(c.deltaChips) ? c.deltaChips : null;
    var out = [];
    if (arr && arr.length) {
      arr.forEach(function (ch) {
        if (!ch) return;
        var v = typeof ch.value === 'number' ? ch.value : 0;
        // 壅塞度越低越好：value<0 視為正向
        var good = ch.key === 'congestion' ? v < 0 : v > 0;
        var bad = ch.key === 'congestion' ? v > 0 : v < 0;
        out.push({
          text: ch.text || ((ch.label || ch.key || '') + ' ' + (v > 0 ? '+' : '') + v),
          cls: good ? 'is-up' : (bad ? 'is-down' : 'is-flat'),
          key: ch.key || ''
        });
      });
      return out;
    }
    var d = p.deltas || {};
    [['money', '金錢'], ['profit', '獲利'], ['happiness', '幸福度']].forEach(function (kv) {
      var v = d[kv[0]] || 0;
      out.push({ text: kv[1] + ' ' + (v > 0 ? '+' : '') + v, cls: v > 0 ? 'is-up' : (v < 0 ? 'is-down' : 'is-flat'), key: kv[0] });
    });
    return out;
  }

  function sign(n) {
    if (!n) return '—0';
    return (n > 0 ? '▲+' : '▼') + n;
  }

  PolicyHand.prototype.updatePredict = function () {
    if (!this.predictEl) return;
    var p = this.predict();
    var n = p.netPreview;
    var names = p.solves.map(function (id) {
      var e = G.DATA.events[id];
      return e ? e.title : id;
    });
    this.predictEl.innerHTML =
      '<div class="policy-tip">用既有點數買政策卡 → 公職委任看星芒圖</div>' +
      '<div><strong>點數</strong> 花 ' + (-p.policyDeltas.points) +
      '／剩 ' + (this.availablePoints - this.spentPoints()) +
      (this.availableMoney != null ? '　<strong>金錢</strong> 花 ' + this.spentMoney() + '／剩 ' + Math.round(this.availableMoney - this.spentMoney()) : '') + '</div>' +
      '<div>預測 金' + sign(n.money) + ' 利' + sign(n.profit) +
      ' 幸' + sign(n.happiness) + '</div>' +
      '<div>對症：' + (names.length ? names.join('、') : '尚無') + '</div>';
    if (this.confirmBtn) {
      this.confirmBtn.disabled = !this.enabled || this.selected.length === 0;
    }
  };

  PolicyHand.prototype.toggle = function (id) {
    if (!this.enabled) return;
    var p = G.DATA.policies[id];
    if (!p) return;
    var idx = this.selected.indexOf(id);
    if (idx >= 0) {
      this.selected.splice(idx, 1);
    } else {
      var sh = this.shortOf(id);
      if (sh.points > 0 || sh.money > 0) return;
      if (G.Installment && G.Installment.lockOf && G.Installment.lockOf(G.state && G.state.ctx, id)) return; /* Stage I：合約鎖卡 */
      this.selected.push(id);
    }
    this.render();
    this.onChange(this.selected);
  };

  PolicyHand.prototype.render = function () {
    var self = this;
    var order = G.DATA.policyOrder || Object.keys(G.DATA.policies);
    var spent = this.spentPoints();
    this.handEl.innerHTML = '';
    if (this.handEl.classList && (this.handEl.id === 'np-decision-hand' ||
        (this.handEl.closest && this.handEl.closest('#np-decision-hud')))) {
      this.handEl.classList.add('is-cards-3x4');
    }
    /* 民怨提示：建議卡（命中最高民怨領域）排前面；其餘維持原順序 */
    var hints = null;
    try { hints = (G.Complaint && G.state && G.state.ctx) ? G.Complaint.cardHints(G.state.ctx) : null; } catch (e) { hints = null; }
    /* 街景線索提示（回合條蒐集；與民怨「建議」並用）：線索 policyHints 指到的卡加「線索」徽章並排前 */
    var clueHints = null;
    try { clueHints = (G.StreetClues && G.state && G.state.ctx) ? G.StreetClues.cardHints(G.state.ctx) : null; } catch (e2) { clueHints = null; }
    if (hints || clueHints) {
      order = order.map(function (id, i) {
        var rec = hints && hints[id] && hints[id].recommended ? 1 : 0;
        var clue = clueHints && clueHints[id] ? 1 : 0;
        return { id: id, i: i, k: rec * 2 + clue, rec: rec, cs: clue ? clueHints[id].rank * 100 + clueHints[id].score : 0, sc: hints && hints[id] ? hints[id].score : 0 };
      })
        .sort(function (a, b) { return (b.k - a.k) || (b.cs - a.cs) || (b.sc - a.sc) || (a.i - b.i); })
        .map(function (o) { return o.id; });
    }
    order.forEach(function (id) {
      var p = G.DATA.policies[id];
      if (!p) return;
      var hint = hints && hints[id];
      var selected = self.selected.indexOf(id) >= 0;
      var short = selected ? { points: 0, money: 0 } : self.shortOf(id);
      var ictx = G.state && G.state.ctx, lock = G.Installment && G.Installment.lockOf ? G.Installment.lockOf(ictx, id) : null; /* Stage I 分期合約：尾款未清／罷工後本任期鎖卡 */
      var wouldExceed = (!selected && (short.points > 0 || short.money > 0)) || !!lock;
      var shortText = lock ? lock.text : (short.points > 0 ? '還差 ' + short.points + ' 點' : (short.money > 0 ? '還差 ' + short.money + ' 元' : ''));
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'policy-card' +
        (selected ? ' is-selected' : '') +
        (wouldExceed || !self.enabled ? ' is-disabled' : '');
      btn.disabled = wouldExceed || !self.enabled;
      var d = p.deltas || {};
      var solveTitles = (p.solves || []).map(function (eid) {
        var e = G.DATA.events[eid];
        return e ? e.title : eid;
      });
      /* 新卡（solves 為空）：用資料的 eventEffects.cure（事件池事件）當「對症」顯示，不虛構效果 */
      if (!solveTitles.length && p.eventEffects && p.eventEffects.cure && p.eventEffects.cure.length) {
        var pe = (G.DATA.eventPool && G.DATA.eventPool.events) || [];
        solveTitles = p.eventEffects.cure.map(function (eid) {
          var hit = pe.filter(function (x) { return x.id === eid; })[0];
          return hit ? hit.title : eid;
        }).slice(0, 3);
      }
      btn.dataset.policyId = id;
      btn.classList.add('card-3x4');
      if (p.rarity) btn.setAttribute('data-rarity', p.rarity);
      btn.title = p.name + '｜點數 ' + p.cost + (moneyCost(p) ? '｜' + moneyCost(p) + ' 元' : '') + (shortText ? '｜' + shortText : '') + (solveTitles.length ? '｜對症：' + solveTitles.join('、') : '');
      if (shortText) { btn.setAttribute('data-short', shortText); btn.classList.add('is-short'); }
      if (lock) { btn.classList.add('is-contract-lock'); btn.setAttribute('data-lock', lock.reason); }
      if (G.Installment && G.Installment.spec && G.Installment.spec(id)) { var iw = G.Installment.warnOf(ictx, id); btn.title += '｜' + G.Installment.summary(id) + (iw ? '｜' + iw : ''); if (iw) btn.setAttribute('data-installment-warn', iw); }
      var artObj = (p.art && typeof p.art === 'object') ? p.art : null;
      var cardObj = (p.card && typeof p.card === 'object') ? p.card : null;
      var artSrc = (typeof p.art === 'string' && p.art) ||
        (artObj && artObj.card) ||
        (cardObj && cardObj.art) ||
        ('assets/sprites/cards/card_' + String(id).replace(/^policy_/, '') + '.webp');
      var emoji = (cardObj && cardObj.fallbackEmoji) || (artObj && artObj.fallbackEmoji) || CARD_ICON[id] || '🃏';
      var accent = (cardObj && cardObj.accent) || (artObj && artObj.accent) || '';
      if (accent) {
        btn.style.setProperty('--card-rim', accent);
        btn.style.setProperty('--card-accent', accent);
      }
      if (artObj && (artObj.exists === false || artObj.cardExists === false || artObj.status === '待畫')) { btn.style.setProperty('--card-emoji', '"' + emoji + '"'); btn.classList.add('is-art-fallback'); } /* 待畫卡圖：資料標記後不送出請求（404=0） */
      else applyCardFallback(btn, artSrc, emoji);
      var typeLabel = (cardObj && cardObj.typeLabel) || ((p.tags || []).slice(0, 2).join('／'));
      var shopLine = (cardObj && cardObj.shopLine) || p.shopBlurb || p.blurb || '';
      var costText = (cardObj && cardObj.costBadge) || ('點數 ' + p.cost);
      var chips = chipsFor(p).map(function (ch) {
        return '<i class="policy-card__chip ' + ch.cls + '" data-key="' + esc(ch.key) + '">' + esc(ch.text) + '</i>';
      }).join('');
      if (hint && hint.recommended) btn.classList.add('is-recommended');
      var ch = clueHints && clueHints[id];
      if (ch) { btn.classList.add('is-clue-hint'); btn.setAttribute('data-clue-role', ch.role); }
      var reliefHtml = (hint && hint.chips && hint.chips.length)
        ? '<span class="policy-card__relief" data-relief="' + hint.chips.map(function (c) { return c.id + ':' + c.delta; }).join(',') + '">' +
          '<b>降怨</b>' + hint.chips.map(function (c) {
            return '<i class="policy-card__rchip" data-domain="' + esc(c.id) + '">' + esc(c.name) + ' ' + c.delta + '</i>';
          }).join('') + '</span>'
        : '';
      btn.innerHTML =
        '<span class="policy-card__title name">' + esc(p.name) + '</span>' +
        '<span class="policy-card__cost cost">' + esc(costText) + '</span>' +
        (shortText ? '<span class="policy-card__short" aria-label="' + esc(shortText) + '">' + esc(shortText) + '</span>' : '') +
        (typeLabel ? '<span class="policy-card__type">' + esc(typeLabel) + '</span>' : '') +
        (hint && hint.recommended ? '<span class="policy-card__rec">建議</span>' : '') +
        (ch ? '<span class="policy-card__clue">🔍 線索·' + esc(ch.role) + '</span>' : '') +
        '<span class="blurb policy-card__shopline">' + esc(shopLine) + '</span>' +
        reliefHtml +
        '<span class="policy-card__deltas deltas">' + chips + '</span>' +
        '<span class="solves">' +
        (solveTitles.length ? esc(solveTitles.join('、')) : '無對症') + '</span>';
      btn.onclick = function () { self.toggle(id); };
      self.handEl.appendChild(btn);
    });
    this.updatePredict();
  };

  G.PolicyHand = PolicyHand;
})(window);
