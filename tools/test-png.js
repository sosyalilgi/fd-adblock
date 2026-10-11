/* PNG arac kutusunu KANITLA — ve KENDI HATAMIZI YAKALAYACAK SEKILDE.
   ---------------------------------------------------------------------
   ONEMLI: Onceki test, yazdigimiz PNG'yi kendi okuyucumuzla okuyup
   karsilastiriyordu. Iki taraf da ayni hatali kod oldugu icin gecen
   verdi. CRC hatasi ancak BAGIMSIZ bir uygulamayla yakalandi.

   Burada CRC, bilinen bir test vektorunden hesaplanir:
     "123456789" icin dogru CRC-32 = 0xCBF43926
   Bu vektor bilinen yaygin bir test oldugundan karsilastirma elle
   yapilabilir ve bizim tablo hatamizi da yakalar.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const TOOL = './png.js';
const { oku, pngYaz, crc32 } = require(TOOL);

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
}

console.log('\n1) CRC32 BILINEN TEST VEKTORUNE UYGUN MU?');
check('crc32("123456789") = 0xCBF43926', crc32(Buffer.from('123456789')) === 0xcbf43926,
  '0x' + crc32(Buffer.from('123456789')).toString(16));
check('crc32("") = 0', crc32(Buffer.alloc(0)) === 0);

console.log('\n2) Yazilan PNG her parcasi gecerli CRC tasiyor mu?');
function parcalarıDogrula(buf) {
  const ISARET = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(ISARET)) return ['imza bozuk'];
  const sorunlar = [];
  let p = 8;
  let gorulen = 0;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const tur = buf.toString('ascii', p + 4, p + 8);
    const saklanan = buf.readUInt32BE(p + 8 + len);
    // CRC alani haric, tur + veri
    const hesaplanan = crc32(buf.subarray(p + 4, p + 8 + len));
    if (saklanan !== hesaplanan) {
      sorunlar.push(tur + ' CRC ' + saklanan.toString(16) + ' != ' + hesaplanan.toString(16));
    }
    gorulen++;
    p += 12 + len;
    if (tur === 'IEND') break;
  }
  if (gorulen < 3) sorunlar.push('beklenen en az 3 parca, bulunan ' + gorulen);
  return sorunlar;
}
{
  const buf = pngYaz(20, 20, Buffer.alloc(20 * 20 * 4, 128), false);
  const s = parcalarıDogrula(buf);
  check('uc parcacinin CRC\'si de dogru', s.length === 0, s.join(' | '));
}

console.log('\n3) Gercek ikonlari okuyabiliyor mu?');
for (const f of ['icon16', 'icon32', 'icon48', 'icon128']) {
  const ham = fs.readFileSync(path.join(ROOT, 'icons', f + '.png'));
  const s = parcalarıDogrula(ham);
  check(f + '.png parcalari saglam', s.length === 0, s.join(' | '));
  try {
    const g = oku(ham);
    const b = parseInt(f.replace('icon', ''), 10);
    check(f + '.png ' + g.genislik + 'x' + g.yukseklik, g.genislik === b && g.yukseklik === b);
  } catch (e) {
    check(f + '.png okundu', false, e.message);
  }
}

console.log('\n4) Yaz -> ok gidis-donusu BOZULMA OLMAMALI');
{
  const g = 64, y = 48;
  const src = Buffer.alloc(g * y * 4);
  for (let i = 0; i < g * y; i++) {
    src[i * 4] = (i * 7) & 0xff;
    src[i * 4 + 1] = (i * 13) & 0xff;
    src[i * 4 + 2] = (i * 29) & 0xff;
    src[i * 4 + 3] = (i % 5 === 0) ? 0 : 255;
  }
  const t = oku(pngYaz(g, y, src, true));
  check('boyut korundu', t.genislik === g && t.yukseklik === y);
  let farkli = 0;
  for (let i = 0; i < src.length; i++) if (src[i] !== t.veri[i]) farkli++;
  check('tum kanallar birebir ayni', farkli === 0, farkli + ' farkli');
}

console.log('\n5) Alfa kanali OLMADAN (store kurali: no alpha)');
{
  // Girdi DAIMA RGBA (4 kanal) — cizim kodunun gercek kullanimi bu.
  const g = 8, y = 8;
  const rgba = Buffer.alloc(g * y * 4);
  for (let p = 0; p < g * y; p++) {
    rgba[p * 4] = p * 3;
    rgba[p * 4 + 1] = p * 3 + 1;
    rgba[p * 4 + 2] = p * 3 + 2;
    rgba[p * 4 + 3] = 255;
  }
  const t = oku(pngYaz(g, y, rgba, false));
  let hepsiTam = true;
  for (let i = 3; i < t.veri.length; i += 4) if (t.veri[i] !== 255) hepsiTam = false;
  check('alfa yoksa cikista hepsi 255', hepsiTam);
  check('R,G,B sirasi ve KAYDIRMA YOK',
    t.veri[0] === 0 && t.veri[1] === 1 && t.veri[2] === 2 &&
    t.veri[4] === 3 && t.veri[5] === 4 && t.veri[6] === 5,
    t.veri.slice(0, 12).join(','));
}

console.log('\n5b) Gradyan gibi DOLU bir RGBA tamponu bozulmadan yazilir');
{
  // Bu, gercek kullanim senaryosu: 440x280 gradyan.
  const g = 40, y = 30;
  const rgba = Buffer.alloc(g * y * 4);
  for (let yy = 0; yy < y; yy++) {
    for (let xx = 0; xx < g; xx++) {
      const i = (yy * g + xx) * 4;
      rgba[i] = 15 + xx; rgba[i + 1] = 32 + yy; rgba[i + 2] = 58; rgba[i + 3] = 255;
    }
  }
  const t = oku(pngYaz(g, y, rgba, false));
  let sapma = 0;
  for (let yy = 0; yy < y; yy++) {
    for (let xx = 0; xx < g; xx++) {
      const i = (yy * g + xx) * 4;
      if (t.veri[i] !== 15 + xx || t.veri[i + 1] !== 32 + yy || t.veri[i + 2] !== 58) sapma++;
    }
  }
  check('dolu tampon birebir korundu', sapma === 0, sapma + ' piksel kaymis');
}

console.log('\n6) Bozuk girdi DUZGUN hata veriyor mu?');
{
  try { oku(Buffer.from('bu bir png degil')); check('imzasiz reddedildi', false); }
  catch (e) { check('imzasiz reddedildi', /imzasi/.test(e.message), e.message); }
  try { oku(Buffer.alloc(200)); check('bozuk veri reddedildi', false); }
  catch (e) { check('bozuk veri reddedildi', true, e.message); }
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);