/* Kişisel yol sızıntısı denetimini KANITLA.
   Temiz proje gecmeli; sızıntı olunca HATA vermeli.

   NOT: Bu dosyada ornek yol DIZGILERI bulunmaz. Denetim tum
   .js dosyalarini taradigi icin, ornek dizgi burada dursaydi testin
   kendisi sizinti olarak gorunurdu. Iki kez oldu: once duz dizgi,
   sonra parca birlestirme olarak yazildi — denetim ikisini de
   dogru sekilde yakaliyor. Bu yuzden sizinti gecici bir fixture
   dosyasina yazilir ve test sonunda silinir. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const V = path.join(ROOT, 'tools', 'validate.js');

let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

function calistir() {
  const r = spawnSync('node', [V], { encoding: 'utf8' });
  return { kod: r.status, cikti: (r.stdout || '') + (r.stderr || '') };
}

// Sızıntıyı geçici bir dosyaya yaz, tarama bitince sil.
const FIXTURE = path.join(ROOT, 'tools', 'zz-gecici-sizinti.js');
function sizintiYaz(ipucu) {
  fs.writeFileSync(FIXTURE, ipucu);
}
function sizintiSil() {
  if (fs.existsSync(FIXTURE)) fs.unlinkSync(FIXTURE);
}

console.log('\n1) Temiz proje GECMELI');
{
  const r = calistir();
  check('cikis kodu 0', r.kod === 0,
    r.cikti.split('\n').filter((l) => /HATA/.test(l)).join(' | '));
  check('denetim calisti', /kişisel yol sızıntısı/.test(r.cikti));
  check('fixture yok', !fs.existsSync(FIXTURE));
}

console.log('\n2) Windows mutlak yolu YAKALANMALI');
{
  sizintiYaz('const R = "' + 'C:' + String.fromCharCode(92) +
    'Users' + String.fromCharCode(92) + 'ornek/x";\n');
  const r = calistir();
  check('cikis kodu 1', r.kod === 1);
  check('dosya adi mesajda', /zz-gecici-sizinti\.js/.test(r.cikti));
  check('satir numarasi verildi', /zz-gecici-sizinti\.js:\d+/.test(r.cikti));
  check('__dirname onerisi verildi', /__dirname/.test(r.cikti));
  sizintiSil();
}

console.log('\n3) Linux yolu da YAKALANMALI');
{
  sizintiYaz('const R = "/' + 'home/' + 'ornek/klasor";\n');
  const r = calistir();
  check('/home/... yolu yakalandi', r.kod === 1 && /kişisel/.test(r.cikti));
  sizintiSil();
}

console.log('\n4) Parca birlestirme gizlemesi de YAKALANMALI');
{
  // Denetim kaynak metnini tarar; parca birlestirme kaçamaz.
  sizintiYaz('const R = "C:' + '/Users' + '/ornek";\n');
  const r = calistir();
  check('parca birlestirilmis yol yakalandi', r.kod === 1);
  sizintiSil();
}

console.log('\n5) GERI KONULDU');
{
  const r = calistir();
  check('cikis kodu 0', r.kod === 0);
  check('fixture silindi', !fs.existsSync(FIXTURE));
}

console.log('\n6) Tum test dosyalari goreli yol kullaniyor mu?');
{
  const testler = fs.readdirSync(path.join(ROOT, 'tools'))
    .filter((f) => f.startsWith('test-'));
  testler.forEach((f) => {
    const s = fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8');
    const mutlak = /[A-Za-z]:\\Users\\|[A-Za-z]:\/Users\//i.test(s);
    check(f + ' mutlak yol içermiyor', !mutlak);
  });
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);