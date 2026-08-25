(function (global, document) {
  'use strict';

  // DPRO MEDICAL BRUSHUP-10 / PUBLIC CURRENT DIAGNOSIS NUMBER LABEL V1.0
  let observer = null;

  function enhance() {
    const metric = document.getElementById('hp-current-number-metric');
    if (!metric) return;
    const label = metric.querySelector('span');
    if (label && label.textContent !== '現在診療番号') label.textContent = '現在診療番号';
    if (!document.getElementById('hp-brushup10-current-number-note')) {
      const note = document.createElement('small');
      note.id = 'hp-brushup10-current-number-note';
      note.className = 'small';
      note.textContent = '現在診療・呼出中の受付番号';
      metric.appendChild(note);
    }
  }

  function init() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      observer = new MutationObserver(enhance);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  global.DPROMedicalHPBrushup10 = Object.freeze({ version: 'BRUSHUP-10-V1.0', enhance });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
