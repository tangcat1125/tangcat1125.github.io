(function (global, doc) {
  'use strict';

  var audio;
  var started = false;

  function ensureAudio() {
    if (audio) return audio;
    audio = doc.getElementById('bgm') || doc.createElement('audio');
    audio.id = 'bgm';
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.55;
    if (!audio.querySelector('source')) {
      var source = doc.createElement('source');
      source.src = 'assets/audio/Polite_Applause_for_Nothing.mp3';
      source.type = 'audio/mpeg';
      audio.appendChild(source);
    }
    if (!audio.parentNode) doc.body.appendChild(audio);
    return audio;
  }

  function start() {
    var player = ensureAudio();
    if (started) return;
    started = true;
    var promise = player.play();
    if (promise && typeof promise.catch === 'function') promise.catch(function () { started = false; });
  }

  function stop() {
    var player = ensureAudio();
    player.pause();
    started = false;
  }

  global.CanyonTownAudio = { start: start, stop: stop, get: ensureAudio };
  doc.addEventListener('click', start, { once: true, passive: true });
  doc.addEventListener('keydown', start, { once: true, passive: true });
})(window, document);
