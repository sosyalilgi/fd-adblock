/* =====================================================================
   FD Reklam Engelleyici — json-prune.js
   ---------------------------------------------------------------------
   Sayfanın kendi JS'i OYNATICIYA GÖRE OYNATICIYI okumadan önce
   `ytInitialPlayerResponse` ve Innertube API yanıtlarını parse eder.
   Bu script JSON.parse'ı proxy'leyerek reklam alanlarını yanıttan
   tamamen siler.
   Ana dünya (MAIN world) — chrome API'lerine erişemez.
   ===================================================================== */
(function () {
  'use strict';

  var FD = (window.__FD = window.__FD || {});

  // Eklenti kapalıyken tüm hook'lar pasif çalışır.
  // Aynı dünya içinde attribute okumak güvenli ve senkron.
  FD.off = function () {
    try {
      return document.documentElement.getAttribute('data-fd-off') === '1';
    } catch (e) {
      return false;
    }
  };

  FD.emit = function (type, detail) {
    try {
      document.dispatchEvent(new CustomEvent('fd:' + type, { detail: String(detail || '') }));
    } catch (e) {
      /* yok say */
    }
  };

  FD.stats = FD.stats || { ads: 0, requests: 0 };

  // ---- Sayaç yayını ----
  // ÖNEMLİ: prune() hem JSON.parse kancasından hem fetch yolundan
  // çağrılır. JSON.parse yolu OYNATICI YANITINI işler (yanıtın büyük
  // kısmı buradan geçer) ama her parse'da mesaj göndermek pahalıdır.
  // Bu yüzden fark biriktirilir ve en fazla saniyede bir yayınlanır.
  // (Eskiden yalnızca fetch yolu yayınlıyordu; arka plandaki sayı
  //  sayfa içi sayının çok altında kalıyordu.)
  FD._pending = 0;
  FD._lastFlush = 0;

  FD.flush = function () {
    var n = FD._pending;
    FD._pending = 0;
    FD._lastFlush = Date.now();
    if (n > 0) FD.emit('ads', n);
  };

  FD.countAd = function (n) {
    FD.stats.ads += n;
    FD._pending += n;
  };

  // ---- Strateji ----
  // 'delete' : alanları tamamen sil (varsayılan, çalıştığı doğrulandı)
  // 'spoof'  : alanları boş diziyle DEĞİŞTİR, silme.
  //            Gerçek tarayıcıda bu alanlar hep vardır; yokluğu
  //            "cevap kurcalanmış" sinyali verebilir.
  FD.strategy = function () {
    try {
      var v = document.documentElement.getAttribute('data-fd-strategy');
      // Bilinmeyen/geçersiz değer gelirse güvenli varsayılana düş
      return (v === 'spoof' || v === 'delete') ? v : 'delete';
    } catch (e) {
      return 'delete';
    }
  };

  // Silinecek üst seviye alanlar.
  var AD_KEYS = [
    'adPlacements',
    'playerAds',
    'adSlots',
    'adBreakHeartbeatParams',
    'adBreakParams',
    'adVideoCurrentTimeRenderer',
    'adSlotRenderers'
  ];

  // Anti-adblock / zorlama mesajları.
  var ENFORCE_KEYS = [
    'enforcementMessageViewModel',
    'enforcementMessage',
    'adBlockerOverlay',
    'adBlockDetected',
    'adBlocksFound'
  ];

  // Yalnızca bu dallara ineriz; tüm nesneyi dolaşmayız.
  var BRANCH_KEYS = [
    'playerResponse',
    'response',
    'adPlacements',
    'adSlots',
    'responseContext',
    'auxiliaryUi',
    'messageRenderers',
    'contents',
    'items',
    'onResponseReceivedEndpoints',
    'frameworkUpdates',
    'playerConfig',
    'raw_player_response',
    'args'
  ];

  // contents dizilerinde tek başına duran reklam renderer'ları
  // (YouTube bunları { adSlotRenderer: {...} } biçiminde gönderir)
  var AD_RENDERER_RE = /^(adSlot|displayAd|inFeedAdLayout|promotedSparkles|videoMastheadAd|statementBanner|bannerPromo|searchPromo|carouselAd|brandVideo|actionCompanionAd|videoAds|adSlotV3|adBreak|feedAd|renderPromoted|adLayout|promotedVideo)Renderer$/;

  function isAdRenderer(obj) {
    if (Array.isArray(obj) || !obj || typeof obj !== 'object') return false;
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (AD_RENDERER_RE.test(k)) return true;
    }
    return false;
  }

  function countAds(obj, key) {
    var v = obj[key];
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === 'object') return 1;
    return 1;
  }

  // 'spoof' stratejisinde alanın yerine konacak zararsız değer.
  // Dizi olan alanlara boş dizi, diğerlerine undefined.
  // (YouTube oynatıcısı alanı "var ama boş" olarak görür — tespit
  //  tetikleyen "alan kayıp" durumu oluşmaz.)
  function EMPTY_PLACEHOLDER(key) {
    if (key === 'adPlacements' || key === 'playerAds' ||
        key === 'adSlots' || key === 'adSlotRenderers') {
      return [];
    }
    return undefined;
  }

  // Oynatıcı yanıtı mı? videoDetails + streamingData/playabilityStatus
  // birlikte gelir. "ilk başta reklam varmış" bilgisi kaybolmasın diye
  // SİLME YAPILMADAN ÖNCE yakalanır.
  function looksLikePlayerResponse(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    if (!o.videoDetails || typeof o.videoDetails !== 'object') return false;
    return !!(o.streamingData || o.playabilityStatus);
  }

  function capturePlayerInfo(obj) {
    try {
      var durum = function (k) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) return 'YOK';
        var v = obj[k];
        if (Array.isArray(v)) return v.length ? 'var (' + v.length + ')' : 'var (bos)';
        return 'var';
      };
      FD.lastPlayerInfo = {
        videoId: (obj.videoDetails && obj.videoDetails.videoId) || '(yok)',
        adPlacements: durum('adPlacements'),
        playerAds: durum('playerAds'),
        adSlots: durum('adSlots'),
        enforcement: Object.prototype.hasOwnProperty.call(obj, 'enforcementMessageViewModel')
          ? 'VAR' : 'yok',
        at: Date.now()
      };
    } catch (e) {}
  }

  /**
   * Nesne ağacından reklam alanlarını siler.
   * @returns {boolean} değişiklik yapıldı mı
   */
  function prune(obj, depth, seen) {
    if (!obj || typeof obj !== 'object' || depth > 8) return false;
    if (seen.has(obj)) return false;
    seen.add(obj);

    var changed = false;
    var i, key, val;

    // --- Diziler: reklam renderer öğelerini tümden çıkar ---
    if (Array.isArray(obj)) {
      for (var k = obj.length - 1; k >= 0; k--) {
        var el = obj[k];
        if (!el || typeof el !== 'object') continue;
        if (isAdRenderer(el)) {
          obj.splice(k, 1);
          FD.countAd(1);
          changed = true;
        } else {
          prune(el, depth + 1, seen);
        }
      }
      return changed;
    }

    // Oynatıcı yanıtını gördüğümüzü ve içinde ne olduğunu kaydet.
    // SPA geçişlerinde window.ytInitialPlayerResponse kaybolabiliyor;
    // bu kayıt ölçümü her zaman mümkün kılıyor.
    if (looksLikePlayerResponse(obj)) capturePlayerInfo(obj);

    var spoof = FD.strategy() === 'spoof';

    for (i = 0; i < AD_KEYS.length; i++) {
      key = AD_KEYS[i];
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var n = countAds(obj, key);
        if (spoof) {
          // Alan yerinde kalsin ama reklam tasımısın
          try {
            obj[key] = EMPTY_PLACEHOLDER(key);
          } catch (e) {}
        } else {
          try {
            delete obj[key];
          } catch (e) {
            try {
              obj[key] = undefined;
            } catch (e2) {}
          }
        }
        FD.countAd(n);
        changed = true;
      }
    }

    for (i = 0; i < ENFORCE_KEYS.length; i++) {
      key = ENFORCE_KEYS[i];
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        try {
          delete obj[key];
        } catch (e) {}
        changed = true;
      }
    }

    // auxiliaryUi.messageRenderers.*upsell* / *adBlocker*
    if (obj.auxiliaryUi && typeof obj.auxiliaryUi === 'object') {
      var mr = obj.auxiliaryUi.messageRenderers;
      if (mr && typeof mr === 'object') {
        for (key in mr) {
          if (/upsell|adblock|adblocker|enforcement|premium/i.test(key)) {
            delete mr[key];
            changed = true;
          }
        }
      }
    }

    // responseContext.adSignalsInfo — reklam sinyalleri
    if (obj.responseContext && typeof obj.responseContext === 'object') {
      if ('adSignalsInfo' in obj.responseContext) {
        try {
          delete obj.responseContext.adSignalsInfo;
          changed = true;
        } catch (e) {}
      }
    }

    for (i = 0; i < BRANCH_KEYS.length; i++) {
      key = BRANCH_KEYS[i];
      val = obj[key];
      if (val && typeof val === 'object') {
        if (prune(val, depth + 1, seen)) changed = true;
      }
    }

    return changed;
  }

  FD.prune = prune;

  /**
   * Yanıt metnini budar. Metin değişmezse aynı metni döner.
   * @returns {string|null}
   */
  FD.pruneJSONText = function (text) {
    if (typeof text !== 'string' || text.length < 2) return null;
    if (text.indexOf('adPlacements') === -1 &&
        text.indexOf('playerAds') === -1 &&
        text.indexOf('adSlots') === -1 &&
        text.indexOf('enforcementMessage') === -1 &&
        text.indexOf('upsellDialog') === -1 &&
        text.indexOf('adSignalsInfo') === -1) {
      return null;
    }
    try {
      // origParse kullan: hookedParse zaten budar, çift budamayı önle
      var obj = origParse(text);
      var before = FD.stats.ads;
      prune(obj, 0, new Set());
      if (FD.stats.ads !== before) {
        FD.flush();               // birikmiş reklam sayısını yayınla
        return JSON.stringify(obj);
      }
    } catch (e) {
      /* parse edilemezse dokunma */
    }
    return null;
  };

  /* ---------------- JSON.parse tuzağı ---------------- */
  var origParse = JSON.parse;
  var parseHooked = false;
  var FLUSH_INTERVAL = 1000;

  function hookedParse(text, reviver) {
    var result = origParse.call(JSON, text, reviver);
    try {
      if (!FD.off() && result && typeof result === 'object') {
        prune(result, 0, new Set());
        // Oynatıcı yanıtı genelde BURADAN geçer. Sayaç bu yolda
        // biriktirilir; saniyede en fazla bir kez arka plana gönderilir
        // (her parse'da mesaj atmak pahalı olurdu).
        if (Date.now() - FD._lastFlush > FLUSH_INTERVAL) FD.flush();
      }
    } catch (e) {
      /* asla sayfayı bozma */
    }
    return result;
  }

  function installParseHook() {
    if (parseHooked) return;
    parseHooked = true;
    try {
      JSON.parse = hookedParse;
      // Sayfanın "bu native mi?" kontrolüne takılmamak için
      // Function.prototype.toString maskelemesi anti-detect.js'te yapılır.
    } catch (e) {
      /* yoksay */
    }
  }

  installParseHook();
  FD.installParseHook = installParseHook;

  /* -------- Sayfa kendi JSON.parse'ını geri yüklemeye çalışırsa -------- */
  Object.defineProperty(JSON, 'parse', {
    configurable: true,
    writable: true,
    value: hookedParse
  });
})();
