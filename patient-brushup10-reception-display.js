(function (global, document) {
  'use strict';

  // DPRO MEDICAL BRUSHUP-10 / PATIENT RECEPTION MODE + CURRENT NUMBER DISPLAY V1.0
  const MODE_LABELS = Object.freeze({
    datetime: '時間予約',
    queue: '順番予約',
    time_window: '時間枠予約',
    complete_reservation: '完全予約',
    walk_in: '直接来院'
  });
  let observer = null;

  function enhanceReservation() {
    const select = document.getElementById('appointmentType');
    const badge = document.getElementById('modeBadge');
    if (select && badge) {
      const typeValue = select.value;
      const option = Array.from(select.options || []).find(o => o.value === typeValue);
      // Inline reservation runtime owns the actual booking_mode. We only rename
      // its visible badge after it has rendered, without changing API payloads.
      const current = String(badge.textContent || '');
      const replacements = {
        '日時予約': MODE_LABELS.datetime,
        '順番受付': MODE_LABELS.queue,
        '時間帯受付': MODE_LABELS.time_window
      };
      if (replacements[current] && badge.textContent !== replacements[current]) badge.textContent = replacements[current];
      if (option) option.dataset.brushup10DisplayReady = '1';
    }

    const queueStrong = document.querySelector('#queueRoute strong');
    if (queueStrong && queueStrong.textContent !== '順番予約（当日受付）') queueStrong.textContent = '順番予約（当日受付）';
  }

  function enhanceWaitStatus() {
    const currentCard = document.getElementById('currentCard');
    if (!currentCard) return;
    const label = currentCard.querySelector('p.small');
    if (label && label.textContent !== '現在診療番号') label.textContent = '現在診療番号';
    if (!document.getElementById('brushup10-current-number-note')) {
      const note = document.createElement('p');
      note.id = 'brushup10-current-number-note';
      note.className = 'small';
      note.textContent = '現在診療・呼出中の受付番号';
      const value = document.getElementById('current');
      if (value?.parentNode) value.parentNode.appendChild(note);
    }
  }

  function enhance() {
    enhanceReservation();
    enhanceWaitStatus();
  }

  function init() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      observer = new MutationObserver(enhance);
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }
  }

  global.DPROMedicalPatientBrushup10 = Object.freeze({ version: 'BRUSHUP-10-V1.0', modeLabels: MODE_LABELS, enhance });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
