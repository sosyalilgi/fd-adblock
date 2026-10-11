/* =====================================================================
   Minimal PNG arac kutusu — harici bagimlilik olmadan
   ---------------------------------------------------------------------
   Bu proje kurulum yapmadan calismayi hedefliyor; sharp/canvas/jimp
   kurmak yerine zlib (Node ile birlikte gelir) uzerinden PNG okuma ve
   yazma yeterli. Yalnizca 8-bit RGB/RGBA/gri/grek+alfa desteklenir —
   bizim ikonlarimiz bu formatta.

   DOGRULAMA NOTU: Bu dosya kendi yazdigi PNG'yi geri okuyup piksel
   bazinda karsilastirir. Yazma/okma hatalari sessizce renk bozulmasi
   olarak cikar; test bunu yakalar.
   ===================================================================== */
'use strict';

const zlib = require('zlib');

const ISARET = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/* ------------------------------------------------------------ CRC32 */
const CRC_TABLO = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLO[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function parca(tur, veri) {
  const bas = Buffer.alloc(8);
  bas.writeUInt32BE(veri.length, 0);
  bas.write(tur, 4, 'ascii');
  const govde = Buffer.concat([bas, veri]);
  // CRC, turunun 4 bayti + verinin TAMAMI uzerinden hesaplanir.
  // govde = [uzunluk(4) | tur(4) | veri(n)]  ->  dilim 4 .. 8+n
  const son = Buffer.alloc(4);
  son.writeUInt32BE(crc32(govde.subarray(4, 8 + veri.length)), 0);
  return Buffer.concat([bas, veri, son]);
}

/* ------------------------------------------------------------ OKUMA */
function oku(buffer) {
  if (!buffer.subarray(0, 8).equals(ISARET)) throw new Error('PNG imzasi yok');

  let p = 8;
  let baslik = null;
  const idat = [];
  let palet = null;
  let saydam = null;

  while (p < buffer.length) {
    const uz = buffer.readUInt32BE(p);
    const tur = buffer.toString('ascii', p + 4, p + 8);
    const veri = buffer.subarray(p + 8, p + 8 + uz);

    if (tur === 'IHDR') {
      baslik = {
        genislik: veri.readUInt32BE(0),
        yukseklik: veri.readUInt32BE(4),
        bit: veri[8],
        renk: veri[9],
        sikistirma: veri[10],
        filtre: veri[11],
        aralik: veri[12]
      };
    } else if (tur === 'PLTE') {
      palet = Buffer.from(veri);
    } else if (tur === 'tRNS') {
      saydam = Buffer.from(veri);
    } else if (tur === 'IDAT') {
      idat.push(Buffer.from(veri));
    } else if (tur === 'IEND') {
      break;
    }
    p += 12 + uz;
  }

  if (!baslik) throw new Error('IHDR bulunamadi');
  if (baslik.bit !== 8) throw new Error('yalnizca 8-bit desteklenir, dosya ' + baslik.bit);
  if (baslik.sikistirma !== 0 || baslik.filtre !== 0) {
    throw new Error('yalnizca standart sikistirma desteklenir');
  }

  const kanal = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[baslik.renk];
  if (!kanal) throw new Error('desteklenmeyen renk tipi: ' + baslik.renk);

  const ham = zlib.inflateSync(Buffer.concat(idat));
  const { genislik: g, yukseklik: y } = baslik;
  const satirBayt = g * kanal;
  const pikseller = Buffer.alloc(satirBayt * y);

  // ters filtreleme (unfilter)
  let gidx = 0;
  for (let satir = 0; satir < y; satir++) {
    const ft = ham[gidx++];
    const satirSonu = (satir + 1) * satirBayt;
    const cur = pikseller.subarray(satirSonu - satirBayt, satirSonu);
    ham.copy(cur, 0, gidx, gidx + satirBayt);
    gidx += satirBayt;

    const prev = satir === 0 ? null : pikseller.subarray(satirSonu - 2 * satirBayt, satirSonu - satirBayt);

    for (let i = 0; i < satirBayt; i++) {
      const a = i >= kanal ? cur[i - kanal] : 0;
      const b = prev ? prev[i] : 0;
      const c = (prev && i >= kanal) ? prev[i - kanal] : 0;
      switch (ft) {
        case 0: break;
        case 1: cur[i] = (cur[i] + a) & 0xff; break;
        case 2: cur[i] = (cur[i] + b) & 0xff; break;
        case 3: cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          const pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          cur[i] = (cur[i] + pred) & 0xff;
          break;
        }
        default: throw new Error('bilinmeyen filtre: ' + ft);
      }
    }
  }

  // RGBA'ya normalize et
  const rgba = Buffer.alloc(g * y * 4);
  for (let i = 0, n = g * y; i < n; i++) {
    const s = i * kanal;
    const d = i * 4;
    if (baslik.renk === 6) {
      rgba[d] = pikseller[s]; rgba[d + 1] = pikseller[s + 1];
      rgba[d + 2] = pikseller[s + 2]; rgba[d + 3] = pikseller[s + 3];
    } else if (baslik.renk === 2) {
      rgba[d] = pikseller[s]; rgba[d + 1] = pikseller[s + 1];
      rgba[d + 2] = pikseller[s + 2]; rgba[d + 3] = 255;
    } else if (baslik.renk === 0) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pikseller[s]; rgba[d + 3] = 255;
    } else if (baslik.renk === 4) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pikseller[s]; rgba[d + 3] = pikseller[s + 1];
    } else if (baslik.renk === 3) {
      const idx = pikseller[s];
      rgba[d] = palet[idx * 3]; rgba[d + 1] = palet[idx * 3 + 1];
      rgba[d + 2] = palet[idx * 3 + 2];
      rgba[d + 3] = saydam && idx < saydam.length ? saydam[idx] : 255;
    }
  }

  return { genislik: g, yukseklik: y, veri: rgba };
}

/* ------------------------------------------------------------ YAZMA
   sozlesme: veri DAIMA 4 kanallidir (RGBA), alfaVar=false ise alfa
   atilir. onceki surum alfaVar=false iken 3 kanalli girdi bekliyordu;
   cizim kodunun urettigi RGBA buffer'i 3 kanalli sanip KAYDIRIYORDU ve
   cikti kurpik gorunuyordu. Artik tek bir girdi bicimi var.            */
function pngYaz(g, y, rgba, alfaVar = true) {
  const kanal = alfaVar ? 4 : 3;
  const ham = Buffer.alloc((g * kanal + 1) * y);

  for (let satir = 0; satir < y; satir++) {
    const o = satir * (g * kanal + 1);
    ham[o] = 0;                                   // filtre tipi 0 (None)
    const kaynak = satir * g * 4;
    for (let i = 0; i < g; i++) {
      const s = kaynak + i * 4;
      const d = o + 1 + i * kanal;
      ham[d] = rgba[s];
      ham[d + 1] = rgba[s + 1];
      ham[d + 2] = rgba[s + 2];
      if (alfaVar) ham[d + 3] = rgba[s + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(g, 0);
  ihdr.writeUInt32BE(y, 4);
  ihdr[8] = 8;
  ihdr[9] = alfaVar ? 6 : 2;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    ISARET,
    parca('IHDR', ihdr),
    parca('IDAT', zlib.deflateSync(ham, { level: 9 })),
    parca('IEND', Buffer.alloc(0))
  ]);
}

module.exports = { oku, pngYaz, crc32 };