/* =====================================================================
   Surum tutarliligi denetimi
   ---------------------------------------------------------------------
   README'de surum elle yaziliyordu ve manifest'ten geride kaldi
   (once "1.1.0" yaziyordu, manifest 1.13'tu). Elle tutulan her sayi
   zamanla yanlis kalir.

   Burada: manifest TEK kaynak. README'deki surum ve rozetler
   manifest'ten alinir. Bir yerde surum degistiginde digeri de
   degismis olur.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const KOK = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

const m = JSON.parse(fs.readFileSync(path.join(KOK, 'manifest.json'), 'utf8'));
const surum = m.version;
const oku = (p) => fs.existsSync(p) ? fs.readFileSync(path.join(KOK, p), 'utf8') : null;

console.log('\n1) Manifest geçerli bir sürüm mü?');
check('manifest_version 3', m.manifest_version === 3, String(m.manifest_version));
check('sürüm "x.y.z" biçiminde', /^\d+\.\d+\.\d+$/.test(surum), surum);

console.log('\n2) README sürümü manifest ile aynı mı?');
{
  const r = oku('README.md');
  check('README.md var', r !== null);
  if (r) {
    // rozet: badge/s%C3%BCr%C3%BCm-1.20.0
    const rozetler = r.match(/badge\/s%C3%BCr%C3%BCm-([\d.]+)/g) || [];
    check('sürüm rozeti var (' + rozetler.length + ')', rozetler.length > 0);
    rozetler.forEach((rb) => {
      const v = rb.match(/([\d]+\.[\d]+\.[\d]+)$/)[1];
      check('rozetteki sürüm manifest ile aynı: ' + v, v === surum);
    });

    // metin içinde geçen açık sürüm ifadesi
    const metinler = r.match(/Sürüm \d+\.\d+\.\d+/g) || [];
    metinler.forEach((t) => {
      const v = t.replace('Sürüm ', '');
      check('metindeki sürüm doğru: ' + t, v === surum);
    });
  }
}

console.log('\n3) TEKNIK-DETAY.md sürümü güncel mi?');
{
  const t = oku('TEKNIK-DETAY.md');
  check('TEKNIK-DETAY.md var', t !== null);
  if (t) {
    const v = (t.match(/Sürüm:\s*([\d.]+)/) || [])[1];
    check('sürüm manifest ile aynı: ' + v, v === surum);
  }
}

console.log('\n4) README -> TEKNIK-DETAY bağlantısı');
{
  const r = oku('README.md');
  check('README teknik dosyaya bağlanıyor', /TEKNIK-DETAY\.md/.test(r));
}

console.log('\n5) Lisans iddiası gerçekten karşılanmış mı?');
{
  const r = oku('README.md');
  const l = oku('LICENSE');
  if (/MIT/.test(r)) {
    check('README MIT diyor -> LICENSE dosyasi VAR', l !== null);
    if (l) {
      check('LICENSE içeriği MIT', /MIT License/.test(l));
      check('telif sahibi doğru', /Ferhat Do/.test(l));
      check('telif yili doğru', /2026/.test(l));
    }
  } else {
    check('README lisans belirtmiyor (LICENSE yoksa tutarlı)', true);
  }
}

console.log('\n6) Yayınlanan sayfalar (docs/) güncel mi?');
{
  const r = spawnSync('node', [path.join(KOK, 'tools', 'publish-pages.js')], {
    cwd: KOK, encoding: 'utf8'
  });
  check('publish-pages.js calisti', r.status === 0, r.stderr);
  const diff = spawnSync('git', ['diff', '--quiet', '--', 'docs/'], {
    cwd: KOK, encoding: 'utf8'
  });
  check('docs/ web/ ile senkron (yeniden uretilmedi)', diff.status === 0,
    'docs/ degisti — publish-pages.js calistir ve commit et');
}

console.log('\n7) Paket sürümü zip adıyla uyuşuyor mu?');
{
  /* Bu kontrol YERELDE anlamlı ama CI'da gecersizdir:
     zip dosyasi .gitignore'dadir, depoda bulunmaz. GitHub Actions
     depoyu klonlar, zip orada yoktur — kontrol her zaman basarisiz
     olur ve tum CI'yi kirmiziya boyardi.

     Bu yuzden: paketin varligi ancak yerelde zorunlu, depoda
     degil. Varsa adi tutarli olmali; yoksa dokunulmaz. */
  const zipAd = path.join(path.dirname(KOK), 'fd-adblock-' + surum + '.zip');
  const varMi = fs.existsSync(zipAd);

  if (varMi) {
    check('paket adi surumle uyusuyor: fd-adblock-' + surum + '.zip', true);
  } else if (process.env.CI) {
    // CI: paket depoda tutulmaz (build sonrasi üretilir). Sessiz geç,
    // ama gerekçeyi yaz ki "noksan" gibi görünmesin.
    check("CI ortami: paket .gitignore'da, burada beklenmiyor", true);
  } else {
    check('paket bulunamadı — önce `node tools/package.js` çalıştır',
      false, zipAd);
  }
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);