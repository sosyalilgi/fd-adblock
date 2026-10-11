/* =====================================================================
   FD Reklam Engelleyici — picker.js
   ---------------------------------------------------------------------
   Sağ tık menüsünden "bu öğeyi engelle" ile çağrılır.
   Kullanıcı imleçle bir öğe seçer, script bir CSS seçici üretir ve
   onu kalıcı gizleme kuralı olarak kaydeder.
   İzole dünyada çalışır (chrome.scripting ile enjekte edilir).
   ===================================================================== */
(function () {
  'use strict';

  if (window.__fdPicker) return;

  var Z = '2147483647';
  var style = document.createElement('style');
  style.textContent =
    '#fd-picker-box{position:fixed;pointer-events:none;z-index:' + Z + ';' +
    'border:2px solid #f97316;background:rgba(249,115,22,.18);border-radius:2px;' +
    'transition:all .04s linear;display:none}' +
    '#fd-picker-tip{position:fixed;z-index:' + Z + ';background:#f97316;color:#000;' +
    'font:11px/1.4 ui-monospace,Menlo,monospace;padding:3px 7px;border-radius:4px;' +
    'pointer-events:none;max-width:460px;overflow:hidden;text-overflow:ellipsis;' +
    'white-space:nowrap;display:none}' +
    '#fd-picker-bar{position:fixed;top:0;left:0;right:0;z-index:' + Z + ';' +
    'background:#111827;color:#fff;font:13px/1.5 system-ui,sans-serif;' +
    'padding:9px 14px;display:flex;gap:12px;align-items:center}' +
    '#fd-picker-bar b{color:#fb923c;font-weight:600}' +
    '#fd-picker-bar kbd{background:#374151;border-radius:3px;padding:1px 5px;' +
    'font-family:ui-monospace,Menlo,monospace;font-size:11px}';

  var bar = document.createElement('div');
  bar.id = 'fd-picker-bar';
  bar.innerHTML =
    '<b>FD Eleman Seçici</b>' +
    '<span>Gizlemek istediğin öğeye tıkla &nbsp;·&nbsp; ' +
    '<kbd>Esc</kbd> iptal</span>';

  var box = document.createElement('div');
  box.id = 'fd-picker-box';

  var tip = document.createElement('div');
  tip.id = 'fd-picker-tip';

  document.documentElement.appendChild(style);
  document.documentElement.appendChild(bar);
  document.documentElement.appendChild(box);
  document.documentElement.appendChild(tip);

  var active = true;
  var current = null;

  /* ------------------------------------------------------------------
     CSS seçici üretimi — selector-gen.js'e taşındı (test edilebilir)
     ------------------------------------------------------------------ */
  var cssPath = function (el) {
    if (!window.FDSelector) return el ? el.tagName.toLowerCase() : null;
    return window.FDSelector.cssPath(el, document);
  };

  /* ------------------------------------------------------------------
     İşaretleme
     ------------------------------------------------------------------ */
  function onMove(e) {
    if (!active) return;
    var el = e.target;
    if (!el || el === box || el === tip || el === bar ||
        el.id === 'fd-picker-box' || el.id === 'fd-picker-tip' || el.id === 'fd-picker-bar') return;

    current = el;
    var r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';

    var sel = cssPath(el);
    tip.style.display = 'block';
    tip.textContent = sel || el.tagName.toLowerCase();
    var tw = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(window.innerWidth - tw - 6, r.left)) + 'px';
    tip.style.top = Math.max(34, r.top - 26) + 'px';
  }

  function cleanup() {
    active = false;
    window.__fdPicker = false;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    [style, bar, box, tip].forEach(function (n) {
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
  }

  function onClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    if (!current) return;

    var sel = cssPath(current);
    var label = (current.innerText || '').trim().slice(0, 60);
    cleanup();
    if (!sel) return;

    try {
      chrome.runtime.sendMessage({ type: 'fd:addUserRule', selector: sel, label: label });
    } catch (err) {}
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);

  window.__fdPicker = true;
})();
