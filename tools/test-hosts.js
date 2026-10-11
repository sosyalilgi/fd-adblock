/* Host izni denetimini KANITLA.
   Geri eklenen gereksiz izin YAKALANMALI — hem tek başına,
   hem de gizlilik politikasıyla çeliştiği için. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MF = path.join(ROOT, 'manifest.json');
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

const orij = fs.readFileSync(MF, 'utf8');

console.log('\n1) DUZELTILMIS proje GECMELI');
{
  const r = calistir();
  check('cikis kodu 0', r.kod === 0,
    r.cikti.split('\n').filter((l) => /HATA/.test(l)).join(' | '));
  check('denetim calisti', /host izinleri/.test(r.cikti));
}

console.log('\n2) Gereksiz host izni geri eklenirse YAKALANMALI');
{
  const bozuk = orij.replace(
    '"*://*.youtube-nocookie.com/*"\n  ],',
    '"*://*.youtube-nocookie.com/*",\n    "*://*.googlevideo.com/*"\n  ],'
  );
  check('test girdisi degistirdi', bozuk !== orij);
  fs.writeFileSync(MF, bozuk, 'utf8');

  const r = calistir();
  check('cikis kodu 1', r.kod === 1);
  check('"gereksiz host izni" mesaji', /gereksiz host izni/.test(r.cikti));
  check('alan adi mesajda', /googlevideo/.test(r.cikti));
  check('politika celiskisi de yakalandi',
    /izin istemiyoruz.*manifest|manifest istiyor/.test(r.cikti));

  fs.writeFileSync(MF, orij, 'utf8');
}

console.log('\n3) Geri konuldu, temiz durum');
{
  const r = calistir();
  check('cikis kodu 0', r.kod === 0);
  check('dosya orijinal halinde', fs.readFileSync(MF, 'utf8') === orij);
}

console.log('\n4) Manifest gercekten 2 host izni iceriyor mu?');
{
  const m = JSON.parse(fs.readFileSync(MF, 'utf8'));
  check('host_permissions 2 tane', (m.host_permissions || []).length === 2,
    (m.host_permissions || []).join(', '));
  check('YouTube ikisi de var',
    m.host_permissions.some((h) => h.indexOf('youtube.com') !== -1) &&
    m.host_permissions.some((h) => h.indexOf('youtube-nocookie.com') !== -1));
  const ads = ['doubleclick', 'googlesyndication', 'googlevideo', 'googleadservices', '2mdn'];
  ads.forEach((a) => {
    check(a + ' host izni YOK',
      !m.host_permissions.some((h) => h.indexOf(a) !== -1));
  });
}

console.log('\n5) Icerik scriptleri yine calisacak mi?');
{
  const m = JSON.parse(fs.readFileSync(MF, 'utf8'));
  // content script'ler yalnızca youtube/nocookie'i hedeflemeli —
  // kaldırılan izinler bunlardan biri olsaydı kod calismazdi
  (m.content_scripts || []).forEach((cs, i) => {
    cs.matches.forEach((p) => {
      check('cs[' + i + '] kalıcı izin: ' + p,
        m.host_permissions.some((h) => h.indexOf(
          p.replace(/^\*:\/\/\*\./, '').replace(/\/\*$/, '')) !== -1) ||
        p.indexOf('youtube') !== -1);
    });
  });
}

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);