(function () {
  'use strict';

  const API = window.DPROMedicalClinicApi;
  if (!API) throw new Error('DPROMedicalClinicApi adapter is required before clinic.js.');

  const visitLabels = {
    arrived:'受付済', waiting:'待合', exam_wait:'検査待ち', examining:'検査',
    consult_wait:'診察待ち', consulting:'診察', procedure_wait:'処置待ち',
    procedure:'処置', payment_wait:'会計待ち', completed:'完了'
  };
  const nextVisit = {
    arrived:'waiting', waiting:'exam_wait', exam_wait:'examining', examining:'consult_wait',
    consult_wait:'consulting', consulting:'procedure_wait', procedure_wait:'procedure',
    procedure:'payment_wait', payment_wait:'completed'
  };

  const state = {
    context: null,
    businessDate: '',
    today: [],
    appointments: [],
    queue: [],
    visits: [],
    doctors: [],
    questionnaires: [],
    patientSearchCache: [],
    busy: false,
    error: ''
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  const displayStatusLabels = Object.assign({}, visitLabels, {
    confirmed:'予約確定', checked_in:'受付済', cancelled:'キャンセル', no_show:'来院なし',
    answered:'回答済', needs_review:'要確認', unanswered:'未回答', submitted:'回答済', reviewed:'確認済',
    pending:'確認待ち', active:'有効', inactive:'停止'
  });
  function status(s) { return `<span class="status ${esc(s)}">${esc(displayStatusLabels[s] || '確認中')}</span>`; }
  function role() { return (state.context && state.context.role) || API.config.role || 'owner'; }
  function hasPermission(permission) { return API.hasPermission(state.context || { role: role(), permissions: {} }, permission); }
  function feature(name) { return !!(state.context && state.context.features && state.context.features[name]); }
  function workflow(name, fallback) {
    const cfg = state.context && state.context.workflowConfig;
    return cfg && Object.prototype.hasOwnProperty.call(cfg, name) ? !!cfg[name] : !!fallback;
  }

  function rowAppointment(row) { return row.appointment || row; }
  function rowPatient(row) { return row.patient || {}; }
  function rowVisit(row) { return row.visit || null; }
  function patientIdOf(row) { const a=rowAppointment(row); const p=rowPatient(row); return p.patientId || a.patientId || row.patientId || ''; }
  function appointmentIdOf(row) { const a=rowAppointment(row); return a.appointmentId || row.appointmentId || ''; }
  function doctorById(id) { return state.doctors.find(d => (d.doctorId || d.id) === id) || { name:'未指定' }; }
  function patientById(id) {
    const todayPatient = state.today.map(rowPatient).find(p => p.patientId === id);
    const cached = state.patientSearchCache.find(p => p.patientId === id);
    return todayPatient || cached || { name:'患者情報なし', patientId:id, kana:'', phone:'' };
  }

  function activeVisitStatuses() {
    return API.canonical.visitStatuses.filter(s => {
      if ((s === 'exam_wait' || s === 'examining') && !feature('feature_exam')) return false;
      if ((s === 'procedure_wait' || s === 'procedure') && !workflow('show_procedure', true)) return false;
      if (s === 'payment_wait' && !workflow('show_payment_wait', true)) return false;
      return true;
    });
  }
  function nextEnabledStatus(current) {
    let next = nextVisit[current];
    const allowed = activeVisitStatuses();
    while (next) {
      if (allowed.includes(next)) return next;
      next = nextVisit[next];
    }
    return null;
  }

  function dashboardSummary() {
    const visits = state.visits;
    const waits = visits.map(v => Number(v.waitMin ?? v.waitMinutes ?? 0)).filter(n => Number.isFinite(n) && n >= 0);
    return {
      appointmentsToday: state.appointments.length || state.today.length,
      checkedIn: state.appointments.filter(a => ['checked_in','completed'].includes(a.status)).length,
      waitingNow: visits.filter(v => !['completed'].includes(v.status)).length,
      consultingNow: visits.filter(v => v.status === 'consulting').length,
      completed: visits.filter(v => v.status === 'completed').length,
      avgWaitMin: waits.length ? Math.round(waits.reduce((a,b)=>a+b,0) / waits.length) : 0
    };
  }

  function renderKpis() {
    const summary = dashboardSummary();
    document.querySelectorAll('[data-kpi]').forEach(el => { el.textContent = summary[el.dataset.kpi] ?? '-'; });
    document.querySelectorAll('[data-adapter-mode]').forEach(el => { el.textContent = API.config.mode === 'mock' ? 'デモデータ' : 'オンライン'; });
    document.querySelectorAll('[data-runtime-env]').forEach(el => { el.textContent = API.config.environmentMode === 'demo' ? 'デモ' : '運用中'; });
    document.querySelectorAll('[data-role-hint]').forEach(el => { el.textContent = (API.config.role || 'owner') === 'staff' ? 'スタッフ' : '医院管理'; });
  }

  function renderToday(target) {
    const rows = state.today.map(row => {
      const a = rowAppointment(row);
      const p = rowPatient(row);
      const v = rowVisit(row) || state.visits.find(x => x.appointmentId === appointmentIdOf(row));
      const patientId = patientIdOf(row);
      const appointmentId = appointmentIdOf(row);
      const doctorId = a.doctorId || row.doctorId;
      const apptStatus = row.appointmentStatus || a.status;
      const questionnaireStatus = row.questionnaireStatus || a.questionnaireStatus || a.questionnaire || '-';
      const wait = v ? (v.waitMin ?? v.waitMinutes ?? 0) : null;
      return `<tr>
        <td>${esc(a.time || row.time || '-')}</td>
        <td><div class="patient-name">${esc(p.name || row.patientName || '患者')}</div></td>
        <td>${esc(a.department || row.department || '-')}</td>
        <td>${esc((row.doctor && row.doctor.name) || doctorById(doctorId).name)}</td>
        <td>${status(apptStatus)}</td>
        <td>${status(questionnaireStatus)}</td>
        <td>${v ? status(v.status) : '<span class="muted">未受付</span>'}</td>
        <td>${v ? esc(wait) + '分' : '-'}</td>
        <td>${apptStatus === 'confirmed' && hasPermission('appointment.check_in') ? `<button class="btn small primary" data-checkin="${esc(appointmentId)}">受付</button>` : ''}</td>
      </tr>`;
    }).join('');
    target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>時刻</th><th>患者</th><th>診療科</th><th>担当医</th><th>予約</th><th>問診</th><th>院内状況</th><th>待ち</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted">本日の患者データなし</td></tr>'}</tbody></table></div>`;
  }

  function renderAppointments(target) {
    target.innerHTML = `<div class="toolbar"><button class="btn primary">日表示</button><button class="btn">週表示</button><span class="muted">${esc(state.businessDate || '')}</span></div>`;
    const holder = document.createElement('div');
    renderToday(holder);
    target.appendChild(holder);
  }

  function renderReception(target) {
    target.innerHTML = `<div class="toolbar"><input id="reception-search" style="min-width:320px" placeholder="患者番号・氏名・カナ・電話番号"><button class="btn primary" id="reception-search-btn">検索</button></div>
      <div class="notice">予約済みの患者を検索し、受付操作を行えます。</div>
      <div id="reception-results" class="search-results" style="margin-top:12px"></div>`;
    const input = target.querySelector('#reception-search');
    const run = () => searchAndRender(target.querySelector('#reception-results'), input.value, true);
    target.querySelector('#reception-search-btn').onclick = run;
    let timer;
    input.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 180); };
    run();
  }

  async function searchAndRender(target, q, withReception) {
    try {
      target.innerHTML = '<div class="muted">検索中...</div>';
      const list = await API.searchPatients(q || '');
      state.patientSearchCache = list;
      target.innerHTML = list.map(p => {
        const a = state.appointments.find(x => x.patientId === p.patientId && x.status === 'confirmed');
        return `<div class="patient-card"><div><div class="patient-name">${esc(p.name)}</div>
          <div class="muted">${esc(p.kana || '')} / ${esc(p.phone || '')}${p.lineLinked !== undefined ? ' / LINE ' + (p.lineLinked ? '連携済' : '未連携') : ''}</div></div>
          <div>${withReception && a && hasPermission('appointment.check_in') ? `<button class="btn primary" data-checkin="${esc(a.appointmentId)}">本日受付</button>` : '<button class="btn" disabled>詳細</button>'}</div></div>`;
      }).join('') || '<div class="muted">該当患者なし</div>';
    } catch (err) { target.innerHTML = '<div class="notice">患者情報を取得できませんでした。もう一度お試しください。</div>'; }
  }

  function renderPatientModule(target) {
    target.innerHTML = `<div class="toolbar"><input data-patient-search placeholder="患者番号・氏名・カナ・電話番号"></div><div class="patient-module-results"></div>`;
    const input = target.querySelector('[data-patient-search]');
    const result = target.querySelector('.patient-module-results');
    let timer;
    const run = () => searchAndRender(result, input.value, false);
    input.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 180); };
    run();
  }

  function renderWorkflow(target) {
    const active = activeVisitStatuses();
    target.innerHTML = `<div class="flow">${active.map(s => {
      const visits = state.visits.filter(v => v.status === s);
      return `<div class="flow-col"><div class="flow-title"><span>${esc(visitLabels[s])}</span><span>${visits.length}</span></div>${visits.map(v => {
        const p = patientById(v.patientId);
        const next = nextEnabledStatus(v.status);
        return `<div class="flow-card"><strong>${esc(p.name)}</strong>
          <div class="muted">待ち ${esc(v.waitMin ?? v.waitMinutes ?? 0)}分</div>
          ${next && hasPermission('visit.update') ? `<button class="btn small primary" data-nextvisit="${esc(v.visitId)}" style="margin-top:8px">→ ${esc(visitLabels[next])}</button>` : ''}</div>`;
      }).join('') || '<div class="muted">0名</div>'}</div>`;
    }).join('')}</div>`;
  }

  function renderQuestionnaires(target) {
    if (!hasPermission('questionnaire.read')) {
      target.innerHTML = '<div class="notice">問診内容を表示する権限がありません。</div>';
      return;
    }
    target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>患者</th><th>状態</th><th>運用要約</th><th>回答時刻</th><th>詳細</th></tr></thead><tbody>${state.questionnaires.map(q => {
      const p = patientById(q.patientId);
      const id = q.submissionId || q.id || q.appointmentId;
      return `<tr><td><div class="patient-name">${esc(p.name)}</div></td><td>${status(q.status)}</td><td>${esc(q.summary || '-')}</td><td>${esc(q.submittedAt || '-')}</td><td><button class="btn small" data-questionnaire-detail="${esc(id)}">詳細を表示</button></td></tr>`;
    }).join('') || '<tr><td colspan="5" class="muted">問診提出なし</td></tr>'}</tbody></table></div><div data-questionnaire-detail-panel style="margin-top:12px"></div>`;
  }

  function renderDoctors(target) {
    target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>医師</th><th>診療科</th><th>予約</th><th>出勤</th></tr></thead><tbody>${state.doctors.map(d => `<tr><td class="patient-name">${esc(d.name)}</td><td>${esc(d.department || d.departmentName || '-')}</td><td>${d.reservable ? '可' : '停止'}</td><td>${d.onDuty ? '出勤' : '休み'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">医師データなし</td></tr>'}</tbody></table></div>`;
  }

  async function showQuestionnaireDetail(id, button) {
    const panel = button.closest('.section')?.querySelector('[data-questionnaire-detail-panel]') || document.querySelector('[data-questionnaire-detail-panel]');
    if (!panel) return;
    try {
      panel.innerHTML = '<div class="muted">権限確認・読込中...</div>';
      const detail = await API.getQuestionnaireSubmission(id);
      if (!detail) { panel.innerHTML = '<div class="muted">詳細なし</div>'; return; }
      const answers = Array.isArray(detail.answers) ? detail.answers : [];
      const answersHtml = answers.map((a, i) => {
        const label = a.question_label || a.label || a.question || `回答 ${i + 1}`;
        const raw = a.value ?? a.answer ?? a.response ?? '';
        const value = Array.isArray(raw) ? raw.join('、') : String(raw || '-');
        return `<div style="padding:10px 0;border-top:1px solid #e5e7eb"><strong>${esc(label)}</strong><div>${esc(value)}</div></div>`;
      }).join('');
      panel.innerHTML = `<div class="card"><strong>問診詳細</strong>${detail.summary ? `<p>${esc(detail.summary)}</p>` : ''}${answersHtml || '<p class="muted">問診内容を確認しました。</p>'}</div>`;
    } catch (err) { panel.innerHTML = '<div class="notice">問診詳細を表示できませんでした。</div>'; }
  }

  async function checkIn(appointmentId) {
    if (!appointmentId || state.busy) return;
    state.busy = true;
    try {
      await API.checkIn({ appointmentId });
      await loadData();
    } catch (err) { showError('受付処理に失敗しました。もう一度お試しください。'); }
    finally { state.busy = false; }
  }

  async function advanceVisit(visitId) {
    if (!visitId || state.busy) return;
    const visit = state.visits.find(v => v.visitId === visitId);
    if (!visit) return;
    const next = nextEnabledStatus(visit.status);
    if (!next) return;
    state.busy = true;
    try {
      await API.updateVisitStatus(visitId, next);
      await loadData();
    } catch (err) { showError('院内状況を更新できませんでした。もう一度お試しください。'); }
    finally { state.busy = false; }
  }

  function showError(message) {
    state.error = message;
    let box = document.getElementById('clinic-global-error');
    if (!box) {
      box = document.createElement('div'); box.id = 'clinic-global-error'; box.className = 'notice'; box.style.margin = '12px';
      document.body.prepend(box);
    }
    box.textContent = message;
  }

  function clearError() {
    state.error = '';
    const box = document.getElementById('clinic-global-error');
    if (box) box.remove();
  }

  function bindGlobalActions() {
    document.addEventListener('click', e => {
      const c = e.target.closest('[data-checkin]'); if (c) checkIn(c.dataset.checkin);
      const n = e.target.closest('[data-nextvisit]'); if (n) advanceVisit(n.dataset.nextvisit);
      const q = e.target.closest('[data-questionnaire-detail]'); if (q) showQuestionnaireDetail(q.dataset.questionnaireDetail, q);
    });
  }

  function refresh() {
    renderKpis();
    document.querySelectorAll('[data-render="today"]').forEach(renderToday);
    document.querySelectorAll('[data-render="appointments"]').forEach(renderAppointments);
    document.querySelectorAll('[data-render="reception"]').forEach(renderReception);
    document.querySelectorAll('[data-render="workflow"]').forEach(renderWorkflow);
    document.querySelectorAll('[data-render="questionnaire"]').forEach(renderQuestionnaires);
    document.querySelectorAll('[data-render="doctors"]').forEach(renderDoctors);
    document.querySelectorAll('[data-render="patients"]').forEach(renderPatientModule);
  }

  async function loadData() {
    clearError();
    state.context = await API.getContext();
    state.businessDate = state.context.businessDate || new Date().toISOString().slice(0,10);
    const [today, appointments, queue, visits, doctors, questionnaires] = await Promise.all([
      API.getTodayPatients(), API.getAppointments(state.businessDate), API.getQueue(state.businessDate),
      API.getVisits(state.businessDate), API.getDoctors(), API.getQuestionnaireSubmissions(state.businessDate)
    ]);
    state.today = today || [];
    state.appointments = appointments || [];
    state.queue = queue || [];
    state.visits = visits || [];
    state.doctors = doctors || [];
    state.questionnaires = questionnaires || [];
    refresh();
  }

  function setupNav() {
    document.querySelectorAll('[data-nav]').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('[data-nav]').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
      document.getElementById(btn.dataset.nav)?.classList.add('active');
      const title = document.getElementById('page-title'); if (title) title.textContent = btn.textContent.trim();
    });
  }

  async function initClinic() {
    setupNav();
    bindGlobalActions();
    try { await loadData(); }
    catch (err) { showError('医院情報を読み込めませんでした。画面を再読み込みしてください。'); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClinic, { once: true });
  } else {
    initClinic();
  }
})();
