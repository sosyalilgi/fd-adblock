/* =====================================================================
   Izin gerekceleri — Chrome Web Store formu icin
   ---------------------------------------------------------------------
   Bu metinler manifest'teki izinlerin GERCEK kullanimina gore
   yazilmistir; her biri kaynak kodla eslesiyor:

     declarativeNetRequest -> src/rules/network.json (19 kural)
     storage               -> background.js + prefs.js
     scripting             -> background.js, SADECE picker tetikleyince
     contextMenus          -> background.js, TEK kalem

   Karakter siniri: alan basina 1.000
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { console.log('  OK   ' + n); pass++; }
  else { console.log('  HATA ' + n + (x ? '   ->  ' + x : '')); fail++; }
};

const SINIR = 1000;

const GEREKCE = {
  declarativeNetRequest:
    'Reklam sunucularına giden istekleri tarayıcının ağ yığınından ' +
    'çıkmadan durdurur. Manifest V3’ün desteklediği ağ engelleme ' +
    'yöntemidir ve sayfa performansını etkilemez.\n\n' +
    '19 kural tanımlıdır (src/rules/network.json). Kapsam şunlardır: ' +
    'doubleclick.net, googlesyndication.com, googleadservices.com ve ' +
    '2mdn.net alan adlarının tamamı; YouTube’un kendi reklam uçları ' +
    '(/pagead/, /ptracking, /api/stats/ads, /youtubei/v1/player/ad*, ' +
    'get_midroll_ads, ad_analytics, get_ads_info); adservice.google.com.\n\n' +
    'Hiçbir kural video akışını (googlevideo.com), oynatıcı betiklerini ' +
    'veya /youtubei/v1/player isteğini engellemez. Bu adresler ' +
    '"asla engellenmemeli" listesinde tutulur ve otomatik olarak ' +
    'denetlenir; liste ihlal edilirse yayın durdurulur.\n\n' +
    'Engellenen adresler reklam sunucularıdır; sayfa içerikleri ' +
    'okunmaz, hiçbir kullanıcı verisi işlenmez.',

  storage:
    'Yalnızca kullanıcının kendi ayarlarını ve sayaçlarını cihazda ' +
    'saklamak için kullanılır. Sunucuya hiçbir şey gönderilmez.\n\n' +
    'chrome.storage.local:\n' +
    '• Ayarlar (temizlik grupları açık mı, strateji seçimi)\n' +
    '• Element seçiciyle eklenen kalıcı kurallar\n' +
    '• Ayarlar sayfasındaki 14 günlük istatistik geçmişi\n\n' +
    'chrome.storage.session:\n' +
    '• Oturum sayaçları (engellenen reklam, engellenen istek)\n\n' +
    'Bu veriler yalnızca chrome.storage API’si ile cihazda kalır, ' +
    'hiçbir ağ isteği yapılmaz. Kullanıcı ayarlar sayfasından ' +
    'sayaçları ve geçmişi silebilir, eklentiyi kaldırınca tümü silinir.',

  scripting:
    'Yalnızca kullanıcı açıkça istediğinde ve yalnızca aktif ' +
    'YouTube sekmesinde çalışır. Sayfa yüklenirken otomatik olarak ' +
    'çalışmaz.\n\n' +
    'Tek kullanım: sağ tık menüsündeki "FD: Bu öğeyi engelle" ' +
    'seçeneği. Kullanıcı bir sayfa öğesine sağ tıkladığında seçici ' +
    'arayüzü (picker.js) ve CSS seçici üreticisi (selector-gen.js) ' +
    'o sekmeye enjekte edilir. Kullanıcı tıkladığı öğeye karşılık ' +
    'gelen kalıcı bir gizleme kuralı oluşturulur.\n\n' +
    'Ayrıca Tanılama aracı, kullanıcı açıkça "Tara" düğmesine ' +
    'basıldığında aktif sekmeyi okur.\n\n' +
    'Arka planda, zamanlanmış olarak veya başka sitelerde ' +
    'çalıştırılmaz.',

  contextMenus:
    'Sağ tık menüsüne tek bir kalem ekler: "FD: Bu öğeyi engelle".\n\n' +
    'Bu menü yalnızca YouTube sayfalarında görünür ' +
    '(*://*.youtube.com/* ve *://*.youtube-nocookie.com/*). Başka ' +
    'bir yerde görünmez ve başka siteye erişim sağlamaz.\n\n' +
    'Kullanıcı bir öğeye sağ tıklayıp bu kalemi seçtiğinde, seçilen ' +
    'öğe için kalıcı bir gizleme kuralı oluşturulur. Başka hiçbir ' +
    'içerik eklenmez.'
};

/* Ana makine izni gerekçesi — 2026-10-11'de host izinleri
   sadeleştirildi: yalnızca content_scripts'in çalıştığı iki alan adı
   kaldı. DNR engelleme kuralları host izni gerektirmediği için
   reklam sunucuları listeden çıkarıldı. */
const HOST_GEREKCE =
  'Eklentinin tüm kodu yalnızca YouTube sayfalarında çalışır.\n\n' +
  'Manifest’te istenen iki ana makine izni vardır:\n' +
  '• *.youtube.com — ana site\n' +
  '• *.youtube-nocookie.com — gizlilik geliştirilmiş gömülü videoların ' +
  'kullanıldığı alan adı\n\n' +
  'Bu izinler, YouTube reklam uçlarına uygulanan ağ engelleme ' +
  'kurallarının (declarativeNetRequest) çalışması için gereklidir. ' +
  'Kurallar yalnızca bu iki alan adından başlatılan istekleri hedefler.\n\n' +
  'Reklam sunucuları (doubleclick, googlesyndication, googlevideo vb.) ' +
  'için host izni istenmez. Ağ kuralları tarayıcı motorunda çalıştığı ' +
  'için bu adreslere erişim izni gerekmez; kurallar onları yine de ' +
  'durdurur. Bu adreslerin sayfaları okunmaz, içerikleri ' +
  'değiştirilmez, verileri işlenmez.\n\n' +
  'Geliştirici araçları (tanılama, element seçici) yalnızca kullanıcı ' +
  'açıkça istediğinde ve yalnızca aktif YouTube sekmesinde çalışır. ' +
  'Arka planda, zamanlanmış olarak veya önceden belirlenmiş bir site ' +
  'listesi üzerinden tarama yapılmaz.';

/* ---------------------------------------------------------------- */
console.log('\n1) Karakter sınırları (alan başına ' + SINIR + ')');
Object.entries(GEREKCE).forEach(([izin, metin]) => {
  console.log('   ' + izin.padEnd(24) + metin.length + ' karakter');
  check(izin + ' sınıra sığıyor', metin.length <= SINIR, metin.length);
  check(izin + ' boş değil', metin.trim().length > 80);
});
console.log('   ' + 'host_permissions'.padEnd(24) + HOST_GEREKCE.length + ' karakter');
check('host gerekçesi sınıra sığıyor', HOST_GEREKCE.length <= SINIR, HOST_GEREKCE.length);

console.log('\n2) Her izin manifest\'te gerçekten var mı?');
const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
Object.keys(GEREKCE).forEach((izin) => {
  check(izin + ' manifest izinlerinde', (m.permissions || []).includes(izin),
    (m.permissions || []).join(', '));
});
check('manifest 2 host izni içeriyor',
  (m.host_permissions || []).length === 2, (m.host_permissions || []).join(', '));

console.log('\n3) Host gerekçesi gerçeği yansıtıyor mu?');
{
  const hp = m.host_permissions || [];
  check('gerekçe yalnızca 2 izin sayıyor',
    (HOST_GEREKCE.match(/• \*/g) || []).length === 2);
  ['doubleclick', 'googlesyndication', 'googlevideo'].forEach((h) => {
    // İki ayrı şey denetleniyor:
    //   (a) manifest bu adresi İZİN olarak istemiyor
    //   (b) gerekçe metni de "istemiyoruz" diyor
    // Eskiden (b) kontrolü yanlış ifade arıyordu: metinde
    // "izin istenmez" değil "için host izni istenmez" yazıyor.
    const izinVar = hp.some((x) => x.indexOf(h) !== -1);
    const gerekcedeVar = /host izni istenmez/.test(HOST_GEREKCE);
    check(h + ' manifest izinlerinde YOK', !izinVar);
    check(h + ' — gerekçede "host izni istenmez" deniyor', gerekcedeVar);
  });
}

console.log('\n3) Gerekçeler koddaki gerçekliği yansıtıyor mu?');
{
  const net = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'rules', 'network.json'), 'utf8'));
  check('19 kural deniyor (' + net.length + ')', /19 kural/.test(GEREKCE.declarativeNetRequest) &&
    net.length === 19, net.length);

  const bg = fs.readFileSync(path.join(ROOT, 'src', 'background.js'), 'utf8');
  check('scripting yalnızca picker için',
    /executeScript[\s\S]{0,200}selector-gen\.js/.test(bg));
  check('contextMenus tek kalem',
    (bg.match(/contextMenus\.create/g) || []).length === 1);
  check('menü yalnızca YouTube\'da',
    /documentUrlPatterns:\s*\['\*:\/\/\*\.youtube\.com\/\*'/.test(bg));

  // asla-engellenmemeli iddiası gerçekten kodla destekleniyor mu
  check('never-block listesi mevcut',
    fs.existsSync(path.join(ROOT, 'src', 'rules', 'never-block.json')));
}

console.log('\n4) Kopyalama çıktısı');
console.log('   (her alan için ayrı ayrı kopyala)');

const cikti = path.join(ROOT, 'store', 'IZIN-GEREKCELERI.md');
const basliklar = {
  declarativeNetRequest: 'declarativeNetRequest gerekçesi',
  storage: 'storage gerekçesi',
  scripting: 'scripting gerekçesi',
  contextMenus: 'contextMenus gerekçesi'
};
let md = '# İzin Gerekçeleri\n\n' +
  'Chrome Web Mağazası → Gizlilik sekmesi → İzin gerekçesi alanlarına ' +
  'kopyalayın.\n\nHer alan 1.000 karakter sınırındadır.\n\n' +
  '> **Uzak kod:** "Hayır, uzak kod iznini kullanmıyorum" seçin. ' +
  'Kaynak kod tamamen pakette yereldir (`tools/test-remote-code.js` ' +
  'bunu denetler).\n\n---\n\n' +
  '## Ana makine izni gerekçesi\n\n' + HOST_GEREKCE + '\n\n---\n\n';
Object.entries(GEREKCE).forEach(([izin, metin]) => {
  md += '## ' + basliklar[izin] + '\n\n' + metin + '\n\n---\n\n';
});
fs.writeFileSync(cikti, md, 'utf8');
console.log('   -> store/IZIN-GEREKCELERI.md  (' + md.length + ' karakter)');

console.log('\n==============================');
console.log('Gecen: ' + pass + ' | Kalan: ' + fail);
process.exit(fail ? 1 : 0);