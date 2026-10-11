/* =====================================================================
   FD Reklam Engelleyici — diag.js
   ---------------------------------------------------------------------
   Aktif YouTube sekmesini chrome.scripting ile ANA DÜNYAYA gönderip
   eklentinin durumunu okur. Konsola kod yapıştırmaya gerek kalmaz.
   ===================================================================== */
'use strict';

const elRun = document.getElementById('run');
const elCopy = document.getElementById('copy');
const elOut = document.getElementById('out');
const elVerdict = document.getElementById('verdict');
const elTabList = document.getElementById('tablist');
const elTabEmpty = document.getElementById('tabempty');

let lastReport = null;
let lastNetTest = null;
let selectedTabId = null;
let youtubeTabs = [];          // listelenen YouTube sekmeleri

const YT_PATTERNS = ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'];

/* ---------------------------------------------------------------------
   Sayfada çalışan prob fonksiyonu.
   executeScript ile serileştirilir, bu yüzden KAPALI olmalı —
   hiçbir dış değişkene erişemez.
   --------------------------------------------------------------------- */
function probe() {
  const out = { ok: false, url: location.href, layers: {}, prune: {}, detect: {}, visible: [], supheli: [], player: {}, net: {} };

  // --- Sayfa tipi ---
  // Her yüzeyin beklentisi farklıdır. Shorts'ta oynatıcı yanıtı genelde
  // yoktur; gömülü videoda oynatıcı yapısı farklıdır. Yanlış beklenti
  // kurmak, çalışan bir katmanı "bozuk" diye raporlamak demektir.
  const yol = location.pathname;
  let tip = 'diger';
  if (yol.indexOf('/shorts/') === 0) tip = 'shorts';
  else if (yol.indexOf('/embed/') === 0) tip = 'embed';
  else if (yol.indexOf('/live/') === 0) tip = 'canli';
  else if (yol.indexOf('/watch') === 0) tip = 'watch';
  else if (yol === '/' || yol.indexOf('/feed/') === 0) tip = 'ana';
  else if (yol.indexOf('/results') === 0) tip = 'arama';
  else if (yol.indexOf('/@') === 0 || yol.indexOf('/channel/') === 0) tip = 'kanal';
  out.sayfa = { tip: tip };

  // Bu yüzeyde oynatıcı yanıtı bulunması bekleniyor mu?
  const yanitBeklenir = (tip !== 'shorts' && tip !== 'ana' && tip !== 'arama' && tip !== 'kanal');
  out.sayfa.yanitBeklenir = yanitBeklenir;

  // --- 1. Eklenti katmanları ---
  const root = document.documentElement;
  const fd = window.__FD;

  out.layers.fdYuklu = !!fd;
  out.layers.hazir = root.getAttribute('data-fd-ready');
  out.layers.kapali = root.getAttribute('data-fd-off') === '1';
  out.layers.strateji = root.getAttribute('data-fd-strategy') || '(yok)';
  out.layers.fetchHook = !!(fd && fd.hooked && fd.hooked.fetch);
  out.layers.jsonHook = JSON.parse && JSON.parse.name === 'hookedParse';
  out.layers.kozmetikStil = document.querySelectorAll('style[id^="fd-cosmetic-"]').length;

  // --- 2. Veri budama durumu ---
  // SPA geçişlerinde window.ytInitialPlayerResponse BAYATLANIR: yeni
  // videoya geçseniz de eski videonun yanıtını tutar. Bu yüzden iki
  // kaynak karşılaştırılır; videoId'ler çelişiyorsa TAZE olan seçilir.
  const pr = window.ytInitialPlayerResponse;
  const raw = window.ytplayer && window.ytplayer.config
    ? window.ytplayer.config.args && window.ytplayer.config.args.raw_player_response
    : null;
  const bilgi = fd && fd.lastPlayerInfo;

  const sayfaId = (pr && pr.videoDetails && pr.videoDetails.videoId) || null;
  const kayitId = bilgi ? bilgi.videoId : null;

  let kaynak = null;
  let uyusmazlik = false;

  if (pr && kayitId && sayfaId && kayitId !== sayfaId && kayitId !== '(yok)') {
    // Çelişki var: kayıt daha yeni (daha önce görülmüş en son yanıt)
    kaynak = 'budama kaydi';
    uyusmazlik = true;
  } else if (pr) {
    kaynak = 'ytInitialPlayerResponse';
  } else if (raw) {
    kaynak = 'ytplayer.config';
  } else if (bilgi) {
    kaynak = 'budama kaydi';
  }

  out.prune.kaynak = kaynak || 'bulunamadi';
  out.prune.bulundu = !!kaynak;
  out.prune.sayfaVideoId = sayfaId || '(bilinmiyor)';
  out.prune.kayitVideoId = kayitId || '(yok)';
  out.prune.uyusmazlik = uyusmazlik;

  if (pr || raw) {
    const src = pr || raw;
    const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
    const durum = (k) => {
      if (!has(src, k)) return 'YOK';
      const v = src[k];
      if (Array.isArray(v)) return v.length ? 'var (' + v.length + ')' : 'var (bos)';
      return 'var';
    };
    // Kaynak budama kaydıysa ÖNCELİKLE ondan oku
    if (bilgi) {
      out.prune.adPlacements = bilgi.adPlacements;
      out.prune.playerAds = bilgi.playerAds;
      out.prune.adSlots = bilgi.adSlots;
      out.prune.enforcement = bilgi.enforcement;
      out.prune.videoId = bilgi.videoId;
      if (bilgi.at) out.prune.yas = Math.round((Date.now() - bilgi.at) / 1000) + ' sn once';
    } else {
      out.prune.adPlacements = durum('adPlacements');
      out.prune.playerAds = durum('playerAds');
      out.prune.adSlots = durum('adSlots');
      out.prune.enforcement = has(src, 'enforcementMessageViewModel') ? 'VAR' : 'yok';
      out.prune.videoId = (src.videoDetails && src.videoDetails.videoId) || '(yok)';
    }
  } else if (bilgi) {
    out.prune.adPlacements = bilgi.adPlacements;
    out.prune.playerAds = bilgi.playerAds;
    out.prune.adSlots = bilgi.adSlots;
    out.prune.enforcement = bilgi.enforcement;
    out.prune.videoId = bilgi.videoId;
    out.prune.yas = bilgi.at ? Math.round((Date.now() - bilgi.at) / 1000) + ' sn once' : '';
  }

  // --- 3. Tespit sinyalleri ---
  out.detect.googletag = typeof window.googletag !== 'undefined'
    ? (window.googletag.__fdShim ? 'sahte (bizim)' : 'gercek')
    : 'YOK - tespit riski';
  out.detect.hasAllowedInstreamAd = String(Object.prototype.hasAllowedInstreamAd);
  out.detect.adBlockPopup = !!document.querySelector(
    'ytd-popup-container tp-yt-paper-dialog:has(ytd-upsell-dialog-renderer), ytd-popup-container tp-yt-paper-dialog:has(yt-mealbar-promo-renderer)'
  );
  out.detect.premiumSatis = !!document.querySelector(
    'yt-mealbar-promo-renderer, ytd-upsell-dialog-renderer, .ytp-premium-upsell'
  );
  out.detect.enforcementViewModel = !!(
    window.yt && window.yt.config_ && window.yt.config_.openPopupConfig &&
    window.yt.config_.openPopupConfig.supportedPopups &&
    window.yt.config_.openPopupConfig.supportedPopups.adBlockMessageViewModel
  );

  // --- 4. Görünür kalan reklam öğeleri ---
  const sels = [
    '.video-ads', 'ytd-ad-slot-renderer', '#masthead-ad', 'ytd-display-ad-renderer',
    '.ytp-ad-overlay-slot', 'ytd-in-feed-ad-layout-renderer', 'ytd-promoted-sparkles-web-renderer',
    'ytd-engagement-panel-section-list-renderer[target-id*="ads"]',
    'ytd-companion-slot-renderer', '.ytp-ad-module'
  ];
  const found = {};
  for (const s of sels) {
    let n = 0;
    try { document.querySelectorAll(s).forEach((e) => { if (e.offsetParent !== null) n++; }); } catch (e) {}
    if (n) found[s] = n;
  }
  out.visible = found;

  // --- Genel şüpheli reklam taraması ---
  // Bilinen seçicilerimiz İZLEME sayfasına göre yazıldı. Shorts ve
  // gömülü video tamamen farklı bir DOM kullanır; onlarda bir reklam
  // sıksa mevcut seçicilerimiz onu GÖREMEZ ve "sıfır sızıntı" deriz —
  // bu sessiz bir yanlış güvence olurdu.
  //
  // Bu yüzden ayrıca oynatıcı kapsayıcısı içinde "reklam gibi görünen"
  // her görünür öğe aranır. Sınıf adı reklam kalıplarıyla eşleşmeli.
  const AD_CISI = /(^|[\s\-_])(ad|ads|advert\w*|adshow\w*|adsense\w*|promo\w*)([\s\-_]|$)/i;
  const KAPSAYICI = [
    '#movie_player', 'ytd-player', '#shorts-player', 'shorts-player',
    'ytd-reel-video-renderer', '#shorts-inner-container', 'ytd-watch-flexy',
    '#player-container', 'ytd-inline-player-renderer', 'ytd-player-container'
  ].join(',');

  try {
    const kap = [];
    KAPSAYICI.split(',').forEach((sel) => {
      try { document.querySelectorAll(sel).forEach((n) => { if (kap.indexOf(n) === -1) kap.push(n); }); } catch (e) {}
    });

    const gorulen = {};
    const limit = 4000;
    let sayilan = 0;

    kap.forEach((kapsayici) => {
      if (sayilan > limit) return;
      const tum = kapsayici.querySelectorAll('*');
      for (let i = 0; i < tum.length && sayilan < limit; i++) {
        const el = tum[i];
        sayilan++;
        // Gizli öğeleri atla (görünür olan ilgilidir)
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) continue;   // minik dekoratif öğeleri yoksay

        const sinif = (typeof el.className === 'string' ? el.className : '') || '';
        const id = el.id || '';
        if (!AD_CISI.test(sinif) && !AD_CISI.test(id)) continue;

        // --- Yanlış pozitif filtresi ---
        // YouTube oynatıcı KAPASAYICISININ kendisine de reklamla ilgili
        // sınıflar ekliyor (ytp-ad-module vb.). Ilk sürüm bunu "şüpheli
        // reklam" saydı ve HER izleme sayfasında oynatıcının kendisini
        // bildiriyordu — gürültü.
        //
        // Ayırıcı ilke: reklam yuvası oynatıcının İÇİNDE ayrı bir katman
        // olarak durur ve kendi video öğesi YOKTUR. Gerçek video öğesi
        // içeren her şey oynatıcının kendisidir (ya da onun bir parçası).
        try {
          if (el.querySelector('video')) continue;
        } catch (e) {}
        if (id === 'movie_player' || id === 'shorts-player' ||
            id === 'player-container' || id === 'shorts-inner-container') continue;
        if (/html5-video-player/.test(sinif)) continue;

        // Oynatıcı boyutuna yakın öğeler muhtemelen kaplama katmanıdır.
        try {
          if (r.width >= kapsayici.clientWidth * 0.92 &&
              r.height >= kapsayici.clientHeight * 0.92) continue;
        } catch (e) {}

        const anahtar = (el.tagName.toLowerCase() +
          (sinif ? '.' + sinif.trim().split(/\s+/).slice(0, 2).join('.') : '') +
          (id ? '#' + id : '')).slice(0, 90);

        if (!gorulen[anahtar]) {
          gorulen[anahtar] = {
            etiket: el.tagName.toLowerCase(),
            sinif: sinif.slice(0, 60) || id,
            boyut: Math.round(r.width) + 'x' + Math.round(r.height),
            metin: (el.innerText || '').trim().slice(0, 40)
          };
        }
      }
    });

    out.supheli = Object.keys(gorulen).slice(0, 12).map((k) => ({
        secici: k,
        sinif: gorulen[k].sinif,
        boyut: gorulen[k].boyut,
        metin: gorulen[k].metin
      }));
    out.supheliToplam = Object.keys(gorulen).length;
  } catch (e) {
    out.supheli = [];
    out.supheliToplam = 0;
  }

  // --- 5. Oynatıcı ---
  const v = document.querySelector('video');
  const p = document.getElementById('movie_player');
  if (v) {
    out.player.adShowing = !!(p && p.classList.contains('ad-showing'));
    out.player.hiz = v.playbackRate;
    out.player.sessiz = v.muted;
    out.player.sure = v.currentTime.toFixed(1) + '/' + (v.duration || 0).toFixed(1);
  } else {
    out.player.durum = 'video yok';
  }

  // --- 6. Ağ ---
  // ENGELLENEN istekler de resource timing kaydı üretebilir. Bu yüzden
  // her kayıt için durum/boyut bilgisi de toplanır: transferSize 0 ise
  // istek ağa hiç çıkmamış (DNR tarafından durdurulmuş) demektir.
  const adRe = /doubleclick|googlesyndication|\/pagead\/|ad_break|\/api\/stats\/ads|\/ptracking|googleadservices|2mdn/;
  const details = [];
  try {
    const entries = performance.getEntriesByType('resource');
    for (const e of entries) {
      if (!adRe.test(e.name)) continue;
      details.push({
        url: e.name.slice(0, 90),
        status: e.responseStatus || 0,
        transfer: e.transferSize || 0,
        encoded: e.encodedBodySize || 0,
        initiator: e.initiatorType || '?',
        ms: Math.round(e.duration || 0)
      });
    }
  } catch (e) {}

  out.net.toplamKayit = details.length;
  out.net.gercektenGecti = details.filter((d) => d.transfer > 0).length;
  out.net.engellendi = details.filter((d) => d.transfer === 0).length;
  // EN ÖNEMLİ ÖNCE: sızanlar raporun başında görünsün
  details.sort(function (a, b) { return (b.transfer - a.transfer) || (b.ms - a.ms); });
  out.net.ornekler = details.slice(0, 12);
  out.net.aciklama = 'transfer>0 ağa çıkmıştır, transfer=0 durdurulmuştur.';

  // Kontrol adresi: reklam deseniyle eşleşmez ama A/B testinin
  // geçerli olup olmadığını gösterir.
  try {
    const ctrl = performance.getEntriesByType('resource')
      .filter((e) => e.name.indexOf('robots.txt') !== -1);
    if (ctrl.length) {
      const c = ctrl[ctrl.length - 1];
      out.net.kontrol = (c.transferSize || 0) + 'B / status ' + (c.responseStatus || 0) +
        ' / ' + Math.round(c.duration || 0) + 'ms';
    } else {
      out.net.kontrol = '(kontrol isteği yapılmadı)';
    }
  } catch (e) {
    out.net.kontrol = '(okunamadı)';
  }

  // --- 7. Enjekte edilen kozmetik stiller ---
  out.layers.stilIdleri = Array.prototype.slice
    .call(document.querySelectorAll('style[id^="fd-cosmetic-"]'))
    .map((s) => s.id);

  // --- 8. Sayaçlar ---
  out.stats = (fd && fd.stats) || null;

  out.ok = true;
  return out;
}

/* ---------------------------------------------------------------------
   Yardımcılar
   --------------------------------------------------------------------- */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function renderCard(title, rows) {
  const card = el('div', 'card');
  card.appendChild(el('h2', null, title));
  for (const [k, v, cls] of rows) {
    const row = el('div', 'row');
    row.appendChild(el('span', 'k', k));
    row.appendChild(el('span', 'v ' + (cls || ''), v));
    card.appendChild(row);
  }
  return card;
}

const VERDICT = {
  ok: '<strong>Yalın.</strong> Tüm katmanlar yerinde, görünür reklam yok.',
  warn: '<strong>Kısmi.</strong> Bazı şeyler sızdı, aşağıya bak.',
  bad: '<strong>Sorun var.</strong> Eklenti çalışmıyor veya tespit edildi.',
  idle: 'Taramak için bir YouTube sekmesi açın, sonra <strong>Tara</strong>’ya basın.'
};

function status(s) {
  return ['ok', 'warn', 'bad'].includes(s) ? s : 'dim';
}

function render(r) {
  elOut.innerHTML = '';
  elVerdict.className = 'verdict';

  if (!r.ok) { elVerdict.textContent = VERDICT.idle; return; }

  // --- karar ---
  const problems = [];

  // Ayar ile sayfa durumu çelişiyor mu? (ölçümde en sık karışan nokta)
  if (r.ayar && r.ayar.okur && r.layers && typeof r.ayar.enabled === 'boolean') {
    if (r.ayar.enabled === !!r.layers.kapali) {
      problems.push('AYAR ile SAYFA uyuşmuyor: ayar ' +
        (r.ayar.enabled ? 'açık' : 'kapalı') + ', sayfa ' +
        (r.layers.kapali ? 'kapalı' : 'açık') + '. YouTube sekmesini Ctrl+Shift+R ile yenile.');
    }
  }

  if (r.layers.kapali) problems.push('Eklenti KAPALI.');
  if (!r.layers.fdYuklu) problems.push('Content script yüklenmemiş — eklentiyi yenileyip sayfayı yeniden yükle.');

  // Oynatıcı yanıtının varlığı YÜZEYE BAĞLIDIR. Shorts/ana sayfa/
  // arama sayfalarında yanıt gelmez ve bu NORMALDİR; "hata" diye
  // raporlamak yanlış alarm olurdu.
  if (!r.prune.bulundu && r.sayfa && r.sayfa.yanitBeklenir) {
    problems.push('Oynatıcı yanıtı hiç yakalanamadı — budama ölçülemiyor.');
  }

  // Genel tarama: bilinen seçicilerimiz dışında kalan reklam kutusu var mı
  if (r.supheliToplam > 0) {
    problems.push('Oynatıcı içinde ' + r.supheliToplam +
      ' "reklam gibi görünen" öğe bulundu (bilinen seçiciler dışında).');
  }
  if (r.prune.bulundu && r.prune.uyusmazlik) {
    problems.push('Ölçülen video ile sayfadaki video farklı (bayat oynatıcı yanıtı). Sayfayı yenile.');
  }
  if (r.prune.bulundu && r.prune.kaynak === 'budama kaydi') {
    problems.push('Yanıt yalnızca budama kaydından okundu. Tam doğrulama için sayfayı Ctrl+Shift+R ile yenile.');
  }
  if (r.layers.kozmetikStil === 0 && !r.layers.kapali) problems.push('Kozmetik stiller enjekte edilmemiş.');

  if (r.ayar && r.ayar.okur && Array.isArray(r.ayar.kapaliGrup) && r.ayar.kapaliGrup.length) {
    problems.push('Kapatılmış temizlik grupları: ' + r.ayar.kapaliGrup.join(', '));
  }

  if (r.detect.googletag === 'YOK - tespit riski') problems.push('googletag yok.');
  if (r.detect.enforcementViewModel) problems.push('YouTube reklam-engelleyici uyarısını tetikledi.');
  if (r.detect.adBlockPopup) problems.push('Açık uyarı penceresi var.');
  if (Object.keys(r.visible).length) problems.push(Object.keys(r.visible).length + ' tür reklam hâlâ görünür.');

  // Önemli olan "kaç kayıt var" değil, "kaçı GERÇEKTEN ağa çıktı"
  if (r.net.gercektenGecti > 0) {
    problems.push(r.net.gercektenGecti + ' reklam isteği ağa çıktı (engellenemedi).');
  }

  if (!problems.length) {
    elVerdict.classList.add('ok');
    elVerdict.innerHTML = VERDICT.ok;
  } else if (problems.length <= 2) {
    elVerdict.classList.add('warn');
    elVerdict.innerHTML = '<strong>Kısmi engelleme.</strong> ' + problems.map(escapeHtml).join(' ');
  } else {
    elVerdict.classList.add('bad');
    elVerdict.innerHTML = '<strong>' + problems.length + ' sorun:</strong> ' + problems.map(escapeHtml).join(' ');
  }

  // --- kartlar ---
  elOut.appendChild(renderCard('1 · Eklenti katmanları', [
    ['Ana dünya scriptleri', r.layers.fdYuklu ? 'yüklü' : 'YOK', status(r.layers.fdYuklu ? 'ok' : 'bad')],
    ['Sayfa kendi durumu', r.layers.kapali ? 'KAPALI' : 'açık', status(r.layers.kapali ? 'bad' : 'ok')],
    ['Depolanan ayar', !r.ayar ? '?' : (r.ayar.okur ? (r.ayar.enabled ? 'açık' : 'kapalı') : 'okunamadı'),
      (r.ayar && r.ayar.okur) ? status(r.ayar.enabled ? 'ok' : 'bad') : 'warn'],
    ['Strateji (sayfa / ayar)', r.layers.strateji + (r.ayar && r.ayar.strateji ? ' / ' + r.ayar.strateji : ''), 'dim'],
    ['fetch kancası', r.layers.fetchHook ? 'kurulu' : 'yok', status(r.layers.fetchHook ? 'ok' : 'bad')],
    ['JSON.parse kancası', r.layers.jsonHook ? 'kurulu' : 'yok', status(r.layers.jsonHook ? 'ok' : 'bad')],
    ['Kozmetik stil sayısı', String(r.layers.kozmetikStil),
      status(r.layers.kozmetikStil > 0 ? 'ok' : 'bad')],
    ['Enjekte edilen gruplar', (r.layers.stilIdleri && r.layers.stilIdleri.length)
      ? r.layers.stilIdleri.join(', ') : '(yok)', 'dim'],
    ['Açık temizlik grubu (ayar)', r.ayar && r.ayar.acikGrup && r.ayar.acikGrup.length
      ? r.ayar.acikGrup.join(', ') : '(yok)', 'dim'],
    ['Kapalı temizlik grubu (ayar)', r.ayar && r.ayar.kapaliGrup && r.ayar.kapaliGrup.length
      ? r.ayar.kapaliGrup.join(', ') : '(hepsi açık)',
      (r.ayar && r.ayar.kapaliGrup && r.ayar.kapaliGrup.length) ? 'warn' : 'ok'],
    ['Kendi kuralınız', r.ayar && r.ayar.kullaniciKurali !== undefined
      ? String(r.ayar.kullaniciKurali) : '?', 'dim']
  ]));

  // --- Sayfa tipi ---
  if (r.sayfa) {
    const TIP_AD = {
      watch: 'İzleme sayfası', shorts: 'Shorts', embed: 'Gömülü video',
      canli: 'Canlı yayın', ana: 'Ana sayfa', arama: 'Arama sonuçları',
      kanal: 'Kanal sayfası', diger: 'Diğer'
    };
    elOut.appendChild(renderCard('0 · Yüzey', [
      ['Sayfa tipi', TIP_AD[r.sayfa.tip] || r.sayfa.tip, 'dim'],
      ['Oynatıcı yanıtı bekleniyor mu', r.sayfa.yanitBeklenir ? 'evet' : 'hayır (bu yüzeyde normal)',
        r.sayfa.yanitBeklenir ? 'ok' : 'dim'],
      ['Şüpheli reklam öğesi (genel tarama)', String(r.supheliToplam || 0),
        r.supheliToplam ? 'bad' : 'ok']
    ]));
  }

  const pruneRows = [];
  if (r.prune.bulundu) {
    pruneRows.push(
      ['Kaynak', r.prune.kaynak,
        r.prune.kaynak === 'budama kaydi' ? 'warn' : 'ok'],
      ['Ölçülen videoId', r.prune.videoId, 'dim'],
      ['Sayfadaki videoId', r.prune.sayfaVideoId || '(bilinmiyor)', 'dim'],
      ['adPlacements', r.prune.adPlacements,
        r.prune.adPlacements === 'YOK' ? 'warn' : 'ok'],
      ['playerAds', r.prune.playerAds, r.prune.playerAds === 'YOK' ? 'ok' : 'warn'],
      ['adSlots', r.prune.adSlots, r.prune.adSlots === 'YOK' ? 'ok' : 'warn'],
      ['enforcement mesajı', r.prune.enforcement,
        String(r.prune.enforcement).indexOf('VAR') === 0 ? 'bad' : 'ok']
    );
    if (r.prune.yas) pruneRows.push(['Kayıt yaşı', r.prune.yas, 'dim']);
  } else {
    pruneRows.push(['Oynatıcı yanıtı', 'bulunamadı', 'bad']);
  }
  elOut.appendChild(renderCard('2 · Veri budama', pruneRows));

  if (r.prune.uyusmazlik) {
    elOut.appendChild(el('p', 'dim',
      'Sayfadaki video ile ölçülen video FARKLI. Global oynatıcı yanıtı bayatlamış ' +
      '(SPA geçişi); taze kayıt kullanıldı. Tam doğrulama için sayfayı Ctrl+Shift+R ile yenile.'));
  }

  elOut.appendChild(renderCard('3 · Tespit sinyalleri', [
    ['googletag', r.detect.googletag, status(r.detect.googletag === 'YOK - tespit riski' ? 'warn' : 'ok')],
    ['hasAllowedInstreamAd', r.detect.hasAllowedInstreamAd, 'dim'],
    ['enforcementViewModel tetiklendi mi', r.detect.enforcementViewModel ? 'EVET' : 'hayır',
      status(r.detect.enforcementViewModel ? 'bad' : 'ok')],
    ['Açık uyarı penceresi', r.detect.adBlockPopup ? 'VAR' : 'yok',
      status(r.detect.adBlockPopup ? 'bad' : 'ok')],
    ['Premium satış öğesi', r.detect.premiumSatis ? 'görünüyor' : 'gizli',
      status(r.detect.premiumSatis ? 'warn' : 'ok')]
  ]));

  const visRows = Object.keys(r.visible).length
    ? Object.entries(r.visible).map(([k, v]) => [k, v + ' adet görünür', 'bad'])
    : [['Görünür reklam öğesi', 'yok', 'ok']];
  elOut.appendChild(renderCard('4 · Sızan reklamlar', visRows));

  const playerRows = r.player.durum
    ? [['Oynatıcı', r.player.durum, 'warn']]
    : [
      ['ad-showing sınıfı', r.player.adShowing ? 'EVET — reklam oynuyor' : 'hayır',
        status(r.player.adShowing ? 'bad' : 'ok')],
      ['Oynatma hızı', r.player.hiz + 'x', r.player.hiz > 2 ? 'warn' : 'dim'],
      ['Sessiz', String(r.player.sessiz), 'dim'],
      ['Süre', r.player.sure, 'dim']
    ];
  elOut.appendChild(renderCard('5 · Oynatıcı', playerRows));

  elOut.appendChild(renderCard('6 · Ağ (sayfa tarafı)', [
    ['Toplam kayıt', String(r.net.toplamKayit), 'dim'],
    ['GERÇEKTEN ağa çıkan', String(r.net.gercektenGecti),
      status(r.net.gercektenGecti ? 'bad' : 'ok')],
    ['transfer=0 (durdurulmuş görünen)', String(r.net.engellendi),
      status(r.net.engellendi ? 'ok' : 'dim')],
    ['Kontrol adresi (robots.txt)', r.net.kontrol || '(yok)', 'dim']
  ]));

  // --- Şüpheli reklam öğeleri (bilinen seçiciler dışında) ---
  // Shorts ve gömülü video bize yepyeni bir test alanı. Bilinen
  // seçicilerimiz oraya uymayabilir; bu tarama onu yakalar.
  if (r.supheli && r.supheli.length) {
    const card = el('div', 'card');
    card.appendChild(el('h2', null, 'Şüpheli reklam öğeleri — ' +
      escapeHtml('bilinen seçicilerimiz dışında kalanlar')));
    const list = el('div');
    r.supheli.forEach((x) => {
      const row = el('div', 'row');
      row.appendChild(el('span', 'k',
        (x.sinif || '(sınıf yok)') + '  ·  ' + x.boyut +
        (x.metin ? '  ·  ' + x.metin : '')));
      row.appendChild(el('span', 'v warn', 'gizlemek için sağ tık kullan'));
      list.appendChild(row);
    });
    card.appendChild(list);
    card.appendChild(el('p', 'dim',
      'Bunlar kesin reklam değil, sadece "reklam gibi görünen" öğeler. ' +
      'Gerçekten reklamsa: öğeye sağ tıkla ve "FD: Bu öğeyi engelle" seç.'));
    elOut.appendChild(card);
  }

  // --- Güncel sayaç ---
  if (r.sayac) {
    const s = r.sayac;
    const pageAds = (r.stats && r.stats.ads) || 0;
    const bgAds = s.ads || 0;

    // DİKKAT: bu iki sayı FARKLI pencereleri ölçer, karşılaştırılamaz:
    //   sayfa içi = yalnızca BU sayfa yüklemesinde budanan reklam
    //   arka plan = tarayıcı OTURUMU boyunca biriken toplam
    // Bu yüzden "sapma" kontrolü YAPILMAZ (elma ile armudu karşılaştırmak
    // normal durumlarda yanlış alarm üretiyordu). Yalnızca gerçek arıza
    // yakalanır: arka plan hiç artmamışken sayfa içi artmışsa content
    // script kopmuş, yani bağlamı geçersizdir.
    const kopuk = pageAds > 0 && bgAds === 0;

    elOut.appendChild(renderCard('7 · Sayaçlar', [
      ['Budanan reklam — bu sayfa', String(pageAds), 'dim'],
      ['Budanan reklam — oturum toplamı', String(bgAds), kopuk ? 'warn' : 'dim'],
      ['Ağdan engellenen — bu sayfa', String(s.blocked || 0), 'ok'],
      ['API isteği işlendi — oturum', String(s.requests || 0), 'dim']
    ]));

    if (kopuk) {
      elOut.appendChild(el('p', 'dim',
        'Arka plan sayacı hiç artmamış. Genellikle şu demektir: eklenti yeniden ' +
        'yüklendikten sonra YouTube sekmesi hâlâ eski content script\'i taşıyor. ' +
        'YouTube sekmesini Ctrl+Shift+R ile yenile.'));
    } else if (pageAds > 0 && bgAds > 0) {
      elOut.appendChild(el('p', 'dim',
        'Not: "bu sayfa" yalnızca bu sayfa yüklemesini, "oturum toplamı" ise ' +
        'tarayıcı oturumunun tamamını kapsar. Aralarındaki fark normaldir.'));
    }
  }

  if (r.net.ornekler && r.net.ornekler.length) {
    const card = el('div', 'card');
    card.appendChild(el('h2', null, 'İstek dökümü — ' + escapeHtml(r.net.aciklama || '')));

    const list = el('div');
    r.net.ornekler.forEach((d) => {
      const cls = d.transfer > 0 ? 'bad' : 'ok';
      const sonuc = d.transfer > 0 ? 'AĞA ÇIKTI' : 'blok imzası';
      const row = el('div', 'row');
      const a = el('span', 'k', d.url);
      a.style.fontSize = '11.5px';
      const b = el('span', 'v ' + cls,
        sonuc + ' · ' + (d.transfer || 0) + 'B · status ' + (d.status || 0) +
        ' · ' + (d.ms || 0) + 'ms');
      b.style.fontSize = '11px';
      row.append(a, b);
      list.appendChild(row);
    });
    card.appendChild(list);
    card.appendChild(el('p', 'dim',
      'Blok imzası = transfer 0 + status 0 + çok kısa süre. ' +
      'Gerçek ağ hatası (DNS/TLS) genelde 100 ms üstündür, bu yüzden ikisi ayrışır. ' +
      'En güvenilir kanıt, aşağıdaki A/B testidir.'));
    elOut.appendChild(card);
  }

  if (r.stats) {
    elOut.appendChild(renderCard('8 · Yanıt yeniden kurma', [
      ['Budanan reklam (ads)', String(r.stats.ads), 'dim'],
      ['İşlenen API isteği', String(r.stats.requests), 'dim'],
      ['Yeniden kurulan yanıt', String(r.stats.rebuilt || 0), 'dim'],
      ['Devre dışı (off)', String(r.layers.kapali), 'dim']
    ]));
    if (r.stats.rebuilt > 0) {
      elOut.appendChild(el('p', 'dim',
        r.stats.rebuilt + ' API yanıtı yeniden kuruldu (içerik budandı). ' +
        'Bu sayı yüksekse oynatma sorunu çıkabilir: oynatıcı bu yanıtı okuyor.'));
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------------------------------------------------------------------
   Akış
   --------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   YouTube sekmelerini bul
   --------------------------------------------------------------------- */
async function listTabs() {
  let tabs = [];

  // 1) Doğrudan URL kalıbıyla sorgula
  try {
    tabs = await chrome.tabs.query({ url: YT_PATTERNS });
  } catch (e) {
    tabs = [];
  }

  // 2) Sonuç yoksa (izin kısıtı olabilir) tüm sekmeleri çek ve
  //    YouTube olanları elimizdeki izinle süz
  if (!tabs.length) {
    try {
      const all = await chrome.tabs.query({});
      tabs = all.filter((t) => t.url && YT_PATTERNS.some((p) => matchPattern(p, t.url)));
    } catch (e) {
      tabs = [];
    }
  }

  // En son kullanılan önce (lastAccess sırası ile)
  tabs.sort((a, b) => {
    const la = a.lastAccessed || 0;
    const lb = b.lastAccessed || 0;
    if (la !== lb) return lb - la;
    return (a.index || 0) - (b.index || 0);
  });

  youtubeTabs = tabs;
  renderTabs();
  return tabs;
}

function shortUrl(url) {
  if (!url) return '(adres okunamadı)';
  try {
    const u = new URL(url);
    const p = u.pathname + u.search;
    return (u.hostname.replace(/^www\./, '') + p).slice(0, 78);
  } catch (e) {
    return String(url).slice(0, 78);
  }
}

function renderTabs() {
  elTabList.innerHTML = '';
  elTabEmpty.style.display = youtubeTabs.length ? 'none' : 'block';

  // Seçili sekme kapandıysa ilkini seç
  if (selectedTabId && !youtubeTabs.some((t) => t.id === selectedTabId)) {
    selectedTabId = null;
  }
  if (!selectedTabId && youtubeTabs.length) selectedTabId = youtubeTabs[0].id;

  youtubeTabs.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'tabitem' + (t.id === selectedTabId ? ' sel' : '');
    item.tabIndex = 0;

    const fav = document.createElement('img');
    fav.className = 'fav';
    fav.alt = '';
    if (t.favIconUrl) fav.src = t.favIconUrl;
    else fav.style.visibility = 'hidden';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const t1 = document.createElement('div');
    t1.className = 't1';
    t1.textContent = t.title || '(başlıksız sekme)';
    const t2 = document.createElement('div');
    t2.className = 't2';
    t2.textContent = shortUrl(t.url);
    meta.append(t1, t2);

    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = t.active ? 'aktif' : (t.audible ? 'sesli' : '#' + (i + 1));

    item.append(fav, meta, pill);

    const pick = () => {
      selectedTabId = t.id;
      renderTabs();
      run();
    };
    item.addEventListener('click', pick);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
    });

    elTabList.appendChild(item);
  });
}

/* ---------------------------------------------------------------------
   Ağ katmanı probu
   ---------------------------------------------------------------------
   Verilen adreslere GET isteği atar ve sonucu döner. DNR kurallari
   acikken ve kapaliyken ayri ayri cagrilir; fark, hangi kuralin
   gercekten atesledigini kanitlar.
   executeScript ile serilestirilir: KAPALI fonksiyon olmali.
   --------------------------------------------------------------------- */
function netProbe(input) {
  const urls = (input && input.urls) || [];
  const timeout = (input && input.timeout) || 3000;

  // Kac kez denenecegi. Ag hatasinin suresi DEGISKENDIR (sicak DNS'te
  // 53 ms, soguk DNS'te 587 ms goruldu). Engelleme ise her zaman 0-2 ms.
  // Bir kez olcmek yaniltici olabiliyor; birkac kez olcup EN HIZLI
  // sonucu almak "bu adres gercekten 1-2 ms'de mi cokuyor?" sorusunu
  // kararli hale getirir.
  var PASSES = (input && input.passes) || 3;

  function once(u) {
    return new Promise(function (resolve) {
      let settled = false;
      const t0 = Date.now();
      const done = function (sonuc) {
        if (settled) return;
        settled = true;
        // SÜRE KRİTİK: DNR ağa hiç çıkmadığı için ~1-3 ms'de çöker.
        // Gerçek ağ hatası (DNS/TLS) genelde 100 ms'den uzun sürer.
        resolve({ url: u, sonuc: sonuc, ms: Date.now() - t0 });
      };

      let ctrl = null;
      try { ctrl = new AbortController(); } catch (e) {}

      const timer = setTimeout(function () {
        try { if (ctrl) ctrl.abort(); } catch (e) {}
        done('zaman asimi');
      }, timeout);

      fetch(u, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        clearTimeout(timer);
        done('gecildi (' + res.status + ')');
      }).catch(function (err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') return done('zaman asimi');
        const m = (err && err.message) || String(err);
        done('hata: ' + m.slice(0, 50));
      });
    });
  }

  function gecis() {
    return Promise.all(urls.map(once));
  }

  // Birden fazla gecis; her adres icin EN HIZLI sonuc saklanir.
  return new Promise(function (resolve) {
    var toplanan = {};
    var kalan = PASSES;

    function birlestir(sonuclar) {
      sonuclar.forEach(function (r) {
        var onceki = toplanan[r.url];
        // Daha hizliysa degistir. "gecildi" gorduysek onu da koru:
        // basarili bir istek her zaman kanittir.
        if (!onceki) {
          toplanan[r.url] = { url: r.url, sonuc: r.sonuc, ms: r.ms };
        } else if (onceki.sonuc.indexOf('gecildi') !== 0 && r.sonuc.indexOf('gecildi') === 0) {
          toplanan[r.url] = { url: r.url, sonuc: r.sonuc, ms: r.ms };
        } else if (onceki.sonuc.indexOf('gecildi') !== 0 && r.ms < onceki.ms) {
          toplanan[r.url] = { url: r.url, sonuc: r.sonuc, ms: r.ms };
        }
      });
    }

    function bitir() {
      if (--kalan > 0) return;
      resolve(urls.map(function (u) {
        return toplanan[u] || { url: u, sonuc: '(bilinmiyor)', ms: null };
      }));
    }

    for (var i = 0; i < PASSES; i++) {
      gecis().then(function (sonuclar) { birlestir(sonuclar); bitir(); }, bitir);
    }
  });
}

// Her adres hangi kuralı sınamak için var
const NET_TEST_URLS = [
  { url: 'https://googleads.g.doubleclick.net/pagead/id', kural: 'googleads.g' },
  { url: 'https://ad.doubleclick.net/', kural: 'doubleclick.net' },
  { url: 'https://pagead2.googlesyndication.com/pagead/render_ads.html', kural: 'googlesyndication' },
  { url: 'https://www.youtube.com/ptracking?html5=1&fd_test=1', kural: '/ptracking' },
  { url: 'https://www.youtube.com/pagead/fd_test=1', kural: '/pagead/' },
  { url: 'https://www.youtube.com/api/stats/ads?fd_test=1', kural: '/api/stats/ads' },
  { url: 'https://www.youtube.com/robots.txt', kural: 'KONTROL' }
];

function sendMsg(payload) {
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage(payload, function (res) {
      void chrome.runtime.lastError;
      resolve(res);
    });
  });
}

function probeInPage() {
  return new Promise(function (resolve, reject) {
    const args = [{
      urls: NET_TEST_URLS.map(function (t) { return t.url; }),
      timeout: 3000,
        passes: 3
    }];
    chrome.scripting.executeScript({
      target: { tabId: selectedTabId },
      world: 'MAIN',
      func: netProbe,
      args: args
    }, function (res) {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      const r = res && res[0] && res[0].result;
      if (!r) return reject(new Error('sayfadan yanıt alınamadı'));
      resolve(r);
    });
  });
}

async function runNetTest() {
  const btn = document.getElementById('netTest');
  const box = document.getElementById('netResult');
  const urls = NET_TEST_URLS.map(function (t) { return t.url; });

  if (!selectedTabId) {
    box.innerHTML = '<p class="dim">Once bir YouTube sekmesi secin.</p>';
    return;
  }

  btn.disabled = true;
  box.innerHTML = '';
  const progress = document.createElement('p');
  progress.className = 'dim';
  progress.textContent = '1/2 tur: kurallar acik...';
  box.appendChild(progress);

  try {
    // --- Tur 1: kurallar ACIK ---
    await sendMsg({ type: 'fd:setNetEnabled', enable: true });
    const r1 = await probeInPage();

    // --- Tur 2: kurallar KAPALI ---
    progress.textContent = '2/2 tur: kurallar kapali (karsilastirma)...';
    await sendMsg({ type: 'fd:setNetEnabled', enable: false });
    const r2 = await probeInPage();

    // --- HAYATI ONEMLI: kurallari geri ac ---
    await sendMsg({ type: 'fd:setNetEnabled', enable: true });
    await refreshNetState();

    // DİKKAT: karar mantığı SÜREYE ihtiyaç duyuyor, bu yüzden düz metin
    // değil { sonuc, ms } NESNELERİ aktarılmalı. Düz metin geçirilirse
    // tüm ölçümler "bilinmiyor" olur ve test hiç sonuç üretemez.
    const m1 = {};
    r1.forEach(function (r) { m1[r.url] = { sonuc: r.sonuc, ms: r.ms }; });
    const m2 = {};
    r2.forEach(function (r) { m2[r.url] = { sonuc: r.sonuc, ms: r.ms }; });

    lastNetTest = {
      tur1_kurallarAcik: m1,
      tur2_kurallarKapali: m2,
      sonuc: null
    };

    renderNetResult(m1, m2);
  } catch (e) {
    // Hata olsa bile kurallari ACIK birak
    try { await sendMsg({ type: 'fd:setNetEnabled', enable: true }); } catch (e2) {}
    await refreshNetState();
    box.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'dim';
    p.style.color = 'var(--bad)';
    p.textContent = 'Test hatasi: ' + (e.message || e);
    box.appendChild(p);
  } finally {
    btn.disabled = false;
  }
}

function renderNetResult(acikMap, kapaliMap) {
  const box = document.getElementById('netResult');
  box.innerHTML = '';

  // Karar mantigi saf modulde (net-verdict.js) — test edilebilir olsun diye
  const v = window.FDNetVerdict.classifyNetResult(NET_TEST_URLS, acikMap, kapaliMap);

  // Kopyalanan rapora da girsin
  if (lastNetTest) lastNetTest.sonuc = v;

  const card = el('div', 'nettable');
  const head = el('div', 'row');
  head.appendChild(el('span', 'k', '<strong>' + v.baslik + '</strong>'));
  card.appendChild(head);

  v.rows.forEach(function (r) {
    const row = el('div', 'row');
    row.appendChild(el('span', 'k', r.url));
    row.appendChild(el('span', 'v ' + r.cls, r.metin));
    card.appendChild(row);
  });
  box.appendChild(card);
  box.appendChild(el('p', 'dim', v.ozet));
}

let ruleCountCache = 0;

async function refreshNetState() {
  const st = await sendMsg({ type: 'fd:getNetState' });
  const elState = document.getElementById('netState');
  const btn = document.getElementById('netToggle');

  if (!st || !st.ok) {
    elState.textContent = 'kurallar: okunamadi';
    elState.className = 'netstate';
    return;
  }

  // 0 SAYISINI SAKLAMA. Ruleset yeniden yuklenirken getRules() geçici
  // olarak bos donabiliyor; 0'i kalici saymak "0 kural AKTIF" gibi
  // yanlitis bir mesaj uretiyordu. 0 gorulursen tekrar dene.
  if (!ruleCountCache) {
    const r = await sendMsg({ type: 'fd:getRules' });
    const adet = (r && r.adet) || 0;
    if (adet > 0) {
      ruleCountCache = adet;
      if (r && r.kurallar) renderRuleList(r.kurallar);
    } else {
      // bir kez daha dene, hâlâ boşsa sayıyı bilinmiyor olarak göster
      const r2 = await sendMsg({ type: 'fd:getRules' });
      const adet2 = (r2 && r2.adet) || 0;
      if (adet2 > 0) {
        ruleCountCache = adet2;
        if (r2 && r2.kurallar) renderRuleList(r2.kurallar);
      }
    }
  }

  if (st.aktif) {
    elState.textContent = ruleCountCache
      ? 'DNR kurallari: ' + ruleCountCache + ' kural AKTIF'
      : 'DNR kurallari: AKTIF (kural sayisi okunamadi)';
    elState.className = 'netstate on';
  } else {
    elState.textContent = 'DNR kurallari: KAPALI';
    elState.className = 'netstate off';
  }
  btn.textContent = st.aktif ? 'Kurallari kapat' : 'Kurallari ac';
}

function renderRuleList(rules) {
  const box = document.getElementById('rulesBox');
  box.innerHTML = '';
  const sum = document.createElement('summary');
  sum.textContent = 'Yuklu ' + rules.length + ' kurali listele';
  box.appendChild(sum);

  const pre = document.createElement('pre');
  pre.textContent = rules.map(function (r) {
    return '#' + r.id + '  oncelik' + r.oncelik + '  ' + r.tip + '  ' + r.filtre;
  }).join('\n');
  box.appendChild(pre);
}

document.getElementById('netTest').addEventListener('click', runNetTest);

// --- URL kutusu: gömülü video gibi açılması zor yüzeyleri tek tıkla aç ---
document.getElementById('urlOpen').addEventListener('click', () => {
  const el = document.getElementById('urlInput');
  let u = (el.value || '').trim();
  if (!u) { el.focus(); return; }
  if (u.indexOf('youtube.com/embed/') === -1 &&
      u.indexOf('youtube.com/watch') === -1 &&
      u.indexOf('youtube.com/shorts/') === -1 &&
      u.indexOf('youtube.com/live/') === -1) {
    u = 'https://www.youtube.com/embed/' + u.replace(/.*\//, '');
  }
  if (u.indexOf('http') !== 0) u = 'https://' + u;
  chrome.tabs.create({ url: u, active: true });
  // yeni sekme listeye düşsün diye kısa bir bekleyip yenile
  setTimeout(listTabs, 1200);
});
document.getElementById('urlInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('urlOpen').click();
});

document.getElementById('netToggle').addEventListener('click', async function () {
  const st = await sendMsg({ type: 'fd:getNetState' });
  if (!st || !st.ok) return;
  await sendMsg({ type: 'fd:setNetEnabled', enable: !st.aktif });
  await refreshNetState();
});

refreshNetState();

async function readPrefs() {
  const out = { okur: false };
  try {
    const res = await chrome.storage.local.get({ fdPrefs: null, fdUserCss: [] });
    const p = res.fdPrefs;
    if (!p) {
      out.yorum = 'ayarlar henüz yazılmamış';
    } else {
      out.okur = true;
      out.enabled = p.enabled !== false;
      out.strateji = p.strategy || 'delete';
      const g = p.groups || {};
      out.acikGrup = Object.keys(g).filter((k) => g[k] === true);
      out.kapaliGrup = Object.keys(g).filter((k) => g[k] !== true);
      out.kullaniciKurali = (res.fdUserCss || []).length;
    }
  } catch (e) {
    out.yorum = 'okunamadı: ' + (e.message || e);
  }
  return out;
}

async function run() {
  if (!youtubeTabs.length) await listTabs();

  if (!selectedTabId) {
    elVerdict.className = 'verdict warn';
    elVerdict.innerHTML = 'Taranacak bir YouTube sekmesi yok. YouTube\'u açıp bu sayfaya dön.';
    return;
  }

  elRun.disabled = true;
  elRun.textContent = 'Taranıyor…';
  elVerdict.className = 'verdict';
  elVerdict.textContent = 'Sayfa taranıyor…';

  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: selectedTabId },
      world: 'MAIN',
      func: probe
    });

    const report = res && res[0] && res[0].result;
    if (!report) throw new Error('Sayfadan veri alınamadı');

    // Sayfa "kapali" der ama ayar "acik" diyorsa, sayfa ayar degistikten
    // SONRA yuklenmis veya tersi — hangisinin gecerli oldugunu gormek
    // icin ikisini ayri ayri gosteriyoruz.
    report.ayar = await readPrefs();
    report.sayac = await sendMsg({ type: 'fd:getCounts' })
      .then((r) => (r && r.ok ? r.counts : null))
      .catch(() => null);

    lastReport = report;
    render(report);
  } catch (err) {
    elVerdict.className = 'verdict bad';
    elVerdict.innerHTML = '<strong>Hata:</strong> ' + escapeHtml(err.message || String(err)) +
      '<br><span style="opacity:.75">Sekmeyi bir kez Ctrl+Shift+R ile yeniden yükleyip tekrar deneyin.</span>';
  } finally {
    elRun.disabled = false;
    elRun.textContent = 'Tara';
  }
}

elRun.addEventListener('click', run);

elCopy.addEventListener('click', async () => {
  if (!lastReport) return;
  const payload = Object.assign({}, lastReport);
  payload.abTesti = lastNetTest || '(bu oturumda çalıştırılmadı)';
  const text = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    elCopy.textContent = 'Kopyalandı';
  } catch (e) {
    elCopy.textContent = 'Kopyalanamadı';
  }
  setTimeout(() => { elCopy.textContent = 'Raporu kopyala'; }, 1600);
});

// Açılışta ve sekme değişimlerinde listeyi tazele
(function stampVersion() {
  try {
    const m = chrome.runtime.getManifest();
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const build = p(now.getHours()) + ':' + p(now.getMinutes()) + ':' + p(now.getSeconds());
    document.getElementById('stamp').textContent = 'sürüm ' + m.version + ' · yüklendi ' + build;
  } catch (e) {
    document.getElementById('stamp').textContent = 'sürüm bilgisi yok';
  }
})();

// Sessiz hatalari ekranda goster — yoksa kullanici bos sayfa gorur
// ve nedenini anlamaz.
function showFatal(msg) {
  if (!msg) return;
  elVerdict.className = 'verdict bad';
  elVerdict.textContent = 'Sayfa hatasi: ' + msg;
}

window.addEventListener('error', (e) => showFatal(e.message));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  showFatal((r && r.message) || String(r));
});

listTabs().catch((e) => showFatal((e && e.message) || String(e)));

chrome.tabs.onRemoved.addListener(() => listTabs());
chrome.tabs.onUpdated.addListener((id, info) => {
  if (!info.url) return;
  if (YT_PATTERNS.some((p) => matchPattern(p, info.url))) listTabs();
});

function matchPattern(pattern, url) {
  // 'https://*.youtube.com/*' gibi kalıbı basitçe eşle
  if (!url) return false;
  const rx = new RegExp('^' + pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*') + '$');
  return rx.test(url);
}
