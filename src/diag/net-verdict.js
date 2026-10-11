/* =====================================================================
   FD Reklam Engelleyici — net-verdict.js
   ---------------------------------------------------------------------
   Ağ katmanı testinin SONUÇLANDIRMA mantığı. Tamamen saf fonksiyon
   (DOM, chrome API, ağ yok) — bu yüzden Node ile test edilebilir.

   ÖLÇÜM YÖNTEMİ (önemli):
   DNR, ağ yığınından önce çalıştığı için webRequest.onErrorOccurred
   engellemeleri RAPORLAMAZ. Bu yüzden "geçti mi" bakmak yerine
   SÜREye bakıyoruz:

     • DNR engellemesi  → istek ağa hiç çıkmaz, 0-2 ms
     • Gerçek ağ hatası → DNS/TLS denemesi, 50-600 ms arası DEĞİŞKEN

   EŞİK NASIL SEÇİLDİ — tahmin edilmedi, ölçümlerden çıkarıldı:
     Engellenen istekler (tüm raporlarda):  0, 1, 2 ms
     Başarısız istekler (tüm raporlarda):   53, 67, 256, 281, 297, 587 ms
   İki küme arasında 25 katlık boşluk var. Eşik 30 ms, tam ortada.
   (Eski değer 150 ms idi ve başarısız kümenin İÇİNDE kalıyordu: sıcak
    DNS ile 53 ms'de düşen bir hatayı "engellenmiş" sanıyordu. Bu yanlış
    NEGATİF üretir — çalışmayan kural "belirsiz" görünürdü.)

   YANLIS POZITIF KORUMASI: ölçüm yoksa asla "çalışıyor" denmez.
   ===================================================================== */
(function () {
  'use strict';

  // Boşluğun ortası. Çok düşükse gürültüye, çok yüksekse yanlış negatife yol açar.
  const BLOCK_FAST_MS = 30;

  function passed(sonuc) {
    return typeof sonuc === 'string' && sonuc.indexOf('gecildi') === 0;
  }

  function isUnknown(v) {
    return v === null || v === undefined || v === '' ||
      (typeof v === 'string' && v.charAt(0) === '(');
  }

  function durum(sonuc, ms) {
    if (isUnknown(sonuc)) return 'bilinmiyor';
    if (passed(sonuc)) return 'gecildi';
    const t = typeof ms === 'number' ? ms : NaN;
    if (t === t) return t < BLOCK_FAST_MS ? 'hata-aninda' : 'hata-yavas';
    return 'hata';
  }

  // Hem eski şemayı (düz metin) hem yeni şemayı ({sonuc, ms}) güvenle okur.
  function sonucOf(v) {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.sonuc;
    return undefined;
  }

  function sureOf(v) {
    if (v && typeof v === 'object' && typeof v.ms === 'number') return v.ms;
    return undefined;
  }

  /**
   * @param {string} kural        'KONTROL' ise muaf
   * @param {object} acik         { sonuc, ms } (veya eski şema: düz metin)
   * @param {object} kapali       { sonuc, ms }
   */
  function classifyOne(kural, acik, kapali) {
    // ÖLÇÜM YOKSA HİÇBİR ŞEY SÖYLEMEYEMEYİZ.
    // Bu, karar mantığının EN ÖNEMLİ güvenlik kuralıdır: bilinmeyen
    // veriden "kurallar her şeyi kesiyor" gibi korkutucu bir sonuç
    // üretmek, doğru ama eksik bir sonuçtan çok daha kötüdür.
    //
    // Düz metin de bilinmiyor sayılır: süre bilinmeden "anında çöktü"
    // ile "ağ hatası" ayırt edilemez.
    const legacy = (typeof acik === 'string') || (typeof kapali === 'string');
    const aS = sonucOf(acik);
    const kS = sonucOf(kapali);

    if (legacy || isUnknown(aS) || isUnknown(kS)) {
      return { yorum: 'olcum yok - belirsiz', cls: 'warn', sayac: 0, olcumYok: true };
    }

    const a = durum(aS, sureOf(acik));
    const k = durum(kS, sureOf(kapali));

    // Kontrol adresi hiçbir kural tarafından engellenmemeli
    if (kural === 'KONTROL') {
      if (a === 'gecildi') {
        return { yorum: 'beklendigi gibi gecti', cls: 'ok', kontrol: true, sayac: 0 };
      }
      return {
        yorum: 'KONTROL BOZUK - engellenmemeliydi',
        cls: 'bad', kontrol: true, bozukKontrol: true, sayac: 0
      };
    }

    // Kurallar açıkken GEÇEBİLDİ → kesinlikle engellenmemiş
    if (a === 'gecildi') {
      return { yorum: 'KURAL CALISMIYOR (acikken gecti)', cls: 'bad', sayac: 0 };
    }

    const engellendiMi = (a === 'hata-aninda');
    const kontrolDigeri = (k === 'gecildi' || k === 'hata-yavas');

    // Ana kanıt: açıkken anında çöktü, kapalıyken normal davrandı
    if (engellendiMi && kontrolDigeri) {
      return { yorum: 'KURAL CALISIYOR', cls: 'ok', sayac: 1 };
    }

    // Açıkken de yavaş hata → bu bir ağ hatası, engelleme değil
    if (a === 'hata-yavas' && k === 'hata-yavas') {
      return {
        yorum: 'KURAL CALISMIYOR (ikisinde de yavas a hatasi)',
        cls: 'bad', sayac: 0
      };
    }

    return { yorum: 'belirsiz', cls: 'warn', sayac: 0 };
  }

  function classifyNetResult(tests, acikMap, kapaliMap) {
    const rows = [];
    let calisan = 0;
    let belirsiz = 0;
    let kontrolBozuk = false;
    let olcumVar = 0;

    tests.forEach(function (t) {
      const a = acikMap[t.url] || null;
      const k = kapaliMap[t.url] || null;
      const r = classifyOne(t.kural, a, k);

      if (!r.olcumYok) olcumVar++;
      calisan += r.sayac;
      if (!r.kontrol && r.cls !== 'ok') belirsiz++;
      if (r.bozukKontrol) kontrolBozuk = true;

      const ams = (a && typeof a.ms === 'number') ? a.ms + 'ms' : '?';
      const kms = (k && typeof k.ms === 'number') ? k.ms + 'ms' : '?';

      rows.push({
        url: t.url,
        kural: t.kural,
        yorum: r.yorum,
        cls: r.cls,
        acik: (a && a.sonuc) || '(bilinmiyor)',
        kapali: (k && k.sonuc) || '(bilinmiyor)',
        metin: r.yorum + ' | acik: ' + ((a && a.sonuc) || '?') + ' (' + ams + ')'
          + ' | kapali: ' + ((k && k.sonuc) || '?') + ' (' + kms + ')'
      });
    });

    let ozet;
    if (olcumVar === 0) {
      // EN ÖNEMLİ DAL: hiç ölçüm yokken "kurallar her şeyi kesiyor"
      // gibi bir yorum ÜRETME. Bu, kullanıcıya anlamsız panik yaratır.
      ozet = 'Hicbir olcum alinamadi, bu yuzden hicbir sonuc cikarilmadi. ' +
        'Testi yeniden calistirmayi dene (Sayfayi Ctrl+Shift+R ile yenileyip tekrar Tara).';
    } else if (kontrolBozuk) {
      ozet = 'Sonuc guvenilmez: kontrol adresi engellendi. Kural seti tum sayfa ' +
        'isteklerini kesiyor demektir.';
    } else if (calisan === 0) {
      ozet = 'Hicbir kural kanitlanmadi. Ag katmani etkisiz; engelleme yalnizca ' +
        'veri budama ve kozmetik filtrelerden geliyor.';
    } else if (belirsiz === 0) {
      ozet = 'Ag katmani calisiyor ve test edilen ' + calisan + ' kuralin hepsi ' +
        'dogrulandi. YouTube bir adresi degistirdiginde bu test "calismiyor" diyecek.';
    } else {
      ozet = 'Ag katmani calisiyor (' + calisan + ' kural dogrulandi), ancak ' +
        belirsiz + ' adres belirsiz — bunlar ag hatasi nedeniyle her iki turda da ' +
        'basarisiz oldu, kirildi kaniti yoktur.';
    }

    return {
      rows: rows,
      calisan: calisan,
      belirsiz: belirsiz,
      olcumVar: olcumVar,
      kontrolBozuk: kontrolBozuk,
      ozet: ozet,
      baslik: olcumVar === 0
        ? 'Sonuc cikarilamadi (olcum yok)'
        : (calisan + ' kural kanitlandi, ' + belirsiz + ' belirsiz')
    };
  }

  const api = {
    classifyNetResult: classifyNetResult,
    classifyOne: classifyOne,
    passed: passed,
    isUnknown: isUnknown,
    durum: durum,
    BLOCK_FAST_MS: BLOCK_FAST_MS
  };
  globalThis.FDNetVerdict = api;
  if (typeof window !== 'undefined') window.FDNetVerdict = api;
})();
