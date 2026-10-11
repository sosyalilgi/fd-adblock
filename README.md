# FD Reklam Engelleyici

**Geliştirici:** Ferhat Doğan · **E-posta:** [ferhatdogan55@gmail.com](mailto:ferhatdogan55@gmail.com) · **Web:** [266hosting.com](https://266hosting.com) · © 2026 Tüm hakları saklıdır.

YouTube reklamlarını engelleyen, sayfayı kozmetik olarak temizleyen Manifest V3
tarayıcı eklentisi. Chrome, Edge ve Brave ile çalışır. Sürüm 1.13.0.

> Sürüm satırı `manifest.json` ile eşleşmelidir.

## Kurulum

1. Tarayıcıda `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`) adresini aç.
2. **Geliştirici modu** anahtarını aç (sağ üstte).
3. **Paketi çözülmemiş olarak yükle** butonuna tıkla.
4. Bu klasörü seç: `fd-adblock`

> Değişiklik yaptıktan sonra eklenti sayfasındaki **yenile** (⟳) ikonuna bas,
> ardından YouTube sekmesini **Ctrl+Shift+R** ile yeniden yükle — content script'ler
> açık sekmelerde kendiliğinden güncellenmez.

## Kullanım

| Ne | Nerede |
|---|---|
| Aç / kapa | Araç çubuğu ikonu (veya `Alt+Shift+Y`) |
| Engellenen reklam / istek sayısı | Popup ve ayar sayfası |
| Temizlik seçenekleri | Ayarlar → *Kozmetik temizlik* |
| Bir öğeyi kalıcı gizle | YouTube'da **sağ tık → FD: Bu öğeyi engelle** |
| Sorun giderme | Popup veya ayarlar → *Tanılama* |

## Nasıl çalışır

| Katman | Dosya | Ne yapar |
|---|---|---|
| Ağ | `src/rules/network.json` | 20 `declarativeNetRequest` kuralı. Reklam sunucularına giden istekleri tarayıcı motoru seviyesinde durdurur — sayfa yavaşlamaz. |
| Veri budama | `src/content/json-prune.js` | `JSON.parse` tuzağı. Oynatıcı veriyi okumadan **önce** `adPlacements`, `playerAds`, `adSlots` ve reklam renderer'ları yanıttan silinir. |
| Ağ gövdesi | `src/content/net-hook.js` | `fetch`/XHR yanıtlarını budar, `/player` isteğine `isInlinePlaybackNoAd` sinyali enjekte eder. |
| Algılama karşıtı | `src/content/anti-detect.js` | `toString` maskeleme, `yt.config_` temizliği, **googletag sahtelemesi**. |
| Kozmetik | `src/rules/cosmetic.css` | 7 grup; her biri ayarlar sayfasından tek tek kapatılabilir. |
| Oynatıcı | `src/content/player.js` | Sızan reklamların "Atla" düğmesine tıklar, atlanamayanları 16x hızlandırır. |
| Element seçici | `src/content/selector-gen.js` + `picker.js` | CSS seçici üretir ve kalıcı kurala çevirir. |
| Tanılama | `src/diag/` | Aktif sekmeyi canlı tarar, hangi katmanın çalıştığını raporlar. |

`json-prune.js`, `net-hook.js` ve `anti-detect.js` **ana dünyada** (`world: "MAIN"`)
çalışır — çünkü YouTube'un kendi JavaScript'iyle aynı bağlamda olmalılar.
Dosyaların geri kalanı izole dünyada çalışır ve `chrome.storage` erişimi sağlar.

## Tespit karşıtı stratejisi

YouTube, gerçek bir tarayıcıda oynatıcı yanıtında `adPlacements` alanının
**daima bulunduğunu** bekler. Alanın tamamen kaybolması "cevap kurcalandı"
sinyali verebilir. Ayarlar sayfasından iki yaklaşım arasında geçiş yapılabilir:

- **Alanları sil** (varsayılan) — en verimli, en az veri bırakır.
- **Alanları boşalt** — alan yerinde kalır ama boş diziye çevrilir; tespit
  ihtimalini azaltır, ancak bazı oynatıcı sürümlerinde oynatmayı bozabilir.

Hangisinin sizin hesabınızda daha iyi çalıştığını **Tanılama** sayfası söyler.

## Ağ katmanı nasıl ölçülür?

`declarativeNetRequest`, ağ yığınından **önce** çalışır. Bu yüzden
`chrome.webRequest.onErrorOccurred` engellemeleri **raporlamaz** (denendi,
boş döndü) ve bu yüzden kullanılmaz — işe yaramayan bir izin bırakmıyoruz.

Ölçüm iki katmanlıdır:

1. **Blok imzası (sezgisel)** — `performance` kaydında `transferSize 0` +
   `status 0` + süre < 150 ms. DNR ağa hiç çıkmadığı için istek 1-3 ms'de
   çöker; gerçek ağ hatası (DNS/TLS) genelde 100 ms üstündür. Popup'taki
   "Ağdan engellendi" sayacı budur. Ekstra izin gerektirmez.
2. **A/B testi (kesin kanıt)** — Tanılama sayfası aynı adreslere kurallar
   açıkken ve kapalıyken istek atar. Yalnızca *açıkken geçemiyor, kapalıyken
   geçiyor* olan adresler kanıt sayılır. `robots.txt` kontrol adresi
   engellenirse sonuç geçersiz sayılır.

## Geliştirici araçları

```bash
node tools/validate.js     # network.json'ı DNR şemasına göre doğrular
node tools/package.js      # dağıtım zip'ini üretir
```

`network.json`'a elle kural eklerken önce `validate.js` çalıştırın — id
çakışması, geçersiz regex ve "asla eşleşmeyen" koşulları yakalar.

## Bilinen sınırlar

- **Sunucu tarafı reklam ekleme (SSAI):** YouTube bazı reklamları doğrudan video
  akışına gömer. Hiçbir eklenti bunları engelleyemez.
- **Bakım:** YouTube sık sık iç sınıf adlarını ve JSON şemasını değiştirir. Bir
  reklam sızmaya başlarsa önce Tanılama sayfasına bakın, sonra
  `src/rules/cosmetic.css` içindeki seçicileri güncelleyin.
- **Oturum sayaçları** `chrome.storage.session` içindedir, tarayıcı kapanınca
  sıfırlanır. Kalıcı trend için ayar sayfasındaki *Son 14 gün* grafiğini kullanın.
- **Chrome 111+** gerekir (`world: "MAIN"` için).

## Algılama karşıtı seçeneği

YouTube, eklenti varlığını fark ederse "reklam engelleyici bulundu" penceresi
gösterebilir. `src/content/anti-detect.js` bu pencereyi bastırmaya çalışır.

**Varsayılan olarak KAPALIDIR** ve Ayarlar'dan açılır. Kapalıyken bu dosya
hiçbir hook kurmaz — sayfaya hiç dokunmaz.

İki nedenle kapalı:

1. **Şeffaflık.** Kullanıcı tam olarak neyin çalıştığını bilmeli.
2. **Mağaza incelemesi.** Yaptığı işi gizleyen kod, reklam engellemeden ayrı
   bir davranış olarak değerlendirilebilir. Kapalıyken ortada hiç yoktur.

> Ayarı değiştirdikten sonra **sayfayı yeniden yüklemeniz gerekir.** Kurulmuş
> bir JS hook'unu geri sökmek güvenilir değildir; bu yüzden geri alma yok.

## Chrome Web Mağazası

Yayınlamak için hazırlanmış dosyalar:

| Klasör | İçerik |
|---|---|
| `store/STORE-SUBMISSION.md` | Mağaza formunun tüm alanları, izin gerekçeleri, kontrol listesi |
| `store/listing-long-en.md` | Uzun açıklama (İngilizce) |
| `store/listing-long-tr.md` | Uzun açıklama (Türkçe) |
| `web/privacy.html` | GitHub Pages için gizlilik politikası |
| `web/support.html` | GitHub Pages için destek sayfası |

Eklentinin içinde de `src/privacy.html` var — çevrimdışı da çalışır.

> Chrome Web Mağazası reklam **engelleyen** eklentileri kabul eder; yasak olan
> reklam **sıkan** eklentilerdir.

## Klasör yapısı

```
fd-adblock/
├── manifest.json
├── icons/                  16 / 32 / 48 / 128 px PNG
├── tools/
│   ├── validate.js         DNR kural doğrulayıcı
│   └── package.js          zip paketleyici
└── src/
    ├── background.js       sayaçlar, rozet, sağ tık menüsü, geçmiş
    ├── popup/              aç/kapa + sayaçlar
    ├── options/            temizlik seçenekleri + 14 günlük grafik
    ├── diag/               tanılama sayfası
    ├── content/
    │   ├── json-prune.js   [ANA DÜNYA] JSON.parse tuzağı
    │   ├── net-hook.js     [ANA DÜNYA] fetch/XHR
    │   ├── anti-detect.js  [ANA DÜNYA] algılama karşıtı
    │   ├── selector-gen.js [saf] CSS seçici üretimi
    │   ├── picker.js       [İZOLE] element seçici arayüzü
    │   ├── prefs.js        [İZOLE] ayarlar
    │   ├── cosmetic.js     [İZOLE] kozmetik motor
    │   ├── player.js       [İZOLE] oynatıcı yedek ağı
    │   └── main.js         [İZOLE] orkestrasyon
    └── rules/
        ├── network.json    DNR ağ kuralları
        └── cosmetic.css    gruplandırılmış gizleme seçicileri
```
