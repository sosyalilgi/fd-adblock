/* =====================================================================
   FD Reklam Engelleyici — player.js
   ---------------------------------------------------------------------
   Kozmetik filtrelerden sızan oynatıcı-içi reklamlar için son savunma:
     • Atlanabilir reklamlarda "Atla" düğmesine anında tıklar
     • Atlanamayan reklamları sessize alır ve 16x hızlandırır
     • Reklam bittiğinde kullanıcının ses/hız ayarlarını geri yükler
   İzole dünya.

   Tespit mantığı player-detect.js'te (saf, test edilebilir). Buradaki
   DÜZELTMELER önceki sürümde sessizce çalışmıyordu:
     • AD_SELECTORS bir string idi ama dizi gibi iterate ediliyordu
     • offsetParent kontrolü sabit konumlu reklamları görmüyordu
     • setInterval 5 dakika sonra SÜRESİZ olarak duruyordu
   ===================================================================== */
(function () {
  'use strict';

  var FDI = globalThis.FDI;
  if (!FDI) return;

  var PD = globalThis.FDPlayerDetect;
  if (!PD) {
    // Bileşen yüklenemedi: reklam oynatıcıda kalır, sessizce çökmez.
    console.warn('[FD] player-detect yuklenemedi, oynatici yedegi devre disi');
    return;
  }

  var sorgu = function (sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
  };

  var isSpeeding = false;
  var savedRate = 1;
  var savedMuted = false;
  var atlanan = 0;
  var hizlandirilan = 0;

  function adsPresent() {
    return PD.reklamVarMi(sorgu);
  }

  function trySkip() {
    var btn = PD.atlaDugmesi(sorgu);
    if (!btn) return false;
    try {
      btn.click();
      FDI.report('ads', 1);
      atlanan++;
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
      hizlandirilan++;
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

  function video() {
    try { return document.querySelector('video'); } catch (e) { return null; }
  }

  function tick() {
    if (FDI.prefs && FDI.prefs.enabled === false) {
      var v0 = video();
      if (v0) restore(v0);
      return;
    }
    if (!adsPresent()) {
      var v = video();
      if (v) restore(v);
      return;
    }
    if (!trySkip()) {
      var v2 = video();
      if (v2) speedThrough(v2);
    }
  }

  FDI.initPlayer = function () {
    trySkip();

    /* Zamanlayıcı KAPATILMAZ. Önceki sürüm 5 dakika sonra
       clearInterval ile tamamen duruyordu; 5 dakikadan uzun izlenen
       videolarda yedek ölüyordu. Bunun yerine sık sık yoklama
       kademeli olarak seyreltilir: koruma hiç kesilmez. */
    var HIZ = 400;
    var YAVAS = 1500;
    var iv = setInterval(tick, HIZ);
    setTimeout(function () {
      clearInterval(iv);
      iv = setInterval(tick, YAVAS);
    }, 300000);

    // Sekme arka plana alininca gereksiz yoklama yapma
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearInterval(iv);
      } else {
        tick();
        iv = setInterval(tick, YAVAS);
      }
    });

    // Yeni video açıldığında yeniden başlat
    document.addEventListener('yt-navigate-finish', function () {
      isSpeeding = false;
      setTimeout(tick, 300);
    });

    window.addEventListener('pagehide', function () {
      var v = video();
      if (v) restore(v);
    });

    // Oynatıcı ilk yüklendiğinde teşhis
    document.addEventListener('yt-player-ready', function () {
      if (adsPresent()) tick();
    });

    FDI.playerStats = function () {
      return { atlanan: atlanan, hizlandirilan: hizlandirilan };
    };
  };
})();