/* =====================================================================
   FD Reklam Engelleyici — prefs.js
   ---------------------------------------------------------------------
   Ayarları okur ve diğer izole dünya scriptlerine paylaşır.
   Tüm bu dosyalar aynı izole dünyada çalışır, `globalThis.FDI` üzerinden
   haberleşirler.
   ===================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'fdPrefs';

  // Kozmetik gruplar — cosmetic.css'teki /* @group ... */ etiketleriyle eşleşir
  var GROUPS = [
    {
      key: 'ads',
      label: 'Reklamlar',
      desc: 'Video önü/ortası reklamlar, banner, kenar çubuğu ve açılır reklamlar'
    },
    {
      key: 'upsell',
      label: 'Premium / Yükseltme',
      desc: 'Premium popupları, "Premium’u deneyin" diyalogları, bağış kartları'
    },
    {
      key: 'clutter-home',
      label: 'Karmaşa — Ana sayfa',
      desc: 'Shorts rafları, Shorts sekmesi, ürün/merch rafları'
    },
    {
      key: 'clutter-related',
      label: 'Karmaşa — İlgili videolar',
      desc: 'İlgili videolar listesindeki Shorts ve otomatik oynatma kartı'
    },
    {
      key: 'clutter-comments',
      label: 'Karmaşa — Yorumlar',
      desc: 'Yorum bölümünü tamamen gizler'
    },
    {
      key: 'player',
      label: 'Oynatıcı',
      desc: 'Bitiş ekranı kartları, ön izleme oynatması, duraklatma kaplaması'
    },
    {
      key: 'misc',
      label: 'Diğer',
      desc: 'Canlı sohbet reklamları, hatırlatma balonları, açılır kutular'
    }
  ];

  var DEFAULTS = {
    enabled: true,
    strategy: 'delete',   // 'delete' | 'spoof'
    antidetect: false,    // varsayilan KAPALI (seffaflik + magaza incelemesi)
    groups: {}
  };
  GROUPS.forEach(function (g) { DEFAULTS.groups[g.key] = true; });

  var FDI = (globalThis.FDI = globalThis.FDI || {});
  FDI.STORAGE_KEY = STORAGE_KEY;
  FDI.GROUPS = GROUPS;
  FDI.STRATEGIES = ['delete', 'spoof'];

  FDI.defaults = function () {
    var d = {
      enabled: DEFAULTS.enabled,
      strategy: DEFAULTS.strategy,
      antidetect: DEFAULTS.antidetect,
      groups: {}
    };
    GROUPS.forEach(function (g) { d.groups[g.key] = true; });
    return d;
  };

  FDI.load = function (cb) {
    try {
      chrome.storage.local.get(STORAGE_KEY, function (res) {
        var prefs = FDI.defaults();
        var saved = res && res[STORAGE_KEY];
        if (saved && typeof saved === 'object') {
          if (typeof saved.enabled === 'boolean') prefs.enabled = saved.enabled;
          if (FDI.STRATEGIES.indexOf(saved.strategy) !== -1) prefs.strategy = saved.strategy;
          if (typeof saved.antidetect === 'boolean') prefs.antidetect = saved.antidetect;
          if (saved.groups && typeof saved.groups === 'object') {
            GROUPS.forEach(function (g) {
              if (typeof saved.groups[g.key] === 'boolean') prefs.groups[g.key] = saved.groups[g.key];
            });
          }
        }
        FDI.prefs = prefs;
        cb && cb(prefs);
      });
    } catch (e) {
      FDI.prefs = FDI.defaults();
      cb && cb(FDI.prefs);
    }
  };

  FDI.save = function (prefs, cb) {
    FDI.prefs = prefs;
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: prefs }, function () {
        cb && cb();
      });
    } catch (e) {
      cb && cb();
    }
  };
})();
