/* =====================================================================
   Paket dogrulamasi
   ---------------------------------------------------------------------
   Amac: uretilen zip'in gercekten yuklenebilir oldugunu KANITLAMAK.

   Neden ayri okuyucu: package.js hem yaziyor hem dogruluyorsa
   ikisi ayni hatayi yapabilir. Burada zip BAGIMSIZ bir okuyucuyla
   acilir: merkez dizini okunur, her kayit orneklenip CRC'si
   hesaplanir, inflate edilip bayt bayt karsilastirilir.

   2026-10-11'de Compress-Archive dosyalari duzlestirdigi icin
   paket yuklenemezdi ve magaza "duplicate privacy.html" hatasi
   verdi. Bu test o sinifi yakalamak icin yazildi.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { crc32 } = require('./png.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '..');
const SURUM = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;
const ZIP = path.join(OUT_DIR, 'fd-adblock-' + SURUM + '.zip');

let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

/* ------------------------------------------------------------------
   BAGIMSIZ zip okuyucu (package.js'den kod ALINMADI)
   ------------------------------------------------------------------ */
function zipOku(buf) {
  // Son kaydı bul (EOCD)
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('EOCD bulunamadi');

  const adet = buf.readUInt16LE(eocd + 10);
  const merkezBoyut = buf.readUInt32LE(eocd + 12);
  const merkezOfset = buf.readUInt32LE(eocd + 16);

  const kayitlar = [];
  let p = merkezOfset;
  for (let i = 0; i < adet; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('merkez kaydi bozuk @' + p);
    const yontem = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const sik = buf.readUInt32LE(p + 20);
    const ham = buf.readUInt32LE(p + 24);
    const adUz = buf.readUInt16LE(p + 28);
    const yorumUz = buf.readUInt16LE(p + 30);
    const ekUz = buf.readUInt16LE(p + 32);
    const isim = buf.toString('utf8', p + 46, p + 46 + adUz);

    const yerOfset = buf.readUInt32LE(p + 42);
    kayitlar.push({ isim, yontem, crc, sik, ham, yerOfset });
    p += 46 + adUz + yorumUz + ekUz;
  }
  if (p - merkezOfset !== merkezBoyut) {
    throw new Error('merkez dizini boyutu tutarsız');
  }
  return { kayitlar, merkezOfset };
}

function kayitOku(buf, k) {
  const yer = k.yerOfset;
  if (buf.readUInt32LE(yer) !== 0x04034b50) throw new Error('yerel kayit bozuk');
  const yontem = buf.readUInt16LE(yer + 8);
  const crc = buf.readUInt32LE(yer + 14);
  const sik = buf.readUInt32LE(yer + 18);
  const ham = buf.readUInt32LE(yer + 22);
  const adUz = buf.readUInt16LE(yer + 26);
  const ekUz = buf.readUInt16LE(yer + 28);
  const bas = yer + 30 + adUz + ekUz;
  const govde = buf.slice(bas, bas + sik);
  return {
    crc, ham, yontem,
    veri: yontem === 8 ? zlib.inflateRawSync(govde) : govde
  };
}

/* ============================================================ testler */
console.log('\n1) Zip yapısı geçerli mi?');
check('paket dosyası var', fs.existsSync(ZIP), ZIP);
if (!fs.existsSync(ZIP)) { console.log('\nÖnce node tools/package.js çalıştır.'); process.exit(1); }

const buf = fs.readFileSync(ZIP);
let zip;
try {
  zip = zipOku(buf);
  check('zip okundu: ' + zip.kayitlar.length + ' kayıt', true);
} catch (e) {
  check('zip okundu', false, e.message);
  process.exit(1);
}

/* --- ÖNCEKİ HATANIN KENDİSİ: düzleştirme --- */
console.log('\n2) Klasör yapısı korunmuş mu? (önceki hata)');
{
  const yollar = zip.kayitlar.map((k) => k.isim);
  const duz = yollar.filter((y) => !y.includes('/'));
  // Düz olması normal olanlar: manifest.json, LICENSE gibi kök dosyalar
  const beklenenDuz = ['manifest.json'];
  const beklenmeyen = duz.filter((y) => !beklenenDuz.includes(y));
  check('iç içe dosya yok (yalnız manifest.json kökte)',
    beklenmeyen.length === 0, beklenmeyen.join(', '));

  check('src/background.js yerinde',
    yollar.includes('src/background.js'));
  check('src/content/json-prune.js yerinde',
    yollar.includes('src/content/json-prune.js'));
  check('background.js KÖKTE DEĞİL', !yollar.includes('background.js'));
}

/* --- YİNELENEN AD: mağazanın verdiği hata --- */
console.log('\n3) Yinelenen dosya adı var mı? (mağaza hatası)');
{
  const adlar = {};
  zip.kayitlar.forEach((k) => {
    const ad = k.isim.split('/').pop();
    adlar[ad] = (adlar[ad] || 0) + 1;
  });
  const dup = Object.entries(adlar).filter(([, n]) => n > 1);
  check('yinelenen ad yok', dup.length === 0,
    dup.map(([a, n]) => a + ' x' + n).join(', '));
  check('privacy.html yalnızca src/ içinde',
    zip.kayitlar.filter((k) => k.isim.endsWith('privacy.html')).length === 1);
}

/* --- GELİŞTİRME DOSYALARI SIZMASIN --- */
console.log('\n4) Geliştirme dosyaları sızmamış mı?');
{
  const yasak = ['tools/', 'store/', 'web/', 'docs/', '.github/', 'node_modules/', '_metadata/'];
  const sizan = zip.kayitlar.filter((k) => yasak.some((v) => k.isim.startsWith(v)));
  check('geliştirme klasörü sızmadı', sizan.length === 0,
    sizan.map((k) => k.isim).join(', '));

  const arac = zip.kayitlar.filter((k) =>
    /(package|validate|publish-pages|make-store-images|check-screenshots|test-.*)\.js$/.test(k.isim));
  check('geliştirme aracı sızmadı', arac.length === 0,
    arac.map((k) => k.isim).join(', '));

  const belge = zip.kayitlar.filter((k) => /README|TEKNIK|LICENSE/.test(k.isim));
  check('geliştirme belgesi sızmadı', belge.length === 0,
    belge.map((k) => k.isim).join(', '));
}

/* --- İÇERİK CRC DOĞRULAMA: her dosya bayt bayt eşleşmeli --- */
console.log('\n5) Her dosya CRC + içerik olarak doğru mu?');
{
  let hata = 0;
  let toplamBayt = 0;
  zip.kayitlar.forEach((k) => {
    let r;
    try { r = kayitOku(buf, k); }
    catch (e) { check(k.isim + ' okundu', false, e.message); hata++; return; }

    const gercekCrc = crc32(r.veri);
    if (gercekCrc !== k.crc) {
      check(k.isim + ' CRC', false,
        'beklenen ' + k.crc.toString(16) + ' hesaplanan ' + gercekCrc.toString(16));
      hata++;
    }
    if (r.veri.length !== k.ham) {
      check(k.isim + ' boyut', false, k.ham + ' != ' + r.veri.length);
      hata++;
    }
    // diskteki dosyayla aynı mı
    const diskYol = path.join(ROOT, k.isim);
    if (fs.existsSync(diskYol)) {
      const disk = fs.readFileSync(diskYol);
      if (!disk.equals(r.veri)) {
        check(k.isim + ' diskle aynı', false, 'boyut farklı');
        hata++;
      }
    } else {
      check(k.isim + ' diskte var', false);
      hata++;
    }
    toplamBayt += r.veri.length;
  });
  if (!hata) {
    check(zip.kayitlar.length + ' dosya, ' + (toplamBayt / 1024).toFixed(0) +
      ' KB — CRC ve içerik doğru', true);
  }
}

/* --- MANIFEST'TEKİ HER YOL PAKETTE OLMALI --- */
console.log('\n6) manifest.json’un gösterdiği her yol pakette var mı?');
{
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const yollar = new Set(zip.kayitlar.map((k) => k.isim));
  const istenen = [];
  if (m.background) istenen.push(m.background.service_worker);
  (m.content_scripts || []).forEach((cs) =>
    [].concat(cs.js || [], cs.css || []).forEach((j) => istenen.push(j)));
  Object.values(m.icons || {}).forEach((i) => istenen.push(i));
  Object.values((m.action || {}).default_icon || {}).forEach((i) => istenen.push(i));
  if (m.options_page) istenen.push(m.options_page);
  if (m.action && m.action.default_popup) istenen.push(m.action.default_popup);
  (m.declarative_net_request || {}).rule_resources &&
    m.declarative_net_request.rule_resources.forEach((r) => istenen.push(r.path));
  (m.web_accessible_resources || []).forEach((w) =>
    (w.resources || []).forEach((r) => istenen.push(r)));

  const eksik = istenen.filter((p) => !yollar.has(p));
  check('tüm manifest yolları pakette (' + istenen.length + ' tane)',
    eksik.length === 0, eksik.join(', '));
}

/* --- PRIVACY KOPYA --- */
console.log('\n7) Gizlilik politikası pakette mi? (offline çalışma)');
{
  const yollar = zip.kayitlar.map((k) => k.isim);
  check('src/privacy.html pakette', yollar.includes('src/privacy.html'));
  const r = kayitOku(buf, zip.kayitlar.find((k) => k.isim === 'src/privacy.html'));
  const s = r.veri.toString('utf8');
  check('politika içeriği okunabilir', /Gizlilik Politikası/.test(s));
  check('e-posta politika içinde', /ferhatdogan55@gmail\.com/.test(s));
}

/* --- JSON AYARLARI GEÇERLİ --- */
console.log('\n8) Paketteki JSON dosyaları parse edilebiliyor mu?');
{
  const jsonlu = zip.kayitlar.filter((k) => k.isim.endsWith('.json'));
  let hata = 0;
  jsonlu.forEach((k) => {
    try { JSON.parse(kayitOku(buf, k).veri.toString('utf8')); }
    catch (e) { check(k.isim + ' parse', false, e.message); hata++; }
  });
  if (!hata) check(jsonlu.length + ' JSON dosyası geçerli', true);
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);