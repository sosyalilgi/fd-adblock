/* =====================================================================
   Bozuk kaynak dosyasi paketlemeyi DURDURMALI
   ---------------------------------------------------------------------
   2026-10-11'de player-detect.js'in module.exports satiri bozuldu
   ve paketlemci onu oldugu gibi pakete koydu. Bozuk dosya ancak
   require eden bir test oldugunda fark edildi; hic require edilmeyen
   bir bozuk dosya sessizce yayina gider.

   Bu test, bozuk bir kaynak ekleyip paketlemeyi DENEDIGINI
   gosterir: paketlenmemeli.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PAKET = path.join(__dirname, 'package.js');

let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

const ZIP = path.join(path.dirname(ROOT), 'fd-adblock-' +
  JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version + '.zip');

const ZIPLER = fs.existsSync(path.dirname(ROOT))
  ? fs.readdirSync(path.dirname(ROOT)).filter((f) => /^fd-adblock-.*\.zip$/.test(f))
  : [];

function paketle() {
  const r = spawnSync(process.execPath, [PAKET], { encoding: 'utf8' });
  return { kod: r.status, cikti: (r.stdout || '') + (r.stderr || '') };
}

console.log('\n1) Temiz projede paketleme ÇALIŞMALI');
{
  const r = paketle();
  check('çıkış kodu 0', r.kod === 0,
    r.cikti.split('\n').filter((l) => /HATA/.test(l)).join(' | '));
  check('sözdizimi denetimi çalıştı',
    /yinelenen ad yok/.test(r.cikti));
  check('paket üretildi', fs.existsSync(ZIP));
}

console.log('\n2) Bozuk kaynak eklendiğinde paketleme DURMALI');
{
  const HEDEF = path.join(ROOT, 'src', 'content', 'player-detect.js');
  const orij = fs.readFileSync(HEDEF, 'utf8');
  // dışa aktarım satırını boz (2026-10-11'de olan tam olarak bu)
  const bozuk = orij.replace(
    /if \(typeof module[^\n]*\n/,
    "if (typeof module !== 'undefined' &&   kok.FDPlayerDetect = API;\n"
  );
  check('test girdisi değişti', bozuk !== orij);

  fs.writeFileSync(HEDEF, bozuk, 'utf8');
  const r = paketle();

  check('çıkış kodu 1', r.kod === 1, 'kod=' + r.kod);
  check('"bozuk sozdizimi" mesajı', /bozuk sozdizimi/.test(r.cikti));
  check('bozuk dosya adı geçiyor', /player-detect/.test(r.cikti));
  check('paket KENDISI bozuldu mu', r.cikti.indexOf('hata') !== -1 ||
    /yüklemeden|bu paket/i.test(r.cikti));

  fs.writeFileSync(HEDEF, orij, 'utf8');
}

console.log('\n3) GERİ konuldu, paketleme çalışıyor mu?');
{
  const r = paketle();
  check('çıkış kodu 0', r.kod === 0,
    r.cikti.split('\n').filter((l) => /HATA/.test(l)).join(' | '));
}

console.log('\n4) Temiz klon benzetimi (CI koşulu)');
{
  const tmp = path.join(require('os').tmpdir(), 'fd-clon-' + process.pid);
  fs.rmSync(tmp, { recursive: true, force: true });
  const cp = spawnSync('git', ['clone', '-q',
    'https://github.com/sosyalilgi/fd-adblock.git', tmp], { encoding: 'utf8' });
  if (cp.status !== 0) {
    check('klon yapılabildi', false, cp.stderr);
  } else {
    const r = spawnSync(process.execPath, [path.join(tmp, 'tools', 'test-package.js')],
      { encoding: 'utf8', cwd: tmp });
    check('temiz klonda paket testi geçiyor', r.status === 0,
      ((r.stdout || '') + (r.stderr || '')).split('\n')
        .filter((l) => /HATA/.test(l)).join(' | '));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);