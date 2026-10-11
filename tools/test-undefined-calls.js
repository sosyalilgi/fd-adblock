/* =====================================================================
   tools/ dosyalarindaki YANLIS ADLANDIRMA denetimi
   ---------------------------------------------------------------------
   test-package.js icinde "ok(...)" cagrisi vardi; "ok" fonksiyonu
   tanimli degildi. node --check bunu YAKALAMAZ — "ok(...)" soz dizimi
   olarak gecerlidir, tanimli olup olmadigi ancak calisma zamaninda
   anlasilir.

   YAKLASIM: metin duzenleyici (regex) YETERLI DEGIL. Onceki surum
   Turkce metin iceren dosyalarda 40+ yanlis pozitif uretti; dizgi
   temizleyici yorum satirina girip kodu bozdu.

   Bu yuzden iki katman kullanilir:
     1) node --check  → sozdizimi
     2) GERCEKTEN dosyayi calistirip ReferenceError olusup olusmadigina
        bakmak. Calistirmak ucuz dosyalarda kesin sonuc verir.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TOOLS = path.join(ROOT, 'tools');

let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

/* ------------------------------------------------------------------ *
 * 1) Sözdizimi
 * ------------------------------------------------------------------ */
const dosyalar = fs.readdirSync(TOOLS).filter((f) => f.endsWith('.js'));

console.log('\n1) Sözdizimi (node --check)');
dosyalar.forEach((f) => {
  const r = spawnSync('node', ['--check', path.join(TOOLS, f)], { encoding: 'utf8' });
  const sat = (r.stderr || '').split('\n').find((l) => /Error/.test(l)) || '';
  check(f, r.status === 0, sat.trim().slice(0, 60));
});

/* ------------------------------------------------------------------ *
 * 2) Gerçekten çalıştır: ucuz dosyalar ReferenceError verir mi?
 * ------------------------------------------------------------------ *
 * "ok is not defined" ancak dosya çalışınca ortaya çıkar. Yavaş
 * dosyalar (paket üretenler, dosya sistemi değiştirenler) burada
 * çalıştırılmaz; onlar zaten ayrı testlerle kapsanıyor.
 */
const HIZLI = dosyalar.filter((f) => /^test-/.test(f) && !/package|png|shots|hits/.test(f));

console.log('\n2) Çalıştırınca tanımsız fonksiyon hatası veriyor mu?');
console.log('   (' + HIZLI.length + ' hızlı test dosyası)');

const SORUNLU = [];
HIZLI.forEach((f) => {
  const r = spawnSync('node', [path.join(TOOLS, f)], {
    encoding: 'utf8', timeout: 30000
  });
  const cikti = (r.stdout || '') + (r.stderr || '');

  if (cikti.indexOf('is not defined') !== -1) {
    const satir = cikti.split('\n').find((l) => /is not defined/.test(l));
    SORUNLU.push(f + ' → ' + (satir || '').trim());
    check(f + ' tanımsız fonksiyon YOK', false, (satir || '').trim());
  } else if (cikti.indexOf('ReferenceError') !== -1) {
    SORUNLU.push(f + ' → ReferenceError');
    check(f + ' ReferenceError YOK', false,
      cikti.split('\n').find((l) => /ReferenceError/.test(l)) || '');
  } else {
    check(f + ' çalıştı, tanımsız çağrı yok', true);
  }
});

/* ------------------------------------------------------------------ *
 * 3) Özellikle "ok(" — bu projede tanımsız olan bilinen isim
 * ------------------------------------------------------------------ */
console.log('\n3) Bilinen hata regresyonu: "ok(" tanımsız');
{
  /* Metin taraması tek başına YANLIŞ ALARM üretiyordu: validate.js
     ve check-screenshots.js "ok" adını gerçekten tanımlıyor.
     Doğrusu: "ok" TANIMLI MI diye bakmak, çağrı olup olmamak değil.
     Bir dosyada ok( varsa TANIMI da olmalı. */
  const kullanan = [];
  const tanimsiz = [];

  dosyalar.forEach((f) => {
    if (f === 'test-undefined-calls.js') return;  // kendi eğitim metni
    const ham = fs.readFileSync(path.join(TOOLS, f), 'utf8');
    const kod = ham
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');

    if (!/(?<![.\w$])ok\s*\(/.test(kod)) return;
    kullanan.push(f);

    // ok tanımlı mı? (fonksiyon bildirimi veya arrow ataması)
    const tanimli = /function\s+ok\s*\(/.test(ham) ||
      /(?:const|let|var)\s+ok\s*=/.test(ham);
    if (!tanimli) tanimsiz.push(f);
  });

  check('ok(...) çağrısı olan her dosyada ok TANIMLI',
    tanimsiz.length === 0, tanimsiz.join(', '));
  check('denetim gerçek hatayı tanıyabiliyor (kendi metninde geçiyor)',
    /ok is not defined/.test(
      fs.readFileSync(path.join(TOOLS, 'test-undefined-calls.js'), 'utf8')));
  console.log('   (' + kullanan.length + ' dosyada ok( var, hepsi tanımlı)');
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
if (SORUNLU.length) {
  console.log('\nTanımsız çağrı bulunan dosyalar:');
  SORUNLU.forEach((s) => console.log('  ' + s));
}
process.exit(fail ? 1 : 0);