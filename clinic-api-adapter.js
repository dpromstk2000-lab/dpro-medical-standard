(function (global) {
  'use strict';

  const DEFAULT_CONFIG = {
    environmentMode: 'production',
    mockMode: false,
    mode: 'api',
    apiBaseUrl: '',
    clinicId: '',
    role: 'owner'
  };

  const APPOINTMENT_STATUSES = ['pending','confirmed','checked_in','cancelled','no_show','completed'];
  const QUEUE_STATUSES = ['waiting','called','paused','skipped','completed','cancelled'];
  const VISIT_STATUSES = ['arrived','waiting','exam_wait','examining','consult_wait','consulting','procedure_wait','procedure','payment_wait','completed'];

  const config = Object.assign({}, DEFAULT_CONFIG, global.DPRO_MEDICAL_CLINIC_CONFIG || {});

  function assertRuntimeGuard() {
    if (!['production', 'demo'].includes(config.environmentMode)) {
      throw new Error('DPRO MEDICAL clinic environmentMode must be "production" or "demo".');
    }
    if (!['mock', 'api'].includes(config.mode)) {
      throw new Error('DPRO MEDICAL clinic adapter mode must be "mock" or "api".');
    }
    if (config.environmentMode === 'production' && (config.mode === 'mock' || config.mockMode === true)) {
      throw new Error('DPRO MEDICAL production guard: mock/mockMode is forbidden in production.');
    }
    if (config.mode === 'mock' && !(config.environmentMode === 'demo' && config.mockMode === true)) {
      throw new Error('DPRO MEDICAL mock mode requires demo + explicit mockMode.');
    }
  }

  function snakeToCamelKey(key) {
    return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  }

  function normalize(value) {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      out[snakeToCamelKey(key)] = normalize(item);
    });
    return out;
  }

  function commonResponseError(payload, fallback) {
    if (payload && typeof payload === 'object') {
      const err = payload.error;
      if (typeof err === 'string' && err) return err;
      if (err && typeof err === 'object') return err.message || err.code || fallback;
      if (typeof payload.message === 'string' && payload.message) return payload.message;
    }
    return fallback;
  }

  function unwrapApiResponse(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('DPRO MEDICAL API response must be the common response object.');
    }
    if (payload.ok !== true) {
      throw new Error(commonResponseError(payload, 'DPRO MEDICAL API response ok !== true.'));
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
      throw new Error('DPRO MEDICAL API response is missing data.');
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'error') || payload.error !== null) {
      throw new Error(commonResponseError(payload, 'DPRO MEDICAL API response error must be null when ok=true.'));
    }
    return normalize(payload.data);
  }

  function asArray(payload, candidates) {
    const value = normalize(payload);
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    for (const key of candidates) {
      if (Array.isArray(value[key])) return value[key];
    }
    return [];
  }

  function dateString() {
    return new Date().toISOString().slice(0, 10);
  }

  function query(path, params) {
    const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (!entries.length) return path;
    const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    return path + '?' + qs;
  }

  async function getAccessToken() {
    const provider = global.DPRO_MEDICAL_AUTH;
    if (!provider || typeof provider.getAccessToken !== 'function') {
      throw new Error('DPRO_MEDICAL_AUTH.getAccessToken() is required in api mode.');
    }
    const token = await provider.getAccessToken();
    if (!token || typeof token !== 'string') {
      throw new Error('Bearer token provider returned an empty token.');
    }
    return token;
  }

  async function apiRequest(path, options) {
    const opts = Object.assign({ method: 'GET' }, options || {});
    const token = await getAccessToken();
    const headers = Object.assign({ Accept: 'application/json', Authorization: 'Bearer ' + token }, opts.headers || {});
    if (config.clinicId) headers['X-DPRO-Clinic-ID'] = config.clinicId;
    if (opts.body !== undefined && opts.body !== null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch((config.apiBaseUrl || '') + path, Object.assign({}, opts, { headers }));
    let payload = null;
    try { payload = await response.json(); }
    catch (_) {
      const error = new Error('DPRO MEDICAL API response must be JSON common response.');
      error.status = response.status;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(commonResponseError(payload, 'HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return unwrapApiResponse(payload);
  }

  function mockStore() {
    if (!global.DPROMedicalMock) throw new Error('DPROMedicalMock is required in mock mode.');
    return global.DPROMedicalMock;
  }

  function mockContext() {
    const m = mockStore();
    return {
      tenantId: m.meta.tenantId,
      environmentMode: m.meta.environment || 'demo',
      businessDate: m.meta.businessDate || dateString(),
      features: Object.assign({}, m.features || {}),
      workflowConfig: Object.assign({}, m.workflowConfig || {}),
      permissions: Object.assign({}, m.permissions || {}),
      role: config.role
    };
  }

  function mockTodayPatients() {
    const m = mockStore();
    return m.appointments.map(a => {
      const p = m.patients.find(x => x.patientId === a.patientId) || {};
      const v = m.visits.find(x => x.appointmentId === a.appointmentId) || null;
      const q = m.questionnaires.find(x => x.appointmentId === a.appointmentId) || null;
      return {
        appointmentId: a.appointmentId,
        patientId: a.patientId,
        time: a.time,
        department: a.department,
        doctorId: a.doctorId,
        appointmentStatus: a.status,
        questionnaireStatus: q ? q.status : a.questionnaire,
        patient: Object.assign({}, p),
        visit: v ? Object.assign({}, v) : null
      };
    });
  }

  function mockSearchPatients(term) {
    const m = mockStore();
    const q = String(term || '').replace(/[\s-]/g, '').toLowerCase();
    return m.patients.filter(p => !q || [p.patientId, p.name, p.kana, p.phone].some(v => String(v || '').replace(/[\s-]/g, '').toLowerCase().includes(q)));
  }

  function mockCheckIn(payload) {
    const m = mockStore();
    const appointmentId = payload && payload.appointmentId;
    const a = m.appointments.find(x => x.appointmentId === appointmentId);
    if (!a) throw new Error('Appointment not found.');
    a.status = 'checked_in';
    let v = m.visits.find(x => x.appointmentId === appointmentId);
    if (!v) {
      v = { visitId: 'V-' + Date.now(), patientId: a.patientId, appointmentId, status: 'arrived', workflowStage: '受付済', waitMin: 0 };
      m.visits.push(v);
    } else {
      v.status = 'arrived';
    }
    let queueEntry = null;
    if (m.features.feature_queue) {
      queueEntry = m.queueEntries.find(q => q.visitId === v.visitId) || null;
      if (!queueEntry) {
        queueEntry = { queueId: 'Q-' + Date.now(), visitId: v.visitId, status: 'waiting', number: m.queueEntries.length + 15 };
        m.queueEntries.push(queueEntry);
      }
    }
    return { appointment: Object.assign({}, a), visit: Object.assign({}, v), queue: queueEntry ? Object.assign({}, queueEntry) : null };
  }

  const Adapter = {
    config: Object.freeze(Object.assign({}, config)),
    canonical: Object.freeze({
      appointmentStatuses: APPOINTMENT_STATUSES.slice(),
      queueStatuses: QUEUE_STATUSES.slice(),
      visitStatuses: VISIT_STATUSES.slice()
    }),
    normalize,

    async getContext() {
      if (config.mode === 'mock') return mockContext();
      return apiRequest('/api/medical/v1/context');
    },

    async getTodayPatients() {
      if (config.mode === 'mock') return mockTodayPatients();
      const result = await apiRequest('/api/medical/v1/today/patients');
      return asArray(result, ['patients', 'items', 'records', 'todayPatients']);
    },

    async getAppointments(date) {
      if (config.mode === 'mock') return mockStore().appointments.map(x => Object.assign({}, x));
      const result = await apiRequest(query('/api/medical/v1/appointments', { date }));
      return asArray(result, ['appointments', 'items', 'records']);
    },

    async searchPatients(term) {
      if (config.mode === 'mock') return mockSearchPatients(term).map(x => Object.assign({}, x));
      const result = await apiRequest(query('/api/medical/v1/patients', { q: term || '' }));
      return asArray(result, ['patients', 'items', 'records']);
    },

    async checkIn(payload) {
      if (config.mode === 'mock') return mockCheckIn(payload || {});
      return apiRequest('/api/medical/v1/check-in', { method: 'POST', body: JSON.stringify(normalizeOutgoing(payload || {})) });
    },

    async getQueue(businessDate) {
      if (config.mode === 'mock') return mockStore().queueEntries.map(x => Object.assign({}, x));
      const result = await apiRequest(query('/api/medical/v1/queue', { business_date: businessDate }));
      return asArray(result, ['queue', 'queueEntries', 'items', 'records']);
    },

    async updateQueue(queueId, patch) {
      if (!queueId) throw new Error('queue_id is required.');
      if (config.mode === 'mock') {
        const entry = mockStore().queueEntries.find(x => (x.queueId || x.queueEntryId) === queueId);
        if (!entry) throw new Error('Queue entry not found.');
        if (patch && patch.status && !QUEUE_STATUSES.includes(patch.status)) throw new Error('Invalid canonical queue status.');
        Object.assign(entry, patch || {});
        return Object.assign({}, entry);
      }
      return apiRequest('/api/medical/v1/queue/' + encodeURIComponent(queueId), { method: 'PATCH', body: JSON.stringify(normalizeOutgoing(patch || {})) });
    },

    async getVisits(businessDate) {
      if (config.mode === 'mock') return mockStore().visits.map(x => Object.assign({}, x));
      const result = await apiRequest(query('/api/medical/v1/visits', { business_date: businessDate }));
      return asArray(result, ['visits', 'items', 'records']);
    },

    async updateVisitStatus(visitId, status) {
      if (!visitId) throw new Error('visit_id is required.');
      if (!VISIT_STATUSES.includes(status)) throw new Error('Invalid canonical visit status.');
      if (config.mode === 'mock') {
        const visit = mockStore().visits.find(x => x.visitId === visitId);
        if (!visit) throw new Error('Visit not found.');
        visit.status = status;
        return Object.assign({}, visit);
      }
      return apiRequest('/api/medical/v1/visits/' + encodeURIComponent(visitId), { method: 'PATCH', body: JSON.stringify({ status }) });
    },

    async getDepartments() {
      if (config.mode === 'mock') return (mockStore().departments || []).map(x => Object.assign({}, x));
      const result = await apiRequest('/api/medical/v1/departments');
      return asArray(result, ['departments', 'items', 'records']);
    },

    async getDoctors() {
      if (config.mode === 'mock') return mockStore().doctors.map(x => Object.assign({}, x));
      const result = await apiRequest('/api/medical/v1/doctors');
      return asArray(result, ['doctors', 'items', 'records']);
    },

    async getAppointmentTypes() {
      if (config.mode === 'mock') return (mockStore().appointmentTypes || []).map(x => Object.assign({}, x));
      const result = await apiRequest('/api/medical/v1/appointment-types');
      return asArray(result, ['appointmentTypes', 'items', 'records']);
    },

    async getAppointmentSlots(params) {
      if (config.mode === 'mock') return (mockStore().appointmentSlots || []).map(x => Object.assign({}, x));
      const path = query('/api/medical/v1/appointment-slots', params || {});
      const result = await apiRequest(path);
      return asArray(result, ['appointmentSlots', 'slots', 'items', 'records']);
    },

    async getQuestionnaireSubmissions(date) {
      if (config.mode === 'mock') return mockStore().questionnaires.map(x => Object.assign({}, x));
      const result = await apiRequest(query('/api/medical/v1/questionnaire-submissions', { date }));
      return asArray(result, ['questionnaireSubmissions', 'submissions', 'items', 'records']);
    },

    async getQuestionnaireSubmission(id) {
      if (!id) throw new Error('questionnaire submission id is required.');
      const context = await this.getContext();
      if (!hasPermission(context, 'questionnaire.read')) throw new Error('questionnaire.read permission is required.');
      if (config.mode === 'mock') {
        const item = mockStore().questionnaires.find(x => (x.id || x.submissionId || x.appointmentId) === id);
        return item ? Object.assign({}, item) : null;
      }
      return apiRequest('/api/medical/v1/questionnaire-submissions/' + encodeURIComponent(id));
    }
  };

  function camelToSnakeKey(key) {
    return key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  }

  function normalizeOutgoing(value) {
    if (Array.isArray(value)) return value.map(normalizeOutgoing);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      out[camelToSnakeKey(key)] = normalizeOutgoing(item);
    });
    return out;
  }

  function hasPermission(context, permission) {
    const permissions = (context && context.permissions) || {};
    if (Array.isArray(permissions)) {
      return permissions.includes(permission) || permissions.includes('*');
    }

    // In API mode, browser role is only a UI hint. Authorization must come from
    // GET /context, including the server-provided role when permissions are role-mapped.
    const authoritativeRole = config.mode === 'api'
      ? (context && context.role)
      : ((context && context.role) || config.role);
    if (!authoritativeRole || !permissions || typeof permissions !== 'object') return false;
    const list = permissions[authoritativeRole] || [];
    return Array.isArray(list) && (list.includes(permission) || list.includes('*'));
  }

  Adapter.hasPermission = hasPermission;
  Adapter.normalizeOutgoing = normalizeOutgoing;

  assertRuntimeGuard();
  global.DPROMedicalClinicApi = Adapter;
})(window);
