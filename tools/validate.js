/* =====================================================================
   FD Reklam Engelleyici — DNR kural doğrulayıcı
   ---------------------------------------------------------------------
   Kullanım:  node tools/validate.js
   src/rules/network.json dosyasını declarativeNetRequest şemasına
   göre kontrol eder. Elle kural eklerken/ düzenlerken çalıştırın.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const RULES_PATH = path.join(__dirname, '..', 'src', 'rules', 'network.json');

const VALID_ACTIONS = [
  'block', 'allow', 'allowAllRequests', 'redirect', 'upgradeScheme', 'modifyHeaders'
];
const VALID_RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'webtransport',
  'webbundle', 'other'
];
const MAX_URL_FILTER = 4096;

let errors = 0;
let warnings = 0;

function err(msg) { errors++; console.log('  HATA  ' + msg); }
function warn(msg) { warnings++; console.log('  UYARI ' + msg); }
function ok(msg) { console.log('  OK    ' + msg); }

let rules;
try {
  rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
} catch (e) {
  console.error('network.json okunamadı/parse edilemedi: ' + e.message);
  process.exit(1);
}

console.log('\n=== network.json doğrulaması ===\n');

if (!Array.isArray(rules)) {
  err('kök dizi (array) olmalı');
  process.exit(1);
}
ok('kök yapı dizi — ' + rules.length + ' kural');

/* ---- id benzersizliği ---- */
const ids = rules.map((r) => r.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) err('tekrarlanan id: ' + [...new Set(dupes)].join(', '));
else ok('tüm id\'ler benzersiz');

/* ---- kural kural inceleme ---- */
rules.forEach((r, i) => {
  const at = '#' + i + ' (id=' + r.id + ')';

  if (!Number.isInteger(r.id) || r.id < 1) err(at + ' id pozitif tam sayı olmalı');
  if (!Number.isInteger(r.priority) || r.priority < 1) err(at + ' priority pozitif tam sayı olmalı');

  if (!r.action || typeof r.action !== 'object') {
    err(at + ' action eksik');
    return;
  }
  if (!VALID_ACTIONS.includes(r.action.type)) {
    err(at + ' geçersiz action.type: ' + r.action.type);
  }
  if (r.action.type === 'redirect' && !r.action.redirect) {
    err(at + ' redirect aksiyonu redirect alanı gerektirir');
  }

  const c = r.condition;
  if (!c || typeof c !== 'object') { err(at + ' condition eksik'); return; }

  const hasUrl = typeof c.urlFilter === 'string';
  const hasRe = typeof c.regexFilter === 'string';

  if (!hasUrl && !hasRe) {
    err(at + ' urlFilter veya regexFilter’dan en az biri gerekli');
  }
  if (hasUrl && hasRe) {
    err(at + ' urlFilter ve regexFilter aynı anda kullanılamaz');
  }
  if (hasUrl && c.urlFilter.length > MAX_URL_FILTER) {
    err(at + ' urlFilter çok uzun (' + c.urlFilter.length + ')');
  }
  if (hasRe) {
    if (c.regexFilter.length > MAX_URL_FILTER) err(at + ' regexFilter çok uzun');
    try { new RegExp(c.regexFilter); } catch (e) {
      err(at + ' geçersiz regex: ' + e.message);
    }
    if (c.regexSubstitution && typeof c.regexSubstitution === 'string') {
      // DNR regexFilter en fazla 2 yakalama grubuna izin verir
      const groups = (c.regexFilter.match(/\(/g) || []).length;
      if (groups > 2) err(at + ' regexFilter en fazla 2 yakalama grubu içerebilir');
    }
  }

  if (c.resourceTypes) {
    if (!Array.isArray(c.resourceTypes)) err(at + ' resourceTypes dizi olmalı');
    else {
      const bad = c.resourceTypes.filter((t) => !VALID_RESOURCE_TYPES.includes(t));
      if (bad.length) err(at + ' geçersiz resourceType: ' + bad.join(', '));
    }
  }
  if (c.excludedResourceTypes && c.resourceTypes) {
    const both = c.resourceTypes.filter((t) => c.excludedResourceTypes.includes(t));
    if (both.length) err(at + ' hem resourceTypes hem excludedResourceTypes\'ta: ' + both.join(', '));
  }

  ['initiatorDomains', 'excludedInitiatorDomains', 'requestDomains', 'excludedRequestDomains']
    .forEach((k) => {
      if (c[k] && !Array.isArray(c[k])) err(at + ' ' + k + ' dizi olmalı');
    });

  if (c.initiatorDomains && c.excludedInitiatorDomains) {
    const both = c.initiatorDomains.filter((d) => c.excludedInitiatorDomains.includes(d));
    if (both.length) {
      warn(at + ' başlatıcı alanlarda çelişki (kural asla eşleşmez): ' + both.join(', '));
    }
  }
  if (c.requestDomains && c.excludedRequestDomains) {
    const both = c.requestDomains.filter((d) => c.excludedRequestDomains.includes(d));
    if (both.length) {
      warn(at + ' istek alanlarında çelişki (kural asla eşleşmez): ' + both.join(', '));
    }
  }

  // Yaygın hata: kural asla eşleşemez
  if (hasUrl && !hasRe && c.urlFilter === '') err(at + ' urlFilter boş');
});

/* =====================================================================
   1b) ASLA ENGELLENMEMESI GEREKEN ADRESLER
   ---------------------------------------------------------------------
   Regresyon: #11 kuralı normal bir video isteğindeki "ctier=" parametresi
   ile eşleşiyordu. ctier reklam göstergesi DEĞİL, video CDN yönlendirme
   parametresidir — sonuç: Shorts dahil TÜM videolar engellendi ve oynatılamadı.
   A/B testimiz bu kuralı sınamıyordu (sadece doubleclick / youtube.com
   uçlarını test ediyordu), bu yüzden fark edilmedi.

   Şimdi her kural, src/rules/never-block.json içindeki gerçek adreslere
   karşı sınanır. Bir kural bunlardan birini eşlerse doğrulama BAŞARISIZ olur.
   ===================================================================== */
console.log('\n=== Asla engellenmemesi gereken adresler ===\n');

let neverBlock = { adresler: [] };
try {
  neverBlock = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'rules', 'never-block.json'), 'utf8'));
} catch (e) {
  err('never-block.json okunamadi: ' + e.message);
}

function urlFilterToRegex(f) {
  // Chrome DNR urlFilter SOZDIZIMI regexp DEGILDIR:
  //   ||  -> hostun basi   |  -> adresin basi/sonu   *  -> her karakter
  //   diger her sey LITERAL (ozellikle "?" niceleyici DEGILDIR)
  //
  // Bu yuzden once ayirici karakterleri AYIRIRIZ, sonra kalan metni
  // regexp ozel karakterleri icin kacisliyoruz. "|" kacislanirsa
  // || kalibi bozulur ve hicbir kural dogru degerlendirilemez.
  const kacis = (m) => String.fromCharCode(92) + m;
  const OZEL = new RegExp('[.+?^$()\\[\\]]', 'g');

  let onek = "";
  let govde = String(f);
  if (govde.indexOf('||') === 0) {
    onek = '^[a-z-]+://([^/]*' + kacis('.') + ')?';
    govde = govde.slice(2);
  } else if (govde.indexOf('|') === 0) {
    onek = '^';
    govde = govde.slice(1);
  }

  return new RegExp(onek + govde.replace(OZEL, kacis).replace(/\*/g, '.*'), 'i');
}

function kuralIskir(r, url, baslatici) {
  const c = r.condition || {};
  if (c.initiatorDomains) {
    const ok = c.initiatorDomains.some((d) => baslatici === d || baslatici.endsWith('.' + d));
    if (!ok) return false;
  }
  if (c.urlFilter) {
    try { if (urlFilterToRegex(c.urlFilter).test(url)) return true; } catch (e) {}
  }
  if (c.regexFilter) {
    try { if (new RegExp(c.regexFilter, 'i').test(url)) return true; } catch (e) {}
  }
  return false;
}

const baslaticilar = ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'];
let ihlal = 0;

(neverBlock.adresler || []).forEach((girdi) => {
  const vuranlar = [];
  baslaticilar.forEach((b) => {
    rules.forEach((r) => {
      if (kuralIskir(r, girdi.url, b)) vuranlar.push('#' + r.id);
    });
  });
  const tekillestir = [...new Set(vuranlar)];
  if (tekillestir.length) {
    ihlal++;
    err('"' + girdi.ad + '" engelleniyor -> kurallar: ' + tekillestir.join(', '));
    console.log('      neden: ' + (girdi.neden || ''));
  } else {
    ok('"' + girdi.ad + '" korunuyor');
  }
});

if (ihlal === 0) {
  console.log('  ' + (neverBlock.adresler || []).length + ' korumali adresin hepsi gecti');
}

/* ---- istatistik ---- */
const byAction = {};
rules.forEach((r) => { byAction[r.action.type] = (byAction[r.action.type] || 0) + 1; });
console.log('\n  dağılım: ' + Object.entries(byAction).map(([k, v]) => k + '=' + v).join(', '));

/* =====================================================================
   2) JavaScript lint — tanımsız değişken taraması
   ---------------------------------------------------------------------
   'use strict' altında tanımsız değişkene atama ReferenceError fırlatır
   ve async fonksiyonlarda sessizce yutulur (sayfa boş kalır, konsolda
   iz yoktur). Bu tam olarak diag.js'de yaşandı.
   ===================================================================== */
console.log('\n=== JavaScript lint ===\n');

// Bu dosyalarda tarama yapma (Node ortamı / test kodu)
const SKIP_FILES = new Set(['validate.js', 'package.js']);

const GLOBALS = new Set([
  'window', 'document', 'chrome', 'console', 'fetch', 'Response', 'Request',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'CustomEvent',
  'XMLHttpRequest', 'Response', 'URL', 'CSS', 'Proxy', 'globalThis', 'self',
  'module', 'require', 'process', 'Buffer', '__dirname', '__filename',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Math', 'JSON', 'Date',
  'RegExp', 'Error', 'TypeError', 'Set', 'Map', 'Promise', 'Symbol', 'parseInt',
  'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'navigator',
  'location', 'history', 'performance', 'Image', 'FormData', 'Blob', 'URLSearchParams',
  'structuredClone', 'HTMLElement', 'Node', 'Element', 'MutationObserver',
  'Function', 'Promise', 'Infinity', 'NaN', 'undefined', 'null', 'true', 'false',
  'arguments', 'event', 'e'
]);

function declaredNames(src) {
  const names = new Set();

  // let/const/var — ÇOKLU bildirim de yakalanmalı: var i, key, val;
  const decl = /(?:let|const|var)\s+([^;\n]*)/g;
  let m;
  while ((m = decl.exec(src)) !== null) {
    m[1].split(',').forEach((part) => {
      const id = part.trim().split(/[\s=;]/)[0];
      if (id && /^[A-Za-z_$][\w$]*$/.test(id)) names.add(id);
    });
  }

  // fonksiyon adları ve parametreleri
  const fn = /function\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
  while ((m = fn.exec(src)) !== null) {
    if (m[1]) names.add(m[1]);
    m[2].split(',').forEach((p) => {
      const id = p.trim().replace(/=.*$/, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(id)) names.add(id);
    });
  }

  // arrow parametreleri: (a, b) =>   /   a =>   /   ({a}) =>
  const arrow = /(?:^|[=(,]\s*)\(([^()]*)\)\s*=>/g;
  while ((m = arrow.exec(src)) !== null) {
    m[1].split(',').forEach((p) => {
      const id = p.trim().replace(/[=:].*$/, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(id)) names.add(id);
    });
  }
  const arrow1 = /(?:^|[=(,]\s*)([A-Za-z_$][\w$]*)\s*=>/gm;
  while ((m = arrow1.exec(src)) !== null) names.add(m[1]);

  // catch parametreleri
  const cw = /catch\s*\(\s*([A-Za-z_$][\w$]*)/g;
  while ((m = cw.exec(src)) !== null) names.add(m[1]);

  // sınıf/metot kısa yazımı ve objesi: { a, b }  /  a() {}
  const cls = /class\s+([A-Za-z_$][\w$]*)/g;
  while ((m = cls.exec(src)) !== null) names.add(m[1]);

  return names;
}

function lintFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const declared = declaredNames(src);
  const lines = src.split(/\r?\n/);
  const problems = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Bildirim satırları ve nesne özellikleri eleniyor
    if (/^(let|const|var|function|class|if|for|while|return|else|case|do|try)\b/.test(trimmed)) return;
    if (/^(import|export)\b/.test(trimmed)) return;
    if (/^[A-Za-z_$][\w$]*\s*:/.test(trimmed)) return;      // nesne anahtarı
    if (/^[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/.test(trimmed)) return; // metot
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    const m = trimmed.match(/^([A-Za-z_$][\w$]*)\s*=(?!=)/);
    if (!m) return;

    const name = m[1];
    if (declared.has(name) || GLOBALS.has(name)) return;

    problems.push((i + 1) + '. satır: "' + name + '" tanımsız olabilir');
  });

  return problems;
}

let lintProblems = 0;
let lintFiles = 0;

function walkJs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '_metadata') continue;
      walkJs(full);
    } else if (entry.name.endsWith('.js') && !SKIP_FILES.has(entry.name)) {
      lintFiles++;
      const problems = lintFile(full);
      const rel = path.relative(path.join(__dirname, '..'), full);
      if (problems.length) {
        lintProblems += problems.length;
        problems.forEach((p) => err(rel + ' → ' + p));
      }
    }
  }
}

walkJs(path.join(__dirname, '..', 'src'));

if (lintProblems === 0) ok(lintFiles + ' dosya tarandı, tanımsız değişken yok');

/* ---- yinelenen JSON anahtarları ----
   JSON.parse yinelenen anahtarlarda HATA VERMEZ; sonuncusu sessizce
   kazanır ve ilkini kaybedersiniz. Bu projede "description" iki kez
   yazılmıştı ve tanılamadan fark edilmişti. Aşağıdaki tarayıcı her
   nesne düzeyinde yinelenen anahtarı bulur.                        */
console.log('\n=== yinelenen JSON anahtarları ===\n');

function yinelenenler(metin) {
  const bulunan = [];
  const yigin = [];           // { anahtar, sonrakiMetin } yığını
  const ciftler = [];         // geri dönüş için eşleşme konumları

  // Kaba JSON ayrıştırıcı: yalnızca anahtar yinelenmesini arıyor.
  let i = 0;
  let nesneBas = -1;
  let sonrakiAnahtarlar = []; // bu nesnede görülen anahtarlar

  function kutuKapat() {
    if (nesneBas !== -1) {
      sonrakiAnahtarlar = [];
      nesneBas = -1;
    }
  }

  while (i < metin.length) {
    const c = metin[i];
    if (c === '"') {
      // dizge: kacisli tirnaklari atla
      const bas = i;
      i++;
      while (i < metin.length) {
        if (metin[i] === '\\') { i += 2; continue; }
        if (metin[i] === '"') break;
        i++;
      }
      const dizge = metin.slice(bas + 1, i);
      i++; // kapanis tirnak
      // anahtar mi? ardindan iki nokta ve noktalama yok
      let j = i;
      while (j < metin.length && /\s/.test(metin[j])) j++;
      if (metin[j] === ':') {
        if (nesneBas === -1) { nesneBas = bas; sonrakiAnahtarlar = []; }
        if (sonrakiAnahtarlar.indexOf(dizge) !== -1) {
          bulunan.push({ anahtar: dizge, ilk: sonrakiAnahtarlar.indexOf(dizge), ikinci: bas });
        } else {
          sonrakiAnahtarlar.push(dizge);
        }
      }
      continue;
    }
    if (c === '}' || c === ']') {
      if (c === '}') kutuKapat();
      i++;
      continue;
    }
    i++;
  }
  return bulunan;
}

const JSON_DOSYALARI = [
  'manifest.json',
  'src/rules/network.json',
  'src/rules/never-block.json'
];

let yinelemeHatasi = 0;
JSON_DOSYALARI.forEach((rel) => {
  const tam = path.join(__dirname, '..', rel);
  if (!fs.existsSync(tam)) return;
  const metin = fs.readFileSync(tam, 'utf8');
  const dup = yinelenenler(metin);
  if (dup.length) {
    dup.forEach((d) => {
      const satir = metin.slice(0, d.ikinci).split('\n').length;
      err(rel + ' → "' + d.anahtar + '" anahtarı ' + satir +
          '. satırda ikinci kez yazılmış (ilk: ' + d.ilk + '. konum). ' +
          'JSON.parse bunu sessizce yutar; ilk değer kaybolur.');
    });
    yinelemeHatasi += dup.length;
  } else {
    ok(rel + ' — yinelenen anahtar yok');
  }
});

/* ---- manifest sahiplik alanlari ---- */
console.log('\n=== manifest kimlik alanları ===\n');
{
  const tam = path.join(__dirname, '..', 'manifest.json');
  const m = JSON.parse(fs.readFileSync(tam, 'utf8'));
  if (m.author) ok('author: ' + m.author);
  else warn('manifest.author yok — mağaza listelemesinde geliştirici belirsiz görünür');
  if (m.homepage_url) ok('homepage_url: ' + m.homepage_url);
  else warn('manifest.homepage_url yok');
}

/* ---- content script kapsamı ----
   src/content/ altına yeni bir dosya ekleyip manifest'e yazmazsan
   dosya hiç çalışmaz ve BUNU HİÇBİR ŞEY SÖYLEMEZ. player-detect.js
   eklerken tam olarak bu tuzağa düşmemek için kontrol eklendi.

   Not: Her dosya content_scripts'te olmak zorunda degil. Bazi dosyalar
   chrome.scripting.executeScript ile veya picker gibi bir modul
   tarafindan geci yuklenir (bkz. background.js). */
console.log('\n=== content script kapsamı ===\n');
{
  const kok = path.join(__dirname, '..');
  const m = JSON.parse(fs.readFileSync(path.join(kok, 'manifest.json'), 'utf8'));

  // 1) manifest'te bildirilen her dosya gercekten var mi?
  const bildirilen = [];
  (m.content_scripts || []).forEach((cs) => (cs.js || []).forEach((j) => bildirilen.push(j)));
  let eksik = 0;
  bildirilen.forEach((j) => {
    if (!fs.existsSync(path.join(kok, j))) { err('manifest bildiriyor ama dosya yok: ' + j); eksik++; }
  });
  if (!eksik) ok(bildirilen.length + ' content script dosyası mevcut');

  // 2) Programatik olarak enjekte edilen dosyalar (background.js)
  const bg = fs.readFileSync(path.join(kok, 'src', 'background.js'), 'utf8');
  const enjekte = new Set();
  const rx = /files:\s*\[([^\]]+)\]/g;
  let m2;
  while ((m2 = rx.exec(bg))) {
    m2[1].split(',').forEach((s) => {
      const yol = s.trim().replace(/^['"]|['"]$/g, '');
      if (yol) enjekte.add(yol);
    });
  }
  if (enjekte.size) ok('programatik enjekte: ' + Array.from(enjekte).join(', '));

  // 3) src/content/ altındaki her dosya ya manifest'te ya enjekte ediliyor
  const disarida = fs.readdirSync(path.join(kok, 'src', 'content'))
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !bildirilen.includes('src/content/' + f))
    .filter((f) => !enjekte.has('src/content/' + f));

  if (disarida.length) {
    disarida.forEach((f) => err("src/content/" + f + " manifest'te de enjekte listesinde de yok — çalışmayacak"));
  } else {
    ok('src/content/ altındaki tüm dosyalar bir yere bağlı');
  }

  // 4) Yardımcı moduller disa aktarim yapabilmeli (testler gercek
  //    dosyayi yukleyebilsin). Iki bicim kabul edilir:
  //      a) globalThis.FDX = api   -> vm ile test edilir
  //      b) module.exports = api   -> require ile test edilir
  ['selector-gen.js', 'player-detect.js'].forEach((f) => {
    const kaynak = fs.readFileSync(path.join(kok, 'src', 'content', f), 'utf8');
    const vmUyum = /globalThis\.FD\w+\s*=/.test(kaynak);
    const reqUyum = /module\.exports/.test(kaynak);
    if (vmUyum || reqUyum) {
      ok(f + ' dışa aktarım var (' + (reqUyum ? 'module.exports' : 'globalThis') + ')');
    } else {
      err(f + ' dışa aktarım yok — testler bu dosyayı yükleyemez');
    }
  });
}

/* ---- özet ---- */
console.log('\n==============================');
console.log('  ' + (errors ? errors + ' HATA, ' : '') + warnings + ' uyarı');
process.exit(errors ? 1 : 0);
