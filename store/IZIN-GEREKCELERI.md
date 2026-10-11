# İzin Gerekçeleri

Chrome Web Mağazası → Gizlilik sekmesi → İzin gerekçesi alanlarına kopyalayın.

Her alan 1.000 karakter sınırındadır.

> **Uzak kod:** "Hayır, uzak kod iznini kullanmıyorum" seçin. Kaynak kod tamamen pakette yereldir (`tools/test-remote-code.js` bunu denetler).

---

## Ana makine izni gerekçesi

Eklentinin tüm kodu yalnızca YouTube sayfalarında çalışır.

Manifest’te istenen iki ana makine izni vardır:
• *.youtube.com — ana site
• *.youtube-nocookie.com — gizlilik geliştirilmiş gömülü videoların kullanıldığı alan adı

Bu izinler, YouTube reklam uçlarına uygulanan ağ engelleme kurallarının (declarativeNetRequest) çalışması için gereklidir. Kurallar yalnızca bu iki alan adından başlatılan istekleri hedefler.

Reklam sunucuları (doubleclick, googlesyndication, googlevideo vb.) için host izni istenmez. Ağ kuralları tarayıcı motorunda çalıştığı için bu adreslere erişim izni gerekmez; kurallar onları yine de durdurur. Bu adreslerin sayfaları okunmaz, içerikleri değiştirilmez, verileri işlenmez.

Geliştirici araçları (tanılama, element seçici) yalnızca kullanıcı açıkça istediğinde ve yalnızca aktif YouTube sekmesinde çalışır. Arka planda, zamanlanmış olarak veya önceden belirlenmiş bir site listesi üzerinden tarama yapılmaz.

---

## declarativeNetRequest gerekçesi

Reklam sunucularına giden istekleri tarayıcının ağ yığınından çıkmadan durdurur. Manifest V3’ün desteklediği ağ engelleme yöntemidir ve sayfa performansını etkilemez.

19 kural tanımlıdır (src/rules/network.json). Kapsam şunlardır: doubleclick.net, googlesyndication.com, googleadservices.com ve 2mdn.net alan adlarının tamamı; YouTube’un kendi reklam uçları (/pagead/, /ptracking, /api/stats/ads, /youtubei/v1/player/ad*, get_midroll_ads, ad_analytics, get_ads_info); adservice.google.com.

Hiçbir kural video akışını (googlevideo.com), oynatıcı betiklerini veya /youtubei/v1/player isteğini engellemez. Bu adresler "asla engellenmemeli" listesinde tutulur ve otomatik olarak denetlenir; liste ihlal edilirse yayın durdurulur.

Engellenen adresler reklam sunucularıdır; sayfa içerikleri okunmaz, hiçbir kullanıcı verisi işlenmez.

---

## storage gerekçesi

Yalnızca kullanıcının kendi ayarlarını ve sayaçlarını cihazda saklamak için kullanılır. Sunucuya hiçbir şey gönderilmez.

chrome.storage.local:
• Ayarlar (temizlik grupları açık mı, strateji seçimi)
• Element seçiciyle eklenen kalıcı kurallar
• Ayarlar sayfasındaki 14 günlük istatistik geçmişi

chrome.storage.session:
• Oturum sayaçları (engellenen reklam, engellenen istek)

Bu veriler yalnızca chrome.storage API’si ile cihazda kalır, hiçbir ağ isteği yapılmaz. Kullanıcı ayarlar sayfasından sayaçları ve geçmişi silebilir, eklentiyi kaldırınca tümü silinir.

---

## scripting gerekçesi

Yalnızca kullanıcı açıkça istediğinde ve yalnızca aktif YouTube sekmesinde çalışır. Sayfa yüklenirken otomatik olarak çalışmaz.

Tek kullanım: sağ tık menüsündeki "FD: Bu öğeyi engelle" seçeneği. Kullanıcı bir sayfa öğesine sağ tıkladığında seçici arayüzü (picker.js) ve CSS seçici üreticisi (selector-gen.js) o sekmeye enjekte edilir. Kullanıcı tıkladığı öğeye karşılık gelen kalıcı bir gizleme kuralı oluşturulur.

Ayrıca Tanılama aracı, kullanıcı açıkça "Tara" düğmesine basıldığında aktif sekmeyi okur.

Arka planda, zamanlanmış olarak veya başka sitelerde çalıştırılmaz.

---

## contextMenus gerekçesi

Sağ tık menüsüne tek bir kalem ekler: "FD: Bu öğeyi engelle".

Bu menü yalnızca YouTube sayfalarında görünür (*://*.youtube.com/* ve *://*.youtube-nocookie.com/*). Başka bir yerde görünmez ve başka siteye erişim sağlamaz.

Kullanıcı bir öğeye sağ tıklayıp bu kalemi seçtiğinde, seçilen öğe için kalıcı bir gizleme kuralı oluşturulur. Başka hiçbir içerik eklenmez.

---

