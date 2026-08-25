(function (global, document) {
  'use strict';

  // DPRO MEDICAL BRUSHUP-10 / RECEPTION MODE SWITCH + CURRENT NUMBER V1.0
  // Additive UI layer only. Backend keys/contracts remain unchanged.
  const VERSION = 'BRUSHUP-10-V1.0';
  const MODE_LABELS = Object.freeze({
    datetime: '時間予約',
    queue: '順番予約',
    time_window: '時間枠予約',
    complete_reservation: '完全予約（案内）',
    walk_in: '直接来院（予約不要）'
  });
  const REFRESH_SECONDS = 30;
  let timer = null;
  let inFlight = false;
  let observer = null;

  const API = global.DPROMedicalClinicApi;

  function queueIdOf(q) { return q && (q.queueId || q.queueEntryId || q.id) || ''; }
  function queueNumberOf(q) {
    const raw=q ? (q.queueNumber ?? q.number ?? null) : null;
    const n=Number(raw);
    return Number.isInteger(n) && n>0 ? n : null;
  }
  function queueForVisit(visit, queue) {
    if(!visit) return null;
    return queue.find(q =>
      (visit.queueId && queueIdOf(q) === visit.queueId) ||
      (q.visitId && q.visitId === visit.visitId) ||
      (visit.appointmentId && q.appointmentId === visit.appointmentId)
    ) || null;
  }
  function sortTime(value){
    const n=Date.parse(value||'');
    return Number.isFinite(n)?n:0;
  }
  function resolveNumber(visits, queue) {
    const priority={consulting:0,examining:1,procedure:2};
    const active=(Array.isArray(visits)?visits.slice():[])
      .filter(v => Object.prototype.hasOwnProperty.call(priority,v?.status))
      .sort((a,b) => {
        const pa=priority[a.status], pb=priority[b.status];
        if(pa!==pb) return pa-pb;
        return sortTime(b.updatedAt||b.startedAt)-sortTime(a.updatedAt||a.startedAt);
      });
    for(const visit of active){
      const n=queueNumberOf(queueForVisit(visit,queue));
      if(n!==null) return n;
    }
    const called=(Array.isArray(queue)?queue.slice():[])
      .filter(q => q?.status==='called')
      .sort((a,b) => sortTime(b.calledAt||b.updatedAt)-sortTime(a.calledAt||a.updatedAt));
    return queueNumberOf(called[0]||null);
  }

  function ensureDashboardMetric() {
    const grid = document.querySelector('#dashboard .grid.kpis');
    if (!grid) return null;
    let card = document.getElementById('brushup10-current-number-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'brushup10-current-number-card';
      card.className = 'card kpi';
      card.innerHTML = '<div class="label">現在診療番号</div><div class="value" data-brushup10-current-number>—</div><small class="muted">現在診療・呼出中の受付番号</small>';
      grid.appendChild(card);
    }
    return card;
  }

  function setCurrentNumber(value) {
    const card = ensureDashboardMetric();
    if (!card) return;
    const target = card.querySelector('[data-brushup10-current-number]');
    if (!target) return;
    if (value===null || value===undefined || value==='') { target.textContent='—'; return; }
    const n = Number(value);
    target.textContent = Number.isInteger(n) && n>0 ? String(n) : '—';
  }

  async function refreshCurrentNumber() {
    if (!API || inFlight || document.hidden) return;
    inFlight = true;
    try {
      const context=await API.getContext();
      const businessDate=context?.businessDate || new Intl.DateTimeFormat('en-CA',{
        timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
      }).format(new Date());
      const [visits,queue]=await Promise.all([
        API.getVisits(businessDate),
        API.getQueue(businessDate)
      ]);
      setCurrentNumber(resolveNumber(visits,queue));
    } catch (_) {
      // Preserve the last valid value on transient authenticated API errors.
    } finally {
      inFlight = false;
    }
  }

  function scheduleCurrentNumber() {
    clearTimeout(timer);
    timer = null;
    if (document.hidden || !document.querySelector('#dashboard .grid.kpis')) return;
    timer = setTimeout(async () => {
      await refreshCurrentNumber();
      scheduleCurrentNumber();
    }, REFRESH_SECONDS * 1000);
  }

  function setSettingCopy(inputId, title, detail) {
    const input = document.getElementById(inputId);
    const copy = input?.closest('.setting-row')?.querySelector('.setting-copy');
    if (!copy) return;
    const strong = copy.querySelector('strong');
    const muted = copy.querySelector('.muted');
    if (strong && strong.textContent !== title) strong.textContent = title;
    if (muted && detail && muted.textContent !== detail) muted.textContent = detail;
  }

  function ensureModeLegend(card, holder) {
    if (!card || !holder || document.getElementById('brushup10-mode-legend')) return;
    const legend = document.createElement('div');
    legend.id = 'brushup10-mode-legend';
    legend.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 12px';
    legend.innerHTML = [
      ['時間予約', '時刻を指定'],
      ['順番予約', '当日の順番'],
      ['時間枠予約', '時間帯を指定']
    ].map(([label, note]) => `<span style="display:inline-flex;gap:6px;align-items:center;padding:7px 10px;border:1px solid #d9e4ec;border-radius:999px;background:#f8fbfd;font-size:12px"><strong>${label}</strong><span class="muted">${note}</span></span>`).join('');
    card.insertBefore(legend, holder);
  }

  function enhanceBookingModeSettings() {
    const holder = document.getElementById('booking-settings-list');
    if (!holder) return;
    const card = holder.closest('.settings-card');
    const heading = card?.querySelector('h3');
    const note = card?.querySelector('.settings-note');
    if (heading && heading.textContent !== '受付方式切替') heading.textContent = '受付方式切替';
    const noteText = '予約メニューごとに「時間予約／順番予約／時間枠予約」を切り替えます。保存後、患者の予約画面は選択した方式へ自動で切り替わります。';
    if (note && note.textContent !== noteText) note.textContent = noteText;
    ensureModeLegend(card, holder);

    holder.querySelectorAll('select[data-booking-select]').forEach(select => {
      Array.from(select.options || []).forEach(option => {
        const label = MODE_LABELS[option.value];
        if (!label) return;
        const featureOff = /Feature OFF/.test(option.textContent || '');
        const nextText = label + (featureOff ? '（Feature OFF）' : '');
        if (option.textContent !== nextText) option.textContent = nextText;
      });
    });
  }

  function enhanceCurrentNumberSettings() {
    setSettingCopy('setting-show-current', '現在診療番号を表示', '患者の待ち状況に現在診療・呼出中の受付番号を表示');
    setSettingCopy('setting-hp-show-current', '現在診療番号を表示', 'ホームページに現在診療・呼出中の受付番号を表示');
  }

  function enhanceSettings() {
    enhanceBookingModeSettings();
    enhanceCurrentNumberSettings();
  }

  function installObserver() {
    if (observer || !document.documentElement || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(() => enhanceSettings());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    ensureDashboardMetric();
    enhanceSettings();
    installObserver();
    refreshCurrentNumber().finally(scheduleCurrentNumber);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearTimeout(timer);
        timer = null;
      } else {
        refreshCurrentNumber().finally(scheduleCurrentNumber);
      }
    });
  }

  global.DPROMedicalBrushup10 = Object.freeze({
    version: VERSION,
    modeLabels: MODE_LABELS,
    refreshCurrentNumber,
    enhanceSettings
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window, document);
