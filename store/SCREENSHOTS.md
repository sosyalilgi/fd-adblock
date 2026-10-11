# Ekran görüntüleri — 1280×800

Mağaza **en az 1, en fazla 5** ekran görüntüsü ister. Boyut: **1280×800**
veya **640×400**. Alfa kanalı olmayacak (PNG `no alpha` veya JPEG).

Bu görüntüler **senin tarayıcında** yakalanmalı — eklentinin gerçek
arayüzünü göstermeleri gerekir. Sahte/temsili görüntü kabul edilmez.

---

## Yakalama öncesi hazırlık

```
1. chrome://extensions → FD Reklam Engelleyici → ⟳ (yenile)
2. YouTube sekmesini Ctrl+Shift+R ile yenile
3. Pencere boyutunu tam 1280x800 yap
```

Pencere boyutu: Chrome'u ekranın ortasında aç, sonra
`Win + ←` ile ekranın yarısına yasla. Ekranın yarısı 1280 genişlikteyse
doğru yerdesin. Değilse pencereyi sürükleyerek ayarla.

**Yakalama aracı:** `Win + Shift + S` → aracın üstünde kutu çıkacak,
sekmeyi seç. Kaydetilen PNG 1280×800 olmalı — sonra boyutu kontrol et
(mağaza reddedebilir).

> Alternatif: Chrome'da `Take and resize browser screenshots` eklentisi
> tam 1280×800 verir. Kurulum gerektirir, gerekirse kullan.

---

## Hangi 5 görüntü (önerilen sıra)

### 1. Tanılama — ağ katmanı kanıtı ⭐ *en önemlisi*

Bu tek görüntü eklentinin ne yaptığını kanıtlar. Mağaza inceleyicisi ve
kullanıcı bunu ilk görür.

```
Popup → Tanılama → YouTube sekmesini seç → Tara
"Testi çalıştır" → birkaç saniye bekle
Sonuç: "6 kural kanıtlandı, 0 belirsiz"
```

Görüntüde görünmesi gereken: yeşil rozet, **"6 kural kanıtlandı"**,
tablo, oynatıcı süresi. Pencerenin üst kısmı yeterli.

### 2. YouTube — reklam yok

Reklam çalıştıran bir videoyu aç, eklenti açıkken oynat. Görüntüde
**temiz oynatıcı** ve sağ üstte eklenti rozeti görünsün.

### 3. Ayarlar — temizlik grupları

Ayarlar sayfasının üst kısmı: ana anahtar, algılama karşıtı (kapalı
görünmeli — bu dürüstlük vurgusudur), kozmetik gruplar.

### 4. Ayarlar — sahiplik ve sayaçlar

Sahiplik/iletişim bloğu + 14 günlük grafik + "Tüm hakları saklıdır".
Yayıncı kimliğini görünür kılar.

### 5. Element seçici

YouTube'da bir reklama **sağ tık → "FD: Bu öğeyi engelle"**, sonra
ayarlarda "Kendi kuralların" listesinin dolduğu an. Kullanıcıya özel
özelliği gösterir.

---

## Dosya adları

`store/screenshots/` klasörüne şu adlarla kaydet:

```
01-tanilama-kanit.png        1280x800
02-youtube-reklamsiz.png      1280x800
03-ayarlar-temizlik.png      1280x800
04-ayarlar-sahiplik.png      1280x800
05-element-secici.png         1280x800
```

---

## Doğrulama (yüklemeden önce)

```bash
node tools/check-screenshots.js
```

Boyutu, alfa kanalını ve boş görüntüyü kontrol eder. Kırmızı çıkarsa
yükleme — mağaza reddeder.

---

## Sık yapılan hatalar

| Hata | Sonuç |
|---|---|
| 1280×800 değil | Red |
| Alfa kanalı olan PNG | Red |
| Aynı görüntüyü 2 kez yükleme | Red |
| Üstünde YouTube logosu telif sorunu | İnceleme sürer |
| 5 resmin hepsi ayar sayfası | "Bu ürünü indirmeye değer mi?" sorusu cevapsız kalır |

> YouTube'un kendi arayüzü görüntüde **görünmemeli** — yalnızca
> oynatıcı ve eklentinin etkisi. Marka/telif kuralları.

---

## Zorunlu diğer görseller (hazır ✅)

| Görsel | Boyut | Durum | Dosya |
|---|---|---|---|
| İkon | 128×128 | ✅ | `icons/icon128.png` |
| Küçük kutu | 440×280 | ✅ | `store/images/promo-small-440x280.png` |
| Marquee | 1400×560 | ✅ | `store/images/marquee-1400x560.png` |

Küçük kutu ve marquee kod ile üretildi (`node tools/make-store-images.js`).
Yeniden üretmek gerekirse aynı komutu çalıştır.