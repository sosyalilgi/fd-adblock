# Teknik Detaylar

Bu dosya, eklentinin **nasıl çalıştığını** anlatan referans dokümanıdır.
Günlük kullanım ve kurulum için [README.md](README.md) yeterlidir.

Sürüm: 1.20.0 · Manifest V3 · Chrome 111+

---

## 1. Mimari: üç bağımsız katman

Eklenti tek bir yöntem kullanmaz. Her katman farklı bir reklam türünü hedefler
ve **birbirinin yerine geçmez** — biri çalışmaz diğerleri devrede kalır.

```
        YouTube sayfası
              │
    ┌─────────┴─────────┐
    │                   │
  AĞ KATMANI        VERİ KATMANI
  (tarayıcı motoru)  (sayfa, okunmadan önce)
    │                   │
    └─────────┬─────────┘
              │
        OYNATICI YEDEĞİ
     (sızanları son çare temizler)
```

### Katman 1 — Ağ (`src/rules/network.json`)

19 adet `declarativeNetRequest` kuralı. Reklam sunucularına giden istekleri
**tarayıcının kendi ağ yığınından çıkmadan** durdurur.

| Kural | Hedef |
|---|---|
| #1, #20 | `/pagead/`, `adservice.google.com` |
| #2, #3, #4 | `/api/stats/ads`, `ad_break`, `/youtubei/v1/ads/` |
| #5, #6, #15, #18 | `get_midroll_ads`, `ad_placement`, `get_ad_break`, `get_ads_info` |
| #7, #9 | `doubleclick.net`, `googleads.g.doubleclick.net` |
| #8 | `googlesyndication.com` (tüm alan adı) |
| #10, #12 | `/ptracking`, `/youtubei/v1/log?` |
| #13, #14 | `googleadservices.com`, `2mdn.net` |
| #16, #17, #19 | `/youtubei/v1/player/ad`, `/ad_analytics`, `/_/ad/` |

`declarativeNetRequest` ağ yığınından **önce** çalışır. Bu yüzden
`chrome.webRequest.onErrorOccurred` engellemeleri raporlamaz — denendi, boş
döndü. Bu yüzden `webRequest` izni istenmez; işe yaramayan bir izin bırakmıyoruz.

### Katman 2 — Veri budama (`src/content/json-prune.js`, `net-hook.js`)

YouTube reklamları ağdan **yanıtın içinde** gelir. Bu katman yanıtı sayfa
okunmadan önce düzenler:

- `JSON.parse` tuzağı (`json-prune.js`) — `adPlacements`, `playerAds`,
  `adSlots` ve reklam renderer öğeleri silinir
- `fetch` / `XMLHttpRequest` kancaları (`net-hook.js`) — yanıt gövdesi yeniden
  serileştirilir, `/player` isteğine `isInlinePlaybackNoAd` sinyali eklenir

İki strateji kullanılabilir:

- **Alanları sil** (varsayılan) — en verimli, en az veri bırakır
- **Alanları boşalt** — alan yerinde kalır ama boş diziye çevrilir; tespit
  ihtimalini azaltır, ancak bazı oynatıcı sürümlerinde oynatmayı bozabilir

### Katman 3 — Oynatıcı yedeği (`src/content/player.js`, `player-detect.js`)

Sızan reklamlar için son savunma. Amaç, reklamı kullanıcıya **göstermemek**:

1. `"Atla"` düğmesi varsa tıkla
2. Yoksa videoyu sonuna sar (`currentTime = duration - 0.05`) — reklam ~1 karede biter
3. Sarma çalışmazsa sessize al + 16x

Tespit için **YouTube'un kendi `ad-showing` bayrağı** kullanılır:

```js
'#movie_player.ad-showing',          // ← birincil sinyal
'.html5-video-player.ad-showing',
'.video-ads',                        // eski oynatıcı sürümleri için yedek
```

> Bu sıralama önemlidir. Modern YouTube reklamları gömülü bir web component
> içinde render eder; `.video-ads` gibi eski seçiciler sayfada **hiç bulunmaz**.
> Güvenilir tek sinyal, oynatıcı kabına YouTube'un kendi eklediği sınıftır.

`player-detect.js` saf bir modüldür (DOM'a dokunmaz) — bu sayede tarayıcı
olmadan test edilir ve `player.js` gerçek dosyayı `require()` eder.

---

## 2. Dünya (world) ayrımı

Chrome MV3'te content script'ler iki ayrı bağlamda çalışır:

| Dünya | Hangi dosyalar | Neden |
|---|---|---|
| `MAIN` | `json-prune.js`, `net-hook.js`, `anti-detect.js` | YouTube'un kendi JS'iyle **aynı** bağlamda olmalı; aksi halde `JSON.parse` tuzağı onun parse'ını göremez |
| `ISOLATED` | `prefs.js`, `cosmetic.js`, `player*.js`, `main.js` | `chrome.storage` ve diğer eklenti API'lerine erişim gerekir |

**Sonuç:** `MAIN` dünyasındaki dosyalar `chrome.storage`'a erişemez. Bu
yüzden durum aktarımı `<html>` etiketi üzerinden yapılır — DOM iki dünya
arasında paylaşılır, `FDI` nesnesi paylaşılmaz.

---

## 3. Ağ katmanı nasıl ölçülüyor?

İki kademe ölçüm kullanılır. Biri **sezgisel**, diğeri **kesin kanıt**.

### Kademe 1 — Blok imzası (sezgisel)

`performance.getEntriesByType('resource')` kayıtlarında:

```
transferSize == 0  AND  status == 0  AND  süre < 150 ms
```

DNR ağa hiç çıkmadığı için istek 1–3 ms'de çöker. Gerçek ağ hatası
(DNS/TLS) genelde 100 ms üstündür. Ekstra izin gerektirmez.

> Bu **kanıt değil, işarettir.** Yanlış pozitif mümkündür; bu yüzden tek başına
> kanıt sayılmaz.

### Kademe 2 — A/B testi (kesin kanıt)

Aynı adreslere kurallar **açıkken** ve **kapalıyken** istek atılır. Yalnızca
*açıkken geçemiyor, kapalıyken geçiyor* olan adresler kanıt sayılır.

**Kontrol adresi:** `robots.txt` her iki turda da geçmelidir. Geçmezse sonuç
tamamen geçersiz sayılır ve raporlanmaz.

### Neden her kural için birden fazla adres?

Bu, projede iki kez hataya yol açtı:

1. `googlesyndication` kuralı yalnızca `/pagead/` yolunu kapatıyordu;
   `/ddm/activity_ext` ve `/activeview_ext` **sızıyordu**. A/B testi
   "6 kural kanıtlandı" dedi çünkü kural başına **tek** adres deniyordu ve
   o adres `/pagead/` yolundaydı.
2. `ctier` kuralı normal video isteğini `ctier=SH` parametresi nedeniyle
   engelliyordu — oynatma tamamen durdu.

Bu yüzden test artık her kural için **farklı yollardan birden fazla** adres
deniyor. Yola kısıtlı bir kural, kendi satırlarından birinde kırılır.

---

## 4. İki yönlü kural koruması

Sessiz hataların en tehlikeli türü, **bir şeyin çalıştığını sanmak** ve
tersinin olduğunu fark etmemektir. Bu yüzden iki ayrı koruma listesi vardır:

| Dosya | Yön | Korur |
|---|---|---|
| `src/rules/never-block.json` | ↘ | **Yanlışlıkla engellenmemeli** — video akışı, `/player`, `reel_watch_sequence`, oynatıcı betikleri |
| `src/rules/must-block.json` | ↗ | **Yanlışlıkla geçmemeli** — `googlesyndication`, `doubleclick`, `/ptracking`, `/api/stats/ads` |

`tools/validate.js` her iki listeyi de her kurala karşı sınar:

- `never-block`'ta bir adres engelleniyorsa → **HATA**
- `must-block`'ta bir adres kaçıyorsa → **HATA**

Ayrıca **alan adı genişliği** denetimi vardır: bir alan adı tamamen reklam
sunucusuysa (googlesyndication gibi), kural onun *tüm* yollarını kapsamalıdır.

> Bu denetim yalnızca tamamen reklam sunucularına uygulanır. `youtube.com`
> gibi host'larda reklam uçları `/pagead/` gibi **yol kurallarıyla** engellenir;
> tüm host kapatılırsa video da gider.

### Yinelenen JSON anahtarları

JSON.parse yinelenen anahtarlarda hata vermez — sonuncusu sessizce kazanır.
Proje genelinde geçerli olması için `validate.js` bunu da tarar.

---

## 5. Dosya haritası

```
manifest.json               MV3 bildirimi (4 API izni, 5 host izni)

src/background.js           sayaçlar, rozet, sağ tık menüsü, geçmiş
src/privacy.html            çevrimdışı gizlilik politikası

src/popup/                  aç/kapa anahtarı + sayaçlar
src/options/                7 temizlik grubu + 14 günlük grafik
src/diag/                   tanılama arayüzü (A/B testi, net-verdict.js)

src/content/
  json-prune.js     [MAIN]  JSON.parse tuzağı
  net-hook.js       [MAIN]  fetch / XHR kancaları
  anti-detect.js    [MAIN]  algılama karşıtı (varsayılan KAPALI)
  prefs.js          [İZOLE] ayarlar
  cosmetic.js       [İZOLE] kozmetik motor
  player-detect.js  [saf]   oynatıcı tespiti (test edilebilir)
  player.js         [İZOLE] oynatıcı yedeği
  main.js           [İZOLE] orkestrasyon
  selector-gen.js   [saf]   CSS seçici üretimi
  picker.js         [İZOLE] sağ tık element seçici

src/rules/
  network.json              19 DNR kuralı
  never-block.json          asla engellenmemeli
  must-block.json           asla geçmemeli
  cosmetic.css              7 gruplandırılmış gizleme seçicisi
```

---

## 6. Geliştirici araçları

```bash
node tools/validate.js          # kurallar, politika/manifest uyumu, kapsam
node tools/package.js           # dağıtım zip'i
node tools/check-screenshots.js # mağaza görsellerini yüklemeden önce doğrular
node tools/make-store-images.js # 440x280 + 1400x560 görselleri üretir
node tools/publish-pages.js     # web/ -> docs/ (GitHub Pages)
```

### Testler

```bash
node tools/test-*.js            # her dosya kendi sonucunu yazar
```

Testler "temiz girdide geçer" mantığıyla yetinmez — **bozuk girdiyi de
denetleyecek yakaladıklarını kanıtlar.** Örnek: `test-mustblock.js` dar
kuralı geri koyup doğrulayıcının yakaladığını gösterir.

Harici bağımlılık yoktur (zlib dışında). Görsel üretimi bile Node'un yerleşik
`zlib`'i ve 5×7 bitmap font ile yapılır (`tools/png.js`, `tools/font5x7.js`).

---

## 7. Algılama karşıtı

`src/content/anti-detect.js` — **varsayılan olarak KAPALI.**

YouTube "reklam engelleyici bulundu" penceresi gösterirse bu dosya pencereyi
bastırmayı dener. Kapalıyken **hiçbir hook kurmaz**; sayfaya dokunmaz.

İki nedenle kapalı:

1. **Şeffaflık** — kullanıcı tam olarak neyin çalıştığını bilmeli
2. **Mağaza incelemesi** — yaptığı işi gizleyen kod, reklam engellemeden
   ayrı bir davranış olarak değerlendirilebilir

> Ayarı değiştirdikten sonra **sayfayı yeniden yüklemek gerekir.** Kurulmuş
> bir JS hook'unu geri sökmek güvenilir değildir; bu yüzden geri alma yoktur.

Pratik gözlem: `googletag` yüklenmiyor (`YOK`) ama dört rapor boyunca
`adBlockPopup`, `enforcementViewModel` ve `premiumSatis` **hep false** kaldı —
tespit tetiklenmedi.

---

## 8. Bilinen sınırlar

**Sunucu tarafı reklam ekleme (SSAI).** YouTube bazı reklamları doğrudan
video akışına gömer — URL'de reklam göstergesi yoktur. Hiçbir eklenti bunları
engelleyemez.

**Gömülü video.** `youtube.com/embed/ID` sekmesi olarak açıldığında çalışır.
Bir blogun içindeki `<iframe>` ile gömüldüğünde **çalışmaz**: eklenti yalnızca
YouTube kökenlerinde izinli. Bu bilinçli bir sınır; tüm siteler için izin
isteseydik mağaza onayı da zorlaşırdı.

**Bakım.** YouTube iç sınıf adlarını ve JSON şemasını sık değiştirir. Reklam
sızmaya başlarsa önce Tanılama sayfasına bakın.

**Sürüm tutarlılığı.** `manifest.json` sürümü dağıtımın tek kaynağıdır.