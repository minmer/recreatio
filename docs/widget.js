/*
 * recreatio.pl — widżety na innych stronach (np. WordPress).
 *
 * Wklej na swoją stronę (blok „Własny HTML"):
 *
 *   <iframe data-recreatio src="https://recreatio.pl/#/widget/<moduł>/<adres strony>"
 *           style="width:100%;border:0;height:360px" loading="lazy" title="Msze święte"></iframe>
 *   <script src="https://recreatio.pl/widget.js" async></script>
 *
 * Ten skrypt robi tylko jedno: dopasowuje wysokość ramki do treści. Widżet
 * sam mówi, ile ma wysokości (postMessage), a tu ramka, z której przyszła
 * wiadomość, dostaje tę wysokość. Żadnych ciasteczek, żadnego śledzenia.
 */
(function () {
  'use strict';
  if (window.__recreatioWidget) return;
  window.__recreatioWidget = true;

  var allowed = /^https:\/\/(www\.)?recreatio\.pl$/;

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'recreatio:widget' || typeof data.height !== 'number') return;

    var frames = document.querySelectorAll('iframe[data-recreatio]');
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      if (frame.contentWindow !== event.source) continue;

      /* Własny adres (np. podgląd) wolno podać w data-recreatio="https://…". */
      var own = frame.getAttribute('data-recreatio');
      if (!(allowed.test(event.origin) || (own && own === event.origin))) return;

      var height = Math.max(80, Math.min(4000, Math.ceil(data.height)));
      frame.style.height = height + 'px';
    }
  });
})();
