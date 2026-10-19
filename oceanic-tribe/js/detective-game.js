Warning: truncated output (original token count: 37162)
Total output lines: 2428

// ============================================================================
// 「🕵️ 時空偵探」遊戲卡牌考驗系統 (Time-Space Detective Card Challenge System)
// 完整 60 題組大題庫・5/5 題不重複過關制・108 課綱素養星芒圖・貓貓歷史偵探獎狀：
// 1. 雙主題共 60 題組（台灣長濱地形 30 題組 + 台灣舊石器時期 30 題組）：
//    - 每次進入「時空偵探」考驗，系統從該主題 30 題庫中「不重複抽取 5 題」組成一局任務（5/5 題）
//    - 跨局記憶已抽過的題目池（usedPoolByTheme），確保連續玩 6 局（30 題）完全不會重複循環！
// 2. 達到 5/5 題時立即過關：
//    - 播放過關禮讚音效，自動產生學生的「108 課綱五向度學習指標能力星芒圖（五角雷達圖）」
//    - 頒發雙面「🐱 貓貓歷史偵探獎狀」：
//      * 【獎狀正面】：半透明故事場景底圖 (story-scene-bg.webp)、WebP 貓貓校長圖 (cat-principal.webp)、
//        學校紅色官印（貓貓歷史偵探學苑・校長之印）、108 課綱五角星芒圖、正向鼓勵詞與可自訂學生姓名
//      * 【獎狀背面】：本次參與課程的 5 道學習題目、作答歷程、課本省思與貓貓校長的正向鼓勵評語，並支援雙面同頁列印／下載圖檔！
// ============================================================================

const COMPETENCY_AXES = [
  { key: "obs", label: "地景觀察", code: "自po-II-1 / 社1a-II-1", desc: "細膩觀察東海岸地形、潮汐與史前遺址空間特徵" },
  { key: "reason", label: "因果推論", code: "自pa-II-1 / 社2a-II-1", desc: "推論板塊抬升、波浪侵蝕與自然環境變遷的因果關係" },
  { key: "history", label: "史前文化", code: "社1b-II-1 / 社2b-II-1", desc: "理解舊石器時代長濱文化的打製石器、骨角器與生活技能" },
  { key: "eco", label: "生態永續", code: "自ah-II-1 / 社3b-II-1", desc: "認識黑潮洋流食物鏈、潮間帶生物適應與人地和諧互動" },
  { key: "inquiry", label: "證據思辨", code: "自pe-II-1 / 社3a-II-1", desc: "根據考古遺留與地質現場證據進行邏輯判斷與課本省思" }
];

const DetectiveGameDB = [
  // ==========================================================================
  // ⛰️ 主題：台灣長濱地形（共 30 個場景題組）
  // ==========================================================================
  {
    id: "terrain_01_cave_uplift",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "社1a-II-1 認識家鄉地形與板塊抬升",
    weights: { obs: 95, reason: 100, history: 75, eco: 70, inquiry: 90 },
    title: "八仙洞的身世",
    targetLabel: "八仙洞半山腰海蝕洞穴群",
    question: "海蝕洞為什麼會在半山腰？",
    options: ["人工開鑿", "地殼抬升", "土石堆積", "火山爆發"],
    correctIndex: 1,
    reflection: "海浪先蝕出洞穴，再因板塊擠壓抬升至半山腰。",
    storyIntegration: "108課綱整合：東海岸受菲律賓海板塊與歐亞板塊擠壓不斷隆起，原本在海平面被海浪侵蝕出的海蝕洞，跟著海階抬升到半山腰，成為長濱人遮風避雨的家！",
    focusPos: [-14.8, 7.8, 5.0],
    cameraPreset: { target: [-14.0, 7.2, 2.5], radius: 20.5, theta: 1.25, phi: 1.12 },
    ringRadius: 4.2
  },
  {
    id: "terrain_02_cave_age",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自pa-II-1 從洞穴高度推論形成先後",
    weights: { obs: 90, reason: 100, history: 80, eco: 65, inquiry: 95 },
    title: "高低洞穴的年齡",
    targetLabel: "八仙洞最高層古老海蝕洞（崑崙洞／乾元洞）",
    question: "八仙洞位置越高的洞穴代表什麼？",
    options: ["形成年代越早", "形成年代越晚", "現代人挖鑿的", "風沙吹出來的"],
    correctIndex: 0,
    reflection: "陸地持續抬升，越早形成的海蝕洞會被推得越高。",
    storyIntegration: "108課綱整合：因為地殼是一階一階往上隆起抬升，最高處的洞穴最早脫離海浪侵蝕、年代最古老；越靠近現今海平面的洞穴則越晚形成！",
    focusPos: [-15.2, 9.8, 4.5],
    cameraPreset: { target: [-14.5, 8.8, 3.0], radius: 21.0, theta: 1.22, phi: 1.05 },
    ringRadius: 4.0
  },
  {
    id: "terrain_03_tombolo_low",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "社1a-II-1 觀察海岸連島沙洲與潮汐變化",
    weights: { obs: 100, reason: 90, history: 75, eco: 85, inquiry: 85 },
    title: "消失的通道",
    targetLabel: "三仙台退潮連島礫石沙洲",
    question: "退潮相連、滿潮淹沒的地形稱作？",
    options: ["海蝕柱", "豆腐岩", "陸連島", "珊瑚礁"],
    correctIndex: 2,
    reflection: "波浪堆積泥沙礫石形成沙頸岬，退潮時便能踏浪登島。",
    storyIntegration: "108課綱整合：海浪在三仙台離岸島與本島之間堆積出「連島礫石沙洲（沙頸岬）」，形成「陸連島」，退潮露出礫石通道時就能徒步走過去！",
    focusPos: [7.5, 0.2, 16.0],
    cameraPreset: { target: [8.5, 1.2, 14.5], radius: 22.0, theta: -2.55, phi: 1.20 },
    ringRadius: 4.8,
    forceSeaLevel: -1.25
  },
  {
    id: "terrain_04_tombolo_high",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自po-II-1 觀察漲潮對海岸通道的影響",
    weights: { obs: 95, reason: 95, history: 70, eco: 85, inquiry: 85 },
    title: "滿潮的三仙台",
    targetLabel: "滿潮海水淹沒的三仙台連島沙洲水道",
    question: "漲滿潮時三仙台連島沙洲會如何？",
    options: ["海水淹沒阻隔", "隆起變成高山", "結冰變成冰橋", "長出茂密森林"],
    correctIndex: 0,
    reflection: "滿潮時海水漫過連島沙洲，三仙台暫時變回離岸島。",
    storyIntegration: "108課綱整合：舊石器時代沒有現代八拱橋，每當漲潮海平面上升，海水就會淹沒低平的連島礫石礁脊，族人必須觀察潮汐、等待退潮才能安全通行。",
    focusPos: [7.5, 0.8, 16.0],
    cameraPreset: { target: [8.5, 1.5, 15.0], radius: 22.5, theta: -2.48, phi: 1.18 },
    ringRadius: 4.8,
    forceSeaLevel: 0.95
  },
  {
    id: "terrain_05_terrace",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "社1a-II-1 認識花東海岸海階台地",
    weights: { obs: 95, reason: 95, history: 75, eco: 75, inquiry: 90 },
    title: "階梯狀海岸",
    targetLabel: "海岸山脈東側隆起的海階台地",
    question: "山脈與海邊像階梯的平坦地形是？",
    options: ["海階地形", "潟湖沙洲", "盆地地形", "火山口湖"],
    correctIndex: 0,
    reflection: "原本的海蝕平台因陸地間歇抬升，變成階梯狀海階。",
    storyIntegration: "108課綱整合：從豐濱新社到長濱、成功，原本貼近海面的海蝕平台受到地殼多次隆起抬升，形成一階一階平坦的「海階台地」，是長濱海岸最經典的地形！",
    focusPos: [-14.0, 9.5, -14.0],
    cameraPreset: { target: [-12.0, 8.0, -12.0], radius: 28.0, theta: 0.92, phi: 1.08 },
    ringRadius: 4.8
  },
  {
    id: "terrain_06_pebble_beach",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自pa-II-1 推論海浪搬運與磨圓作用",
    weights: { obs: 95, reason: 95, history: 80, eco: 75, inquiry: 85 },
    title: "圓滾滾的礫石灘",
    targetLabel: "東海岸灰黑扁圓鵝卵石礫灘",
    question: "長濱海邊的石頭為什麼扁圓光滑？",
    options: ["海浪來回沖刷", "長濱人磨平的", "天上掉下隕石", "海龜踩扁的"],
    correctIndex: 0,
    reflection: "崩落岩塊經東海岸強勁海浪長年翻滾互撞磨成鵝卵石。",
    storyIntegration: "108課綱整合：東海岸波浪強勁，溪流帶下或海崖崩落的稜角石塊，在岸邊受海浪日夜拍打翻滾、互相摩擦碰撞，磨去稜角成為灰黑色的扁圓礫石灘。",
    focusPos: [4.5, 1.2, 10.5],
    cameraPreset: { target: [4.5, 1.2, 10.0], radius: 13.5, theta: -2.35, phi: 1.15 },
    ringRadius: 3.6
  },
  {
    id: "terrain_07_sanxiantai_rock",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自po-II-1 認識都巒山層火山集塊岩與差異侵蝕",
    weights: { obs: 90, reason: 95, history: 70, eco: 75, inquiry: 95 },
    title: "三仙台的奇岩",
    targetLabel: "三仙台島上的都巒山層火山集塊岩三峰",
    question: "三仙台島上耐海浪侵蝕的岩石是？",
    options: ["火山集塊岩", "鬆軟的黃土", "細白石英砂", "人工水泥塊"],
    correctIndex: 0,
    reflection: "都巒山層火山集塊岩質地堅硬，抗蝕留在海邊成島。",
    storyIntegration: "108課綱整合：三仙台與八仙洞主要由海底火山噴發形成的「都巒山層火山集塊岩」構成，因比周圍岩層更堅硬耐海浪拍打，才未被侵蝕殆盡而留存成島！",
    focusPos: [11.5, 4.5, 20.0],
    cameraPreset: { target: [11.0, 3.0, 19.5], radius: 24.0, theta: -2.40, phi: 1.18 },
    ringRadius: 4.6
  },
  {
    id: "terrain_08_shitiping_pothole",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自pa-II-1 認識石梯坪海蝕平台與海蝕壺穴成因",
    weights: { obs: 95, reason: 95, history: 70, eco: 80, inquiry: 90 },
    title: "石梯坪的圓洞",
    targetLabel: "石梯坪白色凝灰岩單面山與海蝕壺穴",
    question: "石梯坪海蝕平台上圓形的凹洞是？",
    options: ["海蝕壺穴", "人工水井", "恐龍腳印", "隕石坑洞"],
    correctIndex: 0,
    reflection: "海浪帶動石礫在岩面凹處打轉磨蝕出圓形海蝕壺穴。",
    storyIntegration: "108課綱整合：石梯坪擁有潔白的凝灰岩單面山與海蝕平台，當海浪夾帶堅硬石礫落入岩面凹陷處不斷旋轉研磨，就鑽蝕出深圓的「海蝕壺穴」！",
    focusPos: [3.0, 1.5, -20.0],
    cameraPreset: { target: [3.0, 1.5, -20.0], radius: 26.0, theta: 0.68, phi: 1.08 },
    ringRadius: 4.4
  },
  {
    id: "terrain_09_intertidal_adapt",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自ah-II-1 認識潮間帶生物對強浪環境的適應",
    weights: { obs: 95, reason: 85, history: 70, eco: 100, inquiry: 85 },
    title: "潮池耐浪高手",
    targetLabel: "潮間帶珊瑚藻礁潮池與耐浪生物群",
    question: "潮間帶礁岩生物如何抵抗強浪？",
    options: ["緊緊吸附岩石", "築高牆擋海浪", "每天飛上樹梢", "潛入地心深處"],
    correctIndex: 0,
    reflection: "藤壺、笠螺緊貼礁石，跳跳魚與螃蟹則躲進潮池岩縫。",
    storyIntegration: "108課綱整合：東海岸潮間帶每天承受強浪拍打與退潮烈日，因此藤壺、笠螺演化出強大吸附力，蛙䲁（跳跳魚）與螃蟹則在退潮潮池中覓食躲藏。",
    focusPos: [8.0, 0.3, 14.5],
    cameraPreset: { target: [8.0, 0.3, 14.0], radius: 10.5, theta: -2.30, phi: 1.12 },
    ringRadius: 3.2,
    forceSeaLevel: -0.95
  },
  {
    id: "terrain_10_kuroshio_shelf",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "社1a-II-1 認識東部斷層海岸極窄大陸棚與黑潮",
    weights: { obs: 90, reason: 95, history: 75, eco: 100, inquiry: 90 },
    title: "緊貼岸邊的黑潮",
    targetLabel: "極窄大陸棚與外海黑潮：飛魚、鬼頭刀、黃鰭鮪",
    question: "為什麼黑潮大魚離長濱海岸這麼近？",
    options: ["大陸棚極狹窄", "海底全是淺灘", "人工挖深海溝", "海水完全靜止"],
    correctIndex: 0,
    reflection: "東海岸大陸棚極窄、離岸即深海，黑潮暖流緊貼岸邊。",
    storyIntegration: "108課綱整合：台灣東部屬於斷層海岸，大陸棚非常狹窄，離岸不遠即驟降至深海，因此溫暖的黑潮主流緊貼海岸北上，帶來飛魚、鬼頭刀與黃鰭鮪魚！",
    focusPos: [23.0, -0.5, 10.0],
    cameraPreset: { target: [23.0, -0.5, 10.0], radius: 16.5, theta: 1.05, phi: 1.12 },
    ringRadius: 4.2,
    followSpecies: "MIGRATION_CHAIN"
  },
  {
    id: "terrain_11_kuroshio_chain",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自ah-II-1 觀察黑潮海洋食物鏈的掠食關係",
    weights: { obs: 95, reason: 90, history: 70, eco: 100, inquiry: 85 },
    title: "黑潮追逐戰",
    targetLabel: "外海黑潮表層：鬼頭刀追擊飛魚群",
    question: "黑潮裡鬼頭刀緊追捕食的獵物是？",
    options: ["滑翔的飛魚", "深海燈籠魚", "潮池跳跳魚", "森林裡的山羌"],
    correctIndex: 0,
    reflection: "鬼頭刀擅長高速衝刺，專捕躍出水面滑翔的飛魚。",
    storyIntegration: "108課綱整合：黑潮帶來豐富的浮游生物與飛魚群，俗稱「飛烏虎」的鬼頭刀會緊追飛魚躍水捕食，而更大型的黃鰭鮪魚則會從深水突襲捕食鬼頭刀！",
    focusPos: [23.0, -0.5, 10.0],
    cameraPreset: { target: [23.0, -0.5, 10.0], radius: 15.0, theta: 1.08, phi: 1.12 },
    ringRadius: 4.0,
    followSpecies: "MIGRATION_CHAIN"
  },
  {
    id: "terrain_12_tuna_predator",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自ah-II-1 認識海洋食物鏈高階掠食者",
    weights: { obs: 90, reason: 90, history: 70, eco: 100, inquiry: 90 },
    title: "深海突襲霸主",
    targetLabel: "外海黑潮深水層：大型黃鰭鮪魚突襲鬼頭刀",
    question: "黑潮中會從深水衝上來抓鬼頭刀吃的是？",
    options: ["大型黃鰭鮪魚", "潮間帶笠螺", "彩色小丑魚", "淡水小溪哥"],
    correctIndex: 0,
    reflection: "流線型的大型黃鰭鮪魚游速極快，是捕食鬼頭刀的頂級掠食者。",
    storyIntegration: "108課綱整合：在東海岸外海的黑潮生態系中，形成「飛魚 ➔ 鬼頭刀 ➔ 大型黃鰭鮪魚」的三層海洋食物鏈，展現海洋生態的能量流動！",
    focusPos: [23.5, -1.0, 12.0],
    cameraPreset: { target: [23.5, -1.0, 12.0], radius: 16.0, theta: -1.75, phi: 1.12 },
    ringRadius: 4.2,
    followSpecies: "MIGRATION_CHAIN"
  },
  {
    id: "terrain_13_coastal_mountain",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "社1a-II-1 認識花東海岸山脈地景",
    weights: { obs: 95, reason: 90, history: 75, eco: 85, inquiry: 85 },
    title: "緊貼大海的山脈",
    targetLabel: "長濱西側高聳陡峭的海岸山脈",
    question: "長濱西側緊鄰太平洋的高聳山脈是？",
    options: ["海岸山脈", "阿里山山脈", "大屯火山群", "八卦台地"],
    correctIndex: 0,
    reflection: "花東沿海緊靠陡峭的海岸山脈，呈現山海相依的地景。",
    storyIntegration: "108課綱整合：台東長濱與成功背靠陡峭的「海岸山脈」、面向浩瀚太平洋，山林與海洋距離極近，提供史前人類同時具備山林狩獵與海岸採集的環境！",
    focusPos: [-22.0, 16.0, 0.0],
    cameraPreset: { target: [-18.0, 12.0, 0.0], radius: 36.0, theta: 1.05, phi: 1.08 },
    ringRadius: 5.5
  },
  {
    id: "terrain_14_xiuguluan_river",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "社1a-II-1 認識秀姑巒溪穿山入海與獅球嶼",
    weights: { obs: 95, reason: 95, history: 75, eco: 85, inquiry: 90 },
    title: "穿山入海的溪流",
    targetLabel: "大港口秀姑巒溪出海口與河口獅球嶼",
    question: "切穿海岸山脈流入太平洋的溪流是？",
    options: ["秀姑巒溪", "淡水河主流", "高屏溪主流", "濁水溪主流"],
    correctIndex: 0,
    reflection: "秀姑巒溪橫切海岸山脈於大港口入海，形成壯麗峽谷與河口。",
    storyIntegration: "108課綱整合：秀姑巒溪是東部唯一切穿海岸山脈的河川，在豐濱大港口出海，河口中央矗立著堅硬火山集塊岩構成的「獅球嶼（奚卜蘭島）」！",
    focusPos: [-2.0, 2.0, -8.0],
    cameraPreset: { target: [-2.0, 2.0, -8.0], radius: 32.0, theta: 0.85, phi: 1.04 },
    ringRadius: 4.8
  },
  {
    id: "terrain_15_cuesta_rock",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自po-II-1 觀察石梯坪傾斜單面山地形",
    weights: { obs: 100, reason: 90, history: 70, eco: 75, inquiry: 90 },
    title: "一側陡一側緩的岩坡",
    targetLabel: "石梯坪向海緩傾、向陸陡峭的單面山",
    question: "石梯坪一邊緩斜、一邊陡峭的地形是？",
    options: ["單面山地形", "冰河峽灣", "沙漠新月丘", "石灰岩鐘乳洞"],
    correctIndex: 0,
    reflection: "傾斜岩層受海浪差異侵蝕，形成一側緩坡一側陡崖的單面山。",
    storyIntegration: "108課綱整合：石梯坪的白色火山凝灰岩層因板塊推擠而傾斜，經海浪長年侵蝕後，形成一邊緩緩傾向大海、另一邊陡峭如階梯的「單面山」奇景！",
    focusPos: [2.0, 2.2, -19.0],
    cameraPreset: { target: [2.0, 2.0, -19.0], radius: 24.0, theta: 0.72, phi: 1.08 },
    ringRadius: 4.2
  },
  {
    id: "terrain_16_algal_reef",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自ah-II-1 認識三仙台周邊珊瑚藻礁生態",
    weights: { obs: 90, reason: 85, history: 75, eco: 100, inquiry: 85 },
    title: "潮間帶的天然防波堤",
    targetLabel: "三仙台連島沙洲兩側的珊瑚礁與藻礁淺坪",
    question: "三仙台淺海能減緩巨浪、孕育魚蝦的是？",
    options: ["珊瑚與藻礁坪", "水泥消波塊", "塑膠人工草皮", "地下鐵路隧道"],
    correctIndex: 0,
    reflection: "珊瑚礁與藻礁不僅能消減強浪能量，更是潮間帶生物的搖籃。",
    storyIntegration: "108課綱整合：三仙台岬灣周圍發育了豐富的珊瑚礁與藻礁平台，不僅幫忙減緩海浪衝擊、穩定連島礫石沙洲，更提供魚蝦貝類豐富的棲息空間！",
    focusPos: [9.5, 0.2, 14.5],
    cameraPreset: { target: [9.5, 0.5, 14.5], radius: 14.0, theta: -2.35, phi: 1.15 },
    ringRadius: 3.8,
    forceSeaLevel: -0.85
  },
  {
    id: "terrain_17_sea_turtle",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自ah-II-1 認識東海岸保育類綠蠵龜與藻礁",
    weights: { obs: 95, reason: 80, history: 70, eco: 100, inquiry: 85 },
    title: "礁岩邊的海洋訪客",
    targetLabel: "近海珊瑚礁區覓食海藻的綠蠵龜",
    question: "會游到長濱與三仙台近海礁岩吃海藻的是？",
    options: ["保育類綠蠵龜", "北極圈北極熊", "非洲大河馬", "高山台灣黑熊"],
    correctIndex: 0,
    reflection: "綠蠵龜喜愛在溫暖乾淨的東海岸礁岩區覓食海藻。",
    storyIntegration: "108課綱整合：東海岸水質清澈且礁岩長滿海菜與海藻，吸引海龜（如綠蠵龜）前來覓食，提醒我們共同守護海洋生態與海岸整潔！",
    focusPos: [18.0, -1.0, 16.0],
    cameraPreset: { target: [18.0, -1.0, 16.0], radius: 13.0, theta: -2.20, phi: 1.12 },
    ringRadius: 3.5
  },
  {
    id: "terrain_18_wave_foam",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自po-II-1 觀察淺灘地形對碎浪白沫的影響",
    weights: { obs: 100, reason: 95, history: 65, eco: 80, inquiry: 90 },
    title: "白色的浪花蕾絲",
    targetLabel: "三仙台淺坪與礫石灘拍岸的白色碎浪沫",
    question: "海浪湧向三仙台淺灘時為什麼會捲起白沫？",
    options: ["水變淺浪碎裂", "海裡倒了肥皂", "海底在噴白煙", "魚群在吐泡泡"],
    correctIndex: 0,
    reflection: "深海湧浪進入淺水礁坪與礫灘時，底部受阻碎裂捲入空氣成白浪。",
    storyIntegration: "108課綱整合：當太平洋長浪推進到三仙台周圍淺水礁坪與連島沙洲時，水深驟減使波浪前緣崩碎並混入大量空氣，形成層層潔白如蕾絲的浪花！",
    focusPos: [11.0, 0.3, 15.0],
    cameraPreset: { target: [10.0, 0.8, 15.5], radius: 18.0, theta: -2.50, phi: 1.18 },
    ringRadius: 4.2,
    forceSeaLevel: 0.10
  },
  {
    id: "terrain_19_wave_refraction",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "自pa-II-1 推論離岸島波影區如何堆積出連島沙洲",
    weights: { obs: 90, reason: 100, history: 70, eco: 80, inquiry: 95 },
    title: "三仙台背後的避風港",
    targetLabel: "三仙台島後方波浪減弱堆積的連島沙頸岬",
    question: "為什麼礫石會堆積在三仙台島與本島之間？",
    options: ["島嶼擋浪減速", "族人用車載來", "鯨魚幫忙推石", "海底磁鐵吸引"],
    correctIndex: 0,
    reflection: "離岸島阻擋外海強浪，島後波浪能量減弱使礫石泥沙自然堆積。",
    storyIntegration: "108課綱整合：三仙台島就像海上的天然擋浪牆，海浪繞過島嶼後方時流速變慢、搬運力下降，石礫便在島後與本島之間堆積成連島沙洲（陸連島）！",
    focusPos: [7.5, 0.2, 16.0],
    cameraPreset: { target: [8.0, 1.2, 16.0], radius: 21.0, theta: -2.60, phi: 1.20 },
    ringRadius: 4.6,
    forceSeaLevel: -1.25
  },
  {
    id: "terrain_20_five_zones",
    categoryId: "TERRAIN",
    categoryName: "台灣長濱地形",
    indicator: "社1a-II-1 統整東海岸五帶橫剖面地景結構",
    weights: { obs: 100, reason: 95, history: 85, eco: 90, inquiry: 95 },
    title: "山海五帶大縱走",
    targetLabel: "從海岸山脈、海階、礫灘、潮間帶到黑潮的五帶剖面",
    question: "從長濱山上走到外海，地景順序何者正確？",
    options: ["山脈→海階→海", "深海→山脈→灘", "沙漠→冰原→海", "盆地→火山→湖"],
    correctIndex: 0,
    reflection: "東海岸由西向東依序為：海岸山脈、海階台地、礫灘、潮間帶與黑潮。",
    storyIntegration: "108課綱整合：觀察右下角橫剖面圖，花東海岸在短短數公里內濃縮了「海岸山脈 ➔ 海階台地（八仙洞）➔ 礫石灘 ➔ 潮間帶陸連島 ➔ 大陸棚與黑潮」五帶地景！",
    focusPos: [4.0, 2.0, 4.0],
    cameraPreset: { target: [4.0, 2.0, 4.0], radius: 52.0, theta: 0.78, phi: 1.08 },
    ringRadius: 6.0
  },

  // ==========================================================================
  // 🏛️ 主題：台灣舊石器時期（共 30 個場景題組）
  // ==========================================================================
  {
    id: "culture_01_pebble_tool",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 認識舊石器時代長濱文化打製石器",
    weights: { obs: 95, reason: 90, history: 100, eco: 75, inquiry: 95 },
    title: "舊石器工藝",
    targetLabel: "八仙洞下層平台：敲擊礫石製器族人",
    question: "長濱人如何製作石頭工具？",
    options: ["敲打鵝卵石", "表面磨光滑", "冶煉青銅器", "雕刻玉石"],
    correctIndex: 0,
    reflection: "舊石器時代使用打製石器，尚未發明磨製技術。",
    storyIntegration: "108課綱整合：長濱文化屬於舊石器時代晚期，族人撿拾海邊堅硬的鵝卵石直接互相敲打，打出鋒利石片與礫石砍伐器，還不會磨製石器喔！",
    focusPos: [-4.5, 4.2, 4.5],
    cameraPreset: { target: [-4.5, 4.0, 2.8], radius: 9.2, theta: 1.18, phi: 1.10 },
    ringRadius: 2.5
  },
  {
    id: "culture_02_fire_skill",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 認識舊石器時代用火技能與無陶器特徵",
    weights: { obs: 95, reason: 90, history: 100, eco: 75, inquiry: 95 },
    title: "火堆的秘密",
    targetLabel: "潮音洞口：圍火烤食與取暖火塘",
    question: "洞穴裡的火堆代表掌握了哪項技能？",
    options: ["燒製陶器", "熟食與取暖", "焚林整地", "冶煉金屬"],
    correctIndex: 1,
    reflection: "長濱人已懂得用火取暖與熟食，但尚未發明陶器。",
    storyIntegration: "108課綱整合：八仙洞遺址留有灰燼與燒烤獸骨，證明舊石器時代的長濱人已知用火烤熟食物、夜晚照明取暖並驅趕野獸，但當時還沒有發明陶器。",
    focusPos: [-11.2, 5.8, 5.0],
    cameraPreset: { target: [-11.2, 5.8, 3.2], radius: 9.5, theta: 1.26, phi: 1.12 },
    ringRadius: 2.6
  },
  {
    id: "culture_03_food_no_rice",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 比較舊石器採集漁獵與新石器農業差異",
    weights: { obs: 90, reason: 95, history: 100, eco: 85, inquiry: 100 },
    title: "海邊的採集",
    targetLabel: "潮間帶礁岩：採海菜拾貝與捕魚族人",
    question: "下列哪一種不是長濱人的主要食物？",
    options: ["近海魚類", "潮間帶貝類", "田裡的稻米", "山裡的野獸"],
    correctIndex: 2,
    reflection: "舊石器時代靠採集與狩獵生活，尚未發展農業。",
    storyIntegration: "108課綱整合：長濱人過著「採集與漁獵」生活——女人在海邊潮間帶撿海菜與螺貝、男人在岸邊釣魚或山林獵山豬山羌；種植稻米的農業要到新石器時代才會出現！",
    focusPos: [4.8, 1.0, 4.2],
    cameraPreset: { target: [4.8, 1.2, 2.5], radius: 12.0, theta: 0.95, phi: 1.12 },
    ringRadius: 3.5
  },
  {
    id: "culture_04_bone_tools",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 認識長濱文化骨角器工藝",
    weights: { obs: 90, reason: 85, history: 100, eco: 85, inquiry: 95 },
    title: "漁獵與骨器",
    targetLabel: "八仙洞周邊山林：狩獵山豬與山羌的族人",
    question: "長濱人除了打製石器還會用什麼工具？",
    options: ["骨角器漁獵", "鐵犁耕水田", "玻璃珠交易", "火藥槍射擊"],
    correctIndex: 0,
    reflection: "長濱文化善用獸骨磨製魚鉤與倒鉤骨叉來漁獵。",
    storyIntegration: "108課綱整合：八仙洞出土許多精緻的「骨角器」（雙尖骨針魚鉤、倒鉤骨叉、骨鑿），證明長濱人懂得利用獵物獸骨製作精巧的捕魚與狩獵工具！",
    focusPos: [-13.5, 11.2, 2.0],
    cameraPreset: { target: [-13.5, 10.5, 0.5], radius: 15.5, theta: 1.15, phi: 1.08 },
    ringRadius: 3.6
  },
  {
    id: "culture_05_cave_shelter",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 認識舊石器時代天然穴居型態",
    weights: { obs: 95, reason: 90, history: 100, eco: 80, inquiry: 90 },
    title: "天然穴居生活",
    targetLabel: "八仙洞潮音洞與永安洞穴居聚落",
    question: "長濱人主要居住在什麼地方？",
    options: ["天然海蝕洞穴", "紅磚瓦房舍", "鋼筋水泥樓", "水上高腳屋"],
    correctIndex: 0,
    reflection: "舊石器時代尚未建造房屋，選擇天然海蝕洞穴居住。",
    storyIntegration: "108課綱整合：長濱人尚未發展出蓋房子的建築技術，八仙洞半山腰乾燥、通風且視野良好的天然海蝕洞穴，就是他們最安全的聚落家園！",
    focusPos: [-12.5, 6.2, 4.5],
    cameraPreset: { target: [-12.0, 6.0, 3.0], radius: 14.0, theta: 1.30, phi: 1.14 },
    ringRadius: 3.5
  },
  {
    id: "culture_06_bark_vine",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社2b-II-1 認識史前人類利用自然植物編織製衣",
    weights: { obs: 95, reason: 85, history: 100, eco: 90, inquiry: 85 },
    title: "樹皮衣與藤繩",
    targetLabel: "洞口平台：打擊樹皮製衣與編織藤繩族人",
    question: "長濱人如何利用植物做衣服與繩子？",
    options: ["打樹皮編藤繩", "紡織蠶絲綢緞", "種植棉花織布", "合成尼龍纖維"],
    correctIndex: 0,
    reflection: "利用石拍敲打構樹皮製衣，並揉捻黃藤編織堅韌藤繩。",
    storyIntegration: "108課綱整合：在尚未發明紡織機的舊石器時期，族人就地取材剝取構樹內皮拍打成柔軟樹皮布遮體，並採集山林黃藤與月桃編織捆綁用的繩索。",
    focusPos: [-9.2, 6.0, 1.6],
    cameraPreset: { target: [-9.2, 6.0, 0.8], radius: 8.2, theta: 1.15, phi: 1.12 },
    ringRadius: 2.4
  },
  {
    id: "culture_07_wood_gather",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 認識史前人類保存火種與採薪生活",
    weights: { obs: 90, reason: 90, history: 95, eco: 85, inquiry: 85 },
    title: "採集薪柴護火",
    targetLabel: "八仙洞北側草坡：採集枯木薪柴的族人",
    question: "族人在洞穴旁撿拾枯木的主要用途是？",
    options: ["維持火塘不滅", "建造大型帆船", "蓋木造大城堡", "製造印刷紙張"],
    correctIndex: 0,
    reflection: "舊石器時代生火不易，需持續添柴保存洞口火種。",
    storyIntegration: "108課綱整合：對史前人類而言「火種」極為珍貴，因此族人會在穴居地周邊山坡採集乾燥漂流木與枯枝，日夜維持洞口火塘燃燒以供烤食與驅獸。",
    focusPos: [-10.5, 6.0, -1.5],
    cameraPreset: { target: [-10.5, 6.0, -2.2], radius: 9.0, theta: 1.25, phi: 1.14 },
    ringRadius: 2.5
  },
  {
    id: "culture_08_women_forage",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社3b-II-1 認識海岸潮間帶採集與海洋資源利用",
    weights: { obs: 95, reason: 85, history: 95, eco: 100, inquiry: 90 },
    title: "退潮海產採集",
    targetLabel: "潮間帶與連島礫灘：撿拾海菜與貝類的女性",
    question: "退潮時女性族人在海邊礁石採集什麼？",
    options: ["海菜與螺貝類", "深海大鯨魚", "海底石油礦", "珍珠項鍊盒"],
    correctIndex: 0,
    reflection: "潮間帶退潮裸露的礁岩提供豐富的海菜、笠螺與海膽。",
    storyIntegration: "108課綱整合：八仙洞文化層中發現大量貝殼與魚骨遺留，顯示潮間帶採集是長濱人最穩定的食物來源，退潮時更能走上三仙台連島沙洲撿拾海產！",
    focusPos: [3.8, 1.2, 2.8],
    cameraPreset: { target: [3.8, 1.2, 2.0], radius: 10.5, theta: 1.05, phi: 1.12 },
    ringRadius: 3.0,
    forceSeaLevel: -1.15
  },
  {
    id: "culture_09_men_fishing",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 認識雙尖骨針魚鉤與近海漁撈技術",
    weights: { obs: 95, reason: 85, history: 100, eco: 90, inquiry: 90 },
    title: "近海竹筏垂釣",
    targetLabel: "近海礁石與海面：木拼舢舨與岸邊垂釣族人",
    question: "男性族人如何在東海岸近海捕魚？",
    options: ["骨鉤垂釣刺魚", "使用聲納雷達", "駕駛鐵殼漁船", "投擲炸藥炸魚"],
    correctIndex: 0,
    reflection: "以藤繩綁縛木拼竹筏，用雙尖骨針魚鉤與骨叉捕魚。",
    storyIntegration: "108課綱整合：八仙洞出土了台灣最早的「雙尖骨針（魚鉤）」與倒鉤骨叉，族人站在礁石岸邊或乘簡易木拼浮具，在黑潮近岸捕撈洄游魚類！",
    focusPos: [7.2, 1.2, 5.8],
    cameraPreset: { target: [7.2, 1.2, 5.0], radius: 11.0, theta: 0.85, phi: 1.14 },
    ringRadius: 3.2
  },
  {
    id: "culture_10_dusk_routine",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社2a-II-1 觀察史前人類順應自然日夜的作息",
    weights: { obs: 95, reason: 95, history: 95, eco: 90, inquiry: 85 },
    title: "日落歸巢作息",
    targetLabel: "黃昏與夜晚：全體族人歸巢圍火晚餐與入洞安眠",
    question: "太陽下山入夜後，外出的長濱人會？",
    options: ["回洞圍火睡覺", "點電燈耕水田", "開汽車去夜市", "整晚深海游泳"],
    correctIndex: 0,
    reflection: "史前人類順應日夜作息，黃昏歸巢圍火共食、夜晚入洞安眠。",
    storyIntegration: "108課綱整合：舊石器時代沒有電力照明，夜晚山林與海邊充滿危險，族人遵循日出而作、日落而息的規律，在黃昏時帶著獵物與海產回到八仙洞圍火晚餐並入洞睡覺。",
    focusPos: [-11.4, 5.8, 4.4],
    cameraPreset: { target: [-11.4, 5.8, 3.2], radius: 13.0, theta: 1.35, phi: 1.15 },
    ringRadius: 3.4,
    forceTimeOfDay: "DUSK"
  },
  {
    id: "culture_11_chopper_use",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社3a-II-1 從石器形制推論礫石砍伐器用途",
    weights: { obs: 90, reason: 95, history: 100, eco: 75, inquiry: 100 },
    title: "礫石砍伐器的用途",
    targetLabel: "八仙洞敲石平台：單面打出刃口的礫石砍伐器",
    question: "長濱人敲打出鋒利邊緣的石器主要用來？",
    options: ["切割獸肉砍木", "修理電腦晶片", "車削金屬螺絲", "鏡面拋光鑽石"],
    correctIndex: 0,
    reflection: "打製出的礫石砍伐器與石片器，可切肉、刮獸皮與砍削木竹。",
    storyIntegration: "108課綱整合：長濱文化的代表石器是「礫石砍伐器」與薄銳的「石片器」，雖然外型古樸，卻能有效率地切開獵物皮肉、敲骨取髓與砍削木竹製作長矛！",
    focusPos: [-4.5, 4.2, 4.5],
    cameraPreset: { target: [-4.5, 4.0, 3.2], radius: 8.5, theta: 1.22, phi: 1.10 },
    ringRadius: 2.4
  },
  {
    id: "culture_12_boar_muntjac",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 認識長濱文化山林狩獵物種",
    weights: { obs: 95, reason: 85, history: 95, eco: 95, inquiry: 90 },
    title: "山林圍獵行動",
    targetLabel: "八仙洞周邊山林：獵人包抄圍獵台灣野豬與山羌",
    question: "長濱獵人在山林中主要追捕哪些獵物？",
    options: ["山豬與山羌", "非洲長頸鹿", "南極皇帝企鵝", "澳洲大袋鼠"],
    correctIndex: 0,
    reflection: "台灣本土山林常見的野豬、山羌與水鹿是長濱人的主要獵物。",
    storyIntegration: "108課綱整合：考古學家在八仙洞遺址中發掘出許多台灣野豬、山羌、鹿與猴類的骨骼遺留，證明長濱獵人熟稔穴居地周圍山林的動物習性並進行團隊圍獵！",
    focusPos: [-12.0, 9.5, 2.0],
    cameraPreset: { target: [-12.0, 9.0, 1.5], radius: 14.5, theta: 1.18, phi: 1.08 },
    ringRadius: 3.6
  },
  {
    id: "culture_13_no_pottery",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社3a-II-1 辨別舊石器時代與新石器時代器物差異",
    weights: { obs: 85, reason: 95, history: 100, eco: 70, inquiry: 100 },
    title: "還沒有陶器的時代",
    targetLabel: "潮音洞口：直接架在火堆上燒烤魚肉的火塘",
    question: "長濱人還不會做陶器，如何把食物弄熟？",
    options: ["火堆直接燒烤", "用微波爐加熱", "放進鐵鍋快炒", "用陶甕慢火燉"],
    correctIndex: 0,
    reflection: "舊石器時代尚無陶器與金屬鍋具，主要以火塘直接燒烤或石板烘烤。",
    storyIntegration: "108課綱整合：長濱文化被稱為「先陶文化」（還沒有陶器的時代），族人捕獲的魚類、貝類與山豬肉，都是串在木枝上直接架在營火旁燒烤熟食！",
    focusPos: [-11.2, 5.8, 5.0],
    cameraPreset: { target: [-11.2, 5.8, 3.8], radius: 9.0, theta: 1.32, phi: 1.12 },
    ringRadius: 2.6
  },
  {
    id: "culture_14_bone_needle",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 認識八仙洞出土雙尖骨針（魚鉤）",
    weights: { obs: 90, reason: 90, history: 100, eco: 85, inquiry: 95 },
    title: "獸骨變身釣魚鉤",
    targetLabel: "海邊垂釣族人手中的骨製釣鉤與藤線",
    question: "八仙洞出土兩端磨尖的「雙尖骨針」用途是？",
    options: ["綁線釣魚的鉤", "注射藥水針筒", "指南針看方向", "避雷針防閃電"],
    correctIndex: 0,
    reflection: "雙尖骨針中央綁上藤線並套上魚餌，魚吞食後便會卡住成為魚鉤。",
    storyIntegration: "108課綱整合：八仙洞出土了細緻的「雙尖骨針」，考古學家研究發現這是舊石器時代巧妙的「直鉤（喉鉤）」，綁上強韌植物纖維就能在海岸垂釣大魚！",
    focusPos: [7.2, 1.2, 5.8],
    cameraPreset: { target: [7.2, 1.2, 5.0], radius: 10.0, theta: 0.90, phi: 1.12 },
    ringRadius: 3.0
  },
  {
    id: "culture_15_tombolo_forage",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社2a-II-1 理解史前人類配合潮汐規律採集",
    weights: { obs: 100, reason: 95, history: 95, eco: 95, inquiry: 90 },
    title: "看潮水走陸連島",
    targetLabel: "退潮時踏上三仙台連島礫石沙洲採集的族人",
    question: "長濱族人什麼時候才能走過礫石沙洲登島？",
    options: ["退潮露通道時", "滿潮浪最大時", "颱風暴潮來時", "半夜漲滿潮時"],
    correctIndex: 0,
    reflection: "族人觀察潮汐漲退，趁乾潮連島礫石脊裸露時徒步登島採集。",
    storyIntegration: "108課綱整合：史前人類是敏銳的自然觀察家，他們知道每天退潮時三仙台與本島之間的連島礫石通道會浮現，便趁退潮前往潮池採集滿滿的螺貝與海菜！",
    focusPos: [7.5, 0.2, 16.0],
    cameraPreset: { target: [7.5, 1.0, 15.0], radius: 19.0, theta: -2.55, phi: 1.18 },
    ringRadius: 4.5,
    forceSeaLevel: -1.25
  },
  {
    id: "culture_16_night_cave_safety",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社1b-II-1 理解海蝕洞火塘在夜晚的防護功能",
    weights: { obs: 95, reason: 95, history: 95, eco: 85, inquiry: 90 },
    title: "星空下的守護火光",
    targetLabel: "夜晚星空下：八仙洞口熊熊燃燒的營火與熟睡族人",
    question: "夜晚族人在八仙洞口生火睡覺的好處是？",
    options: ["保暖驅趕野獸", "吸引外星飛船", "幫海浪照鏡子", "給稻田照日光"],
    correctIndex: 0,
    reflection: "洞口營火能在寒夜提供溫暖，並防止山林野獸靠近洞穴。",
    storyIntegration: "108課綱整合：夜晚海風微涼且山林有野獸出沒，長濱族人睡在乾燥的半山腰海蝕洞內，並在洞口維持營火燃燒，既能保暖又能守護全族人的安全！",
    focusPos: [-12.2, 6.2, 3.8],
    cameraPreset: { target: [-12.2, 6.2, 3.5], radius: 15.5, theta: 1.32, phi: 1.12 },
    ringRadius: 3.5,
    forceTimeOfDay: "NIGHT"
  },
  {
    id: "culture_17_stone_material",
    categoryId: "CULTURE",
    categoryName: "台灣舊石器時期",
    indicator: "社3a-II-1 探究長濱人就地取材的石器原料",
    weights: { obs: 90, reason: 95, history: 95, eco: 85, inquiry: 100 },
    title: "就地取材的好石頭",
    targetLabel: "東海岸礫石灘與敲石平台上的砂岩、安山岩礫石",
    question: "長濱人打製石器的石頭主要從哪裡撿來？",
    options: ["海邊與溪流礫灘", "外太空月球上", "外國貨輪進口", "人工化學合成"],
    correctIndex: 0,
    reflection: "長濱人就地取材，直接撿拾海邊與溪床堅硬的砂岩、石英岩鵝卵石。",
    storyIntegration: "108課綱整合：八仙洞前方的海灘與溪流充滿被海浪篩選過的堅硬鵝卵石，長濱人發揮智慧就地取材，挑…17162 tokens truncated…課本省思並調整判斷的歷程，都讓你的歷史思辨力與地景觀察力更加茁壯！真正的時空偵探不怕挑戰，越觀察越有智慧！`;
}

// ----------------------------------------------------------------------------
// 7. 渲染「貓貓歷史偵探獎狀」（正面：證書+星芒圖+貓貓校長+紅印章；背面：5 題學習歷程+正向鼓勵詞）
// ----------------------------------------------------------------------------
function renderCatCertificateHTML() {
  const missionCards = getMissionCards();
  const scores = compute108CompetencyScores();
  const starRadarSVG = build108StarRadarSVG(scores);
  const redSealSVG = buildSchoolRedSealSVG();

  const themeTitle = detectiveState.categoryFilter === 'CULTURE'
    ? '台灣舊石器時期（八仙洞長濱文化）'
    : detectiveState.categoryFilter === 'TERRAIN'
      ? '台灣長濱地形（東海岸五帶地景與陸連島）'
      : '長濱文化與東海岸地形綜合探究';

  const totalAttempts = missionCards.reduce((acc, c) => acc + (detectiveState.records[c.id]?.attempts || 1), 0);
  const encouragementText = getPositiveEncouragement(scores, themeTitle, totalAttempts);
  const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  // 獎狀正面 HTML
  const frontCardHTML = `
    <div class="cert-paper cert-front relative rounded-3xl overflow-hidden border-4 border-amber-600 shadow-2xl text-slate-900">
      <!-- 故事場景半透明背景圖 (讓學生清楚知道自己參與了什麼課程場景) -->
      <div class="cert-scene-bg"></div>
      <div class="cert-gold-frame relative z-10 p-5 md:p-6 space-y-4">
        <!-- 獎狀頂部校徽與榮譽標頭 -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-amber-700/40 pb-3">
          <div class="flex items-center gap-3">
            <img src="./assets/cat-principal.webp" alt="貓貓校長" class="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-amber-600 shadow-md object-cover bg-amber-50"/>
            <div>
              <div class="text-xs md:text-sm font-black tracking-widest text-amber-900 uppercase">CAT HISTORY DETECTIVE ACADEMY ・ 108 課綱素養認證</div>
              <h2 class="text-2xl md:text-3xl font-black text-amber-950 tracking-wide">🐾 貓貓歷史偵探獎狀</h2>
              <div class="text-xs md:text-sm font-bold text-amber-800 mt-0.5">參與課程：《黑潮之濱：${themeTitle}》</div>
            </div>
          </div>
          <div class="text-right">
            <span class="inline-block px-3 py-1 rounded-full bg-amber-600 text-white text-xs md:text-sm font-black shadow">🏆 5 / 5 題闖關通過</span>
            <div class="text-xs font-bold text-amber-900 mt-1">證書字號：貓探字第 108-${MISSION_TARGET_COUNT}0${scores.overall} 號</div>
          </div>
        </div>

        <!-- 受獎學生姓名與表揚正文 -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2 border-amber-500/60 shadow-inner">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div class="text-base md:text-lg font-black text-amber-950 flex items-center gap-2 flex-wrap">
              <span>茲表揚時空小偵探：</span>
              <span class="cert-student-name-display text-2xl md:text-3xl font-black text-rose-800 underline decoration-amber-500 decoration-wavy underline-offset-4">${detectiveState.studentName}</span>
            </div>
            <div class="flex items-center gap-1.5 print-hidden">
              <label class="text-xs font-bold text-amber-900">✏️ 輸入姓名：</label>
              <input type="text" value="${detectiveState.studentName}" oninput="updateCertificateStudentName(this.value)"
                placeholder="輸入學生姓名"
                class="px-2.5 py-1 rounded-lg border-2 border-amber-500 bg-amber-50/90 text-slate-900 text-sm font-black w-36 focus:outline-none focus:ring-2 focus:ring-amber-600"/>
            </div>
          </div>
          <p class="text-sm md:text-base text-slate-800 font-bold leading-relaxed">
            參與「<strong class="text-amber-900">黑潮之濱：舊石器八仙洞聚落、三仙台退潮陸連島與潮間帶沙盒</strong>」互動模擬劇場課程，完成
            <strong class="text-emerald-800">【${themeTitle}】5/5 題組</strong>現場圈選觀察與卡牌推理考驗，表現優異，特頒此狀以資鼓勵！
          </p>
        </div>

        <!-- 中段：左欄 108 課綱五向度能力星芒圖 + 右欄 貓貓校長正向鼓勵詞與紅色官印 -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <!-- 108 課綱能力星芒圖 -->
          <div class="md:col-span-6 bg-amber-50/85 rounded-2xl p-3 border-2 border-amber-500/60 flex flex-col items-center">
            <div class="text-sm font-black text-amber-950 mb-1 flex items-center gap-1.5">
              <span>🌟 108 課綱五向度學習指標能力星芒圖</span>
              <span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black">綜合素養 ${scores.overall} 分</span>
            </div>
            ${starRadarSVG}
            <div class="grid grid-cols-5 gap-1 w-full text-center mt-1 pt-1.5 border-t border-amber-300/80">
              ${COMPETENCY_AXES.map(ax => `
                <div class="bg-white/85 rounded-lg py-1 px-0.5 border border-amber-300">
                  <div class="text-[11px] font-black text-amber-950">${ax.label}</div>
                  <div class="text-xs font-mono font-black text-emerald-700">${scores[ax.key]}%</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 貓貓校長正向鼓勵詞 + 貓貓校長圖 + 學校紅色印章 -->
          <div class="md:col-span-6 flex flex-col justify-between bg-white/82 rounded-2xl p-4 border-2 border-amber-500/60 space-y-3">
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-lg">🐱</span>
                <span class="text-base font-black text-amber-950">貓貓校長的正向鼓勵評語：</span>
              </div>
              <p class="text-sm md:text-base text-slate-800 font-bold leading-relaxed bg-amber-50/90 p-3 rounded-xl border border-amber-300">
                「${encouragementText}」
              </p>
            </div>

            <!-- 底部簽署區：WebP 貓貓校長立繪 + 學校紅色印章 + 頒發日期 -->
            <div class="flex items-center justify-between gap-2 pt-2 border-t border-amber-300/80">
              <div class="flex items-center gap-2.5">
                <img src="./assets/cat-principal.webp" alt="貓貓校長簽章" class="w-16 h-16 rounded-full border-2 border-amber-600 shadow object-cover bg-amber-100"/>
                <div>
                  <div class="text-sm font-black text-amber-950">貓貓歷史偵探學苑</div>
                  <div class="text-xs font-bold text-slate-700">校長：橘白貓福爾摩斯 親授</div>
                  <div class="text-xs font-bold text-slate-600 mt-0.5">${todayStr}</div>
                </div>
              </div>
              <!-- 學校紅色印章 -->
              <div class="flex-shrink-0">
                ${redSealSVG}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 獎狀背面 HTML（學習的題目與歷程在獎狀後面 + 正向鼓勵詞）
  const backMissionRowsHTML = missionCards.map((c, idx) => {
    const r = detectiveState.records[c.id] || { solved: true, attempts: 1, selectedHistory: [c.correctIndex] };
    const chosenTrail = (r.selectedHistory && r.selectedHistory.length > 0)
      ? r.selectedHistory.map(i => c.options[i]).join(' ➔ ')
      : c.options[c.correctIndex];
    const badgeColor = r.attempts === 1
      ? 'bg-emerald-700 text-white'
      : 'bg-amber-600 text-white';
    const attemptComment = r.attempts === 1
      ? '🌟 一次命中！觀察入微'
      : `💪 嘗試 ${r.attempts} 次突破成功！愈挫愈勇`;

    return `
      <div class="bg-white/88 rounded-2xl p-3.5 border-2 border-amber-500/60 shadow-sm space-y-1.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2.5 py-0.5 rounded-lg bg-amber-900 text-amber-100 text-xs font-black">第 ${idx + 1} 題</span>
            <span class="text-base font-black text-amber-950">【${c.title}】${c.question}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-400">${c.indicator || '108課綱素養'}</span>
            <span class="text-xs font-black px-2.5 py-0.5 rounded-full ${badgeColor}">${attemptComment}</span>
          </div>
        </div>
        <div class="text-xs md:text-sm font-bold text-slate-700">
          🎯 <strong>場景觀察目標：</strong>${c.targetLabel} ｜ 🃏 <strong>作答歷程：</strong><span class="text-emerald-800 font-black">${chosenTrail}</span>
        </div>
        <div class="text-xs md:text-sm font-bold text-amber-950 bg-amber-100/85 px-3 py-1.5 rounded-xl border border-amber-300">
          💡 <strong>課本省思：</strong>${c.reflection}
        </div>
        <div class="text-xs text-slate-700 font-medium leading-relaxed">
          📖 ${c.storyIntegration}
        </div>
      </div>
    `;
  }).join('');

  const backCardHTML = `
    <div class="cert-paper cert-back relative rounded-3xl overflow-hidden border-4 border-amber-600 shadow-2xl text-slate-900">
      <div class="cert-scene-bg"></div>
      <div class="cert-gold-frame relative z-10 p-5 md:p-6 space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-amber-700/40 pb-2.5">
          <div class="flex items-center gap-2.5">
            <img src="./assets/cat-principal.webp" alt="貓貓校長" class="w-12 h-12 rounded-xl border-2 border-amber-600 object-cover bg-amber-50"/>
            <div>
              <h3 class="text-xl md:text-2xl font-black text-amber-950">📜 獎狀背面：學習題目、探究歷程與省思紀錄</h3>
              <div class="text-xs md:text-sm font-bold text-amber-900">獲獎偵探：<span class="cert-student-name-display font-black text-rose-800">${detectiveState.studentName}</span> ｜ 參與課程：《${themeTitle}》</div>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-black">✅ 完成 5/5 題組探究歷程</span>
        </div>

        <!-- 5 道過關題目與學習歷程清單 -->
        <div class="space-y-2.5">
          ${backMissionRowsHTML}
        </div>

        <!-- 獎狀背面底部：貓貓校長的正向鼓勵與未來期許 -->
        <div class="bg-gradient-to-r from-amber-100/95 via-yellow-50/95 to-emerald-50/95 rounded-2xl p-3.5 border-2 border-amber-500 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img src="./assets/cat-principal.webp" alt="貓貓校長" class="w-14 h-14 rounded-full border-2 border-amber-600 object-cover flex-shrink-0"/>
            <div class="text-xs md:text-sm font-bold text-amber-950 leading-relaxed">
              <div class="font-black text-sm md:text-base text-rose-900 mb-0.5">🐾 貓貓校長給你的學習歷程正向鼓勵：</div>
              「看到你一步一腳印完成這 5 道場景推理題，把八仙洞的海階抬升、三仙台退潮陸連島與長濱人敲石用火的生活串聯起來，貓貓校長為你感到無比驕傲！繼續保持這份對家鄉土地與歷史的好奇心，你就是最棒的時空探險家！」
            </div>
          </div>
          <div class="flex-shrink-0 hidden sm:block">
            ${redSealSVG}
          </div>
        </div>
      </div>
    </div>
  `;

  const sideMode = detectiveState.certificateSide || 'FRONT';

  return `
    <div id="detective-certificate-shell" class="certificate-mode-${sideMode.toLowerCase()} mc-panel rounded-3xl p-4 border-2 border-amber-400 shadow-2xl space-y-3 max-h-[88vh] overflow-y-auto">
      <!-- 頂部控制列（翻轉獎狀正面／背面、列印獎狀、再挑戰新題組） -->
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-700 print-hidden">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🏆</span>
          <div>
            <div class="text-lg md:text-xl font-black text-amber-300">恭喜過關 (5/5)！獲頒「貓貓歷史偵探獎狀」</div>
            <div class="text-xs text-slate-300 font-bold">可切換查看【獎狀正面：108課綱星芒圖與貓貓校長印章】與【獎狀背面：5題學習歷程與正向鼓勵】</div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <button onclick="switchCertificateSide('FRONT')" class="px-3 py-1.5 rounded-xl text-xs md:text-sm font-black border-2 transition-all ${sideMode === 'FRONT' ? 'bg-amber-400 text-slate-950 border-white shadow-lg' : 'bg-slate-800 text-amber-200 border-amber-400/50 hover:bg-slate-700'}">
            🎖️ 獎狀正面（星芒圖・貓貓校長）
          </button>
          <button onclick="switchCertificateSide('BACK')" class="px-3 py-1.5 rounded-xl text-xs md:text-sm font-black border-2 transition-all ${sideMode === 'BACK' ? 'bg-amber-400 text-slate-950 border-white shadow-lg' : 'bg-slate-800 text-amber-200 border-amber-400/50 hover:bg-slate-700'}">
            📜 獎狀背面（學習題目與歷程）
          </button>
          <button onclick="switchCertificateSide('BOTH')" class="px-3 py-1.5 rounded-xl text-xs md:text-sm font-black border-2 transition-all ${sideMode === 'BOTH' ? 'bg-emerald-400 text-slate-950 border-white shadow-lg' : 'bg-slate-800 text-emerald-200 border-emerald-400/50 hover:bg-slate-700'}">
            📖 正反雙面同覽
          </button>
          <button onclick="printCatCertificate()" class="px-3 py-1.5 rounded-xl text-xs md:text-sm font-black bg-rose-600 hover:bg-rose-500 text-white border border-rose-300 shadow">
            🖨️ 列印／存成 PDF
          </button>
          <button onclick="startDetectiveTheme('${detectiveState.categoryFilter}')" class="px-3 py-1.5 rounded-xl text-xs md:text-sm font-black bg-sky-600 hover:bg-sky-500 text-white border border-sky-300 shadow">
            🎲 再抽 5 題新挑戰
          </button>
          <button onclick="openDetectiveThemeSelector()" class="px-2.5 py-1.5 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600">
            🔄 換主題
          </button>
          <button onclick="toggleDetectiveMode(false)" class="px-2.5 py-1.5 rounded-xl text-sm bg-slate-800 hover:bg-rose-900 text-slate-200 font-black">
            ✕
          </button>
        </div>
      </div>

      <!-- 獎狀本體顯示區 -->
      <div class="space-y-4">
        ${sideMode === 'FRONT' ? frontCardHTML : sideMode === 'BACK' ? backCardHTML : `${frontCardHTML}${backCardHTML}`}
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// 8. 渲染「時空偵探」主視窗（主題選擇 / 5題卡牌闖關 / 貓貓歷史偵探獎狀 / 省思記憶庫）
// ----------------------------------------------------------------------------
function renderDetectiveModalContent() {
  const container = document.getElementById('detective-panel-container');
  if (!container) return;

  // 若處於獎狀頒發階段，展開寬幅獎狀面板
  if (detectiveState.stage === 'CERTIFICATE') {
    container.className = 'w-[680px] lg:w-[860px] max-w-[92vw] pointer-events-auto';
    container.innerHTML = renderCatCertificateHTML();
    return;
  } else {
    container.className = 'w-[540px] lg:w-[650px] max-w-[88vw] pointer-events-auto';
  }

  const missionCards = getMissionCards();
  const missionSolvedCount = getMissionSolvedCount();

  const totalCulturePool = detectiveState.cards.filter(c => c.categoryId === 'CULTURE').length;
  const totalTerrainPool = detectiveState.cards.filter(c => c.categoryId === 'TERRAIN').length;

  // ==========================================================================
  // 畫面 A：開始時空偵探前，老師／學生選擇主題畫面 (`SELECT_THEME`)
  // ==========================================================================
  if (detectiveState.stage === 'SELECT_THEME' && detectiveState.activeTab !== 'MEMORY') {
    container.innerHTML = `
      <div class="mc-panel rounded-3xl p-5 border-2 border-amber-400/80 shadow-2xl space-y-4">
        <!-- 頂部標題 -->
        <div class="flex items-center justify-between border-b border-slate-700/90 pb-3">
          <div class="flex items-center gap-3">
            <img src="./assets/cat-principal.webp" alt="貓貓校長" class="w-14 h-14 rounded-2xl border-2 border-amber-400 shadow-md object-cover bg-amber-100"/>
            <div>
              <h2 class="text-xl md:text-2xl font-black text-amber-300">🕵️ 時空偵探：請選擇考驗主題（5/5 題過關領獎狀！）</h2>
              <p class="text-sm text-slate-200 font-bold">全題庫擴充至 <span class="text-amber-300">${detectiveState.cards.length} 個題組</span>（每主題 ${Math.floor(detectiveState.cards.length / 2)} 題）！每次隨機抽取 <span class="text-emerald-300">5 道不重複題目</span>，答對 5/5 題即頒發「🐱 貓貓歷史偵探獎狀與 108 課綱星芒圖」！</p>
            </div>
          </div>
          <button onclick="toggleDetectiveMode(false)" class="px-3 py-1.5 rounded-xl text-base bg-slate-800 hover:bg-rose-900 text-slate-200 font-black" title="關閉時空偵探">
            ✕
          </button>
        </div>

        <!-- 兩大主題選擇巨型圖卡 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 主題 1：台灣舊石器時期 -->
          <button onclick="startDetectiveTheme('CULTURE')"
            class="detective-game-card group rounded-2xl p-4 border-2 border-amber-400/70 bg-gradient-to-b from-amber-950/85 to-slate-900/95 hover:border-amber-300 hover:-translate-y-1 transition-all text-left flex flex-col justify-between shadow-xl cursor-pointer">
            <div>
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="text-sm font-black px-3 py-1 rounded-xl bg-amber-400 text-slate-950 whitespace-nowrap">🏛️ 主題一</span>
                <span class="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-slate-950/80 text-amber-200 border border-amber-400/40 whitespace-nowrap">
                  題庫 ${totalCulturePool} 題（每次抽 5 題不重複）
                </span>
              </div>
              <div class="flex items-center gap-3.5 mb-2.5">
                ${QUESTION_CUTE_SVGS.culture_01_pebble_tool}
                <div>
                  <div class="text-2xl font-black text-white group-hover:text-amber-200">台灣舊石器時期</div>
                  <div class="text-sm font-bold text-amber-300 mt-0.5">八仙洞長濱文化・5/5 題過關</div>
                </div>
              </div>
              <p class="text-sm md:text-base text-slate-200 leading-relaxed font-medium">
                包含：敲打鵝卵石砍伐器、洞穴用火熟食、雙尖骨針魚鉤與骨叉、天然海蝕洞穴居、打樹皮衣編藤繩、採薪護火、退潮採海菜拾貝、竹木筏垂釣與部落共食分享！
              </p>
            </div>
            <div class="mt-4 w-full py-2.5 px-4 rounded-xl bg-amber-500/30 border border-amber-300/70 text-center text-base md:text-lg font-black text-amber-100 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
              ▶ 開始「台灣舊石器時期」考驗 (0/5)
            </div>
          </button>

          <!-- 主題 2：台灣長濱地形 -->
          <button onclick="startDetectiveTheme('TERRAIN')"
            class="detective-game-card group rounded-2xl p-4 border-2 border-sky-400/70 bg-gradient-to-b from-sky-950/85 to-slate-900/95 hover:border-sky-300 hover:-translate-y-1 transition-all text-left flex flex-col justify-between shadow-xl cursor-pointer">
            <div>
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="text-sm font-black px-3 py-1 rounded-xl bg-sky-400 text-slate-950 whitespace-nowrap">⛰️ 主題二</span>
                <span class="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-slate-950/80 text-sky-200 border border-sky-400/40 whitespace-nowrap">
                  題庫 ${totalTerrainPool} 題（每次抽 5 題不重複）
                </span>
              </div>
              <div class="flex items-center gap-3.5 mb-2.5">
                ${QUESTION_CUTE_SVGS.terrain_01_cave_uplift}
                <div>
                  <div class="text-2xl font-black text-white group-hover:text-sky-200">台灣長濱地形</div>
                  <div class="text-sm font-bold text-sky-300 mt-0.5">東海岸地質與潮汐・5/5 題過關</div>
                </div>
              </div>
              <p class="text-sm md:text-base text-slate-200 leading-relaxed font-medium">
                包含：八仙洞地殼抬升、高低洞穴年代、三仙台退潮陸連島、滿潮淹沒沙洲、階梯狀海階台地、扁圓礫石灘、火山集塊岩、石梯坪單面山與壺穴、秀姑巒溪與黑潮食物鏈！
              </p>
            </div>
            <div class="mt-4 w-full py-2.5 px-4 rounded-xl bg-sky-500/30 border border-sky-300/70 text-center text-base md:text-lg font-black text-sky-100 group-hover:bg-sky-400 group-hover:text-slate-950 transition-all">
              ▶ 開始「台灣長濱地形」考驗 (0/5)
            </div>
          </button>
        </div>

        <!-- 底部綜合全題庫挑戰 -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <button onclick="startDetectiveTheme('ALL')" class="mc-btn px-4 py-2 rounded-xl text-sm md:text-base font-black text-emerald-200 border-emerald-400/60 flex items-center gap-2">
            <span>🌟</span>
            <span>綜合全主題大考驗（從 ${detectiveState.cards.length} 題庫隨機抽 5 題闖關）</span>
          </button>
          <span class="text-xs md:text-sm text-amber-200 font-bold">🐾 通過 5/5 題即可獲得貓貓校長親授獎狀與 108 課綱能力星芒圖！</span>
        </div>
      </div>
    `;
    return;
  }

  const card = getCardById(detectiveState.currentCardId);
  const rec = detectiveState.records[card.id] || { solved: false, attempts: 0, selectedHistory: [], lastWrongIndex: null };

  if (!detectiveState.shuffledOptionsByCard[card.id]) {
    randomizeCardOptions(card.id);
  }
  const shuffledOptions = detectiveState.shuffledOptionsByCard[card.id];
  const letters = ['A', 'B', 'C', 'D'];

  const currentThemeTitle = detectiveState.categoryFilter === 'CULTURE'
    ? '🏛️ 台灣舊石器時期'
    : detectiveState.categoryFilter === 'TERRAIN'
      ? '⛰️ 台灣長濱地形'
      : '🌟 綜合全主題';

  const currentQuestionIndex = Math.max(0, missionCards.findIndex(c => c.id === card.id)) + 1;

  // 頂部本局 5 題闖關進度列
  const sceneSelectorPills = missionCards.map((c, idx) => {
    const isCurrent = (c.id === card.id);
    const isSolved = detectiveState.records[c.id]?.solved;
    return `
      <button onclick="selectDetectiveSceneCard('${c.id}', true, false)"
        class="px-3 py-1.5 rounded-xl text-sm font-black whitespace-nowrap transition-all flex items-center gap-1.5 border-2 flex-shrink-0 ${
          isCurrent
            ? 'bg-amber-500/40 border-amber-300 text-white shadow-lg scale-[1.03]'
            : isSolved
              ? 'bg-emerald-950/85 border-emerald-400/60 text-emerald-200 hover:bg-emerald-900/75'
              : 'bg-slate-900/85 border-slate-700 text-slate-200 hover:border-sky-400/60'
        }">
        <span class="text-base">${isSolved ? '✅' : `第${idx + 1}題`}</span>
        <span>${c.title}</span>
      </button>
    `;
  }).join('');

  let bodyHTML = '';

  if (detectiveState.activeTab === 'MEMORY') {
    const memoryCardsHTML = missionCards.map((c, idx) => {
      const r = detectiveState.records[c.id];
      const solved = r?.solved;
      const qSvg = QUESTION_CUTE_SVGS[c.id] || QUESTION_CUTE_SVGS.terrain_01_cave_uplift;
      return `
        <div class="p-3.5 rounded-2xl border-2 ${solved ? 'bg-emerald-950/55 border-emerald-400/55' : 'bg-slate-900/70 border-slate-800 opacity-85'}">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2.5">
              ${qSvg}
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 font-black">本局第 ${idx + 1} 題</span>
                  <span class="text-lg font-black ${solved ? 'text-emerald-200' : 'text-slate-200'}">${c.title}</span>
                  <span class="text-xs px-2 py-0.5 rounded-lg bg-slate-800 text-sky-300 border border-sky-400/40 font-bold whitespace-nowrap">${c.indicator || c.categoryName}</span>
                </div>
                <div class="text-base font-extrabold text-white mt-1">❓ ${c.question}</div>
              </div>
            </div>
            <button onclick="selectDetectiveSceneCard('${c.id}', true, false)" class="text-sm px-3 py-1.5 rounded-xl bg-sky-500/30 border border-sky-400/50 text-sky-100 hover:bg-sky-500/50 font-black whitespace-nowrap">
              🎯 前往此題
            </button>
          </div>
          ${solved ? `
            <div class="text-sm text-emerald-300 font-black mb-1.5">
              ★ 正確答案：${c.options[c.correctIndex]}（共嘗試 ${r.attempts} 次）
            </div>
            <div class="text-base text-amber-200 font-black bg-amber-950/60 px-3 py-2 rounded-xl border border-amber-400/40 mb-1.5">
              💡 課本省思：${c.reflection}
            </div>
            <div class="text-sm text-slate-100 leading-relaxed">
              📖 ${c.storyIntegration}
            </div>
          ` : `
            <div class="text-sm text-slate-300 bg-slate-950/60 px-3 py-2 rounded-xl">尚未解鎖此題，點擊右上「🎯 前往此題」觀察場景並打出正確卡牌即可解鎖！</div>
          `}
        </div>
      `;
    }).join('');

    bodyHTML = `
      <div class="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
        <div class="flex items-center justify-between bg-slate-950/85 p-3.5 rounded-2xl border-2 border-emerald-400/45 gap-3">
          <div>
            <div class="text-lg font-black text-emerald-200">📖 本局 5 題課程回應記憶與 108 課綱整合（進度 ${missionSolvedCount} / ${MISSION_TARGET_COUNT}）</div>
            <div class="text-sm text-slate-200 mt-0.5">答滿 5/5 題即可獲頒「貓貓歷史偵探獎狀」與專屬 108 課綱能力星芒圖！</div>
          </div>
          ${missionSolvedCount >= MISSION_TARGET_COUNT ? `
            <button onclick="openCatDetectiveCertificate('FRONT')" class="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm whitespace-nowrap shadow-lg">
              🏆 領取貓貓獎狀
            </button>
          ` : ''}
        </div>
        <div class="grid grid-cols-1 gap-3">
          ${memoryCardsHTML}
        </div>
      </div>
    `;
  } else {
    // ========================================================================
    // 卡牌挑戰模式：題目配有可愛插畫 + 2x2 大字可愛插畫遊戲卡牌（亂數洗牌呈現）
    // ========================================================================
    const questionCuteSvg = QUESTION_CUTE_SVGS[card.id] || QUESTION_CUTE_SVGS.terrain_01_cave_uplift;

    const optionCardsHTML = shuffledOptions.map((optItem, displayIdx) => {
      const origIdx = optItem.origIndex;
      const optText = optItem.text;
      const isCorrectOpt = (origIdx === card.correctIndex);
      const wasChosenWrong = (rec.lastWrongIndex === origIdx && !rec.solved);
      const isSolvedCorrect = (rec.solved && isCorrectOpt);
      const cuteSvg = getOptionCuteSVG(optText);

      let cardStyleClass = 'bg-slate-900/92 border-sky-400/55 hover:border-amber-300 hover:-translate-y-1 text-white shadow-lg';
      let badgeHTML = `<span class="text-xs md:text-sm font-mono font-black px-2.5 py-0.5 rounded-lg bg-sky-500/30 text-sky-100 border border-sky-400/50 whitespace-nowrap">卡牌 ${letters[displayIdx]}</span>`;

      if (isSolvedCorrect) {
        cardStyleClass = 'bg-gradient-to-b from-emerald-900/95 to-teal-950/95 border-emerald-300 text-emerald-50 shadow-xl ring-2 ring-emerald-400/70';
        badgeHTML = `<span class="text-xs md:text-sm font-black px-2.5 py-0.5 rounded-lg bg-emerald-400 text-slate-950 whitespace-nowrap">★ 正確卡牌</span>`;
      } else if (wasChosenWrong) {
        cardStyleClass = 'bg-rose-950/90 border-rose-400 text-rose-100 shadow-lg';
        badgeHTML = `<span class="text-xs md:text-sm font-black px-2.5 py-0.5 rounded-lg bg-rose-500 text-white whitespace-nowrap">✕ 再觀察看看</span>`;
      } else if (rec.solved) {
        cardStyleClass = 'bg-slate-950/65 border-slate-800 text-slate-400 opacity-70';
      }

      return `
        <button id="detective-opt-orig-${origIdx}"
          onclick="submitDetectiveCardAnswer('${card.id}', ${origIdx})"
          class="detective-game-card rounded-2xl p-3.5 border-2 transition-all duration-200 flex items-center gap-3.5 text-left cursor-pointer ${cardStyleClass}">
          <div class="flex-shrink-0 transform transition-transform group-hover:scale-105">
            ${cuteSvg}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1 mb-1">
              ${badgeHTML}
              <span class="text-lg">${isSolvedCorrect ? '🔔' : wasChosenWrong ? '🚨' : '✨'}</span>
            </div>
            <div class="text-xl md:text-2xl font-black tracking-wide leading-tight text-white truncate">
              ${optText}
            </div>
            <div class="text-xs md:text-sm mt-1 font-bold ${isSolvedCorrect ? 'text-emerald-200' : wasChosenWrong ? 'text-rose-300' : 'text-sky-200/80'}">
              ${isSolvedCorrect ? '叮咚！答對了' : wasChosenWrong ? '滴滴！再看大圓圈' : '點擊打出這張卡牌'}
            </div>
          </div>
        </button>
      `;
    }).join('');

    let feedbackBannerHTML = '';
    if (rec.solved) {
      const isAllFiveCleared = (missionSolvedCount >= MISSION_TARGET_COUNT);
      feedbackBannerHTML = `
        <div class="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/95 via-teal-950/95 to-slate-900/95 border-2 border-emerald-400/70 space-y-2">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm md:text-base font-black px-3 py-1 rounded-xl bg-emerald-400 text-slate-950 whitespace-nowrap">
                🔔 叮咚！答對了 (${missionSolvedCount}/${MISSION_TARGET_COUNT})
              </span>
              <span class="text-base md:text-lg font-black text-amber-200">💡 課本省思：${card.reflection}</span>
            </div>
            ${isAllFiveCleared ? `
              <button onclick="openCatDetectiveCertificate('FRONT')" class="px-5 py-2.5 rounded-xl text-base md:text-lg font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-slate-950 border-2 border-white whitespace-nowrap shadow-xl animate-bounce cursor-pointer">
                🏆 5/5 恭喜過關！領取貓貓歷史偵探獎狀 ➔
              </button>
            ` : `
              <button onclick="goToNextDetectiveCard()" class="mc-btn active px-4 py-2 rounded-xl text-sm md:text-base font-black text-amber-100 border-amber-300 whitespace-nowrap shadow-lg">
                ▶ 下一題 (${missionSolvedCount}/${MISSION_TARGET_COUNT}) ➔
              </button>
            `}
          </div>
          <p class="text-sm md:text-base text-slate-100 leading-relaxed font-medium">${card.storyIntegration}</p>
        </div>
      `;
    } else if (rec.lastWrongIndex !== null) {
      feedbackBannerHTML = `
        <div class="mt-3 p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-400/60 flex items-center justify-between gap-3">
          <span class="text-sm md:text-base font-bold text-rose-100 leading-snug">
            🚨 <strong>滴滴！</strong>「${card.options[rec.lastWrongIndex]}」不對喔！請仔細觀察畫面中<strong>大圓圈圈起來的場景</strong>，再選一張卡牌！
          </span>
          <button onclick="selectDetectiveSceneCard('${card.id}', true, false)" class="text-xs md:text-sm px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-black whitespace-nowrap flex-shrink-0">
            🎯 對準圓圈
          </button>
        </div>
      `;
    }

    bodyHTML = `
      <!-- 當前圈選問題標題列（含可愛題目專屬 SVG 插畫 + 108 課綱指標 + 放大一倍的題幹文字） -->
      <div class="bg-slate-950/90 rounded-2xl p-3.5 border-2 border-amber-400/55 mb-3 flex items-center gap-3.5">
        ${questionCuteSvg}
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-black px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 whitespace-nowrap">第 ${currentQuestionIndex}/${MISSION_TARGET_COUNT} 題</span>
              <span class="text-xs font-black px-2.5 py-0.5 rounded-lg bg-amber-500/30 text-amber-200 border border-amber-400/50 whitespace-nowrap">${card.indicator || card.categoryName}</span>
              <span class="text-xs font-bold text-sky-300">🎯 鎖定：${card.targetLabel || card.title}</span>
            </div>
            <button onclick="selectDetectiveSceneCard('${card.id}', true, true)" class="mc-btn px-2.5 py-1 rounded-lg text-xs font-bold text-amber-200 border-amber-400/50 whitespace-nowrap" title="重新對準目標並洗牌選項">
              🎯 對準目標
            </button>
          </div>
          <h3 class="text-xl md:text-2xl font-black text-white leading-snug">
            ❓ 【${card.title}】${card.question}
          </h3>
        </div>
      </div>

      <!-- 4 張亂數排列的可愛插畫遊戲卡牌（2x2 大字版面） -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${optionCardsHTML}
      </div>

      ${feedbackBannerHTML}
    `;
  }

  container.innerHTML = `
    <div class="mc-panel rounded-3xl p-4 border-2 border-amber-400/70 shadow-2xl">
      <!-- 頂部主軸分類與 5/5 闖關進度列 -->
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-700/90">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🕵️</span>
          <span class="text-base md:text-lg font-black text-amber-300">${currentThemeTitle}</span>
          <span class="text-xs md:text-sm font-mono px-3 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 font-black whitespace-nowrap">
            過關進度 ${missionSolvedCount} / ${MISSION_TARGET_COUNT} 題
          </span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          ${missionSolvedCount >= MISSION_TARGET_COUNT ? `
            <button onclick="openCatDetectiveCertificate('FRONT')" class="px-3 py-1 rounded-xl text-xs md:text-sm font-black bg-amber-400 text-slate-950 border-2 border-white shadow animate-pulse">
              🏆 查看貓貓獎狀
            </button>
          ` : ''}
          <button onclick="openDetectiveThemeSelector()" class="px-2.5 py-1 rounded-xl text-xs md:text-sm font-black border-2 bg-amber-500/30 border-amber-300 text-amber-100 hover:bg-amber-500/50 whitespace-nowrap">
            🔄 選擇主題
          </button>
          <button onclick="shuffleCurrentDetectiveDeck()" class="px-2.5 py-1 rounded-xl text-xs md:text-sm font-black border bg-slate-900 border-amber-400/50 text-amber-200 hover:bg-amber-950 whitespace-nowrap" title="從目前主題題庫重新抽取 5 道不重複新題目">
            🎲 換一批 5 題
          </button>
          <button onclick="switchDetectiveTab('${detectiveState.activeTab === 'MEMORY' ? 'CHALLENGE' : 'MEMORY'}')"
            class="px-3 py-1 rounded-xl text-xs md:text-sm font-black border whitespace-nowrap ${detectiveState.activeTab === 'MEMORY' ? 'bg-emerald-500/40 border-emerald-300 text-white' : 'bg-purple-950/90 border-purple-400/60 text-purple-100 hover:bg-purple-900'}">
            ${detectiveState.activeTab === 'MEMORY' ? '🃏 返回挑戰' : `📓 本局紀錄 (${missionSolvedCount}/${MISSION_TARGET_COUNT})`}
          </button>
          <button onclick="toggleDetectiveMode(false)" class="px-2.5 py-1 rounded-xl text-sm bg-slate-800 hover:bg-rose-900 text-slate-200 font-black" title="關閉時空偵探">
            ✕
          </button>
        </div>
      </div>

      <!-- 本局抽出的 5 道不重複題目進度條 -->
      <div class="flex items-center gap-2 overflow-x-auto pb-2 mb-2">
        <span class="text-xs md:text-sm text-amber-200 font-black whitespace-nowrap flex-shrink-0">🎯 本局 5 題任務：</span>
        ${sceneSelectorPills}
      </div>

      ${bodyHTML}
    </div>
  `;
}

// ----------------------------------------------------------------------------
// 9. 每幀更新 3D 光圈動畫與 2D 畫面大圓圈投影座標
// ----------------------------------------------------------------------------
window.updateDetectiveSystem = function (dt) {
  if (!detectiveState.isOpen || detectiveState.stage !== 'PLAYING' || detectiveState.activeTab === 'MEMORY') return;

  const card = getCardById(detectiveState.currentCardId);
  if (card && card.followSpecies === 'MIGRATION_CHAIN' && typeof migrationSquads !== 'undefined' && migrationSquads.length > 0) {
    detectiveState.focusWorldVec.copy(migrationSquads[0].mahiUnits[0].group.position);
  }

  if (detectiveState.ring3DGroup && detectiveState.ring3DGroup.visible) {
    detectiveState.ring3DGroup.position.copy(detectiveState.focusWorldVec);
    const pulse = 1.0 + Math.sin(simTime * 4.2) * 0.08;
    const baseR = (card && card.ringRadius) ? card.ringRadius : 3.2;
    detectiveState.ring3DGroup.scale.set(baseR * pulse, 1.0, baseR * pulse);
    if (detectiveState.ringOuterMesh) detectiveState.ringOuterMesh.rotation.z = simTime * 1.2;
    if (detectiveState.ringInnerMesh) detectiveState.ringInnerMesh.rotation.z = -simTime * 1.8;
  }

  const circleEl = document.getElementById('detective-target-circle');
  if (circleEl && typeof camera !== 'undefined') {
    const proj = detectiveState.focusWorldVec.clone();
    proj.project(camera);

    if (proj.z > 1.0) {
      circleEl.style.opacity = '0';
    } else {
      const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-proj.y * 0.5 + 0.5) * window.innerHeight;
      circleEl.style.opacity = '1';
      circleEl.style.left = `${sx.toFixed(1)}px`;
      circleEl.style.top = `${sy.toFixed(1)}px`;
    }
  }
};

// 初始化載入題庫與記憶
loadDetectiveDataAndMemory();

