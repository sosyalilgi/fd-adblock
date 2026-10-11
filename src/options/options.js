/* =====================================================================
   FD Reklam Engelleyici — options.js
   ===================================================================== */
'use strict';

const STORAGE_KEY = 'fdPrefs';

const GROUPS = [
  { key: 'ads',              label: 'Reklamlar',              desc: 'Video önü/ortası reklamlar, banner, kenar çubuğu, açılır reklamlar' },
  { key: 'upsell',           label: 'Premium / Yükseltme',    desc: 'Premium popupları, "Premium’u deneyin" diyalogları' },
  { key: 'clutter-home',     label: 'Karmaşa — Ana sayfa',    desc: 'Shorts rafları, Shorts sekmesi, ürün rafları' },
  { key: 'clutter-related',  label: 'Karmaşa — İlgili',      desc: 'İlgili videolardaki Shorts ve otomatik oynatma kartı' },
  { key: 'clutter-comments', label: 'Karmaşa — Yorumlar',     desc: 'Yorum bölümünü tamamen gizler' },
  { key: 'player',           label: 'Oynatıcı',               desc: 'Bitiş ekranı kartları, ön izleme oynatması, duraklatma kaplaması' },
  { key: 'misc',             label: 'Diğer',                  desc: 'Canlı sohbet reklamları, hatırlatma balonları, açılır kutular' }
];

const elMaster = document.getElementById('master');
const elGroups = document.getElementById('groups');
const elAds = document.getElementById('c-ads');
const elReq = document.getElementById('c-req');
const elReset = document.getElementById('reset');
const elDiag = document.getElementById('openDiag');
const elAnti = document.getElementById('antidetect');
const elAntiDesc = document.getElementById('antiDesc');

function renderAntiDetect() {
  elAnti.checked = !!prefs.antidetect;
  elAntiDesc.textContent = prefs.antidetect
    ? 'Açık. YouTube uyarı penceresi bastırılmaya çalışılıyor.'
    : 'Kapalı. YouTube uyarı penceresi gösterebilir; bu normaldir ve sayfayı bozmaz.';
}

elAnti.addEventListener('change', () => {
  prefs.antidetect = elAnti.checked;
  renderAntiDetect();
  persist();
});
const elUserRules = document.getElementById('userRules');
const elUserEmpty = document.getElementById('userEmpty');
const elClearRules = document.getElementById('clearRules');

/* ---------------- kullanıcı kuralları ---------------- */
function renderUserRules(rules) {
  elUserRules.innerHTML = '';
  const has = Array.isArray(rules) && rules.length > 0;
  elUserEmpty.style.display = has ? 'none' : 'block';
  elClearRules.style.display = has ? 'inline-block' : 'none';
  if (!has) return;

  rules.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'rule';

    const sel = document.createElement('span');
    sel.className = 'sel';
    sel.textContent = r.selector;
    sel.title = r.selector;

    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = r.label || '';

    const x = document.createElement('button');
    x.className = 'x';
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Bu kuralı sil';
    x.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'fd:removeUserRule', selector: r.selector }, () => {
        loadUserRules();
      });
    });

    row.append(sel, lbl, x);
    elUserRules.appendChild(row);
  });
}

function loadUserRules() {
  chrome.runtime.sendMessage({ type: 'fd:getUserRules' }, (res) => {
    renderUserRules(res && res.rules);
  });
}

elClearRules.addEventListener('click', () => {
  if (!confirm('Tüm kendi kuralların silinsin mi?')) return;
  chrome.runtime.sendMessage({ type: 'fd:clearUserRules' }, () => loadUserRules());
});
const elVersion = document.getElementById('version');

let prefs = null;

function defaults() {
  const groups = {};
  GROUPS.forEach((g) => { groups[g.key] = true; });
  return { enabled: true, strategy: 'delete', antidetect: false, groups };
}

function renderStrategy() {
  document.querySelectorAll('input[name="strategy"]').forEach((r) => {
    r.checked = r.value === prefs.strategy;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      prefs.strategy = r.value;
      persist();
    });
  });
}

function persist() {
  chrome.storage.local.set({ [STORAGE_KEY]: prefs });
}

function renderGroups() {
  elGroups.innerHTML = '';
  GROUPS.forEach((g) => {
    const row = document.createElement('div');
    row.className = 'row';

    const left = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = g.label;
    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = g.desc;
    left.append(strong, desc);

    const sw = document.createElement('label');
    sw.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!prefs.groups[g.key];
    input.addEventListener('change', () => {
      prefs.groups[g.key] = input.checked;
      persist();
    });
    const slider = document.createElement('span');
    slider.className = 'slider';
    sw.append(input, slider);

    row.append(left, sw);
    elGroups.appendChild(row);
  });
}

function renderMaster() {
  elMaster.checked = prefs.enabled !== false;
  elGroups.style.opacity = prefs.enabled !== false ? '1' : '.5';
  elGroups.style.pointerEvents = prefs.enabled !== false ? 'auto' : 'none';
}

elMaster.addEventListener('change', () => {
  prefs.enabled = elMaster.checked;
  renderMaster();
  persist();
});

/* ---------------- 14 günlük grafik ---------------- */
const elChart = document.getElementById('chart');
const elChartTotal = document.getElementById('chartTotal');
const elClearHistory = document.getElementById('clearHistory');

function dayKeys(count) {
  const out = [];
  const d = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    const p = (n) => String(n).padStart(2, '0');
    out.push(t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()));
  }
  return out;
}

function renderChart(history) {
  elChart.innerHTML = '';
  const keys = dayKeys(14);
  const today = keys[keys.length - 1];

  let max = 0;
  let sumAds = 0;
  let sumReq = 0;
  keys.forEach((k) => {
    const d = history[k] || { ads: 0, blocked: 0 };
    max = Math.max(max, d.ads || 0, d.blocked || 0);
    sumAds += d.ads || 0;
    sumReq += d.blocked || 0;
  });
  if (max === 0) max = 1;

  keys.forEach((k) => {
    const d = history[k] || { ads: 0, blocked: 0 };
    const ads = d.ads || 0;
    const req = d.blocked || 0;

    const col = document.createElement('div');
    col.className = 'col' + (k === today ? ' today' : '');

    const t = document.createElement('span');
    t.className = 'tip2';
    t.textContent = k.slice(5) + ' · ' + ads + ' reklam / ' + req + ' ağ isteği';
    col.appendChild(t);

    // istek bar'i altta, reklam bar'i ustte yigilmis
    const bReq = document.createElement('div');
    bReq.className = 'bar req';
    bReq.style.height = Math.max(0, (req / max) * 100) + '%';
    const bAds = document.createElement('div');
    bAds.className = 'bar ads';
    bAds.style.height = Math.max(0, (ads / max) * 100) + '%';

    col.append(bReq, bAds);
    elChart.appendChild(col);
  });

  elChartTotal.textContent = 'toplam ' + (sumAds + sumReq) + ' engellendi';
}

function loadHistory() {
  chrome.runtime.sendMessage({ type: 'fd:getHistory' }, (res) => {
    renderChart((res && res.history) || {});
  });
}

elClearHistory.addEventListener('click', () => {
  if (!confirm('Tüm istatistik geçmişi silinsin mi?')) return;
  chrome.runtime.sendMessage({ type: 'fd:clearHistory' }, () => {
    renderChart({});
  });
});

elDiag.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/diag/diag.html') });
});

elReset.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'fd:resetCounts' }, () => {
    elAds.textContent = '0';
    elReq.textContent = '0';
  });
});

function loadCounts() {
  chrome.runtime.sendMessage({ type: 'fd:getCounts' }, (res) => {
    if (res && res.ok) {
      elAds.textContent = String(res.counts.ads || 0);
      elReq.textContent = String(res.counts.blocked || 0);
    }
  });
}

chrome.storage.local.get(STORAGE_KEY, (res) => {
  const saved = (res && res[STORAGE_KEY]) || {};
  // Varsayılanların üzerine kaydedilmiş ayarları yaz — tanımadığımız
  // alanlar (ileride eklenenler) korunur.
  prefs = Object.assign(defaults(), saved);
  prefs.groups = Object.assign(defaults().groups, saved.groups || {});
  if (prefs.strategy !== 'spoof' && prefs.strategy !== 'delete') {
    prefs.strategy = 'delete';
  }
  if (typeof prefs.antidetect !== 'boolean') prefs.antidetect = false;
  renderGroups();
  renderMaster();
  renderStrategy();
  renderAntiDetect();
  loadCounts();
  loadUserRules();
  loadHistory();
});

try {
  const m = chrome.runtime.getManifest();
  if (m && m.version) {
    elVersion.textContent = 'Sürüm ' + m.version;
    const elOwner = document.getElementById('ownerVersion');
    if (elOwner) elOwner.textContent = m.version;
  }
} catch (e) {}
