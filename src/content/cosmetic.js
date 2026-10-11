/* =====================================================================
   FD Reklam Engelleyici — cosmetic.js
   ---------------------------------------------------------------------
   cosmetic.css dosyasını "/* @group X *\/" işaretlerine göre parçalar,
   her grup için ayrı bir <style> etiketi enjekte eder. Böylece her
   temizlik özelliği çalışma anında tek tek açılıp kapatılabilir.
   Ayrıca sayfa yeniden yüklendiğinde gizlenen öğelerin kapladığı
   boşluğu da kaldırır.
   ===================================================================== */
(function () {
  'use strict';

  var FDI = globalThis.FDI;
  if (!FDI) return;

  var STYLE_PREFIX = 'fd-cosmetic-';
  var parsed = null;      // { groupName: cssText }
  var styleEls = {};      // { groupName: HTMLStyleElement }

  var GROUP_RE = /\/\*\s*@group\s+([\w-]+)\s*\*\//g;

  function parseCSS(text) {
    var groups = {};
    var matches = [];
    var m;
    GROUP_RE.lastIndex = 0;
    while ((m = GROUP_RE.exec(text)) !== null) {
      matches.push({ name: m[1], start: m.index, bodyStart: GROUP_RE.lastIndex });
    }
    for (var i = 0; i < matches.length; i++) {
      var end = i + 1 < matches.length ? matches[i + 1].start : text.length;
      groups[matches[i].name] = text.slice(matches[i].bodyStart, end).trim();
    }
    return groups;
  }

  function applyGroup(name, enabled) {
    try {
      var el = styleEls[name];
      if (!enabled) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
        delete styleEls[name];
        return;
      }
      if (el) return;
      var s = document.createElement('style');
      s.id = STYLE_PREFIX + name;
      s.setAttribute('type', 'text/css');
      s.textContent = parsed[name] || '';
      (document.head || document.documentElement).appendChild(s);
      styleEls[name] = s;
    } catch (e) {}
  }

  FDI.applyCosmetics = function (groups) {
    if (!parsed) return;
    FDI.GROUPS.forEach(function (g) {
      applyGroup(g.key, !!(groups && groups[g.key]));
    });
  };

  /* ---------------- kullanıcının kendi kuralları ---------------- */
  var userEl = null;
  var USER_KEY = 'fdUserCss';

  FDI.applyUserRules = function (rules) {
    try {
      if (!Array.isArray(rules) || !rules.length) {
        if (userEl && userEl.parentNode) userEl.parentNode.removeChild(userEl);
        userEl = null;
        return;
      }
      var css = rules
        .map(function (r) {
          var sel = typeof r === 'string' ? r : (r && r.selector);
          return sel ? sel + ' { display: none !important; }' : '';
        })
        .filter(Boolean)
        .join('\n');

      if (!userEl) {
        userEl = document.createElement('style');
        userEl.id = STYLE_PREFIX + 'user';
        (document.head || document.documentElement).appendChild(userEl);
      }
      userEl.textContent = css;
    } catch (e) {}
  };

  FDI.loadUserRules = function () {
    try {
      chrome.storage.local.get({ [USER_KEY]: [] }, function (res) {
        FDI.applyUserRules(res[USER_KEY]);
      });
    } catch (e) {}
  };

  // Yeni kural eklendiğinde/silindiğinde anında uygula
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes[USER_KEY]) {
        FDI.applyUserRules(changes[USER_KEY].newValue || []);
      }
    });
  } catch (e) {}

  FDI.initCosmetic = function (cb) {
    var url = chrome.runtime.getURL('src/rules/cosmetic.css');
    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (text) {
        parsed = parseCSS(text);
        // Bazı gruplar için destek yoksa uyarı ver (geliştirme kolaylığı)
        FDI.GROUPS.forEach(function (g) {
          if (!parsed[g.key]) console.warn('[FD] kozmetik grubu bulunamadı:', g.key);
        });
        cb && cb();
      })
      .catch(function (e) {
        console.warn('[FD] cosmetic.css yüklenemedi', e);
        parsed = {};
        cb && cb();
      });
  };
})();
