/* =====================================================================
   FD Reklam Engelleyici — anti-detect.js  (OPSİYONEL)
   ---------------------------------------------------------------------
   YouTube, eklenti varlığını tespit edip "reklam engelleyici bulundu"
   penceresi gösterebilir. Bu modül o pencereyi bastırmaya çalışır.

   VARSAYILAN: KAPALI.

   Neden varsayılan kapalı?
     1) Şeffaflık: kullanıcı tam olarak neyin çalıştığını bilmeli.
     2) Mağaza incelemesi: gizleyen kod, reklam engellemeden ayrı bir
        davranış olarak görülebilir. Kapalıyken hiç kurulmaz.

   Kapatıldığında YouTube "reklam engelleyici bulundu" uyarısı
   gösterebilir. Bu normaldir ve sayfayı bozmaz.

   NASIL ÇALIŞIR
     Bu dosya document_start'ta, sayfanın kendi betiklerinden ÖNCE
     çalışır. O anda kullanıcı ayarı henüz bilinmez (izole dünya
     daha sonra çalışır). Bu yüzden hook'lar kurulmaz; kısa aralıklarla
     bayrak kontrol edilir ve '1' görüldüğünde kurulur.

   DÖNÜŞÜM SONRASI YENİDEN UYGULANMAZ: JS'te bir proxy'yi geri
   sökmek güvenilir değildir. Ayarı değiştirdikten sonra sayfayı
   yeniden yüklemen gerekir. Bu, arayüzde açıkça yazılıdır.
   ===================================================================== */
(function () {
  'use strict';

  var FD = window.__FD;
  if (!FD) return;

  var ATTR = 'data-fd-antidetect';

  /**
   * Ayar şu anda açık mı?
   * '1'  -> açık, kur
   * '0'  -> kapalı, hiçbir şey kurma
   * null -> henüz bilinmiyor (belki henüz yükleniyor), kurma
   */
  function enabled() {
    try {
      return document.documentElement.getAttribute(ATTR) === '1';
    } catch (e) {
      return false;
    }
  }

  FD.antiDetectEnabled = enabled;

  // --- durum bayrakları ---
  var installed = false;
  var ticks = 0;
  var MAX_TICKS = 40;          // ~40 saniye boyunca dene

  function install() {
    if (installed) return;
    if (!enabled()) return;
    installed = true;
    try { buildHooks(); } catch (e) { /* sayfayı bozma */ }
  }

  // Ayar geç gelirse yakalayabilmek için kısa aralıklarla denetle
  var timer = setInterval(function () {
    if (installed) { clearInterval(timer); return; }
    ticks++;
    if (ticks > MAX_TICKS) { clearInterval(timer); return; }
    // İlk saniyelerde sık, sonra seyrek
    if (ticks % 4 === 0 || ticks < 10) install();
  }, 250);

  /* ===================================================================
     Aşağıdaki her şey yalnızca '1' görüldükten sonra çalışır
     =================================================================== */
  function buildHooks() {
    /* ---------------- toString maskeleme ---------------- */
    var NativeToString = Function.prototype.toString;
    var MASKED = [];

    function mask(fn) {
      if (typeof fn !== 'function' || MASKED.indexOf(fn) !== -1) return fn;
      MASKED.push(fn);
      return fn;
    }

    Function.prototype.toString = function toString() {
      if (MASKED.indexOf(this) !== -1) {
        return 'function ' + (this.name || '') + '() { [native code] }';
      }
      try {
        return NativeToString.call(this);
      } catch (e) {
        return 'function () { [native code] }';
      }
    };

    // Hook'ladığımız fonksiyonları maskele
    try { mask(window.fetch); } catch (e) {}
    try { mask(JSON.parse); } catch (e) {}
    try { mask(window.XMLHttpRequest.prototype.open); } catch (e) {}
    try { mask(window.XMLHttpRequest.prototype.send); } catch (e) {}

    /* ---------------- paylaşılan sinyaller ---------------- */
    try {
      Object.defineProperty(Object.prototype, 'hasAllowedInstreamAd', {
        configurable: true,
        get: function () { return true; },
        set: function () {}
      });
    } catch (e) {}

    /* ---------------- yt / ytplayer temizliği ---------------- */
    function scrub(node) {
      if (!node || typeof node !== 'object') return;

      if (node.openPopupConfig && node.openPopupConfig.supportedPopups) {
        try {
          delete node.openPopupConfig.supportedPopups.adBlockMessageViewModel;
          delete node.openPopupConfig.supportedPopups.adBlockMessage;
        } catch (e) {}
      }
      if (node.args) scrub(node.args);
      if (node.player_response) scrubPlayerResponse(node.player_response);
      if (node.raw_player_response) scrubPlayerResponse(node.raw_player_response);
    }

    function scrubPlayerResponse(pr) {
      if (!pr || typeof pr !== 'object') return;
      try {
        delete pr.adPlacements;
        delete pr.playerAds;
        delete pr.adSlots;
        if (pr.auxiliaryUi && pr.auxiliaryUi.messageRenderers) {
          var mr = pr.auxiliaryUi.messageRenderers;
          for (var k in mr) {
            if (/upsell|adblock|enforcement/i.test(k)) delete mr[k];
          }
        }
      } catch (e) {}
    }

    function wrapConfig(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      try {
        return new Proxy(obj, {
          get: function (t, p) {
            if (p === 'enforcementMessageViewModel' || p === 'adBlockMessageViewModel') {
              return undefined;
            }
            if (p === 'hasAllowedInstreamAd') return true;
            return t[p];
          },
          set: function (t, p, v) {
            if (p === 'enforcementMessageViewModel' || p === 'adBlockMessageViewModel') return true;
            if (p === 'hasAllowedInstreamAd') return true;
            t[p] = v;
            return true;
          },
          deleteProperty: function (t, p) { delete t[p]; return true; }
        });
      } catch (e) {
        return obj;
      }
    }

    function hookGlobal(name) {
      var existing;
      try {
        existing = window[name];
      } catch (e) {
        return;
      }

      // Zaten tanimliyse sarmalayip birak
      if (existing && typeof existing === 'object') {
        scrub(existing);
        try { window[name] = wrapConfig(existing); } catch (e) {}
        return;
      }

      // Henuz tanimli degilse: atama aninda yakala.
      // Getter MUTLAKA guncel degeri dondurmeli, yoksa YouTube
      // `window.yt`'i okudugunda hep undefined gorur.
      var current;
      try {
        Object.defineProperty(window, name, {
          configurable: true,
          enumerable: true,
          get: function () { return current; },
          set: function (v) {
            try { scrub(v); } catch (e) {}
            current = wrapConfig(v);
          }
        });
      } catch (e) {
        // defineProperty basarisiz olursa umut etmeyelim
      }
    }

    hookGlobal('yt');
    hookGlobal('ytplayer');
    hookGlobal('ytcfg');

    /* ---------------- googletag sahtelemesi ----------------
       Ağ katmanı doubleclick/googlesyndication'ı engellediği için
       googletag kütüphanesi hiç yüklenmiyor. Yokluğu "reklam ağına
       ulaşılamadı" sinyalidir. Zararsız bir taklit kuruyoruz: çağrılar
       no-op döner, hiçbir ağ isteği yapılmaz.
       Gerçek googletag sonradan yüklenirse yerini bırakır. */
    function chainableStub() {
      var stub = {};
      var noop = function () { return stub; };
      stub.addService = noop;
      stub.appendChild = noop;
      stub.attachToDocument = noop;
      stub.setTarget = noop;
      stub.setSubSlots = noop;
      stub.clearSubSlots = noop;
      stub.noLazyLoad = noop;
      stub.defineSizeMapping = noop;
      stub.getSizes = function () { return []; };
      stub.getService = function () { return stub; };
      stub.getSlotById = function () { return null; };
      return stub;
    }

    var shim = null;
    function installGoogletagShim() {
      if (shim) return;
      try {
        if (window.googletag) return;   // gercek kutuphane varsa dokunma
      } catch (e) {
        return;
      }

      shim = {
        cmd: {
          push: function (arg) {
            try {
              var items = Array.isArray(arg) ? arg : [arg];
              for (var i = 0; i < items.length; i++) {
                if (typeof items[i] === 'function') {
                  try { items[i](); } catch (e) {}
                }
              }
            } catch (e) {}
          }
        },
        loaded: true,
        defineSlot: function () { return chainableStub(); },
        destroySlots: function () {},
        enableSingleRequest: function () {},
        disableSingleRequest: function () {},
        display: function () { return { validate: false }; },
        pubads: {
          getSlots: function () { return []; },
          collapseEmptyDivs: function () {},
          setCentering: function () {},
          refresh: function () {}
        },
        __fdShim: true
      };

      try {
        window.googletag = shim;
      } catch (e) {}
    }

    installGoogletagShim();

    /* ---------------- reklam dogrulama ping'leri ---------------- */
    try {
      var origPost = window.postMessage;
      window.postMessage = function (msg, target, transfer) {
        try {
          if (msg && typeof msg === 'object') {
            var s = JSON.stringify(msg);
            if (s && /adBreakHeartbeat|adPlaybackEnd|adServingData|adPlacements|adBlock/i.test(s)) {
              return; // sessizce yut
            }
          }
        } catch (e) {}
        return origPost.apply(this, arguments);
      };
      mask(window.postMessage);
    } catch (e) {}

    /* ---------------- periyodik temizlik ---------------- */
    setInterval(function () {
      if (FD.off()) return;
      try {
        if (window.yt && window.yt.config_) scrub(window.yt.config_);
        if (window.ytplayer && window.ytplayer.config) scrub(window.ytplayer.config);
        if (window.ytcfg) scrub(window.ytcfg);
        if (window.ytInitialPlayerResponse) scrubPlayerResponse(window.ytInitialPlayerResponse);
      } catch (e) {}
    }, 1500);

    console.info('[FD] Algılama karşıtı etkinleştirildi.');
  }
})();
