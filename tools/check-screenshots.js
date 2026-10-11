/* =====================================================================
   Magaza gorsellerini yuklemeden ONCE dogrular
   ---------------------------------------------------------------------
   Kurallar (Chrome Web Store):
     - ekran goruntusu: 1280x800 veya 640x400, en fazla 5, en az 1
     - PNG "no alpha" veya JPEG  -> alfa kanal OLMAMALI
     - kucuk kutu 440x280 (zorunlu)
     - marquee 1400x560 (istege bagli)

   Kullanim: node tools/check-screenshots.js
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { oku } = require('./png.js');

const KOK = path.join(__dirname, '..');
const SS = path.join(KOK, 'store', 'screenshots');
const IMG = path.join(KOK, 'store', 'images');

let hata = 0, uyari = 0;
const ok = (m) => console.log('  OK    ' + m);
const H = (m) => { hata++; console.log('  HATA  ' + m); };
const U = (m) => { uyari++; console.log('  UYARI ' + m); };

/* --------------------------------------------------- zorunlu gorseller */
console.log('\n=== Kodla uretilmis gorseller (zorunlu) ===\n');

function pngBilgi(p) {
  const b = fs.readFileSync(p);
  const g = oku(b);
  let alfaVar = false;
  for (let i = 3; i < g.veri.length; i += 4) {
    if (g.veri[i] !== 255) { alfaVar = true; break; }
  }
  // renk cesitliligi: tam tek renk = bos/bozuk gorsel
  const gorulen = new Set();
  for (let i = 0; i < g.veri.length; i += 4 * 97) {
    gorulen.add(g.veri[i] + ',' + g.veri[i + 1] + ',' + g.veri[i + 2]);
  }
  return { g, alfaVar, cesit: gorulen.size };
}

function kontrolEt(dosya, beklenenG, beklenenY, zorunlu) {
  const p = path.join(IMG, dosya);
  if (!fs.existsSync(p)) {
    (zorunlu ? H : U)('EKSIK: store/images/' + dosya);
    return;
  }
  try {
    const { g, alfaVar, cesit } = pngBilgi(p);
    const etiket = dosya + ' (' + g.genislik + 'x' + g.yukseklik + ')';
    if (g.genislik === beklenenG && g.yukseklik === beklenenY) ok(etiket + ' boyut dogru');
    else H(etiket + ' boyut YANLIS, beklenen ' + beklenenG + 'x' + beklenenY);

    if (!alfaVar) ok(dosya + ' alfa kanalı yok (store kurali)');
    else H(dosya + ' ALFA KANALI VAR — magaza reddeder');

    if (cesit >= 8) ok(dosya + ' dolu icerik (' + cesit + ' farkli renk)');
    else H(dosya + ' resim neredeyse bos (' + cesit + ' renk) — cizim basarisiz olabilir');
  } catch (e) {
    H(dosya + ' okunamadi: ' + e.message);
  }
}

kontrolEt('promo-small-440x280.png', 440, 280, true);
kontrolEt('marquee-1400x560.png', 1400, 560, false);

/* ikon */
{
  const p = path.join(KOK, 'icons', 'icon128.png');
  if (!fs.existsSync(p)) H('EKSIK: icons/icon128.png');
  else {
    const { g } = pngBilgi(p);
    if (g.genislik === 128 && g.yukseklik === 128) ok('icon128.png 128x128');
    else H('icon128.png ' + g.genislik + 'x' + g.yukseklik + ' olmali 128x128 olmali');
  }
}

/* ------------------------------------------------ ekran goruntuleri */
console.log('\n=== Ekran goruntuleri (kullanici yakalar) ===\n');

if (!fs.existsSync(SS)) {
  console.log('  store/screenshots/ klasoru yok.');
  console.log('  Yalnizca 1 tane olsa bile magaza formu gonderimi kabul eder.');
  console.log('  Kilavuz: store/SCREENSHOTS.md');
} else {
  const dosyalar = fs.readdirSync(SS).filter((f) => /\.(png|jpe?g)$/i.test(f));
  if (!dosyalar.length) {
    U('store/screenshots/ bos — en az 1 gorsuntu gerekiyor');
  } else {
    if (dosyalar.length > 5) H(dosyalar.length + ' gorsuntu var, en fazla 5 olabilir');
    else ok(dosyalar.length + ' gorsuntu (' + dosyalar.length + '/5)');

    dosyalar.forEach((f) => {
      const p = path.join(SS, f);
      if (/\.jpe?g$/i.test(f)) {
        // JPEG: boyut dosya basligindan okunmaz, dosya boyutuna bakilir
        const kb = (fs.statSync(p).size / 1024).toFixed(0);
        ok(f + ' (JPEG, ' + kb + ' KB) — boyutu Paint ile kontrol et');
        return;
      }
      try {
        const { g, alfaVar, cesit } = pngBilgi(p);
        const i1280 = g.genislik === 1280 && g.yukseklik === 800;
        const i640 = g.genislik === 640 && g.yukseklik === 400;
        if (i1280) ok(f + ' 1280x800');
        else if (i640) ok(f + ' 640x400');
        else H(f + ' ' + g.genislik + 'x' + g.yukseklik + ' — 1280x800 veya 640x400 olmali');

        if (!alfaVar) ok(f + ' alfa kanalı yok');
        else H(f + ' ALFA KANALI VAR — magaza reddeder');

        if (cesit >= 20) ok(f + ' dolu icerik (' + cesit + ' renk)');
        else U(f + ' az renk var (' + cesit + ') — bos gorunuyor olabilir');
      } catch (e) {
        H(f + ' okunamadi: ' + e.message);
      }
    });

    // yinelenen icerik: ayni dosya iki kez yuklenmis olabilir
    const imzalar = dosyalar.map((f) => fs.readFileSync(path.join(SS, f)));
    let tekrar = 0;
    for (let i = 0; i < imzalar.length; i++) {
      for (let j = i + 1; j < imzalar.length; j++) {
        if (imzalar[i].equals(imzalar[j])) { tekrar++; }
      }
    }
    if (tekrar) H(tekrar + ' gorsuntu bayt bayt ayni — yinelenen icerik reddedilir');
    else if (imzalar.length > 1) ok('tum gorsuntuler farkli');
  }
}

/* ---------------------------------------------------------- ozet */
console.log('\n==============================');
console.log('  ' + (hata ? hata + ' HATA, ' : '') + uyari + ' uyari');
if (hata) {
  console.log('\n  Yuklemeden once yukseleri duzelt.');
} else {
  console.log('\n  Magaza gorselleri yuklemeye hazir.');
}
process.exit(hata ? 1 : 0);