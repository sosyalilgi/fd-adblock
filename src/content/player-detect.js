/* =====================================================================
   FD Reklam Engelleyici — player-detect.js
   ---------------------------------------------------------------------
   Oynatıcı yedeğinin SAF mantığı: reklam var mı, atla düğmesi
   var mı. DOM'a dokunmaz; verilen sorgu işlevini kullanır.

   Neden ayrı dosya:
     player.js icinde yazildiginda iki hata GORUNMEZDI ve test
     edilemiyordu —
       1) AD_SELECTORS join ile STRING yapildigi halde dizi gibi
          iterate ediliyordu: querySelector('.'), querySelector('v')...
          96 anlamsiz sorgu, reklam hic bulunamaz.
       2) offsetParent kontrolu position:fixed ogelerde null doner;
          YouTube reklam katmani cogu sabit konumludur.
   Bu dosya saf oldugu icin tarayici olmadan test edilir.
   ===================================================================== */
(function (kok) {
  'use strict';

  /* Reklam bari iceren seciciler. TEK BIR STRING olarak tutulur ve
     querySelector'a oldugu gibi verilir.

     EN ONEMLI MADDE: `.html5-video-player.ad-showing`.
     Bu YouTube'un KENDI bayragi — reklam oynatirken oynatici
     kabina bu sinifi kendisi ekler. Modern YouTube reklamlari
     gomulu bir web component icinde render edildigi icin
     `.video-ads` gibi eski seciciler cogu zaman HIC YOKTUR.
     Rapor: ad-showing=true iken hiz=1 — yani sinif var ama
     eski seciciler bulunamadiyordu.

     Siralama onemli: Once YouTube'un bayragi, sonra eski seciciler
     (daha eski oynatici surumleri icin yedek yol). */
  var AD_SELECTORS = [
    '#movie_player.ad-showing',
    '.html5-video-player.ad-showing',
    '.video-ads',
    'ytd-player-legacy-desktop-watch-ads-renderer',
    '.ytp-ad-module',
    '.ytp-ad-overlay-container',
    '.ytp-ad-overlay-slot',
    '.ytp-ad-text-overlay'
  ].join(',');

  /* Atla dugmeleri. */
  var SKIP_SELECTORS = [
    '.ytp-ad-skip-button',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot button',
    'button.ytp-ad-skip-button-modern'
  ].join(',');

  /* Oge gercekten gorunur mu?
     offsetParent, position:fixed/absolute ogelerde null doner; bu
     yuzden ek olarak dikdortgen olcüsune bakilir. */
  function gorunurMu(el) {
    if (!el) return false;
    try {
      if (el.offsetParent !== null && el.offsetParent !== undefined) return true;
      var r = el.getBoundingClientRect();
      return !!(r && r.width > 0 && r.height > 0);
    } catch (e) {
      return false;
    }
  }

  /* Gorsunur bir reklam bari var mi?
     sorgu: (secici) => Element|null */
  function reklamVarMi(sorgu) {
    var el;
    try {
      el = sorgu(AD_SELECTORS);
    } catch (e) {
      return false;
    }
    return gorunurMu(el);
  }

  /* Tiklanabilir bir atla dugmesi var mi?

     GORUNURLUK KONTROLU KRITIK:
     YouTube'un "Atla" dugmesi DOM'da reklamin BASINDAN itibaren
     vardir, ama ilk ~5 saniye GIZLIDIR. Onceki surum yalnizca
     "var mi / disabled mi" diyordu; gizli dugmeyi de tiklayip
     atlanan sayacini artiriyordu, ama tiklamanin etkisi yoktu ve
     reklam oynamaya devam ediyordu.

     Rapor: atlanan=21, sonlandirilan=0 — sarmaya hic hicranmamis,
     kullanici reklami gordu. Dugenin gercekten kullanilabilir
     olmasi (gorunur) sart. */
  function atlaDugmesi(sorgu) {
    var btn;
    try {
      btn = sorgu(SKIP_SELECTORS);
    } catch (e) {
      return null;
    }
    if (!btn || btn.disabled) return null;
    // Oge henuz DOM'a tam baglanmamis olabilir
    if (typeof btn.click !== 'function') return null;
    // Gizli dugmeye tiklamak ise yaramaz; "yok" say ki plan()
    // hemen sona sarma yoluna geçsin.
    if (!gorunurMu(btn)) return null;
    return btn;
  }

  /* ---------------------------------------------------------------
     Ne yapilacagina karar vermek. SAF fonksiyon.

     Neden: onceki surum reklami sessize alip 16x yapardi. Bu calisir
     ama 15 saniyelik reklam ~1 saniye GORUNUR. Kullanici sordu:
     "gorsel olarak bir gorum mu?" Evet, goruyordu.

     Siralama:
       1) Atla dugmesi varsa tikla  -> en temiz yol, YouTube kendi
                                        reklami dogru sekilde kapatir
       2) Yoksa videoyu sonuna sar -> reklam ~1 karede biter,
                                        kullanici reklam GORMEZ
       3) Olmuyorsa sessiz + 16x   -> son care
     */
  var SONUNCU_SANIYE = 0.05;

  /* dogrulanabilir sayi mi? (canli yayinlarda sure = Infinity) */
  function sonluSayi(n) {
    return typeof n === 'number' && isFinite(n) && n > 0;
  }

  /* Süre HENÜZ bilinmiyor mu?
     Infinity "bilinmiyor" DEĞİLDİR — canlı yayında hep öyle kalır.
     Ayırt etmek şart: yoksa sonsuza kadar bekleriz ve reklam
     hiç bitmez. 0 ve NaN ise gerçekten henüz yüklenmemiştir. */
  function sureBilinmiyor(n) {
    return typeof n !== 'number' || isNaN(n) || n <= 0;
  }

  function plan(d) {
    d = d || {};

    // 1) Atla dugmesi
    if (d.atlaVar) return { aksiyon: 'atla', sebep: 'atla dugmesi var' };

    // 2) Süre henüz yüklenmedi — sonraki turda tekrar dene
    if (sureBilinmiyor(d.sure)) {
      return { aksiyon: 'bekle', sebep: 'süre henüz okunamadı' };
    }

    // 3) Sonuna sar — gorsel olarak reklam gorunmez
    if (sonluSayi(d.sure)) {
      return {
        aksiyon: 'sonlandir',
        hedef: Math.max(0, d.sure - SONUNCU_SANIYE),
        sebep: 'reklam sonuna sarildi'
      };
    }

    // 4) Canlı yayın (Infinity): sarma çalışmaz → sessiz + hız
    return { aksiyon: 'hizlandir', hiz: 16, sebep: 'canlı yayın, süre sonu yok' };
  }

  /* ---------------------------------------------------------------
     Kullaniciya gosterilecek is durumu. player.js bunu HTML
     etiketine yazar; tanilama oradan okur (DOM iki dunya arasinda
     paylasilir, FDI'nin kendisi paylasilmaz).
     */
  var REKLAM_ETIKETI = 'data-fd-player';

  var API = {
    AD_SELECTORS: AD_SELECTORS,
    SKIP_SELECTORS: SKIP_SELECTORS,
    gorunurMu: gorunurMu,
    reklamVarMi: reklamVarMi,
    atlaDugmesi: atlaDugmesi,
    plan: plan,
    sonluSayi: sonluSayi,
    sureBilinmiyor: sureBilinmiyor,
    SONUNCU_SANIYE: SONUNCU_SANIYE,
    REKLAM_ETIKETI: REKLAM_ETIKETI
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  kok.FDPlayerDetect = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);