/* =====================================================================
   GitHub Pages icin yayin hazirligi
   ---------------------------------------------------------------------
   Depo adi  <kullanici>/fd-adblock  oldugu icin Pages adresi:
       https://sosyalilgi.github.io/fd-adblock/

   GitHub, bir proje deposundan Pages yayinlamayi iki sekilde kabul eder:
     a) dalin kokunden  ->   /  altindaki dosyalar
     b) /docs klasorunden ->  docs/ altindaki dosyalar

   Bu betik (b) yolunu kullanir: kaynak web/ klasoru degismez, yayin
   kopyasi docs/ altina uretilir. Boylece web/ hem depo icinde okunur
   hem de Pages'e ayri bir dal ayari gerekmez.

   Kullanim:  node tools/publish-pages.js
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const KAYNAK = path.join(KOK, 'web');
const HEDEF = path.join(KOK, 'docs');

if (!fs.existsSync(KAYNAK)) {
  console.error('web/ klasoru yok. Ne yayinlayacagimizi bilmiyorum.');
  process.exit(1);
}

fs.rmSync(HEDEF, { recursive: true, force: true });
fs.mkdirSync(HEDEF, { recursive: true });

let n = 0;
for (const ad of fs.readdirSync(KAYNAK)) {
  if (!ad.toLowerCase().endsWith('.html')) continue;
  fs.copyFileSync(path.join(KAYNAK, ad), path.join(HEDEF, ad));
  n++;
}

// ---- KOK'a indeks.html koy: Pages "/fd-adblock/" adresine gelince
//      varsayilan 404 yerine baglantilar gorunsun.
//
//      Dil notu: privacy.html ve support.html Ingilizce (magaza listesi
//     Ingilizce oldugu icin). Indeks de ayni dilde olmali; karisik
//      sayfalar tutarsiz gorunuyor.
const linkler = ['privacy.html', 'support.html']
  .filter((f) => fs.existsSync(path.join(HEDEF, f)))
  .map((f) => '      <li><a href="' + f + '">' + (f === 'privacy.html'
    ? 'Privacy Policy' : 'Support') + '</a></li>')
  .join('\n');

const index = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FD Reklam Engelleyici</title>
<meta name="description" content="Privacy policy and support for FD Reklam Engelleyici.">
<style>
  body {
    margin:0; padding:64px 20px;
    font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:#f8fafc; color:#0f172a;
  }
  @media (prefers-color-scheme: dark) {
    body { background:#0b1220; color:#e2e8f0; }
  }
  .wrap { max-width:640px; margin:0 auto; }
  h1 { margin:0 0 6px; font-size:26px; letter-spacing:-.02em; }
  .meta { margin:0 0 28px; color:#64748b; font-size:14px; }
  ul { list-style:none; padding:0; margin:0; }
  li { margin-bottom:10px; }
  a {
    display:block; padding:14px 18px; text-decoration:none;
    border:1px solid rgba(127,127,127,.3); border-radius:12px;
    color:inherit;
  }
  a:hover { border-color:#16a34a; }
  a b { display:block; margin-bottom:2px; }
  a span { color:#64748b; font-size:14px; }
  footer {
    margin-top:40px; padding-top:16px;
    border-top:1px solid rgba(127,127,127,.3);
    color:#64748b; font-size:13.5px; text-align:center;
  }
  footer a { display:inline; padding:0; border:0; color:#16a34a; }
</style>
</head>
<body>
<div class="wrap">

<h1>FD Reklam Engelleyici</h1>
<p class="meta">Chrome, Edge ve Brave icin YouTube reklam engelleyici</p>

<ul>
${linkler}
</ul>

<footer>
  <p>&copy; 2026 Ferhat Do&#287;an. All rights reserved.</p>
  <p>
    <a href="https://266hosting.com">266hosting</a> &middot;
    <a href="mailto:ferhatdogan55@gmail.com">ferhatdogan55@gmail.com</a>
  </p>
</footer>

</div>
</body>
</html>
`;

fs.writeFileSync(path.join(HEDEF, 'index.html'), index, 'utf8');

console.log('docs/ olusturuldu:');
fs.readdirSync(HEDEF).forEach((f) => console.log('  ' + f));
console.log('\n' + (n + 1) + ' dosya. Simdi git add docs/ && git commit');