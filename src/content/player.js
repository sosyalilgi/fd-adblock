/* =====================================================================
   FD Reklam Engelleyici — player.js
   ---------------------------------------------------------------------
   Kozmetik filtrelerden sızan oynatıcı-içi reklamlar için son savunma.

   Amaç: reklamı kullanıcıya GÖSTERMEMEK.

   Önceki sürüm reklamı sessize alıp 16x yapıyordu; bu çalışıyordu
   ama 15 saniyelik reklam ~1 saniye görünüyordu. Kullanıcının
   sorduğu tam olarak buydu: "görsel olarak bir görüntü görüyor muyum?"

   Şimdi sıra:
     1. "Atla" düğmesi varsa tıkla      (YouTube kendi kapatır)
     2. Yoksa videoyu sonuna sar        (reklam ~1 karede biter,
                                         kullanıcı görmez)
     3. Olmuyorsa sessiz + 16x          (son çare)

   Tespit mantığı player-detect.js'te (saf, test edilebilir).
   İzole dünya.
   ===================================================================== */
(function () {
  'use strict';

  var FDI = globalThis.FDI;
  if (!FDI) return;

  var PD = globalThis.FDPlayerDetect;
  if (!PD) {
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
  var sonlandirilan = 0;
  var hizlandirilan = 0;
  var sonPlan = null;

  function video() {
    try { return document.querySelector('video'); } catch (e) { return null; }
  }

  /* Tanılama bunu okur. FDI izole dünyada olduğu için doğrudan
     görünmez; DOM etiketi iki dünya arasında paylaşılır. */
  function durumuYaz() {
    try {
      document.documentElement.setAttribute(PD.REKLAM_ETIKETI, JSON.stringify({
        atlanan: atlanan,
        sonlandirilan: sonlandirilan,
        hizlandirilan: hizlandirilan,
        sonPlan: sonPlan
      }));
    } catch (e) {}
  }

  function speedThrough(video) {
    if (isSpeeding) return;
    isSpeeding = true;
    savedRate = video.playbackRate || 1;
    savedMuted = !!video.muted;
    try {
      video.muted = true;
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

  /* Reklamı sonuna sar → kullanıcı görmez. */
  function seekToEnd(v) {
    try {
      v.currentTime = Math.max(0, v.duration - PD.SONUNCU_SANIYE);
      return true;
    } catch (e) {
      return false;
    }
  }

  function tick() {
    if (FDI.prefs && FDI.prefs.enabled === false) {
      var v0 = video();
      if (v0) restore(v0);
      return;
    }

    if (!PD.reklamVarMi(sorgu)) {
      var v = video();
      if (v) restore(v);
      return;
    }

    var atlaDugmesiVar = !!PD.atlaDugmesi(sorgu);
    var v2 = video();
    var d = { atlaVar: atlaDugmesiVar, sure: v2 ? v2.duration : 0 };

    var p = PD.plan(d);
    sonPlan = p.aksiyon;

    if (p.aksiyon === 'atla') {
      trySkip();
    } else if (p.aksiyon === 'sonlandir' && v2) {
      // Önce sessize al (sesli son sıfır anı duyulmasın)
      try { v2.muted = true; } catch (e) {}
      if (seekToEnd(v2)) {
        sonlandirilan++;
        FDI.report('ads', 1);
      } else {
        speedThrough(v2);
      }
    } else if (p.aksiyon === 'hizlandir' && v2) {
      speedThrough(v2);
    }
    // 'bekle' → sonraki turda tekrar dene (süre henüz bilinmiyor)

    durumuYaz();
  }

  FDI.initPlayer = function () {
    durumuYaz();

    /* Zamanlayıcı KAPATILMAZ. Önceki sürüm 5 dakika sonra
       clearInterval ile tamamen duruyordu. */
    var HIZ = 400;
    var YAVAS = 1500;
    var iv = setInterval(tick, HIZ);
    setTimeout(function () {
      clearInterval(iv);
      iv = setInterval(tick, YAVAS);
    }, 300000);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearInterval(iv);
      } else {
        tick();
        iv = setInterval(tick, YAVAS);
      }
    });

    document.addEventListener('yt-navigate-finish', function () {
      isSpeeding = false;
      setTimeout(tick, 300);
    });

    window.addEventListener('pagehide', function () {
      var v = video();
      if (v) restore(v);
    });

    document.addEventListener('yt-player-ready', function () {
      if (PD.reklamVarMi(sorgu)) tick();
    });

    FDI.playerStats = function () {
      return {
        atlanan: atlanan,
        sonlandirilan: sonlandirilan,
        hizlandirilan: hizlandirilan,
        sonPlan: sonPlan
      };
    };
  };
})();