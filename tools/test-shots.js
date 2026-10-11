/* check-screenshots.js'in BOZUK girdiyi yakaladigini kanitlar.
   Yalnizca temiz girdide gecmek, kontrolun hic calismadigini da
   gosterirdi. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const KOK = path.join(__dirname, '..');
const TOOLS = __dirname;
const { pngYaz } = require(TOOLS + '/png.js');

const SS = path.join(KOK, 'store', 'screenshots');
const IMG = path.join(KOK, 'store', 'images');
const V = TOOLS + '/check-screenshots.js';

let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

const yedek = {};
function sakla(dosya) { if (fs.existsSync(dosya)) yedek[dosya] = fs.readFileSync(dosya); }
function geriKoy() {
  Object.keys(yedek).forEach((d) => fs.writeFileSync(d, yedek[d]));
  Object.keys(yedek).forEach((d) => delete yedek[d]);
}

function calistir() {
  // stdout'u HER ZAMAN al. Basarili calistirmada cikti bos sayiliyordu;
  // boylece yalnizca mesaji olan uyarilari okuyamazdik.
  const r = require('child_process').spawnSync('node', [V], { encoding: 'utf8' });
  return { kod: r.status, cikti: (r.stdout || '') + (r.stderr || '') };
}

// temiz durum
const p1 = path.join(SS, '01-tanilama.png');
const p2 = path.join(SS, '02-youtube.png');
const promo = path.join(IMG, 'promo-small-440x280.png');
const icon = path.join(KOK, 'icons', 'icon128.png');
[p1, p2, promo, icon].forEach(sakla);

function dolu(g, y) {
  const b = Buffer.alloc(g * y * 4);
  for (let i = 0; i < g * y; i++) {
    b[i * 4] = (i * 13) & 255; b[i * 4 + 1] = (i * 7) & 255;
    b[i * 4 + 2] = (i * 3) & 255; b[i * 4 + 3] = 255;
  }
  return b;
}

fs.mkdirSync(SS, { recursive: true });

console.log('\n1) DOGRU girdi KABUL EDILMELI');
{
  fs.writeFileSync(p1, pngYaz(1280, 800, dolu(1280, 800), false));
  fs.writeFileSync(p2, pngYaz(1280, 800, dolu(1280, 800).map((v, i) => (i % 4 === 1 ? v ^ 0x5a : v)), false));
  const r = calistir();
  check('1280x800 ikisi de kabul', r.kod === 0, r.cikti.split('\n').filter(l => /HATA/.test(l)).join(' | '));
}

console.log('\n2) YANLIS BOYUT REDDEDILMELI');
{
  fs.writeFileSync(p1, pngYaz(800, 600, dolu(800, 600), false));
  const r = calistir();
  check('800x600 reddedildi', r.kod === 1);
  check('hata mesaji boyutu soyluyor', /1280x800/.test(r.cikti));
}

console.log('\n3) ALFA KANALI OLAN PNG REDDEDILMELI');
{
  const b = dolu(1280, 800);
  for (let i = 3; i < b.length; i += 4) b[i] = 128;   // yari saydam
  fs.writeFileSync(p1, pngYaz(1280, 800, b, true));
  const r = calistir();
  check('alfa kanali reddedildi', r.kod === 1);
  check('mesaj alfa kanalini soyluyor', /ALFA/i.test(r.cikti));
}

console.log('\n4) BOS GORSEL REDDEDILMELI');
{
  const tek = Buffer.alloc(1280 * 800 * 4, 200);   // her piksel ayni
  fs.writeFileSync(p1, pngYaz(1280, 800, tek, false));
  const r = calistir();
  check('tek renkli gorsel yakalandi', /bos/i.test(r.cikti));
}

console.log('\n5) YINELENEN GORSEL REDDEDILMELI');
{
  const a = pngYaz(1280, 800, dolu(1280, 800), false);
  fs.writeFileSync(p1, a);
  fs.writeFileSync(p2, Buffer.from(a));            // bayt bayt ayni
  const r = calistir();
  check('ayni gorsuntu iki kez reddedildi', r.kod === 1);
  check('mesaj yinelenmeyi soyluyor', /aynı|ayni/i.test(r.cikti));
}

console.log('\n6) 5+TANE FAZLA REDDEDILMELI');
{
  for (let i = 1; i <= 6; i++) {
    const b = dolu(1280, 800);
    b[i * 999] ^= 0xff;
    fs.writeFileSync(path.join(SS, 'x' + i + '.png'), pngYaz(1280, 800, b, false));
  }
  [p1, p2].forEach((p) => { if (fs.existsSync(p)) fs.unlinkSync(p); });
  const r = calistir();
  check('6 gorsuntu reddedildi', r.kod === 1);
  check('mesaj 5 sinirini soyluyor', /5/.test(r.cikti));
}

console.log('\n7) ZORUNLU KUTU EKSIKSE REDDEDILMELI');
{
  fs.rmSync(SS, { recursive: true, force: true });
  fs.mkdirSync(SS, { recursive: true });
  const yedekPromo = fs.readFileSync(promo);
  fs.unlinkSync(promo);
  const r = calistir();
  check('440x280 kutu yokken hata', r.kod === 1);
  check('mesaj EKSIK diyor', /EKSIK/i.test(r.cikti));
  fs.writeFileSync(promo, yedekPromo);
}

console.log('\n8) GERI ALINDI, temiz duruma dondu mu?');
{
  fs.rmSync(SS, { recursive: true, force: true });
  geriKoy();
  const r = calistir();
  check('temiz durum gecti', r.kod === 0,
    r.cikti.split('\n').filter(l => /HATA/.test(l)).join(' | '));
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);