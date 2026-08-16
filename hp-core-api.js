(() => {
  "use strict";

  class HPIntegrationError extends Error {
    constructor(code, message, detail = null) {
      super(message);
      this.name = "HPIntegrationError";
      this.code = code;
      this.detail = detail;
    }
  }

  const cfg = window.DPROMedicalHPConfig;
  if (!cfg) throw new HPIntegrationError("CONFIG_MISSING", "DPRO Medical HP config is missing.");

  if (cfg.environment === "production" && cfg.mockMode === true) {
    throw new HPIntegrationError(
      "PRODUCTION_MOCK_FORBIDDEN",
      "production + mockMode is forbidden by MED-SYSTEM baseline."
    );
  }

  const isDemoMock = cfg.environment === "demo" && cfg.mockMode === true;

  function requireApiConfig() {
    const missing = [];
    if (!String(cfg.apiBaseUrl || "").trim()) missing.push("apiBaseUrl");
    if (!String(cfg.clinicId || "").trim()) missing.push("clinicId");
    if (missing.length) {
      throw new HPIntegrationError(
        cfg.environment === "production" ? "PRODUCTION_API_NOT_CONNECTED" : "API_CONFIG_MISSING",
        `PUBLIC API config is missing: ${missing.join(", ")}`
      );
    }
  }

  function clinicPath(suffix) {
    const clinicId = encodeURIComponent(String(cfg.clinicId || "").trim());
    return `/api/medical/v1/clinics/${clinicId}/${suffix}`;
  }

  const endpointPaths = Object.freeze({
    clinicProfile: () => clinicPath("profile"),
    clinicHours: () => clinicPath("hours"),
    clinicClosures: () => clinicPath("closures"),
    doctors: () => clinicPath("doctors"),
    departments: () => clinicPath("departments"),
    announcements: () => clinicPath("announcements"),
    waitingSummary: () => clinicPath("waiting-count")
  });

  function buildUrl(bindingKey) {
    const getPath = endpointPaths[bindingKey];
    if (!getPath) throw new HPIntegrationError("API_BINDING_UNKNOWN", `Unknown API binding: ${bindingKey}`);
    const base = String(cfg.apiBaseUrl || "").replace(/\/$/, "");
    return `${base}${getPath()}`;
  }

  async function getData(bindingKey) {
    const response = await fetch(buildUrl(bindingKey), {
      method: "GET",
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });

    let json;
    try {
      json = await response.json();
    } catch (cause) {
      throw new HPIntegrationError("API_RESPONSE_INVALID", `${bindingKey}: response is not valid JSON.`, cause);
    }

    if (!response.ok) {
      throw new HPIntegrationError(
        "API_HTTP_ERROR",
        `${bindingKey}: HTTP ${response.status}`,
        json?.error || null
      );
    }
    if (!json || typeof json !== "object") {
      throw new HPIntegrationError("API_RESPONSE_INVALID", `${bindingKey}: response object is missing.`);
    }
    if (json.ok === false) {
      throw new HPIntegrationError(
        "CORE_API_ERROR",
        `${bindingKey}: CORE returned ok=false.`,
        json.error || null
      );
    }
    if (json.ok !== true || !("data" in json)) {
      throw new HPIntegrationError(
        "API_RESPONSE_INVALID",
        `${bindingKey}: expected { ok: true, data, error } response.`
      );
    }
    return json.data;
  }

  const text = (value) => value == null ? "" : String(value).trim();

  function joinAddress(clinic = {}) {
    return [clinic.prefecture, clinic.city, clinic.address1, clinic.address2]
      .map(text)
      .filter(Boolean)
      .join("");
  }

  function normalizeProfile(payload = {}) {
    const clinic = payload.clinic || {};
    const publicSettings = payload.public_settings || {};
    const featureFlags = payload.feature_flags || {};
    return {
      clinic: {
        name: text(clinic.name),
        phone: text(clinic.phone),
        address: joinAddress(clinic),
        tagline: text(publicSettings.tagline)
      },
      clinic_settings: {
        clinic_status: text(publicSettings.clinic_status) || "UNKNOWN",
        reception_status: text(publicSettings.reception_status) || "UNKNOWN",
        status_message: text(publicSettings.status_message),
        status_updated_at: publicSettings.status_updated_at || null,
        feature_flags: { ...featureFlags }
      }
    };
  }

  const DAY_LABELS = Object.freeze({
    0: "日", 1: "月", 2: "火", 3: "水", 4: "木", 5: "金", 6: "土",
    sun: "日", sunday: "日", mon: "月", monday: "月", tue: "火", tuesday: "火",
    wed: "水", wednesday: "水", thu: "木", thursday: "木", fri: "金", friday: "金",
    sat: "土", saturday: "土"
  });

  function dayLabel(value) {
    const raw = text(value);
    if (!raw) return "";
    const key = raw.toLowerCase();
    return DAY_LABELS[key] || raw;
  }

  function timePart(value) {
    const raw = text(value);
    if (!raw) return "";
    const m = raw.match(/(?:T|^)(\d{2}:\d{2})/);
    return m ? m[1] : raw.slice(0, 5);
  }

  function sessionLabel(row = {}) {
    const open = timePart(row.opens_at);
    const close = timePart(row.closes_at);
    if (!open || !close) return "休診";
    const last = timePart(row.last_reception_at);
    return `${open}–${close}${last ? `（受付 ${last}まで）` : ""}`;
  }

  function normalizeHours(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const groups = new Map();
    list.forEach((row) => {
      const key = text(row.day_of_week);
      if (!groups.has(key)) groups.set(key, { day: dayLabel(row.day_of_week), morning: "休診", afternoon: "休診" });
      const model = groups.get(key);
      const sessionNo = Number(row.session_no);
      if (sessionNo === 1) model.morning = sessionLabel(row);
      else if (sessionNo === 2) model.afternoon = sessionLabel(row);
    });

    const order = ["1", "2", "3", "4", "5", "6", "0"];
    return [...groups.entries()]
      .sort(([a], [b]) => {
        const ai = order.indexOf(a), bi = order.indexOf(b);
        if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        return 0;
      })
      .map(([, value]) => value);
  }

  function datePart(value) {
    const raw = text(value);
    if (!raw) return "";
    return raw.slice(0, 10);
  }

  function normalizeClosures(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const startDate = datePart(row.starts_at);
      const endDate = datePart(row.ends_at);
      const startTime = timePart(row.starts_at);
      const endTime = timePart(row.ends_at);
      const date = startDate && endDate && startDate !== endDate ? `${startDate}〜${endDate}` : startDate;
      const period = startTime && endTime ? `${startTime}–${endTime}` : "";
      return {
        date,
        period,
        label: text(row.notice_text) || text(row.reason) || period
      };
    });
  }

  function normalizeDepartments(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: text(row.department_id),
      name: text(row.name),
      description: ""
    }));
  }

  function normalizeDoctors(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const fallbackName = [row.last_name, row.first_name].map(text).filter(Boolean).join(" ");
      return {
        id: text(row.doctor_id),
        name: text(row.display_name) || fallbackName,
        role: text(row.specialty),
        department_ids: text(row.department_id) ? [text(row.department_id)] : [],
        message: text(row.profile)
      };
    });
  }

  function normalizeAnnouncements(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: text(row.id),
      date: datePart(row.publish_from),
      title: text(row.title),
      body: text(row.body)
    }));
  }

  function normalizeWaiting(raw = {}) {
    const available = raw.available === true;
    if (!available) {
      return {
        waiting_count: null,
        estimated_minutes: null,
        updated_at: raw.updated_at || null,
        available: false
      };
    }

    const waitingCount = Number(raw.waiting_count);
    const estimatedMinutes = raw.estimated_minutes == null ? null : Number(raw.estimated_minutes);
    return {
      waiting_count: Number.isFinite(waitingCount) ? waitingCount : null,
      estimated_minutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : null,
      updated_at: raw.updated_at || null,
      available: true
    };
  }

  let mockLoadPromise = null;
  function loadMockDataScript() {
    if (window.DPROMedicalHPMockData) return Promise.resolve();
    if (!isDemoMock) {
      return Promise.reject(new HPIntegrationError("MOCK_NOT_ALLOWED", "Mock data may load only in explicit demo + mockMode."));
    }
    if (mockLoadPromise) return mockLoadPromise;

    const src = text(cfg.mockDataUrl);
    if (!src) {
      return Promise.reject(new HPIntegrationError("MOCK_DATA_URL_MISSING", "Explicit demo mockDataUrl is missing."));
    }

    mockLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.dproMedicalMock = "true";
      script.onload = () => {
        if (window.DPROMedicalHPMockData) resolve();
        else reject(new HPIntegrationError("MOCK_DATA_MISSING", "Mock script loaded but data object is missing."));
      };
      script.onerror = () => reject(new HPIntegrationError("MOCK_DATA_LOAD_FAILED", "Explicit demo mock data could not be loaded."));
      document.head.appendChild(script);
    });
    return mockLoadPromise;
  }

  async function load() {
    if (isDemoMock) {
      await loadMockDataScript();
      return { source: "MOCK", ...window.DPROMedicalHPMockData };
    }

    requireApiConfig();
    const [profileRaw, hoursRaw, closuresRaw, doctorsRaw, departmentsRaw, announcementsRaw, waitingRaw] = await Promise.all([
      getData("clinicProfile"),
      getData("clinicHours"),
      getData("clinicClosures"),
      getData("doctors"),
      getData("departments"),
      getData("announcements"),
      getData("waitingSummary")
    ]);

    const profile = normalizeProfile(profileRaw);
    return {
      source: "CORE_API",
      clinic: profile.clinic,
      clinic_settings: profile.clinic_settings,
      clinic_hours: normalizeHours(hoursRaw),
      clinic_closures: normalizeClosures(closuresRaw),
      doctors: normalizeDoctors(doctorsRaw),
      departments: normalizeDepartments(departmentsRaw),
      announcements: normalizeAnnouncements(announcementsRaw),
      waiting_summary: normalizeWaiting(waitingRaw)
    };
  }

  window.DPROMedicalHPCore = Object.freeze({ load, HPIntegrationError });
})();
