YouTube'daki reklamları kaldırır ve sayfayı etraflarından temizler.

Çoğu reklam engelleyici bir kara kutu: kurarsınız, reklamlar büyük ölçüde
kaybolur ve neden kaybolduğunu hiçbir zaman öğrenemezsiniz. FD Reklam
Engelleyici aynı şekilde çalışır — ama hangi katmanın işi yaptığını ve
sızan bir şey olup olmadığını size söyleyen bir Tanılama aracıyla birlikte
gelir.

── Reklamları nasıl engelliyoruz ──

Dört katman, her biri ayrı ayrı doğrulanabilir:

• Ağ — reklam altyapısına giden istekleri tarayıcıdan çıkmadan önce
  Manifest V3 declarativeNetRequest API'siyle durdururuz. Sayfa yavaşlamaz,
  çünkü istek hiç başlamaz.

• Veri budama — reklam alanlarını (adPlacements, playerAds, adSlots ve reklam
  renderer'ları) sayfanın kendi betiği okumadan **önce** oynatıcı yanıtından
  sileriz. Önüne geçen ve ortasına giren reklamlar bu yüzden kalkar: oynatıcı
  hiçbir zaman reklam planlandığını öğrenmez.

• Kozmetik filtreleme — geriye kalanı gizler: üst banner'lar, kenar
  çubuğu blokları, yükselen video sonuçları, "Premium'u dene" pencereleri,
  Shorts rafları, yorum bölümü ve bitiş ekranı kartları. Yedi ayrı grup,
  her biri tek tek kapatılabilir.

• Oynatıcı yedeği — bir video reklamı yine de geçerse oynatıcı izlenir:
  atlama düğmesine otomatik tıklanır, atlanamayan reklamlar sessize
  alınıp hızlandırılır. Oynatma hızınız ve sesiniz sonrasında geri
  yüklenir.

── Tanılama: gerçekte ne olduğunu görün ──

Çoğu engelleyicide bulunmayan kısım bu. Tanılama'yı açtığınızda eklenti
aktif YouTube sekmenizi tarar ve sade bir dille raporlar:

• Hangi engelleme katmanı bu sayfada etkin
• Oynatıcı yanıtında reklam verisi bulundu ve silindi mi
• YouTube'un "reklam engelleyici bulundu" uyarısı tetiklendi mi
• Hangi reklam uçları engellendi, hangileri geçti
• Her kuralın gerçekten çalıştığını, hiçbir zaman engellenmemesi gereken
  bir kontrol adresiyle A/B testiyle kanıtlayan bir test

YouTube bir şeyi değiştirip reklamlar sızmaya başlarsa, araç hangi katmanın
kırıldığını söyler; siz tahmin etmezsiniz.

── Sayfayı temizleme ──

Yedi ayrı kapatılabilir grup şunları gizler: reklamlar, Premium yükseltmeleri,
ana sayfadaki Shorts karmaşası, ilgili videolardaki Shorts'lar, yorumlar,
oynatıcı kaplamaları ve bitiş ekranı kartları, bildirim balonları.

Kendi kurallarınızı da ekleyebilirsiniz: bir öğeye sağ tıklayıp
"FD: Bu öğeyi engelle" deyin. Eklenti o öğe için bir CSS seçici üretir ve
kalıcı kural olarak kaydeder.

── Gizlilik ──

FD Reklam Engelleyici hiçbir veri toplamaz, hiçbir şey göndermez. Analitik,
telemetri, uzak yapılandırma ve bizim sunucumuz yok. Tüm analiz cihazınızda
çalışır. Ayarlar ve sayaçlar `chrome.storage` içinde tutulur, makinenizden
çıkmaz.

Eklentinin yaptığı tek ağ isteği, engellediği reklam sunucularına ve zaten
ziyaret ettiğiniz sayfalara gider.

── Dürüst sınırlar ──

YouTube bazı reklamları sunucu tarafında, doğrudan video akışına gömer.
Hiçbir tarayıcı eklentisi bunları engelleyemez. Oynatıcı içi reklamların
büyük çoğunluğu hâlâ istemci tarafında ve burada engelleniyor — ama
hepsi değil, hiçbir zaman.

YouTube size "reklam engelleyici bulundu" uyarısı gösterirse, Ayarlar'daki
algılama karşıtı seçeneğini açabilirsiniz. **Varsayılan olarak kapalıdır** —
yaptığımızı gizlemektense size açıkça göstermeyi tercih ederiz.
