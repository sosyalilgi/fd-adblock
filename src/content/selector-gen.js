/* =====================================================================
   FD Reklam Engelleyici — selector-gen.js
   ---------------------------------------------------------------------
   Bir DOM öğesi için CSS seçici üretir. Tamamen saf mantıktır
   (ağ, storage, chrome API kullanmaz), bu yüzden tarayıcı olmadan
   test edilebilir. picker.js bunu kullanır.
   ===================================================================== */
(function () {
  'use strict';

  // YouTube/Polymer'ın her render'da değiştirdiği, hiçbir anlam
  // taşımayan sınıflar
  var SKIP_CLASS = /^(sc-|css-|style-|ng-|ember\d|ytp-|_|is-active$|selected$)/;

  function esc(value) {
    if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    // Yedek: en azından nokta/parantez/sondaki tire sorunlarını çöz
    return String(value).replace(/([^\w-])/g, '\\$1');
  }

  function classPart(el) {
    var out = [];
    var list = el.classList || [];
    for (var i = 0; i < list.length && out.length < 3; i++) {
      var c = list[i];
      if (!c || SKIP_CLASS.test(c)) continue;
      if (out.indexOf(c) !== -1) continue;
      out.push(c);
    }
    return out;
  }

  function segFor(el) {
    var seg = el.tagName.toLowerCase();
    var cls = classPart(el);
    for (var i = 0; i < cls.length; i++) seg += '.' + esc(cls[i]);
    return seg;
  }

  function matchesUnique(root, selector, el) {
    try {
      var found = root.querySelectorAll(selector);
      return found.length === 1 && found[0] === el;
    } catch (e) {
      return false;
    }
  }

  /**
   * @param {Element} el
   * @param {Document|Element} root  benzersizlik testi için
   * @returns {string|null}
   */
  function cssPath(el, root) {
    var doc = root || (typeof document !== 'undefined' ? document : null);
    if (!el || el.nodeType !== 1 || !doc) return null;

    // 1) Benzersiz id — en kısa ve en dayanıklı seçici
    if (el.id && !/[^A-Za-z0-9_-]/.test(el.id)) {
      var byId = '#' + esc(el.id);
      if (matchesUnique(doc, byId, el)) return byId;
    }

    // 2) Aşağı doğru kısa yol
    var parts = [];
    var cur = el;
    var depth = 0;
    var stop = doc.body || doc.documentElement;

    while (cur && cur.nodeType === 1 && depth < 5) {
      parts.unshift(segFor(cur));
      var candidate = parts.join(' > ');
      if (matchesUnique(doc, candidate, el)) return candidate;
      if (cur === stop) break;
      cur = cur.parentElement;
      depth++;
    }

    // 3) nth-of-type ile garanti yol (her zaman benzersiz)
    var stack = [];
    cur = el;
    while (cur && cur.nodeType === 1 && cur !== doc.documentElement) {
      var index = 1;
      var sib = cur.previousElementSibling;
      while (sib) {
        if (sib.tagName === cur.tagName) index++;
        sib = sib.previousElementSibling;
      }
      stack.unshift(cur.tagName.toLowerCase() + ':nth-of-type(' + index + ')');
      if (matchesUnique(doc, stack.join(' > '), el)) return stack.join(' > ');
      cur = cur.parentElement;
    }

    return stack.join(' > ') || segFor(el);
  }

  var api = { cssPath: cssPath, segFor: segFor, classPart: classPart };
  globalThis.FDSelector = api;
  if (typeof window !== 'undefined') window.FDSelector = api;
})();
