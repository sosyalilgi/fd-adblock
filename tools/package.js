/* =====================================================================
   FD Reklam Engelleyici — paketleyici
   Kullanim:  node tools/package.js

   ---------------------------------------------------------------------
   ONCEKI SURUMUN HATASI (2026-10-11'de magaza formunda yakalandi):

   Powershell Compress-Archive'a dosya LISTESI verildiginde dosyalar
   zip KOKUNE duzlestirilir. Klasor yapisini korumaz:

       src/background.js  ->  background.js   (zip icinde)

   manifest.json "src/background.js" bekledigi icin paket hic yuklenemezdi.
   Ayrica docs/ klasoru dislanmamis oldugu icin privacy.html iki kez
   girdi ve magaza "duplicate files" hatasi verdi.

   Simdi zip dogrudan Node ile yaziliyor: yol agaci korunur, icerik
   listesi beyaz liste ile belirlenir, sonra DOGRULANIR.

   Harici bagimlilik yok (zlib yeterli).
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { crc32 } = require('./png.js');

const ROOT = path.join(__dirname, '..');
const NAME = 'fd-adblock';
const OUT_DIR = path.join(ROOT, '..');
const OUT = path.join(OUT_DIR, NAME + '-' + readVersion() + '.zip');

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
}

/* ---------------------------------------------------------------------
   Pakete girilecek dosyalar. Beyaz liste: manifest'in gercekten
   ihtiyac duydugu her sey. Dev araclari (tools/, store/, web/,
   docs/, CI dosyalari) ve gelistirme belgeleri GIRMEZ.

   Silmekten kacinma ilkesi: manifest'te adı geçen her yol pakette
   OLMALI. Bu yuzden asagida manifest'ten dogrulama yapilir.
   ------------------------------------------------------------------- */
const AL = [
  'manifest.json'
];

const KLASORLER = [
  'icons',
  'src'
];

const CIKAR = [
  // gelistirme araclari ve magaza materyalleri — calisma zamaninda yok
  'src/rules/must-block.json',   // yalnizca tools/validate.js kullanir
  'src/rules/never-block.json'   // yalnizca tools/validate.js kullanir
];

/* ---------------------------------------------------------------- ZIP */
const BELIRTICILER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);  // PK\x03\x04
const MERKEZ    = Buffer.from([0x50, 0x4b, 0x01, 0x02]);  // PK\x01\x02
const SON       = Buffer.from([0x50, 0x4b, 0x05, 0x06]);  // PK\x05\x06

function dosyaBasi(isim, crc, boyut, sikistirilmis, yontem, tarih) {
  const b = Buffer.alloc(30);
  b.writeUInt32LE(BELIRTICILER.readUInt32LE(0), 0);
  b.writeUInt16LE(20, 4);          // surum 2.0
  b.writeUInt16LE(0x0800, 6);      // bayrak: dosya adi UTF-8
  b.writeUInt16LE(yontem, 8);
  b.writeUInt16LE(tarih, 10);      // zaman
  b.writeUInt16LE(tarih >> 16, 12); // tarih
  b.writeUInt32LE(crc, 14);
  b.writeUInt32LE(sikistirilmis, 18);
  b.writeUInt32LE(boyut, 22);
  b.writeUInt16LE(isim.length, 26);
  b.writeUInt16LE(0, 28);         // ek alan yok
  return b;
}

function merkezKaydi(isim, crc, boyut, sikistirilmis, ofset, yontem, tarih) {
  // Merkez dizin kaydı 46 bayttır. ALAN GENİŞLİKLERİ KESİN:
  //   30-31 ek alan uzunluğu   (2)
  //   32-33 yorum uzunluğu     (2)
  //   34-35 disk numarası      (2)
  //   36-37 iç özellik         (2)
  //   38-41 dış özellik        (4)
  //   42-45 yerel kayıt ofseti (4)
  // İlk yazımda 30'a 4 bayt yazıldı ve alanlar kaydı; bağımsız
  // okuyucu "merkez kaydi bozuk" dedi.
  const b = Buffer.alloc(46);
  b.writeUInt32LE(MERKEZ.readUInt32LE(0), 0);
  b.writeUInt16LE(20, 4);          // bu kaydı yazan sürüm
  b.writeUInt16LE(20, 6);          // gereken sürüm
  b.writeUInt16LE(0x0800, 8);      // dosya adı UTF-8
  b.writeUInt16LE(yontem, 10);
  b.writeUInt16LE(tarih, 12);      // zaman
  b.writeUInt16LE(tarih >> 16, 14); // tarih
  b.writeUInt32LE(crc, 16);
  b.writeUInt32LE(sikistirilmis, 20);
  b.writeUInt32LE(boyut, 24);
  b.writeUInt16LE(isim.length, 28);
  b.writeUInt16LE(0, 30);          // ek alan
  b.writeUInt16LE(0, 32);          // yorum
  b.writeUInt16LE(0, 34);          // disk numarası
  b.writeUInt16LE(0, 36);          // iç özellik
  b.writeUInt32LE(0, 38);          // dış özellik
  b.writeUInt32LE(ofset, 42);      // yerel kayıt ofseti
  return b;
}

function zipYaz(dosyalar) {
  const parcalar = [];
  const merkezler = [];
  let ofset = 0;
  const tarih = ((2026 - 1980) << 9) | (1 << 5) | 1;   // 2026-01-01

  for (const d of dosyalar) {
    const isim = Buffer.from(d.yol.replace(/\\/g, '/'), 'utf8');
    const ham = d.icerik;
    const sik = zlib.deflateRawSync(ham, { level: 9 });
    // Sikistirme kazanc yoksa saklama (daha kucuk ve daha hizli acilis)
    const yontem = sik.length < ham.length ? 8 : 0;
    const govde = yontem === 8 ? sik : ham;
    const crc = crc32(ham);

    parcalar.push(dosyaBasi(isim, crc, ham.length, govde.length, yontem, tarih));
    parcalar.push(isim);
    parcalar.push(govde);
    // Merkez kaydı SABİT 46 bayttır; dosya adı AYRIca eklenir.
    // (İlk yazımda ad hiç eklenmedi — okuyucu kaydı 46 bayt sayıp
    //  sonraki kaydın imzasını isim sanıyordu.)
    merkezler.push(merkezKaydi(isim, crc, ham.length, govde.length, ofset, yontem, tarih));
    merkezler.push(isim);

    ofset += 30 + isim.length + govde.length;
  }

  const merkezGovde = Buffer.concat(merkezler);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(SON.readUInt32LE(0), 0);
  son.writeUInt16LE(0, 4);
  son.writeUInt16LE(0, 6);
  son.writeUInt16LE(dosyalar.length, 8);
  son.writeUInt16LE(dosyalar.length, 10);
  son.writeUInt32LE(merkezGovde.length, 12);
  son.writeUInt32LE(ofset, 16);
  son.writeUInt16LE(0, 20);

  return Buffer.concat([...parcalar, merkezGovde, son]);
}

/* ---------------------------------------------------------------- dosyalar */
function topla() {
  const cikti = [];
  for (const f of AL) {
    const tam = path.join(ROOT, f);
    if (fs.existsSync(tam)) cikti.push({ yol: f, icerik: fs.readFileSync(tam) });
  }
  for (const k of KLASORLER) {
    const kok = path.join(ROOT, k);
    if (!fs.existsSync(kok)) continue;
    (function walk(dir, base) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const tam = path.join(dir, e.name);
        const rel = base ? base + '/' + e.name : e.name;
        if (e.isDirectory()) {
          if (['node_modules', '_metadata', '__pycache__'].includes(e.name)) continue;
          walk(tam, rel);
        } else {
          if (CIKAR.includes(k + '/' + rel)) continue;
          // gelistirme araclari yanlislikla sizmasin
          if (rel.startsWith('test-') || rel === 'TEKNIK-DETAY.md') continue;
          cikti.push({ yol: k + '/' + rel, icerik: fs.readFileSync(tam) });
        }
      }
    })(kok, '');
  }
  return cikti;
}

/* ---------------------------------------------------------------- dogrulama */
function dogrula(dosyalar) {
  const hatalar = [];
  const yollar = new Set(dosyalar.map((f) => f.yol));

  /* 0) Kaynak dosyalar SOZDIZIMSEL OLARAK GECERLI olmali.
     Bozuk dosya pakete girerse Chrome yukleyemez. Testler yalnizca
     o dosyayi require ederse duser; require etmeyen bir bozuk dosya
     sessizce yayina gider.
     2026-10-11: player-detect.js'in module.exports satiri bozuldu
     ve paketlemci onu oldugu gibi pakete koydu. */
  const { spawnSync } = require('child_process');
  dosyalar.forEach((f) => {
    if (!/\.js$/.test(f.yol)) return;
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f.yol)],
      { encoding: 'utf8' });
    if (r.status !== 0) {
      const sat = (r.stderr || '').split('\n')
        .find((l) => /Error/.test(l));
      hatalar.push('bozuk sozdizimi: ' + f.yol +
        (sat ? '  →  ' + sat.trim().slice(0, 50) : ''));
    }
  });

  // 1) Yinelenen ad — magaza acikca reddediyor
  const adlar = new Map();
  dosyalar.forEach((f) => {
    const ad = f.yol.split('/').pop();
    adlar.set(ad, (adlar.get(ad) || 0) + 1);
  });
  adlar.forEach((n, ad) => {
    if (n > 1) hatalar.push('yinelenen dosya adı: ' + ad + ' x' + n);
  });

  // 2) manifest'in gösterdiği HER yol pakette olmalı
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const istenen = [];
  if (m.background) istenen.push(m.background.service_worker);
  (m.content_scripts || []).forEach((cs) => {
    (cs.js || []).forEach((j) => istenen.push(j));
    (cs.css || []).forEach((c) => istenen.push(c));
  });
  Object.values(m.icons || {}).forEach((i) => istenen.push(i));
  Object.values((m.action && m.action.default_icon) || {}).forEach((i) => istenen.push(i));
  if (m.options_page) istenen.push(m.options_page);
  if (m.action && m.action.default_popup) istenen.push(m.action.default_popup);
  (m.declarative_net_request && m.declarative_net_request.rule_resources || [])
    .forEach((r) => istenen.push(r.path));
  (m.web_accessible_resources || []).forEach((w) => {
    (w.resources || []).forEach((r) => istenen.push(r));
  });

  istenen.forEach((p) => {
    if (!yollar.has(p)) hatalar.push('manifest gösteriyor ama pakette yok: ' + p);
  });

  // 3) Geliştirme dosyaları sızmamalı
  ['tools/', 'store/', 'web/', 'docs/', '.github/', 'node_modules/'].forEach((k) => {
    dosyalar.forEach((f) => {
      if (f.yol.startsWith(k)) hatalar.push('geliştirme dosyası pakete girdi: ' + f.yol);
    });
  });

  // 4) package.js'in kendisi ve testler girmemeli
  dosyalar.forEach((f) => {
    if (/package\.js$|validate\.js$|test-.*\.js$/.test(f.yol)) {
      hatalar.push('geliştirme aracı pakete girdi: ' + f.yol);
    }
  });

  return hatalar;
}

/* ---------------------------------------------------------------- calistir */
const files = topla();

console.log('paketlenecek dosyalar (' + files.length + '):');
files.sort((a, b) => a.yol.localeCompare(b.yol)).forEach((f) => console.log('  ' + f.yol));

const hatalar = dogrula(files);
if (hatalar.length) {
  console.error('\nPAKET DOĞRULAMASI BAŞARISIZ:');
  hatalar.forEach((h) => console.error('  HATA  ' + h));
  console.error('\nBu paket mağazaya yüklenirse reddedilir. Düzeltmeden yükleme.');
  process.exit(1);
}
console.log('\n✓ doğrulama geçti: yinelenen ad yok, manifest yolları tam, geliştirme dosyası sızmadı');

const buf = zipYaz(files);
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
fs.writeFileSync(OUT, buf);

console.log('\nOK -> ' + OUT + '  (' + (buf.length / 1024).toFixed(1) + ' KB)');
console.log('Kurulum: chrome://extensions -> Geliştirici modu -> Paketi çözülmemiş olarak yükle');
console.log('Not: zip yüklenmez; içindeki klasörü açıp onu seçmelisin.');