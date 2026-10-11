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
     querySelector'a oldugu gibi verilir. */
  var AD_SELECTORS = [
    '.video-ads',
    'ytd-player-legacy-desktop-watch-ads-renderer',
    'ytd-player-legacy-desktop-watch-ads-renderer__player',
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

  /* Tiklanabilir bir atla dugmesi var mi? */
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
    return btn;
  }

  var API = {
    AD_SELECTORS: AD_SELECTORS,
    SKIP_SELECTORS: SKIP_SELECTORS,
    gorunurMu: gorunurMu,
    reklamVarMi: reklamVarMi,
    atlaDugmesi: atlaDugmesi
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  kok.FDPlayerDetect = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);