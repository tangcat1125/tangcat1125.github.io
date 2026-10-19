// ============================================================================
// 資料夾圖層 2：【2. 地形】東海岸五帶地質、三仙台陸連島（退潮通行）與海象調校
// ============================================================================

window.BLOCK_DEFS = [
  {
    id: 1,
    key: 'AGGLOMERATE',
    name: '都巒山層火山集塊岩',
    zone: '海岸山脈 / 三仙台陸連島',
    zoneCode: 'MOUNTAIN',
    geo: '中新世安山岩質火山集塊岩（石門、三仙台黑色礁岩）',
    desc: '由海底火山噴發碎屑膠結而成的堅硬黑褐色巨岩，抗蝕力極強，在三仙台陸連島與八仙洞海蝕洞群形成黝黑嶙峋的奇岩。',
    baseColor: '#36322e',
    noiseColors: ['#24211e', '#4a433b', '#594e42', '#1c1917'],
    pattern: 'agglomerate',
    hotbar: true
  },
  {
    id: 2,
    key: 'TUFF',
    name: '石梯坪白色凝灰岩',
    zone: '岩岸海蝕平台',
    zoneCode: 'TERRACE',
    geo: '火山灰沉積凝灰岩（豐濱石梯坪單面山）',
    desc: '質地潔白且具層理的火山凝灰岩，受太平洋波浪差異侵蝕與隆起作用，形成石梯坪著名的階梯狀單面山與壺穴潮池。',
    baseColor: '#dbd7d0',
    noiseColors: ['#eceae4', '#c2bdb4', '#a8a39a', '#f5f3ef'],
    pattern: 'strata',
    hotbar: true
  },
  {
    id: 3,
    key: 'TERRACE_GRASS',
    name: '三仙台與新社海階翠綠草坡',
    zone: '海階地形 / 陸連島植被',
    zoneCode: 'TERRACE',
    geo: '隆起海階與陸連島頂部之台灣海棗、林投與翠綠草坡',
    desc: '覆蓋於豐濱新社海階、長濱海階與三仙台陸連島山頭的鮮綠植被層，與碧藍太平洋形成鮮明對比。',
    baseColor: '#4d9c2a',
    noiseColors: ['#3b821c', '#64b53b', '#76c44b', '#316e16'],
    pattern: 'grass_side',
    hotbar: true
  },
  {
    id: 4,
    key: 'TERRACE_SOIL',
    name: '海階紅土礫石層',
    zone: '海階地形',
    zoneCode: 'TERRACE',
    geo: '更新世海階古海灘圓礫與紅土堆積',
    desc: '海階台地下方的地質層，夾雜古海水淘洗過的圓礫與氧化紅褐色土壤。',
    baseColor: '#875736',
    noiseColors: ['#6e4427', '#9e6842', '#59351d', '#8f7560'],
    pattern: 'soil_gravel',
    hotbar: false
  },
  {
    id: 5,
    key: 'COBBLE_BEACH',
    name: '東海岸灰黑扁圓礫石灘（三仙台陸連島沙洲）',
    zone: '岩岸礫灘 / 陸連島',
    zoneCode: 'SHORE',
    geo: '安山岩、硬砂岩渾圓扁礫・三仙台連島礫石沙洲 (Tombolo)',
    desc: '三仙台與長濱最具代表性的灰黑色圓礫灘！舊石器時期並無拱橋，三仙台與本島之間由這道「連島礫石礁脊」相連，退潮時露出水面供史前族人徒步走過去登島，漲潮時則被海水淹沒。',
    baseColor: '#5b626b',
    noiseColors: ['#3f454d', '#767f8a', '#2c3138', '#8d96a1', '#4d5259'],
    pattern: 'cobble',
    hotbar: true
  },
  {
    id: 6,
    key: 'ALGAL_REEF',
    name: '潮間帶珊瑚藻礁（陸連島礁脊）',
    zone: '潮間帶',
    zoneCode: 'INTERTIDAL',
    geo: '全新世隆起珊瑚礁與石灰藻礁平台',
    desc: '分布於高低潮線間的多孔暗色礁岩，構成三仙台陸連島的水下礁脊基底，退潮時裸露出潮池與海蝕溝，為方蟹、海膽、硨磲貝與跳跳魚的家園。',
    baseColor: '#4c5752',
    noiseColors: ['#38423e', '#627069', '#73585f', '#2b3330', '#876d74'],
    pattern: 'reef',
    hotbar: true
  },
  {
    id: 7,
    key: 'SEAWEED_REEF',
    name: '綠藻石蓴潮間礁岩',
    zone: '潮間帶',
    zoneCode: 'INTERTIDAL',
    geo: '附著石蓴（海菜）、礁膜與藤壺之潮間礁石',
    desc: '潮間帶礁岩表面披上一層鮮綠滑嫩的野生海菜（石蓴與礁膜），是草食蟹類、螺貝與八仙洞史前女性採集的重要食材。',
    baseColor: '#2e8f4b',
    noiseColors: ['#1e6e37', '#43ad63', '#68c783', '#394d42'],
    pattern: 'mossy',
    hotbar: true
  },
  {
    id: 8,
    key: 'CORAL_COLONY',
    name: '基翬淺海造礁珊瑚',
    zone: '潮間帶外緣 / 大陸棚',
    zoneCode: 'SHELF',
    geo: '微孔珊瑚、軸孔珊瑚與桌形珊瑚群落',
    desc: '成功鎮基翬至三仙台淺海受溫暖黑潮支流滋養，發育出繽紛造礁珊瑚群落，吸引綠蠵龜、蝶魚與鸚哥魚棲息。',
    baseColor: '#d96b8a',
    noiseColors: ['#f285a2', '#b84d6d', '#e89954', '#9e58c4'],
    pattern: 'coral',
    hotbar: true
  },
  {
    id: 9,
    key: 'SHELF_SAND',
    name: '大陸棚淺海珊瑚白砂',
    zone: '大陸棚',
    zoneCode: 'SHELF',
    geo: '珊瑚鈣質白砂與生物碎屑海床（折射出翡翠綠海色）',
    desc: '鋪設於近岸與大陸棚淺海的鈣質白砂與礁石基底，陽光穿透清澈海水照射其上，會折射出東海岸迷人的孔雀綠與寶石藍漸層！',
    baseColor: '#b8c4c2',
    noiseColors: ['#9eadab', '#ced9d7', '#879996', '#d9e3e1'],
    pattern: 'sand',
    hotbar: false
  },
  {
    id: 10,
    key: 'KUROSHIO_BASALT',
    name: '黑潮深海斜坡玄武岩',
    zone: '大陸棚外緣深海',
    zoneCode: 'SHELF',
    geo: '菲律賓海板塊隱沒帶陡坡深海基岩',
    desc: '台灣東海岸大陸棚極窄，離岸不遠即陡降至黑潮海溝斜坡，深邃洋底使遠海呈現濃郁的鈷藍色。',
    baseColor: '#162942',
    noiseColors: ['#0f1d30', '#1f3859', '#294770', '#0a1421'],
    pattern: 'agglomerate',
    hotbar: false
  },
  {
    id: 11,
    key: 'FOREST_GRASS',
    name: '海岸山脈雨林腐植土',
    zone: '海岸山脈',
    zoneCode: 'MOUNTAIN',
    geo: '陡坡森林腐植質層與砂頁岩風化土',
    desc: '海岸山脈迎太平洋水氣，終年雲霧繚繞，孕育茂密的亞熱帶季風雨林、山棕、黃藤與姑婆芋。',
    baseColor: '#2d7a3e',
    noiseColors: ['#205e2e', '#3c914f', '#194a24', '#4da660'],
    pattern: 'mossy',
    hotbar: false
  },
  {
    id: 12,
    key: 'TREE_TRUNK',
    name: '海岸楠木與台灣海棗幹',
    zone: '海岸山脈 / 島礁',
    zoneCode: 'MOUNTAIN',
    geo: '台灣海棗、林投與闊葉喬木樹幹',
    desc: '耐鹽抗風的台灣海棗與楠木，常見於三仙台陸連島與海岸山脈坡地。',
    baseColor: '#69492a',
    noiseColors: ['#52371e', '#7d5935', '#402a16', '#8a6540'],
    pattern: 'bark',
    hotbar: false
  },
  {
    id: 13,
    key: 'TREE_LEAVES',
    name: '亞熱帶季風雨林樹冠',
    zone: '海岸山脈',
    zoneCode: 'MOUNTAIN',
    geo: '榕屬、大葉楠、台灣海棗與林投林冠',
    desc: '濃密的常綠闊葉林冠，涵養水源化為山澗溪流注入潮間帶。',
    baseColor: '#328a44',
    noiseColors: ['#236b32', '#42a155', '#1b5427', '#54b567'],
    pattern: 'leaves',
    hotbar: false
  },
  {
    id: 14,
    key: 'MEGALITH',
    name: '史前巨石岩塊',
    zone: '海階地形（史前遺址）',
    zoneCode: 'TERRACE',
    geo: '東海岸海階砂岩與安山岩巨石地標',
    desc: '佇立於東海岸海階台地上的史前巨石地標，遙望太平洋。',
    baseColor: '#8c857b',
    noiseColors: ['#6e685f', '#a69e92', '#544f48', '#bfb7ab'],
    pattern: 'carved',
    hotbar: true
  }
];

window.TERRAIN_LAYER_COPY = {
  folderTitle: '2. 地形',
  folderSubtitle: '五帶地質・三仙台陸連島・海象',
  headerTitle: '⛰️ 2. 地形：東海岸五帶地質與三仙台陸連島',
  headerDesc: '自豐濱一路延伸至成功的東海岸，由西向東呈「海岸山脈 ▸ 海階台地 ▸ 岩岸礫灘 ▸ 潮間帶與陸連島 ▸ 狹窄大陸棚」五帶格局。舊石器時期的三仙台沒有拱橋，而是一座「陸連島」，唯有退潮時連島礫石礁脊露出水面才能徒步走過去！'
};

window.renderTerrainLayerHTML = function () {
  const c = window.TERRAIN_LAYER_COPY;
  return `
    <div class="mc-panel rounded-2xl p-3.5 border-sky-400/50 shadow-2xl max-h-[82vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-sky-500/25 border border-sky-400/40 text-sky-200 text-[10px] font-black">圖層 2</span>
          <h2 class="text-xs font-black tracking-wider text-sky-200">${c.headerTitle}</h2>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="focusLandmark('PANORAMA')" class="text-[10px] bg-sky-500/30 px-2 py-0.5 rounded border border-sky-300/40 text-sky-100 hover:bg-sky-500/50 font-bold">
            🗺️ 全景俯瞰
          </button>
          <button onclick="closeAllLeftFolders()" class="text-[10px] bg-slate-800/80 hover:bg-rose-900/80 px-2 py-0.5 rounded border border-slate-600 text-slate-200 font-bold" title="收合資料夾">
            ✕
          </button>
        </div>
      </div>

      <p class="text-[11px] text-slate-300 leading-relaxed mb-2.5 bg-slate-950/55 p-2 rounded-lg border border-slate-800">
        ${c.headerDesc}
      </p>

      <!-- 三仙台陸連島・退潮通行 vs 滿潮淹沒 專屬控制卡 -->
      <div class="mb-2.5 bg-gradient-to-r from-cyan-950/90 via-slate-900/90 to-teal-950/90 rounded-xl p-2.5 border border-cyan-400/45">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[11px] font-black text-cyan-200">🏝️ 三仙台陸連島（退潮連島礫灘）：</span>
          <span id="tombolo-state-badge" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/25 text-cyan-200 border border-cyan-400/40">平潮：淺水漫過</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5 mb-1.5">
          <button onclick="setTidePreset(-1.25, true)" class="mc-btn py-1.5 px-2 rounded-lg text-[11px] font-bold text-amber-200 border-amber-400/50 flex items-center justify-center gap-1">
            <span>🦶 退潮：露出陸連島走過去</span>
          </button>
          <button onclick="setTidePreset(0.95, true)" class="mc-btn py-1.5 px-2 rounded-lg text-[11px] font-bold text-sky-200 border-sky-400/50 flex items-center justify-center gap-1">
            <span>🌊 滿潮：海水淹沒成離岸島</span>
          </button>
        </div>
        <button onclick="resumeTidePlayback()" class="mc-btn active w-full py-1.5 px-2 rounded-lg text-[11px] font-bold text-emerald-200 border-emerald-400/50 flex items-center justify-center gap-1">
          <span>▶️ 繼續播映（自動漲退潮循環觀察）</span>
        </button>
      </div>

      <!-- 東海岸五帶格局篩選 -->
      <div class="mb-2.5 bg-slate-950/70 rounded-xl p-2 border border-slate-800">
        <div class="text-[10px] text-sky-200 font-bold mb-1.5">🧭 東海岸五帶地形高亮檢視：</div>
        <div class="grid grid-cols-3 gap-1">
          <button onclick="setZoneHighlight('ALL')" id="zone-btn-ALL" class="mc-btn active text-[11px] py-1 rounded font-bold">全區總覽</button>
          <button onclick="setZoneHighlight('MOUNTAIN')" id="zone-btn-MOUNTAIN" class="mc-btn text-[11px] py-1 rounded font-bold flex items-center justify-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-emerald-500"></span><span>1.海岸山脈</span>
          </button>
          <button onclick="setZoneHighlight('TERRACE')" id="zone-btn-TERRACE" class="mc-btn text-[11px] py-1 rounded font-bold flex items-center justify-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-lime-400"></span><span>2.海階地形</span>
          </button>
          <button onclick="setZoneHighlight('SHORE')" id="zone-btn-SHORE" class="mc-btn text-[11px] py-1 rounded font-bold flex items-center justify-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-stone-400"></span><span>3.岩岸礫灘</span>
          </button>
          <button onclick="setZoneHighlight('INTERTIDAL')" id="zone-btn-INTERTIDAL" class="mc-btn text-[11px] py-1 rounded font-bold flex items-center justify-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-teal-400"></span><span>4.潮間帶</span>
          </button>
          <button onclick="setZoneHighlight('SHELF')" id="zone-btn-SHELF" class="mc-btn text-[11px] py-1 rounded font-bold flex items-center justify-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-sky-400"></span><span>5.大陸棚</span>
          </button>
        </div>
      </div>

      <!-- 經典東海岸地標導覽 -->
      <div class="mb-2.5">
        <div class="text-[10px] text-sky-200 font-bold mb-1.5">📸 經典東海岸地標視角：</div>
        <div class="grid grid-cols-2 gap-1.5">
          <button onclick="focusLandmark('BAXIAN')" class="mc-btn text-left p-2 rounded-lg text-xs border-amber-400/50">
            <div class="font-bold text-amber-200 text-[11px]">★ 長濱・八仙洞海蝕洞</div>
            <div class="text-[9px] text-slate-300 mt-0.5">海階岩廈・長濱文化遺址</div>
          </button>
          <button onclick="focusLandmark('PHOTO_SANXIANTAI')" class="mc-btn text-left p-2 rounded-lg text-xs border-cyan-400/50">
            <div class="font-bold text-cyan-200 text-[11px]">★ 成功・三仙台陸連島</div>
            <div class="text-[9px] text-slate-300 mt-0.5">退潮連島礫石灘・火山集塊岩島</div>
          </button>
          <button onclick="focusLandmark('SHITIPING')" class="mc-btn text-left p-2 rounded-lg text-xs">
            <div class="font-bold text-sky-200 text-[11px]">① 豐濱・石梯坪單面山</div>
            <div class="text-[9px] text-slate-300 mt-0.5">白色凝灰岩・隆起海蝕階地</div>
          </button>
          <button onclick="focusLandmark('XIUGULUAN')" class="mc-btn text-left p-2 rounded-lg text-xs">
            <div class="font-bold text-emerald-200 text-[11px]">② 大港口・秀姑巒溪口</div>
            <div class="text-[9px] text-slate-300 mt-0.5">穿山峽谷・獅球嶼火山頸</div>
          </button>
        </div>
      </div>

      <!-- 海浪節奏、地質剖面與天色調校 -->
      <div class="bg-slate-950/75 rounded-xl p-2.5 border border-slate-800 space-y-2">
        <div>
          <div class="flex justify-between items-center mb-0.5">
            <span class="text-[10px] font-bold text-slate-200">⏱️ 海浪推進速度 (週期節奏)</span>
            <span id="wave-speed-readout" class="text-[10px] font-mono text-emerald-300">真實慢湧 (0.45x)</span>
          </div>
          <input id="wave-speed-slider" type="range" min="0.15" max="1.20" step="0.05" value="0.45"
            oninput="onWaveSpeedChange(this.value)"
            class="w-full accent-emerald-400 cursor-pointer h-1.5 rounded-lg bg-slate-700"/>
        </div>

        <div>
          <div class="flex justify-between items-center mb-0.5">
            <span class="text-[10px] font-bold text-slate-200">🌊 浪高與礫灘洗岸白沫幅度</span>
            <span id="wave-height-readout" class="text-[10px] font-mono text-sky-300">東海岸晴日浪 (0.85x)</span>
          </div>
          <input id="wave-slider" type="range" min="0.3" max="1.8" step="0.05" value="0.85"
            oninput="onWaveHeightChange(this.value)"
            class="w-full accent-sky-400 cursor-pointer h-1.5 rounded-lg bg-slate-700"/>
        </div>

        <div class="border-t border-slate-800 pt-1.5">
          <div class="flex justify-between items-center mb-0.5">
            <span class="text-[10px] font-bold text-slate-200">🪨 東西向地質剖面切割 (Z軸)</span>
            <span id="slice-readout" class="text-[10px] font-mono text-amber-300">完整顯示</span>
          </div>
          <input id="slice-slider" type="range" min="-28" max="36" step="1" value="36"
            oninput="onSliceSliderChange(this.value)"
            class="w-full accent-amber-400 cursor-pointer h-1.5 rounded-lg bg-slate-700"/>
        </div>

        <div class="border-t border-slate-800 pt-1.5 flex items-center justify-between gap-1">
          <span class="text-[10px] font-bold text-slate-200">☀️ 四時天色：</span>
          <div class="flex gap-1">
            <button onclick="setTimeOfDay('NOON')" id="tod-NOON" class="mc-btn active text-[10px] px-2 py-0.5 rounded">晴空</button>
            <button onclick="setTimeOfDay('DAWN')" id="tod-DAWN" class="mc-btn text-[10px] px-2 py-0.5 rounded">晨曦</button>
            <button onclick="setTimeOfDay('DUSK')" id="tod-DUSK" class="mc-btn text-[10px] px-2 py-0.5 rounded">黃昏</button>
            <button onclick="setTimeOfDay('NIGHT')" id="tod-NIGHT" class="mc-btn text-[10px] px-2 py-0.5 rounded">星空夜景</button>
          </div>
        </div>
      </div>
    </div>
  `;
};
