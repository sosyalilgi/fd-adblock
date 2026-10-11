# Chrome Web Mağazası Yayın Dosyaları

Bu klasör mağaza gönderiminde doldurulacak metinleri içerir.
Mağaza formundaki alan adlarıyla buradaki başlıklar birebir eşleşecek
şekilde yazıldı.

Yayınlarken `<...>` içindeki yer tutucuları kendi bilgilerinle değiştir.

---

## 0. Yayın öncesi kontrol

Aşağıdaki adresler **yayınlanmadan önce açılıp çalıştırılmalı**. Mağaza
formu gizlilik politikası ve destek adresini zorunlu ister; ikisi de
404 dönerse gönderim reddedilir.

| Adres | Beklenen |
|---|---|
| `https://sosyalilgi.github.io/fd-adblock/` | İndeks açılır |
| `https://sosyalilgi.github.io/fd-adblock/privacy.html` | Gizlilik politikası açılır |
| `https://sosyalilgi.github.io/fd-adblock/support.html` | Destek sayfası açılır |

> Bu adresler **https://** ve **gerçek** olmalı. Yerel dosya yolu
> (`file:///…`) kabul edilmez; Chrome mağazası erişemez.

---

## 1. Yayıcı hesabı (Developer Dashboard → Hesap ayarları)

| Alan | Değer |
|---|---|
| Yayıcı adı | `Ferhat Doğan` |
| İletişim e-postası | `ferhatdogan55@gmail.com` |
| Web sitesi | `https://266hosting.com` |
| Gizlilik politikası URL'si | `https://sosyalilgi.github.io/fd-adblock/privacy.html` |
| Destek URL'si | `https://sosyalilgi.github.io/fd-adblock/support.html` |
| Kaynak kodu | `https://github.com/sosyalilgi/fd-adblock` |

> Not: Ekip üyesi eklemek ücretsizdir ve $5 ücreti gerektirmez
> (Nisan 2026 duyurusu).

> Bu iki adres `docs/` klasöründen GitHub Pages ile yayınlanır.
> Kaynak dosyalar `web/` içindedir; `node tools/publish-pages.js`
> `docs/` kopyasını üretir.

---

## 2. Tek amaç (Single purpose) alanı

**EN:**
```
Removes advertisements from YouTube.
```

**TR:**
```
YouTube'daki reklamları kaldırır.
```

> Bu alan **mümkün olduğunca dar** yazılmalı. Tanılama aracı, istatistik
> grafiği, element seçici ve kozmetik temizlik ayrı "özellik" olarak
> sunulmamalı — hepsi bu tek amacın parçası olarak anlatılmalı.

---

## 3. Kısa açıklama (maks 132 karakter)

**EN (127 karakter):**
```
Blocks ads on YouTube and cleans up the page. Includes a built-in tool that shows which blocking layer is working.
```

**TR:**
```
YouTube reklamlarını engeller, sayfayı temizler. Hangi engelleme katmanının çalıştığını gösteren tanılama aracı içerir.
```

---

## 4. Kategori ve dil

| Alan | Değer |
|---|---|
| Kategori | Productivity / Utilities |
| Dil | English (primary), Türkçe |

---

## 5. Uzun açıklama

Aşağıda İngilizce ve Türkçe uzun açıklamalar hazır. `store/listing-long-en.md`
ve `store/listing-long-tr.md` dosyalarına da yazıldı.

---

## 6. İzin gerekçeleri

İnceleme ekibi her izni ayrı ayrı sorar. Aşağıdaki metinler
`İzinler` sekmesindeki "amaç" alanlarına yazılmalı.

### `declarativeNetRequest`
```
Blocks requests to advertising infrastructure before they leave the browser.
This is the network-blocking API supported by Manifest V3.
```

### `storage`
```
Stores the user's settings and ad-blocking counters. All data stays on the
user's device (chrome.storage.local / chrome.storage.session) and is never
transmitted anywhere.
```

### `scripting`
```
Used only in response to explicit user action: the "Block this element"
context-menu picker, and the Diagnostics tool that reports which blocking
layer is active on the user's current YouTube tab.
```

### `contextMenus`
```
Adds a single right-click entry, "Block this element", so the user can hide
any leftover element permanently.
```

### `world: "MAIN"` (script injection context)
```
The player response that carries ad placements must be filtered before the
page's own JavaScript reads it. That is only possible in the page's own
execution context. This is the same technique used by uBlock Origin and
AdGuard.
```

### Host permissions — `*.youtube.com`, `*.youtube-nocookie.com`
```
The single site this extension acts on.
```

### Host permissions — `*.doubleclick.net`, `*.googlesyndication.com`, `*.googleadservices.com`, `*.2mdn.net`
```
Google's advertising infrastructure. Requests to these hosts are blocked
before they are sent.
```

### Host permissions — `*.googlevideo.com`
```
YouTube's video CDN. Needed to block server-side-inserted ad segments that
are requested from the same host as the actual video.
```

---

## 7. Gizlilik uygulamaları (Privacy practices sekmesi)

Bu bölüm hazır doldurulacak:

| Soru | Cevap |
|---|---|
| Kullanıcı verisi topluyor musunuz? | **Hayır** |
| Verileriniz üçüncü taraflara satılıyor mu? | Hayır |
| Veriler ürünün temel işlevi dışında kullanılıyor mu? | Hayır |
| Kredi değerlendirmesi için kullanılıyor mu? | Hayır |

> Eklenti hiçbir ağ isteğini kendi sunucusuna yapmaz. Tüm analiz
> kullanıcının cihazında çalışır.

---

## 8. İçerik derecelendirmesi (Content rating)

- Kategori: `Productivity` veya `Utilities`
- Kullanıcı etkileşimi: Sınırlı / `People` değil
- İçerik uyarısı: Yok
- Yaş sınırı: Herkese açık

---

## 9. Görsel gereksinimler

| Varlık | Ölçü | Not |
|---|---|---|
| Mağaza ikonu | 128×128 PNG | ✅ `icons/icon128.png` |
| Ekran görüntüsü 1 | 1280×800 veya 640×400 | Popup açıkken tam pencere |
| Ekran görüntüsü 2 | aynı | Ayarlar sayfası — temizlik seçenekleri |
| Ekran görüntüsü 3 | aynı | Tanılama — "hangi katman çalışıyor" |

**Nasıl alınır:** İlgili sayfayı aç → `F11` (tam ekran) → ekran görüntüsü aracıyla
1280×800'e kırp → `store/screenshots/` klasörüne kaydet.

---

## 10. Yayın öncesi kontrol listesi

- [ ] `node tools/validate.js` → 0 hata
- [ ] `node tools/package.js` ile zip üretildi
- [ ] Zip içinde `_metadata` klasörü **yok**
- [ ] İki adımlı doğrulama kuruldu
- [ ] Gizlilik + destek sayfaları GitHub Pages'te yayımlandı
- [ ] Tüm zorunlu URL'ler girildi
- [ ] Gizlilik uygulamaları "toplanmıyor" olarak dolduruldu
- [ ] İzin gerekçeleri yapıştırıldı
- [ ] Tek amaç alanı dar yazıldı

---

## 11. İlk çalıştırma sırasında kontrol edilecekler

1. Eklenti yüklendikten sonra YouTube aç → Ayarlar → **Algılama karşıtı kapalı**
   olduğunu doğrula (mağaza sürümü için varsayılan kapalı)
2. Tanılama sayfasını aç → tüm katmanlar yeşil mi
3. Ağ katmanı testini çalıştır → "6 kural doğrulandı" beklenir
