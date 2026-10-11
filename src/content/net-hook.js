/* =====================================================================
   FD Reklam Engelleyici — net-hook.js
   ---------------------------------------------------------------------
   Innertube API'sine giden fetch/XHR isteklerini yakalar:
     1) Yanıt gövdesindeki reklam alanlarını budar (json-prune.js).
     2) /player istek gövdesine isInlinePlaybackNoAd sinyali enjekte eder
        (YouTube'un "reklam engelleyici tespit edildi" kilidini kırar).
   Ana dünya (MAIN world).
   ===================================================================== */
(function () {
  'use strict';

  var FD = window.__FD;
  if (!FD) return;

  var MAX_BODY = 6 * 1024 * 1024; // 6 MB üstü yanıtlara dokunma

  // Reklam verisi taşıyan Innertube uçları
  var API_RE = /\/youtubei\/v1\/(player|browse|next|search|guide|reel\/reel_watch_sequence|get_watch|account\/get_setting)/;

  function isAPI(url) {
    return typeof url === 'string' && API_RE.test(url);
  }

  function urlOf(input) {
    try {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url;
    } catch (e) {}
    return '';
  }

  /* ------------------------------------------------------------------
     İstek gövdesine "reklam yok" sinyali enjekte et
     ------------------------------------------------------------------ */
  function injectNoAdSignal(bodyText) {
    if (typeof bodyText !== 'string' || !bodyText) return null;
    if (bodyText.indexOf('isInlinePlaybackNoAd') !== -1) return null;
    try {
      var obj = JSON.parse(bodyText);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

      var degisti = false;

      if (obj.context && typeof obj.context === 'object') {
        obj.context.isInlinePlaybackNoAd = true;
        degisti = true;
      }

      // HİÇBİR ŞEY DEĞİŞMEDİYSE GÖVDEYE DOKUNMA.
      // Daha önce burada daima JSON.stringify dönüyordu; yani değişiklik
      // olmasa bile gövde yeniden serileştirilip gönderiliyordu.
      // Gereksiz yere gövde değiştirmek riski artırır.
      if (!degisti) return null;

      return JSON.stringify(obj);
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------
     fetch
     ------------------------------------------------------------------ */
  var origFetch = window.fetch;

  function fdFetch(input, init) {
    try {
      if (FD.off() || !isAPI(urlOf(input))) {
        return origFetch.apply(this, arguments);
      }
    } catch (e) {
      return origFetch.apply(this, arguments);
    }

    FD.stats.requests++;
    FD.emit('requests', 1);

    // İstek gövdesine sinyal enjekte et
    var newInit = init;
    var req = null;
    try {
      req = (init && init.body) ? init : (input && typeof input === 'object' && 'body' in input ? input : null);
    } catch (e) {}
    if (req && typeof req.body === 'string') {
      var patched = injectNoAdSignal(req.body);
      if (patched) {
        try {
          newInit = Object.assign({}, init || {});
          if (typeof Request !== 'undefined' && input instanceof Request) {
            newInit.body = patched;
          } else {
            newInit.body = patched;
          }
          return fdResponse(origFetch.call(this, input, newInit));
        } catch (e) {
          return fdResponse(origFetch.apply(this, arguments));
        }
      }
    }
    return fdResponse(origFetch.apply(this, arguments));
  }

  /* ------------------------------------------------------------------
     Yeni Response kurarken ESKİ BAŞLIKLARI KOPYALAMAK TEHLİKELİDİR.

     res.text() gövdeyi ÇÖZER (gunzip). Orijinal başlıkları olduğu gibi
     kopyalarsak tarayıcı çözülmüş metni TEKRAR gunzip etmeye çalışır,
     "content-length" da yeni gövdeyle tutmaz; sonuç: yanıt okunamaz
     hale gelir. Oynatıcı verisini alamaz ve VİDEO OYNAMAZ.

     Bu sessiz bir hatadır — hata fırlatmaz, sadece bazı sayfalarda
     oynatmayı bozar. Bu yüzden yalnızca güvenli başlıklar taşınır.
     ------------------------------------------------------------------ */
  var GUVENLI_BASLIKLAR = ['content-type', 'content-language'];

  function temizBasliklar(res) {
    var out = {};
    try {
      for (var i = 0; i < GUVENLI_BASLIKLAR.length; i++) {
        var v = res.headers.get(GUVENLI_BASLIKLAR[i]);
        if (v) out[GUVENLI_BASLIKLAR[i]] = v;
      }
    } catch (e) {}
    return out;
  }

  function fdResponse(promise) {
    return promise.then(function (res) {
      if (!res || !res.ok || FD.off()) return res;
      var ctype = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
      if (ctype.indexOf('json') === -1) return res;
      var clen = res.headers.get ? parseInt(res.headers.get('content-length') || '0', 10) : 0;
      if (clen && clen > MAX_BODY) return res;

      return res.clone().text().then(function (text) {
        var pruned = FD.pruneJSONText(text);
        if (!pruned) return res;
        try {
          FD.stats.rebuilt = (FD.stats.rebuilt || 0) + 1;
          return new Response(pruned, {
            status: res.status,
            statusText: res.statusText,
            headers: temizBasliklar(res)   // ← eski başlıklar KOPYALANMAZ
          });
        } catch (e) {
          return res;
        }
      }).catch(function () { return res; });
    }).catch(function (err) { throw err; });
  }

  /* ------------------------------------------------------------------
     XMLHttpRequest
     ------------------------------------------------------------------ */
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var origOpen = XHR.prototype.open;
    var origSend = XHR.prototype.send;

    XHR.prototype.open = function (method, url) {
      try {
        this.__fdUrl = String(url || '');
        this.__fdApi = isAPI(this.__fdUrl);
      } catch (e) {
        this.__fdApi = false;
      }
      return origOpen.apply(this, arguments);
    };

    XHR.prototype.send = function (body) {
      try {
        if (!this.__fdApi || FD.off()) return origSend.apply(this, arguments);
        FD.stats.requests++;
        FD.emit('requests', 1);

        var patched = injectNoAdSignal(body);
        if (patched) body = patched;
      } catch (e) {
        /* yoksay */
      }
      this.addEventListener('load', function () {
        try {
          if (FD.off() || !this.response || this.responseType !== 'text' || !this.responseText) return;
          var pruned = FD.pruneJSONText(this.responseText);
          if (!pruned) return;
          // responseText salt okunur; yeniden yazılamaz olduğu için
          // Object.defineProperty ile ezilir.
          Object.defineProperty(this, 'responseText', {
            configurable: true,
            get: (function (p) { return function () { return p; }; })(pruned)
          });
          Object.defineProperty(this, 'response', {
            configurable: true,
            get: (function (p) { return function () { return p; }; })(pruned)
          });
        } catch (e) {}
      });
      return origSend.apply(this, [body]);
    };
  }

  /* ------------------------------------------------------------------
     Kurulum
     ------------------------------------------------------------------ */
  try {
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      writable: true,
      value: fdFetch
    });
  } catch (e) {
    try { window.fetch = fdFetch; } catch (e2) {}
  }

  FD.hooked = { fetch: fdFetch, XHR: XHR };
})();
