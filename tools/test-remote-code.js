/* =====================================================================
   Uzak kod beyani denetimi
   ---------------------------------------------------------------------
   Chrome Web Store formunda "uzak kod kullanıyor musunuz?" sorusu
   sorulur. "EVET" demek MV3 politikasina aykiridir ve neredeyse
   her zaman RED sebebidir.

   Bu test kaynak kodun gercekten uzak kod ICERMEDIGINI kanitlar:
     - eval / new Function
     - uzaktan script etiketi
     - import / importScripts
     - document.write ile kod yazma
     - uzak adresten cekilen kaynak

   Bulgu varsa test basarisiz olur: beyan yanlis olurdu.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

function jsDosyalari() {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '_metadata'].includes(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.js')) out.push(f);
    }
  })(path.join(ROOT, 'src'));
  return out;
}

const dosyalar = jsDosyalari();

/* Kodu satir satir tara; yorum satirlarini ve dizgi icindeki
   ornekleri haric tut (yanlis pozitiv uretmemek icin). */
function ara(dosya, desen) {
  const cikti = [];
  const satirlar = fs.readFileSync(dosya, 'utf8').split('\n');
  let blokYorum = false;
  satirlar.forEach((s, i) => {
    const t = s.trim();
    if (/^\/\*/.test(t)) blokYorum = true;
    if (/^\*\//.test(t)) blokYorum = false;
    if (blokYorum || t.startsWith('//') || t.startsWith('*')) return;
    if (desen.test(s)) cikti.push({ n: i + 1, s: t });
  });
  return cikti;
}

console.log('\n1) eval / Function constructor — çalıştırılan uzay kod üretimi');
{
  const bulunan = [];
  dosyalar.forEach((f) => {
    ara(f, /\beval\s*\(|new\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]/).forEach((h) => {
      bulunan.push(path.relative(ROOT, f) + ':' + h.n + '  ' + h.s.slice(0, 60));
    });
  });
  check('eval / new Function / dizgi-zamanlayıcı yok',
    bulunan.length === 0, bulunan.join(' | '));
}

console.log('\n2) Uzaktan script yüklenmesi');
{
  const bulunan = [];
  dosyalar.forEach((f) => {
    ara(f, /createElement\s*\(\s*['"`]script|importScripts\s*\(|\bimport\s*\(/).forEach((h) => {
      bulunan.push(path.relative(ROOT, f) + ':' + h.n + '  ' + h.s.slice(0, 60));
    });
  });
  check('script etiketi / import yok', bulunan.length === 0, bulunan.join(' | '));
}

console.log('\n3) document.write ile kod yazma');
{
  const bulunan = [];
  dosyalar.forEach((f) => {
    ara(f, /document\.write\s*\(/).forEach((h) => {
      bulunan.push(path.relative(ROOT, f) + ':' + h.n);
    });
  });
  check('document.write yok', bulunan.length === 0, bulunan.join(' | '));
}

console.log('\n4) Kaynağın tamamı paket içinde mi? (dışarıdan çekilen dosya)');
{
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const yerel = [];
  if (m.background) yerel.push(m.background.service_worker);
  (m.content_scripts || []).forEach((cs) => [].concat(cs.js || [], cs.css || []).forEach((j) => yerel.push(j)));
  (m.declarative_net_request || {}).rule_resources &&
    m.declarative_net_request.rule_resources.forEach((r) => yerel.push(r.path));

  yerel.forEach((p) => {
    check(p + ' paket içinde yerel dosya', fs.existsSync(path.join(ROOT, p)));
  });

  const uzak = yerel.filter((p) => /^https?:/i.test(p));
  check('manifest\'te uzak kaynak adresi yok', uzak.length === 0, uzak.join(', '));
}

console.log('\n5) "web_accessible_resources" uzak kod mu?');
{
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  (m.web_accessible_resources || []).forEach((w) => {
    (w.resources || []).forEach((r) => {
      check('WAR yerel: ' + r, !/^https?:/i.test(r) && fs.existsSync(path.join(ROOT, r)));
    });
  });
}

console.log('\n6) HTML dosyalarında uzak <script src> yok mu?');
{
  const html = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '_metadata'].includes(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.html')) html.push(f);
    }
  })(path.join(ROOT, 'src'));

  const bulunan = [];
  html.forEach((f) => {
    const s = fs.readFileSync(f, 'utf8');
    const rx = /<script[^>]+src\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = rx.exec(s))) {
      if (/^https?:/i.test(m[1])) bulunan.push(path.relative(ROOT, f) + ' -> ' + m[1]);
    }
  });
  check('HTML\'de uzak script yok', bulunan.length === 0, bulunan.join(', '));
  check('HTML dosyaları tarandı', html.length > 0, String(html.length));
}

console.log('\n7) Gerekçe metni doğru beyanı destekliyor mu?');
{
  const g = path.join(ROOT, 'store', 'IZIN-GEREKCELERI.md');
  check('gerekçe dosyası var', fs.existsSync(g));
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
console.log(fail === 0
  ? '\nSONUÇ: kaynak kod uzak kod içermiyor. Formda "Hayır" seçmelisin.'
  : '\nSONUÇ: yukarıdaki bulguları temizle; "Evet" demek red sebebi olur.');
process.exit(fail ? 1 : 0);