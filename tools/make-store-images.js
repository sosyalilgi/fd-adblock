/* =====================================================================
   Chrome Web Store gorselleri uretir
   ---------------------------------------------------------------------
   Magaza zorunlulari:
     ikon 128x128        -> zaten var (icons/)
     kucuk kutu 440x280  -> ZORUNLU, bu betik uretir
     ekran goruntusu    -> kullanici kendi tarayicisinda yakalar
                          (bkz. store/SCREENSHOTS.md)

   Harici bagimlilik yok: tools/png.js + tools/font5x7.js kullanilir.
   Kullanim: node tools/make-store-images.js
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { oku, pngYaz } = require('./png.js');
const font = require('./font5x7.js');

const KOK = path.join(__dirname, '..');
const CIKTI = path.join(KOK, 'store', 'images');
fs.mkdirSync(CIKTI, { recursive: true });

/* ------------------------------------------------------ cizim araclari */
function tuvale(g, y, renk) {
  const veri = Buffer.alloc(g * y * 4);
  for (let i = 0; i < g * y; i++) {
    veri[i * 4] = renk[0]; veri[i * 4 + 1] = renk[1];
    veri[i * 4 + 2] = renk[2]; veri[i * 4 + 3] = 255;
  }
  return { genislik: g, yukseklik: y, veri };
}

function dikeyGradyan(t, ust, alt) {
  for (let y = 0; y < t.yukseklik; y++) {
    const o = y / Math.max(1, t.yukseklik - 1);
    for (let x = 0; x < t.genislik; x++) {
      const i = (y * t.genislik + x) * 4;
      t.veri[i] = ust[0] + (alt[0] - ust[0]) * o;
      t.veri[i + 1] = ust[1] + (alt[1] - ust[1]) * o;
      t.veri[i + 2] = ust[2] + (alt[2] - ust[2]) * o;
      t.veri[i + 3] = 255;
    }
  }
}

/* ikonu boyutlandir (bilinear) ve tuvale yerlestir */
function ikonYerlestir(t, ikon, hedefBoy, merkezX, ustY) {
  const kaynak = ikon.veri;
  for (let dy = 0; dy < hedefBoy; dy++) {
    const sy = Math.floor(dy / hedefBoy * ikon.yukseklik);
    for (let dx = 0; dx < hedefBoy; dx++) {
      const sx = Math.floor(dx / hedefBoy * ikon.genislik);
      const s = (sy * ikon.genislik + sx) * 4;
      const a = kaynak[s + 3] / 255;
      if (a === 0) continue;
      const d = ((ustY + dy) * t.genislik + merkezX + dx) * 4;
      if (ustY + dy < 0 || ustY + dy >= t.yukseklik) continue;
      if (merkezX + dx < 0 || merkezX + dx >= t.genislik) continue;
      t.veri[d] = kaynak[s] * a + t.veri[d] * (1 - a);
      t.veri[d + 1] = kaynak[s + 1] * a + t.veri[d + 1] * (1 - a);
      t.veri[d + 2] = kaynak[s + 2] * a + t.veri[d + 2] * (1 - a);
      t.veri[d + 3] = 255;
    }
  }
}

function yaz(dosya, t) {
  // Magaza ekran goruntulerinde ALFA IZIN VERILMEZ -> alfa kanalini at
  const p = path.join(CIKTI, dosya);
  fs.writeFileSync(p, pngYaz(t.genislik, t.yukseklik, t.veri, false));
  console.log('  ' + dosya + '  ' + t.genislik + 'x' + t.yukseklik +
    '  ' + fs.statSync(p).size + ' bayt');
  return p;
}

const ikon = oku(fs.readFileSync(path.join(KOK, 'icons', 'icon128.png')));

const YESIL = [22, 163, 74];
const BEYAZ = [255, 255, 255];
const SOLUK = [148, 163, 184];

/* =====================================================================
   1) Kucuk tanitim kutusu — 440x280  (ZORUNLU)
   ===================================================================== */
console.log('\n1) Kucuk tanitim kutusu (440x280):');
{
  const t = tuvale(440, 280, [0, 0, 0]);
  dikeyGradyan(t, [15, 32, 58], [8, 18, 34]);

  ikonYerlestir(t, ikon, 108, (440 - 108) / 2, 44);

  // "FD" — buyuk
  const olc1 = font.olc('FD', 7);
  font.ciz(t, 'FD', (440 - olc1.genislik) / 2, 178, 7, YESIL);

  // "REKLAM ENGELLEYICI" — kucuk
  const olc2 = font.olc('REKLAM ENGELLEYICI', 2);
  font.ciz(t, 'REKLAM ENGELLEYICI', (440 - olc2.genislik) / 2, 240, 2, SOLUK);

  yaz('promo-small-440x280.png', t);
}

/* =====================================================================
   2) Marquee — 1400x560  (istege bagli ama onerilir)
   ===================================================================== */
console.log('\n2) Marquee (1400x560):');
{
  const t = tuvale(1400, 560, [0, 0, 0]);
  dikeyGradyan(t, [15, 32, 58], [8, 18, 34]);

  ikonYerlestir(t, ikon, 240, 180, 160);

  const a = font.olc('FD REKLAM', 9);
  font.ciz(t, 'FD REKLAM', 500, 180, 9, BEYAZ);

  const b = font.olc('ENGELLEYICI', 9);
  font.ciz(t, 'ENGELLEYICI', 500, 270, 9, YESIL);

  const c = font.olc('YOUTUBE REKLAMLARINI ENGELLER', 4);
  font.ciz(t, 'YOUTUBE REKLAMLARINI ENGELLER', 502, 380, 4, SOLUK);

  yaz('marquee-1400x560.png', t);
}

console.log('\nstore/images/ klasorune yazildi.');
console.log('Ekran goruntuleri (1280x800) kullanici tarafindan yakalanir:');
console.log('  store/SCREENSHOTS.md');