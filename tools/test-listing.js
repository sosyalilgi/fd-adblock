/* Magaza formuna girilecek metinlerin SINIR KONTROLU.
   Asiri uzun metin formu sessizce kirpar veya reddeder. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

// Sinirlar (Chrome Web Store)
const SINIR = {
  ad: 25,
  kisa: 132,
  uzun: 16000
};

const AD = 'FD Reklam Engelleyici';

// Kisa aciklamalar SINIRA SIĞMALI. Ilk denemede TR 138, EN 133
// karakterdi; form bunlari sessizce kirpar ve metin yarim kalir.
const KISA_TR =
  'YouTube reklamlarını engeller. Reklamlar oynatıcıdan görünmeden ' +
  'silinir. Neyin çalıştığını gösteren tanılama aracı içerir.';
const KISA_EN =
  'Blocks YouTube ads. Ads are stripped from the player before they ' +
  'load. Includes a diagnostics tool showing what was blocked.';
const TEK_AMAC_EN = 'Removes advertisements from YouTube.';
const TEK_AMAC_TR = "YouTube'daki reklamları kaldırır.";

console.log('\n1) Program adı (sınır ' + SINIR.ad + ')');
console.log('   "' + AD + '" = ' + AD.length + ' karakter');
check('sınıra sığıyor', AD.length <= SINIR.ad, AD.length);

console.log('\n2) Kısa açıklama (sınır ' + SINIR.kisa + ')');
console.log('   TR = ' + KISA_TR.length + ' karakter');
check('TR sınıra sığıyor', KISA_TR.length <= SINIR.kisa, KISA_TR.length);
console.log('   EN = ' + KISA_EN.length + ' karakter');
check('EN sınıra sığıyor', KISA_EN.length <= SINIR.kisa, KISA_EN.length);

console.log('\n3) Tek amaç — TEK CÜMLE olmalı');
const amac = [TEK_AMAC_EN, TEK_AMAC_TR];
amac.forEach((a) => {
  const nokta = (a.match(/\./g) || []).length;
  check('tek cümle: "' + a + '"', nokta <= 1 && a.length < 100, nokta + ' nokta');
});

console.log('\n4) Ayrıntılı açıklama (sınır ' + SINIR.uzun + ')');
['store/listing-long-tr.md', 'store/listing-long-en.md'].forEach((f) => {
  const yol = path.join(ROOT, f);
  if (!fs.existsSync(yol)) { check(f + ' var', false); return; }
  const s = fs.readFileSync(yol, 'utf8');
  check(f + ' sınıra sığıyor (' + s.length + ')', s.length <= SINIR.uzun);
  check(f + ' boş değil', s.trim().length > 500);
  // anahtar kelime spam: aynı kelimenin cok tekrari
  const kelimeler = (s.toLowerCase().match(/\b\w{5,}\b/g) || []);
  const sayim = {};
  kelimeler.forEach((k) => (sayim[k] = (sayim[k] || 0) + 1));
  const cok = Object.entries(sayim).filter(([, n]) => n > kelimeler.length * 0.06);
  check(f + ' anahtar kelime spam yok', cok.length === 0,
    cok.slice(0, 3).map(([k, n]) => k + ':' + n).join(', '));
});

console.log('\n5) Kullanılmayan iddialar olmamalı');
// CWS politikasi: "Editor's Choice", "Number One" gibi iddialar yasak
const yasak = [/number one/i, /editor'?s choice/i, /en iyi eklenti/i,
  /#1 eklenti/i, /tek eklenti/i];
['store/listing-long-tr.md', 'store/listing-long-en.md', 'README.md'].forEach((f) => {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const bulunan = yasak.filter((r) => r.test(s)).map((r) => r.source);
  check(f + ' yasak iddia içermiyor', bulunan.length === 0, bulunan.join(', '));
});

console.log('\n6) Gizlilik adresleri gerçekten erişilebilir mi? (metin kontrolü)');
{
  const s = fs.readFileSync(path.join(ROOT, 'store', 'MAĞAZA-GÖNDERİM.md'), 'utf8');
  const K = 'sosyalilgi.github.io/fd-adblock';
  check('privacy adresi https:// ile', s.indexOf('https://' + K + '/privacy.html') !== -1);
  check('support adresi https:// ile', s.indexOf('https://' + K + '/support.html') !== -1);

  // "file://" yalnızca UYARI cümlesi olarak geçebilir; form alanına
  // DEĞER olarak verilemez (mağaza erişemez, red sebebi).
  // Ayırt etmek: gerçek form talimatı "alan: değer" kalıbındadır;
  // tablo satırları ve uyarı cümleleri bu kalıba girmez.
  const degerSatiri = (l) => /^\s*[\wçğıöşüÇĞİÖŞÜ .()/-]{2,40}[=|]\s*\S/.test(l);
  const fileDeger = s.split('\n').filter((l) =>
    /file:\/\//i.test(l) && degerSatiri(l) && !/^\s*\|/.test(l));
  check('file:// bir DEĞER olarak verilmiyor', fileDeger.length === 0,
    fileDeger.join(' | '));

  // Form doldurma bloklarında file:// olmamalı
  const kodBloklari = (s.match(/```[\s\S]*?```/g) || []).join('\n');
  check('kod bloklarında file:// yok', kodBloklari.indexOf('file://') === -1);
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);