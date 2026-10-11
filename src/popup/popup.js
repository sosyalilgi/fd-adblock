/* =====================================================================
   FD Reklam Engelleyici — popup.js
   ===================================================================== */
'use strict';

const STORAGE_KEY = 'fdPrefs';

const DEFAULTS = () => ({
  enabled: true,
  strategy: 'delete',
  groups: {
    ads: true,
    upsell: true,
    'clutter-home': true,
    'clutter-related': true,
    'clutter-comments': true,
    player: true,
    misc: true
  }
});

const elToggle = document.getElementById('toggle');
const elToggleState = elToggle.querySelector('.toggle-state');
const elAds = document.getElementById('count-ads');
const elReq = document.getElementById('count-requests');
const elReset = document.getElementById('reset');
const elOptions = document.getElementById('options');
const elDiag = document.getElementById('diag');

let prefs = DEFAULTS();

function renderToggle() {
  const on = prefs.enabled !== false;
  elToggle.classList.toggle('on', on);
  elToggle.setAttribute('aria-pressed', String(on));
  elToggleState.textContent = on ? 'Açık — koruma aktif' : 'Kapalı — koruma yok';
}

function renderCounts(counts) {
  elAds.textContent = String(counts.ads || 0);
  elReq.textContent = String(counts.blocked || 0);
}

function loadPrefs(cb) {
  chrome.storage.local.get(STORAGE_KEY, (res) => {
    const saved = (res && res[STORAGE_KEY]) || {};
    // Varsayılanların ÜZERİNE kaydedilmiş ayarları yaz.
    // Böylece tanımadığımız alanlar (ileride eklenenler) kaybolmaz.
    prefs = Object.assign(DEFAULTS(), saved);
    prefs.groups = Object.assign(DEFAULTS().groups, saved.groups || {});
    if (prefs.strategy !== 'spoof' && prefs.strategy !== 'delete') {
      prefs.strategy = 'delete';
    }
    renderToggle();
    cb && cb();
  });
}

function loadCounts() {
  chrome.runtime.sendMessage({ type: 'fd:getCounts' }, (res) => {
    if (res && res.ok) renderCounts(res.counts);
  });
}

elToggle.addEventListener('click', () => {
  prefs.enabled = prefs.enabled === false;
  renderToggle();
  chrome.storage.local.set({ [STORAGE_KEY]: prefs });
});

elReset.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'fd:resetCounts' }, () => {
    renderCounts({ ads: 0, requests: 0 });
  });
});

elOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

elDiag.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/diag/diag.html') });
  window.close();
});

loadPrefs(loadCounts);
