# 《黑潮之濱》開發交接手冊

最後整理：2026-10-19

## 1. 專案定位

這是一個以台灣東海岸為故事場景的教學型 3D 互動沙盒，主題串連：

- 八仙洞長濱文化與舊石器時期聚落生活
- 東海岸海階、海蝕洞、礁岩與三仙台陸連島
- 潮間帶生物、黑潮與海洋食物鏈
- 學生先觀察 3D 場景，再進入「時空偵探」進行場景題卡推理

入口與核心控制中心是 [`index.html`](./index.html)。它不只是頁面模板，也包含 Three.js 場景初始化、HUD、相機／滑鼠／鍵盤操作、動畫主迴圈與模組初始化。

## 2. 啟動方式

專案沒有 `package.json`、建置流程或後端；依賴已放在 `vendor/`：

- `vendor/three.min.js`
- `vendor/tailwindcss.js`

建議用 HTTP 靜態伺服器啟動，因為偵探題庫會用 `fetch()` 讀取 JSON：

```powershell
cd D:\game\oceanic-tribe
python -m http.server 8000
```

再以瀏覽器開啟 <http://localhost:8000/>。

直接雙擊 `index.html`（`file://`）時，瀏覽器通常會阻擋 JSON `fetch`；程式會捕捉錯誤並使用 `js/detective-game.js` 內建的備援題庫，因此 3D 遊戲仍可啟動，但不適合用來驗證外部題庫載入。

## 3. Script 載入順序與責任

`index.html` 的順序不可任意調換。載入鏈如下：

1. `vendor/tailwindcss.js`：本地 Tailwind 執行時樣式。
2. `vendor/three.min.js`：Three.js。
3. `css/style.css`：全域樣式、HUD、偵探鎖定圈與卡牌特效。
4. `js/layers/culture-layer.js`：文化圖層資料與文案，並建立 `BLOCK_DEFS` 等共用資料前置內容。
5. `js/layers/terrain-layer.js`：地形圖層、地質資料、方塊定義與海象控制文案。
6. `js/layers/intertidal-layer.js`：潮間帶生物、黑潮食物鏈與圖層文案。
7. `js/hud-controller.js`：左側圖層抽屜、右側探測誌與控制面板。
8. `js/world-terrain.js`：程序生成 3D 地形、方塊、海岸山脈、八仙洞與三仙台等場景。
9. `js/ocean-shader.js`：海面 Shader、深度資料、波浪、潮汐與浪花。
10. `js/coastal-biota.js`：海草、螃蟹、魚類、海龜與黑潮洄游鏈。
11. `js/prehistoric-tribe.js`：長濱史前部落、火堆、狩獵、採集、睡眠與日夜作息。
12. `js/detective-game.js`：時空偵探題庫載入、抽題、作答、能力星芒圖與獎狀。
13. `index.html` 最後的 inline script：相機、互動輸入、場景啟動、動畫迴圈，並呼叫 `initDetectiveSystem()`。

這些檔案大量使用全域變數與 `window.*` 函式；新增模組或改順序前，先檢查它依賴的全域名稱。

## 4. 時空偵探題庫

正式題庫位置：[`data/detective-questions.json`](./data/detective-questions.json)。目前驗證結果為 60 題、兩主題各 30 題、ID 全部唯一、每題 4 個選項。

頂層格式：

```json
{
  "title": "題庫標題",
  "version": "版本字串",
  "missionTargetCount": 5,
  "competencyAxes": [],
  "categories": [],
  "cards": []
}
```

每張 `cards` 題卡目前使用下列欄位：

| 欄位 | 用途 |
| --- | --- |
| `id` | 唯一題目 ID；不可重複，且建議保留 `culture_`／`terrain_` 前綴 |
| `categoryId` | `CULTURE`、`TERRAIN`；綜合題組另由程式用 `ALL` 篩選 |
| `categoryName` | 顯示用主題名稱 |
| `indicator` | 108 課綱學習指標文字 |
| `weights` | `obs`、`reason`、`history`、`eco`、`inquiry` 五向度權重，通常 0–100 |
| `title` | 題卡標題 |
| `targetLabel` | 3D 場景要觀察的目標 |
| `question` | 題目文字 |
| `options` | 4 個選項的陣列 |
| `correctIndex` | 正確選項的原始索引，從 0 開始 |
| `reflection` | 獎狀背面的課本省思 |
| `storyIntegration` | 題目與故事／108 課綱的整合說明 |
| `focusPos` | 3D 鎖定圈位置 `[x, y, z]` |
| `cameraPreset` | 可選相機 `{target, radius, theta, phi}` |
| `ringRadius` | 可選 3D 鎖定圈大小 |
| `forceSeaLevel`、`forceTimeOfDay`、`followSpecies` | 可選的潮汐、日夜或生物追蹤情境控制 |

修改題目時，最少要維持 `id`、`categoryId`、`question`、4 個 `options` 與有效的 `correctIndex`；若希望題卡能正確聚焦地圖，還要保留或更新場景定位欄位。

## 5. 5/5 過關與不重複抽題

規則由 `js/detective-game.js` 的 `MISSION_TARGET_COUNT = 5` 與 `buildNonRepeatingMissionDeck()` 控制：

1. 選擇「台灣舊石器時期」或「台灣長濱地形」後，從該主題題庫抽 5 題；「綜合全主題」則從全部題卡抽 5 題。
2. 同一局的 5 題 ID 不重複。
3. `usedPoolByTheme` 以 `CULTURE`、`TERRAIN`、`ALL` 分開記錄已抽 ID。
4. 尚有至少 5 題未抽時，只從未抽池抽題；因此同一主題各 30 題可連續玩 6 局不重複。
5. 剩餘未抽題少於 5 題時，先取完剩餘題，再用該題庫其他題補足；同一局仍不重複，但會開始跨局重抽。
6. 整個題庫用完後會重新開一輪，並以新一輪已抽的 5 題重新建立記憶池。
7. 答錯會留下作答紀錄並可繼續作答；答對後該題 `solved`，不再重複計次。
8. 5 題全部 `solved` 後達成 5/5，播放過關音效；下一步進入貓貓歷史偵探獎狀畫面。

這個「不重複」記憶目前只存在瀏覽器本次頁面執行的 JavaScript 記憶體，重新整理或關閉頁面會重置，不是跨工作階段的永久進度。

## 6. 108 課綱五向度星芒圖

題卡的 `weights` 對應 `COMPETENCY_AXES` 五軸：

1. **地景觀察**（`obs`）：觀察地形、潮汐、遺址與場景空間。
2. **因果推論**（`reason`）：推論抬升、侵蝕、潮汐與環境變化。
3. **史前文化**（`history`）：理解長濱文化的石器、骨角器、用火與生活技能。
4. **生態永續**（`eco`）：理解黑潮、食物鏈、潮間帶適應與人地互動。
5. **證據思辨**（`inquiry`）：依考古遺留、地質現場與作答歷程形成合理判斷。

`compute108CompetencyScores()` 會逐題平均五向度權重，依作答次數套用鼓勵式係數：一次答對 100%、第二次答對 93%、第三次以上 87%；分數再限制在 82–100%，避免獎狀呈現挫折性的低分。`build108StarRadarSVG()` 以 SVG 五角雷達／星芒圖呈現，並在每軸標示能力名稱、課綱代碼與百分比。

## 7. 雙面「貓貓歷史偵探獎狀」

完成 5/5 後由 `renderCatCertificateHTML()` 產生獎狀：

- **正面**：課程名稱、學生姓名輸入、主題與 5/5 完成紀錄、108 課綱五向度星芒圖、綜合素養分數、正向鼓勵詞、貓貓校長圖與學校紅色印章。
- **背面**：本局 5 道題目、每題場景觀察目標、選項作答歷程、嘗試次數、課本省思、故事整合說明與另一段正向鼓勵。
- **印刷**：可切換正面、背面、正反雙面同覽；`printCatCertificate()` 會暫時切到 `BOTH` 後呼叫瀏覽器列印／另存 PDF。
- **學生姓名**：預設為「小小貓貓偵探」，可在正面輸入並同步更新兩面文字。

紅色校印目前由 `buildSchoolRedSealSVG()` 直接產生 SVG，不是獨立圖檔。貓貓校長圖使用 [`assets/cat-principal.webp`](./assets/cat-principal.webp)。故事場景素材是 [`assets/story-scene-bg.webp`](./assets/story-scene-bg.webp)。

## 8. 素材與樣式用途

- [`css/style.css`](./css/style.css)：全域字體、深色玻璃 HUD、端點資料夾、按鈕、偵探場景鎖定圈、卡牌光澤與答錯抖動效果。
- `assets/cat-principal.webp`：貓貓校長頭像／獎狀簽署角色。
- `assets/story-scene-bg.webp`：獎狀預定使用的東海岸故事場景半透明底圖。
- `vendor/three.min.js`：本地 Three.js runtime。
- `vendor/tailwindcss.js`：本地 Tailwind runtime；偵探獎狀的大部分版面類別直接使用 Tailwind utility。

## 9. 可修改檔案與不可任意碰觸的模組

### 適合修改

- 題目、選項、答案、指標、權重與省思：`data/detective-questions.json`。
- 偵探抽題規則、作答、星芒圖、獎狀文案與獎狀排版：`js/detective-game.js`。
- 偵探鎖定圈、卡牌特效與全站 UI 樣式：`css/style.css`。
- 頁面按鈕、容器與偵探入口：`index.html`，但修改時需保留既有 ID 與 script 順序。
- `js/layers/*.js` 的圖層說明與資料，可在確認依賴後修改。

### 不可任意碰觸

- `js/world-terrain.js`：地圖程序生成、區域座標、方塊與 3D 地景核心；偵探題目的 `focusPos`／相機定位是依它的座標建立。
- `js/ocean-shader.js`：海面、海深、浪花與潮汐資料；題卡的 `forceSeaLevel` 依賴其全域函式。
- `js/coastal-biota.js`：生物模型、互動物件與黑潮洄游資料。
- `js/prehistoric-tribe.js`：史前聚落、火堆、族人活動與日夜狀態。

除非需求明確涉及地圖、海洋、生物或部落本身，題庫／偵探需求應限制在 `data/detective-questions.json`、`js/detective-game.js`、偵探相關 CSS 與必要的 `index.html` UI。

## 10. 已知限制與風險

- 必須留意 `file://` 與 HTTP 的題庫載入差異；正式驗證要使用 HTTP server。
- 題庫 JSON 與 `detective-game.js` 內建備援題庫是兩份資料；修改外部 JSON 後若要支援 `file://`，也要同步更新備援資料，否則兩種啟動方式會出現不同題目。
- `usedPoolByTheme`、本局紀錄與學生姓名都只在頁面記憶體中，重新整理會消失。
- 程式註解提到「下載圖檔」，目前實際提供的是瀏覽器列印／另存 PDF，沒有獨立的圖片下載流程。
- 獎狀 HTML 使用 `.cert-scene-bg`、`.cert-gold-frame` 等類別，但目前 `css/style.css` 沒有同名自訂規則；`story-scene-bg.webp` 目前是素材與結構預留，若要保證半透明背景顯示，需另行補上樣式（這份交接手冊不修改它）。
- 主要程式是傳統 script 全域作用域，不是 module；新增同名全域、調換 script 順序或刪除 DOM ID 都可能造成初始化錯誤。
- `index.html` 的 query-string 版本號用來避免快取；修改 JS／CSS／題庫後，若瀏覽器仍顯示舊內容，應檢查版本號或強制重新整理。
- 題目 `focusPos`、`cameraPreset`、`forceSeaLevel` 與 `followSpecies` 會驅動 3D 場景；若新增題目但未填正確定位，題卡可能能作答但無法正確圈選場景。

## 11. 驗證清單

### 靜態驗證

```powershell
cd D:\game\oceanic-tribe
Get-Content data/detective-questions.json -Raw | ConvertFrom-Json
```

確認：`cards` 為陣列、ID 唯一、每題 4 個選項、`correctIndex` 在 0–3、`categoryId` 為有效主題、五個 `weights` 都存在。

若環境有 Node.js，可檢查所有 JavaScript 語法：

```powershell
Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

### 瀏覽器冒煙測試

1. 用 HTTP server 開啟首頁，確認 3D 地圖、三個圖層抽屜與右側探測誌能正常開關。
2. 開啟「時空偵探」，確認外部 JSON 成功載入，主題數量顯示為各 30 題、總數 60 題。
3. 開始一個主題，確認進度從 `0/5` 變成 `1/5` 至 `5/5`；答錯後能重答，答對題目不會重複計次。
4. 重新開始同一主題，記錄題目 ID；連玩 6 局確認前 30 題不重複，下一輪才允許重抽。
5. 完成 5/5，確認過關音效、獎狀正面、五向度星芒圖、學生姓名輸入、紅色印章、正反面切換與背面五題歷程。
6. 使用列印／存成 PDF，確認 `BOTH` 版面與文字不被 HUD 遮蔽。
7. 開啟瀏覽器 DevTools Console，確認沒有 `ReferenceError`、題庫 JSON 404 或 Three.js 初始化錯誤。

## 12. 變更原則

先改資料，再改偵探邏輯，最後才碰地圖。每次修改後至少跑一次 JSON 解析、JavaScript 語法檢查與上述偵探冒煙測試；若需求只涉及題庫，不應改動 `world-terrain.js`、`ocean-shader.js`、`coastal-biota.js` 或 `prehistoric-tribe.js`。
