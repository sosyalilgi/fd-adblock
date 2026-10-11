/* =====================================================================
   FD Reklam Engelleyici — paketleyici
   Kullanım:  node tools/package.js
   src/ ve manifest.json dışındaki her şeyi (README, tools) zip'e koymaz.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const NAME = 'fd-adblock';
const OUT_DIR = path.join(ROOT, '..');
const OUT = path.join(OUT_DIR, NAME + '-' + readVersion() + '.zip');

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
}

// _metadata: Chrome'un yukleme sirasinda kendi urettigi klasor,
// surum guncellemesinde degisir ve kaynak dosya degildir.
// store/ ve web/ yalnizca magaza gonderimi icindir; eklentiye gerekmez.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'tools', '__pycache__', '_metadata', 'store', 'web'
]);
const SKIP_FILES = new Set(['README.md']);

function walk(dir, base, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, rel, acc);
    } else {
      if (SKIP_FILES.has(entry.name)) continue;
      acc.push(rel);
    }
  }
  return acc;
}

const files = walk(ROOT, '', []);

console.log('paketlenen dosyalar (' + files.length + '):');
files.sort().forEach((f) => console.log('  ' + f));

if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

try {
  execFileSync(
    'powershell',
    ['-NoProfile', '-Command',
      `Compress-Archive -Path @(${files.map((f) => `'${path.join(ROOT, f)}'`).join(',')}) ` +
      `-DestinationPath '${OUT}' -Force`],
    { stdio: 'inherit' }
  );
} catch (e) {
  console.error('\nPaketleme başarısız: ' + e.message);
  process.exit(1);
}

const size = fs.statSync(OUT).size;
console.log('\nOK -> ' + OUT + '  (' + (size / 1024).toFixed(1) + ' KB)');
console.log('Kurulum: chrome://extensions -> Geliştirici modu -> Paketi çözülmemiş olarak yükle');
console.log('Not: zip yüklenmez; içindeki klasörü açıp onu seçmelisin.');
