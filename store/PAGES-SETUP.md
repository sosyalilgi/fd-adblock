# GitHub Pages — tek seferlik kurulum

Bu depo, GitHub Pages ile şu adresleri yayınlar:

| Adres | İçerik |
|---|---|
| `https://sosyalilgi.github.io/fd-adblock/` | İndeks |
| `https://sosyalilgi.github.io/fd-adblock/privacy.html` | Gizlilik politikası |
| `https://sosyalilgi.github.io/fd-adblock/support.html` | Destek sayfası |

Chrome Web Store gönderiminde **gizlilik politikası adresi zorunludur.**
Bu iki sayfa yayınlanmadan form doldurulamaz.

---

## Kurulum (bir kez, 2 dakika)

### 1. Pages'i aç

<https://github.com/sosyalilgi/fd-adblock/settings/pages>

- **Build and deployment** → **Source:** `GitHub Actions`
- Kaydet

> Bu adım **yalnızca elle** yapılabilir. Workflow kendi kendine açamaz;
> bu yüzden ilk çalıştırmada hata verir ve ne yapılacağını söyler.

### 2. Ayarlar → Pages'e git, "Deploy from a branch" değil

Yukarıdaki `Source` alanında iki seçenek çıkar:

- ❌ `Deploy from a branch` — bunu **seçme**, elle yönetim gerektirir
- ✅ `GitHub Actions` — workflow otomatik yayınlar, doğru olan budur

### 3. Bir değişiklik gönder

```bash
node tools/publish-pages.js
git add docs/
git commit -m "docs: yenile"
git push
```

Actions sekmesinden yeşil tik'i bekle (genelde 30–60 saniye).

### 4. Doğrula

```bash
# hepsi 200 dönmeli
curl -o /dev/null -s -w "%{http_code}\n" https://sosyalilgi.github.io/fd-adblock/
curl -o /dev/null -s -w "%{http_code}\n" https://sosyalilgi.github.io/fd-adblock/privacy.html
curl -o /dev/null -s -w "%{http_code}\n" https://sosyalilgi.github.io/fd-adblock/support.html
```

---

## Güncelleme

Kaynak dosyalar `web/` içindedir, `docs/` kopyadır.

```bash
node tools/publish-pages.js     # web/ -> docs/
git add docs/ && git commit -m "docs: yenile"
git push
```

**`web/` içindeki bir sayfayı değiştirdiysen `docs/`'u güncellemeyi
unutma.** CI bunu kontrol eder ve senkron değilse yayını durdurur:

```
::error::docs/ klasoru web/ ile esit degil.
```

Bu, "neden eski metin yayınlanıyor?" sorusunu ortadan kaldırır.

---

## Sık karşılaşılan sorunlar

### "GetPages site_url is not configured"

Pages açılmamış demektir. Yukarıdaki 1. adıma dön.

### 404 dönüyor ama Actions yeşil

Yayın 1–2 dakika sürebil. Bir dakika bekle, tekrar dene. Hâlâ 404 ise
Actions sekmesinden en son çalıştırmanın ayrıntısına bak.

### Sayfa eski içerik gösteriyor

Tarayıcı önbelleği. `Ctrl+Shift+R` ile zorla yenile.

### Özel alan adı (266hosting.com) kullanmak istersem

Pages'e özel alan adı eklenebilir, ancak **mağaza gönderimi için gerekli
değil.** `sosyalilgi.github.io` adresleri de kabul edilir ve ücretsizdir.
Eklenirse DNS'te `CNAME` kaydı ve otomatik HTTPS sertifikası gerekir —
yayını geciktirir, ilk sürümde gerekmez.