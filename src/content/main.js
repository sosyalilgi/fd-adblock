/* =====================================================================
   FD Reklam Engelleyici — main.js
   ---------------------------------------------------------------------
   İzole dünyanın orkestrasyonu:
     • Ayarları yükler ve ana dünyaya attribute ile bildirir
     • Kozmetik filtreleri uygular
     • Oynatıcı katmanını başlatır
     • Ana dünyadan gelen sayaç olaylarını background'a iletir
   ===================================================================== */
(function () {
  'use strict';

  var FDI = globalThis.FDI;
  if (!FDI) return;

  var ATTR_OFF = 'data-fd-off';
  var ATTR_READY = 'data-fd-ready';

  /* ---------------- background'a sayaç gönderimi ---------------- */
  FDI.report = function (kind, amount) {
    amount = amount || 1;
    try {
      chrome.runtime.sendMessage({ type: 'fd:count', kind: kind, amount: amount }, function () {
        void chrome.runtime.lastError;
      });
    } catch (e) {}
  };

  /* ---------------- ana dünyaya durum bildirimi ---------------- */
  /* ---------------- ağdan engellenen istek sayacı ----------------
     webRequest, DNR engellemelerini raporlamıyor (DNR ağ yığınından
     önce çalışıyor). Bu yüzden sayfa, performance kayıtlarındaki
     "blok imzasını" sayar: transferSize 0 + status 0 + <150 ms.
     Gerçek ağ hatası (DNS/TLS) genelde 100 ms üstündür, ikisi ayrışır.
     Ekstra izin gerektirmez. */
  var AD_PATTERN = /doubleclick|googlesyndication|googleadservices|2mdn\.net|\/pagead\/|ad_break|\/api\/stats\/ads|\/ptracking/;
  var BLOCK_FAST_MS = 150;
  var lastBlockedCount = -1;

  FDI.countBlocked = function () {
    try {
      var entries = performance.getEntriesByType('resource');
      var n = 0;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!AD_PATTERN.test(e.name)) continue;
        if ((e.transferSize || 0) !== 0) continue;
        if ((e.responseStatus || 0) !== 0) continue;
        if ((e.duration || 0) >= BLOCK_FAST_MS) continue;
        n++;
      }
      if (n !== lastBlockedCount) {
        lastBlockedCount = n;
        try {
          chrome.runtime.sendMessage({ type: 'fd:setBlockedCount', value: n }, function () {
            void chrome.runtime.lastError;
          });
        } catch (e2) {}
      }
    } catch (e) {}
  };

  FDI.broadcastState = function (prefs) {
    var root = document.documentElement;
    try {
      if (prefs.enabled === false) {
        root.setAttribute(ATTR_OFF, '1');
      } else {
        root.removeAttribute(ATTR_OFF);
      }
      root.setAttribute('data-fd-strategy', prefs.strategy || 'delete');
      root.setAttribute('data-fd-antidetect', prefs.antidetect ? '1' : '0');
      root.setAttribute(ATTR_READY, '1');
    } catch (e) {}
  };

  /* ---------------- arka plan ile haberleşme ---------------- */
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (msg && msg.type === 'fd:ready?') {
        sendResponse({ ok: true });
      }
    });
  } catch (e) {}

  /* ---------------- ana dünyadan gelen olaylar ---------------- */
  document.addEventListener('fd:ads', function (e) {
    FDI.report('ads', parseInt(e.detail || '1', 10) || 1);
  });

  document.addEventListener('fd:requests', function (e) {
    FDI.report('requests', parseInt(e.detail || '1', 10) || 1);
  });

  /* ---------------- açılış ---------------- */
  function boot(prefs) {
    FDI.prefs = prefs;
    FDI.broadcastState(prefs);
    FDI.loadUserRules();

    if (prefs.enabled === false) {
      // Kapalıyken hiçbir şey enjekte etme
      return;
    }

    FDI.initCosmetic(function () {
      FDI.applyCosmetics(prefs.groups);
      // SPA geçişlerinde yeniden uygula
      try {
        document.addEventListener('yt-navigate-finish', function () {
          setTimeout(function () { FDI.applyCosmetics(FDI.prefs.groups); }, 200);
        });
        document.addEventListener('yt-page-data-updated', function () {
          setTimeout(function () { FDI.applyCosmetics(FDI.prefs.groups); }, 400);
        });
      } catch (e) {}

      FDI.initPlayer();
    });

    // Blok sayacını periyodik tazele (SPA geçişlerinde de)
    setInterval(FDI.countBlocked, 3000);
    FDI.countBlocked();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) FDI.countBlocked();
    });
  }

  FDI.load(boot);

  /* ---------------- ayar değişikliklerini dinle ---------------- */
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[FDI.STORAGE_KEY]) return;
      var next = changes[FDI.STORAGE_KEY].newValue;
      if (!next) return;
      var merged = FDI.defaults();
      if (typeof next.enabled === 'boolean') merged.enabled = next.enabled;
      if (FDI.STRATEGIES.indexOf(next.strategy) !== -1) merged.strategy = next.strategy;
      if (typeof next.antidetect === 'boolean') merged.antidetect = next.antidetect;
      if (next.groups) {
        FDI.GROUPS.forEach(function (g) {
          if (typeof next.groups[g.key] === 'boolean') merged.groups[g.key] = next.groups[g.key];
        });
      }
      FDI.prefs = merged;
      FDI.broadcastState(merged);
      FDI.applyCosmetics(merged.groups);
      FDI.loadUserRules();
      FDI.countBlocked();
      if (merged.enabled) FDI.initPlayer();
    });
  } catch (e) {}
})();
