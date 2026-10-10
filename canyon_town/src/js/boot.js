/**
 * boot.js — 初始化 window.Game 命名空間。
 * 供 file:// 經典腳本依序掛載，避免 ES module。
 * 不負責遊戲邏輯。
 */
(function (global) {
  'use strict';
  var Game = global.Game || {};
  Game.version = '0.1.0-mvp';
  Game.DATA = Game.DATA || {};
  Game.state = Game.state || {};
  Game.api = Game.api || {};
  global.Game = Game;
})(window);
