// ============================================================================
// HUD 與端點隱藏式資料夾控制器 (HUD & Endpoint Folder Layer Controller)
// 預設僅顯示「📐 東海岸潮汐側面地形圖」，所有功能收合於各端點小資料夾中
// ============================================================================

window.activeLeftFolder = null; // 'culture' | 'terrain' | 'intertidal' | null
window.activeRightDrawer = null; // 'inspector' | 'controls' | null
window.isBottomHotbarOpen = false;
window.are3DLabelsVisible = true;

window.initLayeredHUD = function () {
  const cLayer = document.getElementById('layer-drawer-culture');
  const tLayer = document.getElementById('layer-drawer-terrain');
  const iLayer = document.getElementById('layer-drawer-intertidal');

  if (cLayer && window.renderCultureLayerHTML) cLayer.innerHTML = window.renderCultureLayerHTML();
  if (tLayer && window.renderTerrainLayerHTML) tLayer.innerHTML = window.renderTerrainLayerHTML();
  if (iLayer && window.renderIntertidalLayerHTML) iLayer.innerHTML = window.renderIntertidalLayerHTML();
};

window.toggleLeftFolder = function (folderKey) {
  if (window.detectiveState && window.detectiveState.isOpen && typeof window.toggleDetectiveMode === 'function') {
    window.toggleDetectiveMode(false);
  }
  if (window.activeLeftFolder === folderKey) {
    window.closeAllLeftFolders();
    return;
  }
  window.activeLeftFolder = folderKey;

  ['culture', 'terrain', 'intertidal'].forEach(k => {
    const tabBtn = document.getElementById(`folder-tab-${k}`);
    const drawer = document.getElementById(`layer-drawer-${k}`);
    const isTarget = (k === folderKey);
    if (tabBtn) tabBtn.classList.toggle('active', isTarget);
    if (drawer) drawer.classList.toggle('layer-hidden', !isTarget);
  });
};

window.closeAllLeftFolders = function () {
  window.activeLeftFolder = null;
  ['culture', 'terrain', 'intertidal'].forEach(k => {
    const tabBtn = document.getElementById(`folder-tab-${k}`);
    const drawer = document.getElementById(`layer-drawer-${k}`);
    if (tabBtn) tabBtn.classList.remove('active');
    if (drawer) drawer.classList.add('layer-hidden');
  });
};

window.toggleRightDrawer = function (drawerKey) {
  if (window.activeRightDrawer === drawerKey) {
    window.activeRightDrawer = null;
  } else {
    window.activeRightDrawer = drawerKey;
  }

  ['inspector', 'controls'].forEach(k => {
    const btn = document.getElementById(`right-tab-${k}`);
    const panel = document.getElementById(`right-drawer-${k}`);
    const isOpen = (window.activeRightDrawer === k);
    if (btn) btn.classList.toggle('active', isOpen);
    if (panel) panel.classList.toggle('hidden', !isOpen);
  });
};

window.toggleBottomHotbar = function () {
  window.isBottomHotbarOpen = !window.isBottomHotbarOpen;
  const btn = document.getElementById('bottom-tab-hotbar');
  const panel = document.getElementById('bottom-drawer-hotbar');
  if (btn) btn.classList.toggle('active', window.isBottomHotbarOpen);
  if (panel) panel.classList.toggle('hidden', !window.isBottomHotbarOpen);
};

window.toggle3DLabels = function () {
  window.are3DLabelsVisible = !window.are3DLabelsVisible;
  if (window.labelSpritesGroup) {
    window.labelSpritesGroup.visible = window.are3DLabelsVisible;
  }
  const btn = document.getElementById('toggle-labels-btn');
  if (btn) {
    btn.textContent = window.are3DLabelsVisible ? '🏷️ 隱藏 3D 地標標籤' : '🏷️ 顯示 3D 地標標籤';
    btn.classList.toggle('active', window.are3DLabelsVisible);
  }
};

// One-click preset for Low Tide (exposing Sanxiantai Tombolo causeway) or High Tide (submerging it)
window.setTidePreset = function (targetSeaLevel, focusSanxiantai = false) {
  if (typeof window.onTideSliderChange === 'function') {
    window.onTideSliderChange(targetSeaLevel);
  }
  const profileSlider = document.getElementById('profile-tide-slider');
  if (profileSlider) profileSlider.value = targetSeaLevel;

  if (focusSanxiantai && typeof window.focusLandmark === 'function') {
    window.focusLandmark('PHOTO_SANXIANTAI');
  }
};
