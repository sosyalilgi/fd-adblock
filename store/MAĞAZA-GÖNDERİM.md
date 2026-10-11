# Chrome Web Mağazası — Adım Adım Gönderim

Hesabın açılmış durumda. Bu belge, mağaza formundaki **her alanı**, ne
yazılacağıyla birlikte sırayla anlatır.

> **Yarım saat sürer.** Tek zorunlu engel ekran görüntüsüdür; o alana
> kadar 5 dakika.

---

## Durum özeti — ne hazır, ne eksik

| | Durum |
|---|---|
| Paket dosyası | ✅ `fd-adblock-1.20.0.zip` (87 KB) |
| İkon 128×128 | ✅ `icons/icon128.png` |
| Küçük kutu 440×280 | ✅ `store/images/promo-small-440x280.png` |
| Marquee 1400×560 | ✅ `store/images/marquee-1400x560.png` |
| Açıklama (TR/EN) | ✅ `store/listing-long-tr.md` / `-en.md` |
| Gizlilik politikası | ✅ https://sosyalilgi.github.io/fd-adblock/privacy.html |
| Destek sayfası | ✅ https://sosyalilgi.github.io/fd-adblock/support.html |
| **Ekran görüntüsü** | ⬜ **TEK EKSİK ÖĞE** |

---

## ADIM 0 — Ekran görüntüsünü al (yapmadan devam etme)

Mağaza formu bu alanı reddedecektir.

### En değerli görüntü (buna önce yap)

Tanılama aracının kanıt ekranı. Tek başına eklentinin ne yaptığını gösterir.

```
1. YouTube'da bir video aç ve oynat
2. Popup → Tanılama
3. YouTube sekmesini seç → "Tara"
4. "Testi çalıştır" → birkaç saniye bekle
5. Sonuç: "6 kural kanıtlandı, 0 belirsiz"
```

Bu ekranda görünmesi gerekenler:

- Üstteki yeşil rozet
- **"6 kural kanıtlandı, 0 belirsiz"** başlığı
- Kural satırları tablosu
- Oynatıcı satırı (`ad-showing sınıfı: hayır`, `Yedek: ...`)

### Nasıl yakalanır

**Yöntem A — Ekran alıntısı aracı (kolay)**

```
Win + Shift + S
```

Aracın üstünde kutu çıkacak. **Pencere boyutu 1280×800'den küçükse** önce
tarayıcı penceresini `Win + ←` ile ekranın sol yarısına yasla.

> ⚠️ Pencere 1280 genişlikte değilse aldığın görüntü yanlış ölçüde olur.
> Dosyayı masaüstüne kaydet, adını `01-tanilama-kanit.png` yap.

**Yöntem B — Paint ile düzeltme (garanti)**

1. Görüntüyü al
2. Paint'te aç → **Boyut** → Yatay `1280`, Dikey `800` → **Kaydet**

Kırpma yapman gerekmez — yeniden boyutlandırma yeterli.

### Doğrulama

Görüntüyü `store/screenshots/` klasörüne kaydet ve kontrol ettir:

```bash
node tools/check-screenshots.js
```

Şunu görmelisin:

```
OK    01-tanilama-kanit.png 1280x800
OK    01-tanilama-kanit.png alfa kanalı yok
OK    01-tanilama-kanit.png dolu icerik
```

**Mağazaya yüklemeden önce bunu çalıştır.** Boyut yanlışsa form reddeder.

### İstersen 4 tane daha (isteğe bağlı, dönüşüm oranını artırır)

| Dosya adı | Ne zaman |
|---|---|
| `01-tanilama-kanit.png` | Tanılama + kanıt ekranı |
| `02-youtube-temiz.png` | Oynatıcı temizken YouTube (reklamsız) |
| `03-ayarlar-temizlik.png` | Ayarlar → Kozmetik temizlik (7 grup) |
| `04-ayarlar-sahiplik.png` | Ayarlar → Sahiplik + 14 günlük grafik |

> ⚠️ YouTube'un kendi arayüzü (logo, kanal adı) görüntüde **görünmemeli**.
> Marka/telif kuralları. Yalnızca oynatıcı ve eklentinin etkisi görünsün.

---

## ADIM 1 — Dashboard'a gir

<https://chrome.google.com/webstore/devconsole>

Google hesabınla giriş yap. Sol menüde eklenti yoksa **"Add new item"**
(veya Türkçe: **"Yeni öğe ekle"**) düğmesi görünür.

---

## ADIM 2 — Paketi yükle

```
[Add new item] → [Choose file] → fd-adblock-1.20.0.zip → [Upload]
```

Dosya yolu — paket, indirilenler klasöründe:

```
fd-adblock-1.20.0.zip
```

(Tam yolü bilmiyorsan Downloads klasöründe ara; `node tools/package.js`
her çalıştırdığında yeniden üretir.)

**Önemli:** Mağaza zip'in **içindeki klasörü değil**, doğrudan klasörün
kendisini ister. Bizim paketleme betiğimiz doğru yapıyı üretiyor — açılıp
kontrol etmek istersen:

```bash
node tools/package.js
```

Yükleme sonrası hata çıkarsa en sık nedenler:

| Hata | Sebep |
|---|---|
| `Manifest file is missing or unreadable` | Yanlış dosya seçildi |
| `Manifest is not valid JSON` | `manifest.json` bozuk |
| `Invalid value for 'version'` | Sürüm `x.y.z` biçiminde değil |

---

## ADIM 3 — Store Listing sekmesi

En uzun sekme. Her alana ne yazılacak:

### 3.1 Program adı

```
FD Reklam Engelleyici
```

(25 karakter sınırı — 22 karakter, sığıyor)

### 3.2 Kısa açıklama (132 karakter)

Türkçe:

```
YouTube'daki reklamları engeller. Kutu oynamadan önce, oynatıcıdan
görünmeden siler. Reklamları neden kaybettiğinizi ölçen tanılama aracı.
```

### 3.3 Ayrıntılı açıklama (16.000 karakter)

`store/listing-long-tr.md` dosyasının **tamamını** yapıştır.

> Dil olarak **Türkçe** seç. Mağazanın Türkçe bölümünde görünür.

### 3.4 Dil

```
Türkçe
```

> Tek dille mi, çift dille mi? **Sadece Türkçe** ile başla. İkinci dil
> eklemek ek iş demektir ve aynı özellikleri anlatmak zorundadır.
> Sonraki güncellemede İngilizce eklenebilir.

### 3.5 Ana kategori

```
Productivity
```

*(Türkçe arayüzde "Üretkenlik")*

Reklam engelleyiciler için en doğru kategori bu. "Utilities" da olur ama
Productivity daha çok ilgilenen bulunuyor.

### 3.6 Grafik dosyalar

| Alan | Dosya | Boyut |
|---|---|---|
| Mağaza simgesi | `icons/icon128.png` | 128×128 ✅ |
| Küçük tanıtım kutusu | `store/images/promo-small-440x280.png` | 440×280 ✅ |
| Büyük tanıtım kutusu | `store/images/marquee-1400x560.png` | 1400×560 ✅ |
| Ekran görüntüleri | `store/screenshots/*.png` | 1280×800 ⬜ |
| Video | *(boş bırak)* | — |

Video zorunlu **değil**. Boş bırakmak sorun değil.

---

## ADIM 4 — Privacy sekmesi (zorunlu, atlanamaz)

Bu sekme en çok red sebebi. Dürüst doldur, reklam engelleyiciler sık
reddedilir çünkü insanlar "veri topluyor" sanar.

### 4.1 Tek amaç (Single purpose)

```
Removes advertisements from YouTube.
```

> Tek cümle. Tanılama, element seçici, kozmetik temizlik gibi
> özellikler ayrı "amaç" gibi yazılmamalı.

### 4.2 Kullanıcı verisi topluyor musunuz?

```
☐ Hayır   (tek kutu işaretle)
```

**Kutuyu işaretleme.** Bu eklenti hiçbir şey toplamıyor.

### 4.3 Veri kullanımı beyanı

Hiçbir şey işaretleme. Tüm listeler boş kalacak — bu doğru.

### 4.4 Gizlilik politikası URL'si

```
https://sosyalilgi.github.io/fd-adblock/privacy.html
```

Bu adres **gerçekten erişilebilir olmalı.** Zaten yayında (HTTP 200).
Yine de formu doldurmadan önce adresi tarayıcıda aç ve doğrula.

---

## ADIM 5 — Distribution sekmesi

### 5.1 Dağıtım

```
☑ Görünürlük: Herkese açık (Public)
```

> "Yalnızca kendim için" seçersen mağazada görünmez. Yayın için
> **Public** olmalı.

### 5.2 Ülke / bölge

```
☑ Tüm ülkeler
```

Varsayılan olarak tüm dünyada listelenir. Kısıtlamak istemiyorsan dokunma.

### 5.3 Kullanıcılar

```
☐ Yalnızca kendim için yayınla
```

Bu kutu **işaretlenmemeli**. İşaretlenirse eklenti mağazada görünmez.

---

## ADIM 6 — Test talimatları (isteğe bağlı)

Bu eklenti için gerekli değil. Boş bırakabilirsin.

> Yalnızca inceleyici bir hesapla giriş gerektiren bir ekran görüyor olsaydı
> buraya kullanıcı adı/şifre yazardık. Bizim eklentimizin açılışta hesap
> istemi yok.

---

## ADIM 7 — Gönder

```
[Submit for review]
```

Açılan onay penceresinde **"Submit"**.

### Son kontrol penceresi

Göndermeden önce şunları gözden geçir:

- [ ] En az 1 ekran görüntüsü yüklendi
- [ ] Gizlilik politikası adresi tıklanabilir
- [ ] "Kullanıcı verisi topluyor musunuz: Hayır" işaretli
- [ ] Görünürlük "Public"
- [ ] "Yalnızca kendim için" işaretli **değil**

---

## ADIM 8 — İnceleme süresi

| Süre | Beklenen |
|---|---|
| Normal | **1–14 gün** |
| İlk sefer (yeni yayıncı) | 7 gün veya daha uzun olabilir |

Durumu şuradan izle:
<https://chrome.google.com/webstore/devconsole> → eklenti → **Durum**

> İnceleme sırasında eklenti mağazada **görünmez**. Onaylanınca yayınlanır.

---

## Red alırsan

Mağazanın en sık red sebepleri ve cevapları:

| Red sebebi | Cevabın |
|---|---|
| "Veri topluyorsunuz" | Privacy → Hayır işaretli olduğunu ve politika adresinin erişilebilir olduğunu kontrol et |
| "Gizlilik politikası eksik" | Politika adresi 200 dönmeli, `https://` olmalı, `file://` olmamalı |
| "Tek amaç belirtilmemiş" | Tam olarak bir cümle yaz, fazla kelime kullanma |
| "İzinler gerekçesiz" | `src/privacy.html` izinlerin her birini gerekçesiyle anlatıyor |
| "Ekran görüntüsü hatalı" | 1280×800, alfa kanalı yok, YouTube logosu içermiyor |
| "İşlevsel değil" | Tanılama kanıt ekranı en güçlü cevap — bu yüzden ilk ekran görüntüsü o olmalı |

Red mesajı geldiğe tam metnini bana yapıştır; neyi değiştireceğimizi net
olarak belirleriz.

---

## Sık yapılan hatalar

**Zip'in içindeki klasörü yüklemek.** Mağaza doğrudan kök dosyaları ister.
`tools/package.js` doğru yapıyı üretir, elle sıkıştırma.

**`file:///` ile politika adresi.** Mağaza erişemez, red sebebi.
`https://` şart.

**Sürüm numarasını artırmadan tekrar yüklemek.** Her yeni yüklemede
`manifest.json` içindeki `version` artırılmalı, yoksa mağaza reddeder.

**Privacy'de "Evet" seçmek.** Veri toplamıyoruz; işaretlemek yanlış beyan olur.

---

## Sıradaki sürüm için

```bash
# manifest.json içindeki sürümü artır
node tools/package.js
# yeni zip'i mağazaya yükle
```

`tools/test-version.js` README, teknik doküman ve paket adının
sürümle eşleştiğini doğrular.