/**
 * dialogue.js — 街景對話泡泡（SpeechBubbleManager）。
 * 定期挑一個在場 NPC，顯示 3～4 秒教學短句；不擋報紙／手牌。
 */
(function (global) {
  'use strict';
  var G = global.Game;

  function SpeechBubbleManager(opts) {
    this.npcManager = opts && opts.npcManager;
    this.lines = [];
    this.cooldown = 1.2;
    this.active = null;
    this.enabled = true;
    this._loadLines(opts && opts.seasonId);
  }

  SpeechBubbleManager.prototype._loadLines = function (seasonId) {
    var pack = (G.DATA && G.DATA.dialogues) || {};
    var key = seasonId || 'season_01';
    var arr = pack[key] || pack.season_01 || G.DATA.dialogue || [];
    this.lines = Array.isArray(arr) ? arr.slice() : [];
  };

  SpeechBubbleManager.prototype.setNpcManager = function (nm) {
    this.npcManager = nm;
  };

  SpeechBubbleManager.prototype.setEnabled = function (on) {
    this.enabled = !!on;
    if (!on) this._clearBubble();
  };

  SpeechBubbleManager.prototype._clearBubble = function () {
    if (this.active && this.active.el && this.active.el.parentNode) {
      this.active.el.parentNode.removeChild(this.active.el);
    }
    this.active = null;
  };

  /* 公職句（speakerKind=staff 或 speakerNpcId 以 staff_ 開頭）只給 id 相同的公職 NPC；
   * 居民句給同 id 的 NPC，或沒指定說話者的句子；找不到時只退回「非公職」的句子，絕不讓非公職說 staff_* 的話。 */
  function isStaffLine(d) {
    return d.speakerKind === 'staff' || /^staff_/.test(d.speakerNpcId || '');
  }

  SpeechBubbleManager.prototype._pickLine = function (npcId) {
    /* P1 街景狀態泡泡（冷清／熱鬧／壅塞／治安／髒亂／店家警示…）：G.Economy.streetLines 依 ctx.town 判定 appearWhen.street；
     * 遊客／路人／巡守只說這類句子；居民（mei/bo/lin…）約 65% 機率說街景句，其餘沿用嗆市長／教學句。 */
    try {
      var sc = G.state && G.state.ctx;
      if (G.Economy && sc && sc.town) {
        var sl = G.Economy.streetLines(sc, npcId), me = null;
        var lst = (this.npcManager && (this.npcManager.getList ? this.npcManager.getList() : this.npcManager.list)) || [];
        lst.forEach(function (n) { if (n.id === npcId) me = n; });
        var extra = !!(me && me.kind && me.kind !== 'resident');
        if (sl.length && (extra || Math.random() < 0.65)) {
          var tot = 0; sl.forEach(function (d) { tot += (d.weight || 1); });
          var r0 = Math.random() * tot;
          for (var k = 0; k < sl.length; k++) { r0 -= (sl[k].weight || 1); if (r0 <= 0) return sl[k]; }
          return sl[sl.length - 1];
        }
        if (extra) return null;
      }
    } catch (e0) { /* 街景句失敗時沿用原本挑句 */ }
    /* 居民嗆市長／讚賞：民怨高或問題沒處理 → 嗆；民怨降或事件有幫助 → 讚（G.MayorBanter.pick；缺資料時略過） */
    try {
      if (G.MayorBanter && G.MayorBanter.pick && G.state && G.state.ctx) {
        var mb = G.MayorBanter.pick(G.state.ctx, npcId);
        if (mb) return { id: mb.id, speakerNpcId: mb.speakerNpcId, lines: mb.lines, category: 'chat', banter: mb.state };
      }
    } catch (e) { /* 沿用原本挑句 */ }
    var pool = this.lines.filter(function (d) {
      if (isStaffLine(d)) return d.speakerNpcId === npcId;
      return !d.speakerNpcId || d.speakerNpcId === npcId;
    });
    if (!pool.length) pool = this.lines.filter(function (d) { return !isStaffLine(d); });
    if (!pool.length) return null;
    var total = 0;
    pool.forEach(function (d) { total += (d.weight || 1); });
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      r -= (pool[i].weight || 1);
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  };

  /** 泡泡不可超出街景左右邊（放大後的泡泡很寬）：用 margin-left 平移；方向若被 NPC 鏡像（scaleX(-1)）反轉就學一次符號。尾巴跟著反向補償 */
  function clampBubble(b) {
    try {
      var st = document.getElementById('street-stage');
      if (!st || !b || !b.isConnected) return;
      var sr = st.getBoundingClientRect(), r = b.getBoundingClientRect(), pad = 8, over = 0;
      if (r.left < sr.left + pad) over = sr.left + pad - r.left;
      else if (r.right > sr.right - pad) over = sr.right - pad - r.right;
      /* 垂直：不可蓋到上方的回合條（放大後被抬高的第二個泡泡會頂到）。往下收，最多收到不低於 NPC 頭頂 */
      var bar = document.getElementById('round-bar');
      if (bar && !bar.hidden) {
        var lim = bar.getBoundingClientRect().bottom + 6;
        if (r.top < lim) {
          var cb = parseFloat(getComputedStyle(b).bottom);
          if (!isNaN(cb)) { b.style.bottom = (cb - (lim - r.top)) + 'px'; r = b.getBoundingClientRect(); }
        }
      }
      if (!over || Math.abs(over) < 1) return;
      var cur = parseFloat(b.style.marginLeft) || 0, sign = b._ms || 1;
      b.style.marginLeft = (cur + over * sign) + 'px';
      var moved = b.getBoundingClientRect().left - r.left;
      if (Math.abs(moved) < 1 || (moved > 0) !== (over > 0)) { sign = -sign; b._ms = sign; b.style.marginLeft = (cur + over * sign) + 'px'; }
      b.style.setProperty('--bshift', (-(parseFloat(b.style.marginLeft) || 0)) + 'px');
    } catch (e) { /* 夾邊失敗不影響泡泡 */ }
  }
  G.clampBubble = clampBubble;

  SpeechBubbleManager.prototype._showOn = function (npc, lineDef) {
    this._clearBubble();
    if (!npc || !npc.el || !lineDef) return;
    var text = (lineDef.lines && lineDef.lines[0]) || '';
    if (!text) return;
    var bubble = document.createElement('div');
    bubble.className = 'npc-bubble npc-bubble--ambient';
    bubble.setAttribute('role', 'status');
    bubble.textContent = text;
    npc.el.appendChild(bubble);
    clampBubble(bubble);
    var self = this;
    this.active = {
      el: bubble,
      npcId: npc.id,
      ttl: 5.8 + Math.random() * 1.2 /* 環境泡泡也要讀得完（≥5.5 秒） */
    };
    var act = this.active;
    bubble.addEventListener('click', function (ev) { /* 點一下延長（釘住），不靠 hover */
      ev.stopPropagation();
      act.ttl = Math.max(act.ttl, 0) + 4;
      bubble.classList.add('is-pinned');
    });
  };

  SpeechBubbleManager.prototype.tick = function (dt) {
    if (!this.enabled) return;
    var sec = dt / 1000;
    if (this.active) {
      this.active.ttl -= sec;
      clampBubble(this.active.el); /* NPC 會走動：持續夾邊 */
      if (this.active.ttl <= 0) {
        this._clearBubble();
        this.cooldown = 2.5 + Math.random() * 2;
      }
      return;
    }
    this.cooldown -= sec;
    if (this.cooldown > 0) return;
    var list = this.npcManager && this.npcManager.getVisibleList
      ? this.npcManager.getVisibleList()
      : (this.npcManager && this.npcManager.getList
        ? this.npcManager.getList()
        : (this.npcManager && this.npcManager.list) || []);
    if (!list.length || !this.lines.length) {
      this.cooldown = 3;
      return;
    }
    var walking = list.filter(function (n) { return n.pause <= 0; });
    var candidates = walking.length ? walking : list;
    var npc = candidates[Math.floor(Math.random() * candidates.length)];
    var line = this._pickLine(npc.id);
    if (line) this._showOn(npc, line);
    else this.cooldown = 2;
  };

  G.SpeechBubbleManager = SpeechBubbleManager;
})(window);
