// ============================================================================
// 資料夾圖層 3：【3. 潮間帶】潮間帶動植物生態與黑潮三層洄游鏈
// ============================================================================

window.INTERTIDAL_SPECIES_META = {
  CRAB: {
    name: '白紋方蟹與細紋方蟹 (Grapsus albolineatus)',
    zone: '3. 潮間帶圖層 / 飛沫帶礁岩',
    geo: '甲殼綱方蟹科・東海岸潮間帶海蝕礁岩優勢種',
    desc: '棲息於石梯坪、八仙洞與三仙台陸連島浪花飛濺的火山集塊岩與珊瑚藻礁上，步足強健善於橫行跳躍，以雙螯刮食礁岩表面的石蓴與微細藻類。',
    previewColor: '#dc2626'
  },
  SEAWEED: {
    name: '石蓴（海菜）、海萵苣與馬尾藻林 (Ulva & Sargassum)',
    zone: '3. 潮間帶圖層 / 海蝕溝槽',
    geo: '綠藻門石蓴科 & 褐藻門馬尾藻科・潮間帶初級生產者',
    desc: '春夏季鋪滿東海岸潮間帶礁岩的翠綠石蓴與隨波搖曳的馬尾藻叢，不僅為稚魚與蟹類提供庇護所，也是八仙洞史前女性背簍採集的重要食用海菜。',
    previewColor: '#16a34a'
  },
  BLENNY: {
    name: '潮池蛙䲁（跳跳魚）與九孔幼貝 (Istiblennius edentulus)',
    zone: '3. 潮間帶圖層 / 壺穴潮池',
    geo: '條鰭魚綱䲁科・潮間帶壺穴與海蝕潮池常駐魚類',
    desc: '在退潮孤立的三仙台陸連島與石梯坪潮池中靈活游動，受驚擾時能以強健尾柄彈跳越過礁石前往鄰近水窪。',
    previewColor: '#38bdf8'
  },
  CLAM_URCHIN: {
    name: '鱗硨磲貝與長棘魔鬼海膽 (Tridacna & Diadema setosum)',
    zone: '3. 潮間帶圖層 / 潮下帶礁台',
    geo: '雙殼綱硨磲貝科 & 海膽綱・珊瑚礁共生底棲生物',
    desc: '嵌入珊瑚礁岩縫中的硨磲貝會微啟雙殼露出絢麗外套膜行光合作用；一旁的魔鬼海膽則揮動細長黑刺防禦天敵，亦是史前族人退潮採集的海產。',
    previewColor: '#9333ea'
  },
  TURTLE: {
    name: '太平洋綠蠵龜與熱帶蝶魚群 (Chelonia mydas)',
    zone: '3. 潮間帶圖層 / 亞潮帶珊瑚礁溝',
    geo: '爬行綱海龜科・成功基翬與三仙台亞潮帶珊瑚礁海域',
    desc: '順著黑潮暖流游入三仙台與基翬清澈珊瑚礁溝覓食海藻的綠蠵龜，身旁伴隨成群鮮黃的熱帶蝶魚與雀鯛。',
    previewColor: '#65a30d'
  },
  FLYING_FISH: {
    name: '黑潮飛魚群 — 第一階獵物 (Cheilopogon unicolor)',
    zone: '3. 潮間帶與大陸棚外海 / 表層躍水帶',
    geo: '鶴鱵目飛魚科・順黑潮暖流北上之大洋表層洄游魚類（鬼頭刀之主食）',
    desc: '【三階掠食鏈 ① 初級獵物】每年春夏季隨黑潮北上經過豐濱與成功外海，遭後方鬼頭刀高速追咬時會衝破海面滑翔逃生；落水瞬間常被鬼頭刀張口精準咬住吞食！',
    previewColor: '#38bdf8'
  },
  MAHI_MAHI: {
    name: '鬼頭刀（鲯鰍 / 飛烏虎）— 抓飛魚吃的中層獵手 (Coryphaena hippurus)',
    zone: '3. 潮間帶與大陸棚外海 / 中表層獵食帶',
    geo: '鰺形目鲯鰍科・專職追捕吞食飛魚，同時也是大型黃鰭鮪魚的獵物',
    desc: '【三階掠食鏈 ② 抓飛魚吃】俗稱「飛烏虎」，緊追飛魚群後方高速衝刺、張開大嘴直接咬住落水飛魚吞食！然而當牠專注獵食飛魚時，後方黑潮深處的大型黃鰭鮪魚也會高速突襲將鬼頭刀捕食吞下。',
    previewColor: '#eab308'
  },
  YELLOWFIN_TUNA: {
    name: '大型黃鰭鮪魚（串仔）— 抓鬼頭刀吃的頂級掠食者 (Thunnus albacares)',
    zone: '3. 潮間帶與大陸棚外海 / 中深層突襲帶',
    geo: '鯖形目鯖科・黑潮頂級掠食巨物（以鬼頭刀、飛魚與頭足類為食）',
    desc: '【三階掠食鏈 ③ 抓鬼頭刀吃】流線魚雷身軀配鮮黃鐮刀背臀鰭的頂級掠食者！潛伏於鬼頭刀後方較深的大陸棚陡坡水域，會突然仰角高速衝刺、張開巨顎直接咬住鬼頭刀並將其吞食！',
    previewColor: '#f59e0b'
  },
  MIGRATION_CHAIN: {
    name: '台灣東海岸黑潮三階掠食食物鏈 (鬼頭刀吃飛魚 ➔ 黃鰭鮪吃鬼頭刀)',
    zone: '3. 潮間帶與大陸棚外海 / 黑潮生態走廊',
    geo: '黑潮暖流（Kuroshio Current）驅動之海洋三階掠食食物鏈',
    desc: '真實呈現東海岸黑潮食物鏈的雙重掠食關係：前段「鬼頭刀」高速衝刺張嘴抓「飛魚」吃；後段體型碩大的「黃鰭鮪魚」則從黑潮深處仰角突襲，張開巨口把「鬼頭刀」抓來吃！',
    previewColor: '#0284c7'
  }
};

// Merge Culture & Intertidal metadata into global SPECIES_META for unified raycast & inspector lookup
window.SPECIES_META = Object.assign({}, window.CULTURE_SPECIES_META || {}, window.INTERTIDAL_SPECIES_META);

window.INTERTIDAL_LAYER_COPY = {
  folderTitle: '3. 潮間帶',
  folderSubtitle: '潮間帶生物・黑潮三階掠食鏈',
  headerTitle: '🦀 3. 潮間帶：臨岸生物與黑潮三階掠食食物鏈',
  headerDesc: '東海岸潮間帶孕育豐富的海菜、方蟹、跳跳魚與硨磲貝；外海緊鄰極窄大陸棚，黑潮暖流帶來真實的三階掠食食物鏈——「鬼頭刀追捕抓飛魚吃、大型黃鰭鮪魚則從深處突襲抓鬼頭刀吃」！',
  biotaList: [
    { key: 'CRAB',        icon: '🦀', title: '潮間帶白紋方蟹',   subtitle: '礁石橫行・雙螯刮藻', borderClass: 'border-rose-400/40',    textClass: 'text-rose-200' },
    { key: 'SEAWEED',     icon: '🌿', title: '石蓴海菜與馬尾藻', subtitle: '隨海湧搖曳・族人採集', borderClass: 'border-emerald-400/40', textClass: 'text-emerald-200' },
    { key: 'BLENNY',      icon: '🐟', title: '潮池跳跳魚(蛙䲁)', subtitle: '退潮壺穴游動・躍石', borderClass: 'border-amber-400/40',   textClass: 'text-amber-200' },
    { key: 'CLAM_URCHIN', icon: '🐚', title: '硨磲貝與魔鬼海膽', subtitle: '雙殼微啟・棘刺擺動', borderClass: 'border-purple-400/40',  textClass: 'text-purple-200' },
    { key: 'TURTLE',      icon: '🐢', title: '基翬礁岸綠蠵龜與熱帶蝶魚群', subtitle: '悠游翡翠淺海珊瑚礁溝', borderClass: 'border-lime-400/40', textClass: 'text-lime-200', fullWidth: true }
  ]
};

window.renderIntertidalLayerHTML = function () {
  const c = window.INTERTIDAL_LAYER_COPY;
  const biotaButtons = c.biotaList.map(item => {
    if (item.fullWidth) {
      return `
        <button onclick="focusSpecies('${item.key}')" class="mc-btn text-left p-2 rounded-lg text-xs flex items-center gap-2 col-span-2 ${item.borderClass}">
          <span class="text-base">${item.icon}</span>
          <div class="flex items-center justify-between flex-1">
            <span class="font-bold ${item.textClass} text-[11px]">${item.title}</span>
            <span class="text-[9px] text-slate-300">${item.subtitle}</span>
          </div>
        </button>`;
    }
    return `
      <button onclick="focusSpecies('${item.key}')" class="mc-btn text-left p-2 rounded-lg text-xs flex items-center gap-1.5 ${item.borderClass}">
        <span class="text-base">${item.icon}</span>
        <div>
          <div class="font-bold ${item.textClass} text-[11px]">${item.title}</div>
          <div class="text-[9px] text-slate-300">${item.subtitle}</div>
        </div>
      </button>`;
  }).join('');

  return `
    <div class="mc-panel rounded-2xl p-3.5 border-teal-400/50 shadow-2xl">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-teal-500/25 border border-teal-400/40 text-teal-200 text-[10px] font-black">圖層 3</span>
          <h2 class="text-xs font-black tracking-wider text-teal-200">${c.headerTitle}</h2>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="focusLandmark('PANORAMA')" class="text-[10px] bg-teal-500/30 px-2 py-0.5 rounded border border-teal-300/40 text-teal-100 hover:bg-teal-500/50 font-bold">
            拉回全景
          </button>
          <button onclick="closeAllLeftFolders()" class="text-[10px] bg-slate-800/80 hover:bg-rose-900/80 px-2 py-0.5 rounded border border-slate-600 text-slate-200 font-bold" title="收合資料夾">
            ✕
          </button>
        </div>
      </div>

      <p class="text-[11px] text-slate-300 leading-relaxed mb-2.5 bg-slate-950/55 p-2 rounded-lg border border-slate-800">
        ${c.headerDesc}
      </p>

      <!-- 黑潮三階掠食食物鏈 (鬼頭刀吃飛魚 ➔ 黃鰭鮪吃鬼頭刀) -->
      <div class="mb-2.5 bg-gradient-to-r from-sky-950/90 via-teal-950/85 to-amber-950/80 rounded-xl p-2.5 border border-sky-400/45 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-black text-sky-200">🌊 黑潮三階掠食鏈（大魚吃小魚）</span>
          <span id="migration-state-badge" class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-400/30">掠食追蹤就緒</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          <button onclick="focusSpecies('FLYING_FISH')" class="mc-btn p-1.5 rounded-lg text-center">
            <div class="text-xs font-black text-sky-200">① 飛魚群</div>
            <div class="text-[9px] text-slate-300">躍水滑翔逃生</div>
          </button>
          <button onclick="focusSpecies('MAHI_MAHI')" class="mc-btn p-1.5 rounded-lg text-center border-amber-400/40">
            <div class="text-xs font-black text-amber-300">② 鬼頭刀</div>
            <div class="text-[9px] text-slate-300">張口抓飛魚吃</div>
          </button>
          <button onclick="focusSpecies('YELLOWFIN_TUNA')" class="mc-btn p-1.5 rounded-lg text-center border-yellow-400/40">
            <div class="text-xs font-black text-yellow-200">③ 黃鰭鮪魚</div>
            <div class="text-[9px] text-slate-300">突襲抓鬼頭刀吃</div>
          </button>
        </div>

        <!-- 學生觀察專用：一鍵拉近看「鬼頭刀抓飛魚吃」與「黃鰭鮪抓鬼頭刀吃」 -->
        <div class="grid grid-cols-2 gap-1.5">
          <button onclick="triggerPredationFocus('MAHI_EATS_FF')" class="mc-btn py-1.5 px-2 rounded-lg text-[10px] font-bold text-amber-200 border-amber-400/55 flex items-center justify-center gap-1">
            <span>⚡ 看鬼頭刀抓飛魚吃</span>
          </button>
          <button onclick="triggerPredationFocus('TUNA_EATS_MAHI')" class="mc-btn py-1.5 px-2 rounded-lg text-[10px] font-bold text-yellow-200 border-yellow-400/55 flex items-center justify-center gap-1">
            <span>⚡ 看黃鰭鮪抓鬼頭刀吃</span>
          </button>
        </div>

        <button onclick="focusSpecies('MIGRATION_CHAIN')" class="mc-btn w-full py-1.5 rounded-lg text-[11px] font-bold text-cyan-100 border-cyan-400/50 flex items-center justify-center gap-1">
          <span>🎥 啟動黑潮三階掠食鏈全程伴游鏡頭</span>
        </button>
      </div>

      <!-- 潮間帶與礁岸動植物 -->
      <div class="text-[10px] text-teal-200/90 font-bold mb-1.5">👇 點擊下方潮間帶與亞潮帶生物拉近觀察：</div>
      <div class="grid grid-cols-2 gap-1.5">
        ${biotaButtons}
      </div>
    </div>
  `;
};

