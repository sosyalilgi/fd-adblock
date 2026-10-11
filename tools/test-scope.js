/* content script kapsam kontrolunu KANITLA.
   Oyle bir dosya ekleyip manifest'e YAZMADAN dogrulamayi dener.
   Yakalamazsa kontrol ise yoktur. */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = 'C:/Users/ferha/Downloads/opencode-windows-x64/fd-adblock';
const V = ROOT + '/tools/validate.js';
let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

function calistir() {
  const r = spawnSync('node', [V], { encoding: 'utf8' });
  return { kod: r.status, cikti: (r.stdout || '') + (r.stderr || '') };
}

console.log('\n1) Temiz proje GECMELI');
{
  const r = calistir();
  check('cikis kodu 0', r.kod === 0,
    r.cikti.split('\n').filter((l) => /HATA/.test(l)).join(' | '));
}

console.log('\n2) Baglanmamis dosya YAKALANMALI');
{
  const yeni = path.join(ROOT, 'src', 'content', 'test-yeni-dosya.js');
  fs.writeFileSync(yeni, '(function(){})();\n');
  const r = calistir();
  check('cikis kodu 1', r.kod === 1);
  check('dosya adi mesajda geciyor', /test-yeni-dosya\.js/.test(r.cikti));
  check('mesaj "çalışmayacak" diyor', /çalışmayacak|çalışmaz/.test(r.cikti));
  fs.unlinkSync(yeni);
}

console.log('\n3) Manifestte olmayan dosya bildirilirse YAKALANMALI');
{
  const mf = path.join(ROOT, 'manifest.json');
  const orij = fs.readFileSync(mf, 'utf8');
  fs.writeFileSync(mf, orij.replace(
    '"src/content/prefs.js",',
    '"src/content/prefs.js",\n        "src/content/olmayan.js",'
  ), 'utf8');
  const r = calistir();
  check('cikis kodu 1', r.kod === 1);
  check('dosya adi mesajda geciyor', /olmayan\.js/.test(r.cikti));
  fs.writeFileSync(mf, orij, 'utf8');
}

console.log('\n4) Disa aktarim kaybolursa YAKALANMALI');
{
  const p = path.join(ROOT, 'src', 'content', 'player-detect.js');
  const orij = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, orij.replace(/module\.exports.*\n/g, ''), 'utf8');
  const r = calistir();
  check('cikis kodu 1', r.kod === 1);
  check('mesaj disa aktarimi soyluyor', /dışa aktarım|disa aktarim/i.test(r.cikti));
  fs.writeFileSync(p, orij, 'utf8');
}

console.log('\n5) GERI KONULDU, temiz durum');
{
  const r = calistir();
  check('cikis kodu 0', r.kod === 0,
    r.cikti.split('\n').filter((l) => /HATA/.test(l)).join(' | '));
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);