/* Printable tools: the print buttons. Kept out of the page because the site's CSP blocks inline script. */
(function () {
  'use strict';
  document.querySelectorAll('[data-print]').forEach((btn) => {
    btn.addEventListener('click', () => window.print());
  });
})();
