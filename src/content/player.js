/* =====================================================================
   FD Reklam Engelleyici — player.js
   ---------------------------------------------------------------------
   Kozmetik filtrelerden sızan oynatıcı-içi reklamlar için son savunma:
     • Atlanabilir reklamlarda "Atla" düğmesine anında tıklar
     • Atlanamayan reklamları sessize alır ve 16x hızlandırır
     • Reklam bittiğinde kullanıcının ses/hız ayarlarını geri yükler
   İzole dünya.
   ===================================================================== */
(function () {
  'use strict';

  var FDI = globalThis.FDI;
  if (!FDI) return;

  var SKIP_SELECTORS = [
    '.ytp-ad-skip-button',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot button',
    'button.ytp-ad-skip-button-modern'
  ].join(',');

  var AD_SELECTORS = [
    '.video-ads',
    'ytd-player-legacy-desktop-watch-ads-renderer',
    '.ytp-ad-module',
    '.ytp-ad-overlay-container'
  ].join(',');

  var isSpeeding = false;
  var savedRate = 1;
  var savedMuted = false;
  var processed = 0;

  function adsPresent() {
    try {
      for (var i = 0; i < AD_SELECTORS.length; i++) {
        var el = document.querySelector(AD_SELECTORS[i]);
        if (el && el.offsetParent !== null) return true;
      }
    } catch (e) {}
    return false;
  }

  function trySkip() {
    var btn = null;
    try { btn = document.querySelector(SKIP_SELECTORS); } catch (e) {}
    if (!btn) return false;
    // Tıklanabilir olmasını bekle
    if (btn.disabled) return false;
    try {
      btn.click();
      FDI.report('ads', 1);
      return true;
    } catch (e) {
      return false;
    }
  }

  function speedThrough(video) {
    if (isSpeeding) return;
    isSpeeding = true;
    savedRate = video.playbackRate || 1;
    savedMuted = !!video.muted;
    try {
      video.muted = true;
      // 16 oynatıcının desteklediği en yüksek hızlardan biri
      video.playbackRate = 16;
    } catch (e) {
      isSpeeding = false;
    }
  }

  function restore(video) {
    if (!isSpeeding) return;
    isSpeeding = false;
    try {
      video.playbackRate = savedRate;
      video.muted = savedMuted;
    } catch (e) {}
  }

  function tick() {
    if (FDI.prefs && FDI.prefs.enabled === false) {
      // Kapalıyken hızı geri yüklemeyi unutma
      var v0 = document.querySelector('video');
      if (v0) restore(v0);
      return;
    }
    if (!adsPresent()) {
      var v = document.querySelector('video');
      if (v) restore(v);
      return;
    }
    if (!trySkip()) {
      var v2 = document.querySelector('video');
      if (v2) speedThrough(v2);
    }
  }

  FDI.initPlayer = function () {
    trySkip();
    // Oynatıcı ilk yüklendiğinde bir kez çalıştır
    var iv = setInterval(tick, 400);
    setTimeout(function () { clearInterval(iv); }, 300000); // 5 dk sonra seyrelt

    // Yeni video açıldığında yeniden başlat
    document.addEventListener('yt-navigate-finish', function () {
      isSpeeding = false;
      setTimeout(tick, 300);
    });

    window.addEventListener('pagehide', function () {
      var v = document.querySelector('video');
      if (v) restore(v);
    });

    // Oynatıcı ilk yüklendiğinde teşhis
    document.addEventListener('yt-player-ready', function () {
      if (adsPresent()) tick();
    });

    processed++;
  };
})();
