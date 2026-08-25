(function (global, document) {
  'use strict';

  if (global.DPRO_MEDICAL_ACTION_FEEDBACK_INSTALLED) return;
  global.DPRO_MEDICAL_ACTION_FEEDBACK_INSTALLED = true;

  const STYLE_ID = 'dpro-medical-action-feedback-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .btn{transition:transform .08s ease,box-shadow .12s ease,opacity .12s ease,filter .12s ease}
      .btn:not(:disabled):active{transform:translateY(1px) scale(.96);box-shadow:inset 0 2px 5px rgba(0,0,0,.16);filter:brightness(.96)}
      .btn.dpro-action-busy{cursor:wait!important;opacity:.74;transform:translateY(1px) scale(.97);box-shadow:inset 0 2px 5px rgba(0,0,0,.14)}
      .flow-card.dpro-action-card-busy{box-shadow:0 0 0 2px rgba(23,107,92,.16);transition:box-shadow .12s ease}
      @media (prefers-reduced-motion:reduce){.btn,.flow-card{transition:none!important}.btn:not(:disabled):active,.btn.dpro-action-busy{transform:none}}
    `;
    document.head.appendChild(style);
  }

  const LABELS = Object.freeze({
    called: '呼出中…',
    waiting: '更新中…',
    paused: '停止中…',
    skipped: '保留中…',
    nextvisit: '更新中…',
    checkin: '受付中…'
  });

  function actionInfo(target) {
    const queueButton = target.closest('[data-queue-action]');
    if (queueButton) return { button: queueButton, label: LABELS[queueButton.dataset.queueAction] || '処理中…' };

    const visitButton = target.closest('[data-nextvisit]');
    if (visitButton) return { button: visitButton, label: LABELS.nextvisit };

    const checkinButton = target.closest('[data-checkin]');
    if (checkinButton) return { button: checkinButton, label: LABELS.checkin };

    return null;
  }

  function markBusy(button, label) {
    if (!button || button.dataset.dproActionBusy === '1') return;

    const card = button.closest('.flow-card, .patient-card, tr');
    const scope = card || button.parentElement;
    const actionButtons = scope ? Array.from(scope.querySelectorAll('[data-queue-action],[data-nextvisit],[data-checkin]')) : [button];

    actionButtons.forEach(item => {
      item.dataset.dproWasDisabled = item.disabled ? '1' : '0';
      item.disabled = true;
      item.setAttribute('aria-disabled', 'true');
    });

    button.dataset.dproActionBusy = '1';
    button.dataset.dproOriginalLabel = button.textContent || '';
    button.classList.add('dpro-action-busy');
    button.setAttribute('aria-busy', 'true');
    button.textContent = label;
    if (card && card.classList) card.classList.add('dpro-action-card-busy');

    // Successful operations re-render the card immediately. If an API call fails and
    // the original DOM remains, restore controls automatically so the user can retry.
    global.setTimeout(() => {
      if (!button.isConnected || button.dataset.dproActionBusy !== '1') return;
      actionButtons.forEach(item => {
        item.disabled = item.dataset.dproWasDisabled === '1';
        item.removeAttribute('aria-disabled');
        delete item.dataset.dproWasDisabled;
      });
      button.textContent = button.dataset.dproOriginalLabel || button.textContent;
      delete button.dataset.dproOriginalLabel;
      delete button.dataset.dproActionBusy;
      button.classList.remove('dpro-action-busy');
      button.removeAttribute('aria-busy');
      if (card && card.classList) card.classList.remove('dpro-action-card-busy');
    }, 12000);
  }

  document.addEventListener('click', event => {
    const info = actionInfo(event.target);
    if (!info || info.button.disabled) return;
    markBusy(info.button, info.label);
  }, true);
})(window, document);
