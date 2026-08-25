(function (global) {
  'use strict';

  if (global.DPRO_MEDICAL_PATIENT_RESOLVER_INSTALLED) return;
  global.DPRO_MEDICAL_PATIENT_RESOLVER_INSTALLED = true;

  const API = global.DPROMedicalClinicApi;
  if (!API) throw new Error('DPROMedicalClinicApi is required before clinic-patient-resolver.js.');

  function patientView(row) {
    const p = row && typeof row === 'object' ? Object.assign({}, row) : {};
    const name = String(p.name || p.displayName || [p.lastName, p.firstName].filter(Boolean).join(' ') || '').trim();
    const kana = String(p.kana || [p.lastNameKana, p.firstNameKana].filter(Boolean).join(' ') || '').trim();
    return Object.assign(p, {
      name: name || '患者',
      kana,
      phone: p.phone || p.phoneNormalized || ''
    });
  }

  async function accessToken() {
    const auth = global.DPRO_MEDICAL_AUTH;
    if (!auth || typeof auth.getAccessToken !== 'function') {
      throw new Error('DPRO_MEDICAL_AUTH.getAccessToken() is required for patient resolution.');
    }
    const token = await auth.getAccessToken();
    if (!token) throw new Error('Patient resolver received an empty access token.');
    return token;
  }

  async function apiGet(path) {
    const token = await accessToken();
    const headers = { Accept: 'application/json', Authorization: 'Bearer ' + token };
    if (API.config.clinicId) headers['X-DPRO-Clinic-ID'] = API.config.clinicId;
    const response = await fetch((API.config.apiBaseUrl || '') + path, { method: 'GET', headers });
    let payload = null;
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok || !payload || payload.ok !== true || payload.error !== null) {
      const message = payload && payload.error && (payload.error.message || payload.error.code);
      throw new Error(message || ('Patient resolver HTTP ' + response.status));
    }
    return API.normalize(payload.data);
  }

  async function mapLimit(values, limit, mapper) {
    const result = new Array(values.length);
    let cursor = 0;
    async function worker() {
      while (true) {
        const index = cursor++;
        if (index >= values.length) return;
        result[index] = await mapper(values[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
    return result;
  }

  async function patientsByIds(ids) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    const rows = await mapLimit(unique, 6, async id => {
      try {
        return patientView(await apiGet('/api/medical/v1/patients/' + encodeURIComponent(id)));
      } catch (_) {
        return patientView({ patientId: id });
      }
    });
    return new Map(rows.map(row => [row.patientId, row]));
  }

  function timeLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
  }

  const originalSearchPatients = typeof API.searchPatients === 'function'
    ? API.searchPatients.bind(API)
    : null;
  if (originalSearchPatients) {
    API.searchPatients = async function (term) {
      const rows = await originalSearchPatients(term);
      return Array.isArray(rows) ? rows.map(patientView) : [];
    };
  }

  const originalTodayPatients = typeof API.getTodayPatients === 'function'
    ? API.getTodayPatients.bind(API)
    : null;

  API.getTodayPatients = async function () {
    if (API.config.mode === 'mock') {
      const rows = originalTodayPatients ? await originalTodayPatients() : [];
      return (rows || []).map(row => {
        const next = Object.assign({}, row);
        if (next.patient) next.patient = patientView(next.patient);
        return next;
      });
    }

    const data = await apiGet('/api/medical/v1/today/patients');
    const appointments = Array.isArray(data && data.appointments) ? data.appointments : [];
    const visits = Array.isArray(data && data.visits) ? data.visits : [];
    const patientMap = await patientsByIds([
      ...appointments.map(row => row.patientId),
      ...visits.map(row => row.patientId)
    ]);
    const visitByAppointment = new Map(
      visits.filter(row => row.appointmentId).map(row => [row.appointmentId, row])
    );
    const matchedVisits = new Set();

    const rows = appointments.map(source => {
      const appointment = Object.assign({}, source);
      if (!appointment.time) appointment.time = timeLabel(appointment.startAt);
      const visit = visitByAppointment.get(appointment.appointmentId) || null;
      if (visit && visit.visitId) matchedVisits.add(visit.visitId);
      return {
        appointment,
        appointmentId: appointment.appointmentId,
        patientId: appointment.patientId,
        appointmentStatus: appointment.status,
        patient: patientMap.get(appointment.patientId) || patientView({ patientId: appointment.patientId }),
        visit
      };
    });

    visits.forEach(visit => {
      if (visit.visitId && matchedVisits.has(visit.visitId)) return;
      rows.push({
        appointmentId: visit.appointmentId || '',
        patientId: visit.patientId,
        appointmentStatus: 'checked_in',
        patient: patientMap.get(visit.patientId) || patientView({ patientId: visit.patientId }),
        visit
      });
    });

    return rows;
  };
})(window);
