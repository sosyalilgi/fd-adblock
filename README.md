<div align="center">

# FD Reklam Engelleyici

**YouTube'daki reklamları engeller, sayfayı temizler.**

Chrome · Edge · Brave

[![Sürüm](https://img.shields.io/badge/s%C3%BCr%C3%BCm-1.21.0-16a34a)](manifest.json)
[![Manifest](https://img.shields.io/badge/manifest-MV3-4285f4)](manifest.json)
[![Lisans](https://img.shields.io/badge/lisans-MIT-a475f9)](LICENSE)

[⬇ Kurulum](#kurulum) · [🛠 Kullanım](#kullanım) · [🔒 Gizlilik](#gizlilik) · [❓ SSS](#sss)

</div>

---

## Ne yapar

YouTube'da açılan reklamları durdurur ve sayfadaki gereksiz öğeleri gizler.

- 🎬 Videonun başında, ortasında ve sonundaki reklamlar
- 🖼️ Ana sayfadaki reklam kutuları ve öneri şeritleri
- ➕ Yan çubuktaki "Şunları beğenebilirsiniz" listeleri
- 💬 Yorum bölümündeki spam ve ilgisiz yorumlar
- 🔔 Premium'a yönlendiren reklamlar

**Reklamları göstermeden engeller.** Reklam oynatıcıda belirdiği anda atlanır
veya sonuna sarılır — ekranda bir görüntü kalmaz.

---

## Kurulum

Tarayıcı eklentileri mağazadan yüklemek yerine, klasörü doğrudan yüklüyoruz.

1. Tarayıcının eklenti sayfasını açın:
   - Chrome → `chrome://extensions`
   - Edge → `edge://extensions`
   - Brave → `brave://extensions`
2. Sağ üstteki **Geliştirici modu** anahtarını açın.
3. **Paketi çözülmemiş olarak yükle** butonuna tıklayın.
4. Bu klasörü seçin: `fd-adblock`

> **Güncelleme sonrası:** Eklenti sayfasındaki ⟳ düğmesine basın, sonra
> YouTube sekmesini `Ctrl+Shift+R` ile yenileyin. Eklentiler açık sekmelerde
> kendiliğinden güncellenmez.

**Gereksinim:** Chrome 111 veya üzeri.

---

## Kullanım

| Ne yapmak istiyorum | Nasıl |
|---|---|
| Açmak / kapatmak | Araç çubuğundaki simgeye tıklayın |
| Engellenen reklam sayısını görmek | Aynı simgeye tıklayın — sayaçlar orada |
| Sayfadan bir şeyleri kaldırmak | Ayarlar → *Kozmetik temizlik* |
| Belirli bir öğeyi gizlemek | YouTube'da öğeye **sağ tık → FD: Bu öğeyi engelle** |
| Sorun gidermek | Ayarlar → *Tanılama* |

**Kısayol:** `Alt + Shift + Y` eklenti menüsünü açar.

### Tanılama nedir?

Ayarlar'daki **Tanılama** sayfası, açık olan YouTube sekmesini tarar ve şunları
söyler:

- Reklam engelleme çalışıyor mu?
- Hangi öğeler sızdı?
- YouTube eklentiyi fark etti mi?
- Sayfanın hangi bölümündesiniz (ana sayfa, video, Shorts, canlı yayın)?

Bir sorun bildirecekseniz bu sayfadaki **Raporu kopyala** düğmesi en hızlı
yoldur — tüm bilgi tek mesajda hazır gelir.

---

## Gizlilik

**Hiçbir veri toplamıyoruz. Hiçbir şey göndermiyoruz.**

Sunucumuz, analitik, telemetri veya uzak yapılandırma yoktur. Tüm işlemler
cihazınızda gerçekleşir.

- Hesap gerekmez, giriş yapılmaz
- Reklam verileri cihazdan çıkmaz
- 14 günlük geçmiş yalnızca kendi tarayıcınızda saklanır

[Politikamızın tamamı](https://sosyalilgi.github.io/fd-adblock/privacy.html) ·
[Destek sayfası](https://sosyalilgi.github.io/fd-adblock/support.html)

---

## SSS

**"Reklam engelleyici bulundu" penceresi çıkıyor.**

Ayarlar → *Algılama karşıtı*'nı açın ve sayfayı yenileyin. Bu seçenek
**varsayılan olarak kapalıdır** — ne yaptığımızı saklamak yerine size seçeneğe
sunuyoruz.

**Gizlemek istediğim bir şey kayboldu.**

Ayarlar → *Kozmetik temizlik*'te 7 ayrı grup var. Kapatmak istediğiniz özelliği
toggleyin; sayfa hemen düzelir.

**Reklam hâlâ oynuyor.**

Tanılama sayfasını açıp **Raporu kopyala** deyin. Rapor hangi katmanın
çalıştığını ve neyin sızdığını gösterir.

**Sayaçlar neden sıfır?**

Oturum sayaçları tarayıcı kapanınca sıfırlanır. Kalıcı istatistik için
Ayarlar'daki *Son 14 gün* grafiğini kullanın.

**Başka bir sitede çalışır mı?**

Hayır. Eklenti yalnızca YouTube'da çalışır ve yalnızca YouTube'daki reklamları
engeller.

---

## Bilmeniz gerekenler

**Bir kısım reklamlar engellenemez.** YouTube bazı reklamları doğrudan video
akışına gömer. Bunların hiçbir eklenti durduramaz.

**Gömülü video.** `youtube.com/embed/...` adresini sekmede açarsanız çalışır.
Bir blogun içine gömüldüğünde çalışmaz — eklenti yalnızca YouTube'da yetkili.

---

## Katkı

Kod açıktır. Hata bildirmek, öneri sunmak veya katkıda bulunmak için:
[github.com/sosyalilgi/fd-adblock](https://github.com/sosyalilgi/fd-adblock)

Yapının ayrıntıları, mimari ve geliştirici araçları için
**[TEKNIK-DETAY.md](TEKNIK-DETAY.md)** dosyasına bakın.

---

## Lisans

MIT

---

<div align="center">

**Ferhat Doğan** · [ferhatdogan55@gmail.com](mailto:ferhatdogan55@gmail.com) · [266hosting.com](https://266hosting.com)

© 2026 FD Reklam Engelleyici — Tüm hakları saklıdır.

</div>