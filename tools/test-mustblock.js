/* Ters denetimi (must-block) KANITLA.
   Once eski dar kural geri konur — denetim yakalamali.
   Temiz projede sessiz gecmeli. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const V = ROOT + '/tools/validate.js';
const NF = ROOT + '/src/rules/network.json';

let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

function calistir() {
  const r = spawnSync('node', [V], { encoding: 'utf8' });
  return { kod: r.status, cikti: (r.stdout || '') + (r.stderr || '') };
}

const orijinal = fs.readFileSync(NF, 'utf8');

console.log('\n1) DUZELTILMIS proje GECMELI');
{
  const r = calistir();
  check('cikis kodu 0', r.kod === 0,
    r.cikti.split('\n').filter((l) => /HATA/.test(l)).join(' | '));
  check('16 zorunlu adresin hepsi engelleniyor',
    /16 zorunlu adresin hepsi engelleniyor/.test(r.cikti));
  check('gürültü uyarısı kalmadı',
    (r.cikti.match(/dar kural olabilir/g) || []).length === 0);
}

console.log('\n2) DAR KURAL geri konulunca YAKALANMALI (ctier sınıfı hata)');
{
  // #8'i eski haline getir: yalnizca /pagead/
  const bozuk = orijinal.replace(
    '"regexFilter": "^https?://([a-z0-9-]+\\\\.)?googlesyndication\\\\.com/"',
    '"regexFilter": "^https?://[^/]*\\\\.googlesyndication\\\\.com/pagead/"'
  );
  check('test girdisi degistirdi', bozuk !== orijinal);
  fs.writeFileSync(NF, bozuk, 'utf8');

  const r = calistir();
  check('cikis kodu 1', r.kod === 1);
  check('KACIYOR mesaji var', /KACIYOR/.test(r.cikti));
  check('ddm aktivite yakalandi', /ddm aktivite/.test(r.cikti));
  check('activeview yakalandi', /activeview/.test(r.cikti));
  check('sodar yakalandi', /sodar/.test(r.cikti));
  check('genişlik uyarısı da verdi', /kapsamıyor|kapsamiyor/.test(r.cikti));
}

console.log('\n3) GERI KONULDU');
{
  fs.writeFileSync(NF, orijinal, 'utf8');
  const r = calistir();
  check('cikis kodu 0', r.kod === 0);
  check('dosya orijinal halinde', fs.readFileSync(NF, 'utf8') === orijinal);
}

console.log('\n4) Kural tamamen silinirse de YAKALMALI');
{
  const sil = orijinal.replace(/\{\s*"id": 8,[\s\S]*?\n  \},\n/, '');
  check('kural 8 silindi', sil !== orijinal && sil.indexOf('"id": 8') === -1);
  fs.writeFileSync(NF, sil, 'utf8');
  const r = calistir();
  check('cikis kodu 1', r.kod === 1);
  check('KACIYOR mesaji var', /KACIYOR/.test(r.cikti));
  fs.writeFileSync(NF, orijinal, 'utf8');
}

console.log('\n5) A/B testi cok YOL deniyor mu?');
{
  const d = fs.readFileSync(ROOT + '/src/diag/diag.js', 'utf8');
  const blok = d.slice(d.indexOf('NET_TEST_URLS'), d.indexOf('];', d.indexOf('NET_TEST_URLS')));
  const gs = (blok.match(/googlesyndication\.com/g) || []).length;
  check('googlesyndication icin birden fazla ADRES (>=3): ' + gs, gs >= 3);
  check('/pagead/ yolu DIŞINDA adresler de var',
    /activeview_ext/.test(blok) && /ddm\/activity_ext/.test(blok) && /sodar/.test(blok));
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);