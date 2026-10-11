/* =====================================================================
   FD Reklam Engelleyici — background.js (MV3 service worker)
   ---------------------------------------------------------------------
   • Oturumluk sayaçları (storage.session)
   • ENGELLENEN isteklerin yetkili günlüğü (webRequest.onErrorOccurred)
   • DNR ruleset aç/kapa (tanılama testi için)
   • Sağ tık menüsü ve element seçici
   • Günlük istatistik geçmişi
   ===================================================================== */

const STORAGE_KEY = 'fdPrefs';
const USER_CSS_KEY = 'fdUserCss';
const HISTORY_KEY = 'fdHistory';
const HISTORY_DAYS = 14;
const RULESET_ID = 'fd_network';
const PICKER_MENU_ID = 'fd-pick-element';

/* =====================================================================
   1) DNR ağ katmanı denetimi
   ===================================================================== */
function getRulesets(cb) {
  try {
    chrome.declarativeNetRequest.getEnabledRulesets((ids) => cb(ids || []));
  } catch (e) {
    cb([]);
  }
}

function setRulesetsEnabled(enable, cb) {
  const patch = enable
    ? { enableRulesetIds: [RULESET_ID], disableRulesetIds: [] }
    : { enableRulesetIds: [], disableRulesetIds: [RULESET_ID] };

  getRulesets((current) => {
    const isOn = current.indexOf(RULESET_ID) !== -1;
    // Zaten istenen durumdaysa gereksiz yeniden yükleme yapma
    if (isOn === !!enable) { cb(!!enable); return; }

    try {
      chrome.declarativeNetRequest.updateEnabledRulesets(patch, () => {
        cb(chrome.runtime.lastError ? isOn : !!enable);
      });
    } catch (e) {
      cb(isOn);
    }
  });
}

function getRules(cb) {
  try {
    chrome.declarativeNetRequest.getRules((rules) => {
      cb(Array.isArray(rules) ? rules : []);
    });
  } catch (e) {
    cb([]);
  }
}

/* Tanılama kuralları geçici olarak kapatabiliyor; Chrome bunu kalıcı
   sakladığı için her açılışta zorla açıyoruz. */
function ensureRulesetsEnabled() {
  getRulesets((ids) => {
    if (ids.indexOf(RULESET_ID) !== -1) return;
    try {
      chrome.declarativeNetRequest.updateEnabledRulesets(
        { enableRulesetIds: [RULESET_ID], disableRulesetIds: [] },
        () => {}
      );
    } catch (e) {}
  });
}

/* =====================================================================
   2) Ağdan engellenen istek sayacı
   ---------------------------------------------------------------------
   ÖNEMLİ: chrome.webRequest.onErrorOccurred, declarativeNetRequest'in
   engellediği istekleri RAPORLAMAZ (DNR ağ yığınından önce çalışır).
   Bu yüzden burada webRequest KULLANILMAZ — denendi ve boş döndü.

   Bunun yerine sayfa, performance kayıtlarındaki "blok imzasını"
   (transferSize 0 + status 0 + çok kısa süre) sayar ve bize yollar.
   Sezgisel bir ölçümdür ama ekran görüntüsündeki verilerle örtüşüyor.
   ===================================================================== */
const BLOCKED_COUNT_MAX = 100000;

function setBlockedCount(n, cb) {
  const value = Math.max(0, Math.min(BLOCKED_COUNT_MAX, parseInt(n, 10) || 0));
  sessionGet((counts) => {
    // Sayfa yeniden yüklenince sayaç sıfırlanır; eski değeri korumak
    // yanlış olurdu, bu yüzden yeni değeri doğrudan yazıyoruz.
    const next = Object.assign({}, EMPTY_COUNTS, counts, { blocked: value });
    chrome.storage.session.set(next, () => {
      updateBadge(next);
      markHistoryDirty();
      if (cb) cb(next);
    });
  });
}

/* =====================================================================
   3) Kullanıcının kendi gizleme kuralları
   ===================================================================== */
function getUserRules(cb) {
  chrome.storage.local.get({ [USER_CSS_KEY]: [] }, (res) => {
    cb(Array.isArray(res[USER_CSS_KEY]) ? res[USER_CSS_KEY] : []);
  });
}

function setUserRules(rules, cb) {
  chrome.storage.local.set({ [USER_CSS_KEY]: rules }, () => cb && cb());
}

function addUserRule(selector, label, cb) {
  if (!selector || typeof selector !== 'string') return cb && cb(false);
  const clean = selector.trim().slice(0, 300);
  getUserRules((rules) => {
    if (rules.some((r) => r.selector === clean)) {
      if (cb) cb(false);
      return;
    }
    rules.unshift({ selector: clean, label: String(label || '').slice(0, 80) });
    // Dev listeler oynatıcıyı yavaşlatır
    setUserRules(rules.slice(0, 200), () => cb && cb(true));
  });
}

/* =====================================================================
   4) Sağ tık menüsü + element seçici
   ===================================================================== */
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PICKER_MENU_ID,
      title: 'FD: Bu öğeyi engelle',
      contexts: ['all'],
      documentUrlPatterns: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*']
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== PICKER_MENU_ID || !tab || !tab.id) return;
  // Seçici yalnızca sayfa hazırsa çalışsın
  chrome.tabs.sendMessage(tab.id, { type: 'fd:ready?' }, (resp) => {
    if (chrome.runtime.lastError) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/selector-gen.js', 'src/content/picker.js']
    }).catch(() => {});
  });
});

/* =====================================================================
   5) Sayaçlar ve rozet
   ===================================================================== */
const EMPTY_COUNTS = { ads: 0, requests: 0, blocked: 0 };

function sessionGet(cb) {
  chrome.storage.session.get(EMPTY_COUNTS, (res) => cb(res || EMPTY_COUNTS));
}

let pendingBadge = null;
let badgeTimer = null;

function updateBadge(counts) {
  pendingBadge = counts;
  if (badgeTimer) return;
  badgeTimer = setTimeout(() => {
    badgeTimer = null;
    const c = pendingBadge || EMPTY_COUNTS;
    const total = (c.ads || 0) + (c.blocked || 0);
    const text = total > 999 ? '999+' : String(total);

    chrome.action.setBadgeBackgroundColor({ color: '#16a34a' }, () => {
      void chrome.runtime.lastError;
    });
    chrome.action.setBadgeText({ text: total > 0 ? text : '' }, () => {
      void chrome.runtime.lastError;
    });
  }, 400);
}

/* =====================================================================
   6) Günlük istatistik geçmişi
   ---------------------------------------------------------------------
   Yazma en fazla 15 sn'de bir; her reklamda storage'a yazmak pahalı.
   ===================================================================== */
let historyDirty = false;
let historyTimer = null;

function todayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function markHistoryDirty() {
  historyDirty = true;
  if (historyTimer) return;
  historyTimer = setTimeout(() => {
    historyTimer = null;
    if (historyDirty) flushHistory();
  }, 15000);
}

function flushHistory() {
  historyDirty = false;
  const key = todayKey();
  sessionGet((counts) => {
    if (!counts.ads && !counts.blocked && !counts.requests) return;
    chrome.storage.local.get({ [HISTORY_KEY]: {} }, (res) => {
      const hist = res[HISTORY_KEY] || {};
      const day = hist[key] || { ads: 0, blocked: 0, requests: 0 };
      // Günün max'ı: oturum sıfırlanınca geçmiş sıfırlanmamalı
      hist[key] = {
        ads: Math.max(day.ads || 0, counts.ads || 0),
        blocked: Math.max(day.blocked || 0, counts.blocked || 0),
        requests: Math.max(day.requests || 0, counts.requests || 0)
      };

      Object.keys(hist).sort().reverse().slice(HISTORY_DAYS)
        .forEach((k) => delete hist[k]);

      chrome.storage.local.set({ [HISTORY_KEY]: hist });
    });
  });
}

chrome.runtime.onSuspend.addListener(() => {
  if (historyDirty) flushHistory();
});

/* =====================================================================
   7) Yaşam döngüsü
   ===================================================================== */
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  ensureRulesetsEnabled();

  chrome.storage.local.get(STORAGE_KEY, (res) => {
    if (res[STORAGE_KEY]) return;
    const groups = {};
    ['ads', 'upsell', 'clutter-home', 'clutter-related',
      'clutter-comments', 'player', 'misc'].forEach((k) => { groups[k] = true; });
    chrome.storage.local.set({
      [STORAGE_KEY]: { enabled: true, strategy: 'delete', antidetect: false, groups }
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
  ensureRulesetsEnabled();
});

/* =====================================================================
   8) Mesajlar
   ===================================================================== */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'fd:count') {
    const kind = msg.kind === 'ads' ? 'ads' : 'requests';
    const amount = parseInt(msg.amount, 10) || 1;
    sessionGet((counts) => {
      const next = Object.assign({}, EMPTY_COUNTS, counts);
      next[kind] = (next[kind] || 0) + amount;
      chrome.storage.session.set(next, () => {
        updateBadge(next);
        markHistoryDirty();
        sendResponse({ ok: true, counts: next });
      });
    });
    return true;
  }

  if (msg.type === 'fd:getCounts') {
    sessionGet((counts) => sendResponse({ ok: true, counts }));
    return true;
  }

  if (msg.type === 'fd:resetCounts') {
    chrome.storage.session.set({ ads: 0, requests: 0, blocked: 0 }, () => {
      updateBadge(EMPTY_COUNTS);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'fd:getPrefs') {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      sendResponse({ ok: true, prefs: res[STORAGE_KEY] || null });
    });
    return true;
  }

  /* ---- element seçici kuralları ---- */
  if (msg.type === 'fd:addUserRule') {
    addUserRule(msg.selector, msg.label, (added) => sendResponse({ ok: true, added }));
    return true;
  }

  if (msg.type === 'fd:getUserRules') {
    getUserRules((rules) => sendResponse({ ok: true, rules }));
    return true;
  }

  if (msg.type === 'fd:removeUserRule') {
    getUserRules((rules) => {
      setUserRules(rules.filter((r) => r.selector !== msg.selector));
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'fd:clearUserRules') {
    setUserRules([], () => sendResponse({ ok: true }));
    return true;
  }

  /* ---- geçmiş ---- */
  if (msg.type === 'fd:getHistory') {
    flushHistory();
    chrome.storage.local.get({ [HISTORY_KEY]: {} }, (res) => {
      sendResponse({ ok: true, history: res[HISTORY_KEY] || {} });
    });
    return true;
  }

  if (msg.type === 'fd:clearHistory') {
    chrome.storage.local.set({ [HISTORY_KEY]: {} }, () => sendResponse({ ok: true }));
    return true;
  }

  /* ---- ağdan engellenen istek sayacı ---- */
  if (msg.type === 'fd:setBlockedCount') {
    setBlockedCount(msg.value, () => sendResponse({ ok: true }));
    return true;
  }

  /* ---- ağ katmanı denetimi ---- */
  if (msg.type === 'fd:getNetState') {
    getRulesets((ids) => {
      sendResponse({
        ok: true,
        aktif: ids.indexOf(RULESET_ID) !== -1,
        rulesetler: ids
      });
    });
    return true;
  }

  if (msg.type === 'fd:setNetEnabled') {
    setRulesetsEnabled(!!msg.enable, (aktif) => sendResponse({ ok: true, aktif }));
    return true;
  }

  if (msg.type === 'fd:getRules') {
    getRules((rules) => {
      sendResponse({
        ok: true,
        adet: rules.length,
        kurallar: rules.map((r) => ({
          id: r.id,
          oncelik: r.priority,
          tip: r.action && r.action.type,
          filtre: (r.condition && (r.condition.urlFilter || r.condition.regexFilter)) || '(yok)'
        }))
      });
    });
    return true;
  }
});
