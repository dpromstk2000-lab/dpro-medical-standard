// DPRO MEDICAL INTEGRATION-1 / STANDARD V1.3 BROWSER AUTH / BOOTSTRAP
// PUBLIC CONFIG ONLY. Never place Service Role, Channel Secret, Access Token, refresh token, password or private secret here.
// Deployment injects public origin/clinic/routes by editing this PUBLIC file or by an equivalent trusted build/runtime step.
window.DPRO_MEDICAL_CONFIG = Object.freeze({
  appName: "DPRO MEDICAL",
  integrationVersion: "INTEGRATION-1 STANDARD V1.3",
  preset: "STANDARD",

  // Production-safe defaults. Browser URL/query MUST NOT switch this to demo.
  environmentMode: "production",
  mockMode: false,

  // Public API origin only, e.g. https://medical-api.example.jp (no trailing slash).
  // The locked API base remains /api/medical/v1/. Empty means same-origin for patient UI,
  // while system-check/HP intentionally report unconnected until deployment supplies values.
  apiBaseUrl: "https://dpro-medical-core.dpromstk2000.workers.dev",

  // Public clinic identifier. For authenticated APIs it is only a selector and is revalidated server-side; never an authorization trust source.
  clinicId: "dbc7fa75-87d6-40fd-889d-3599fcaeeab9",

  // Public Supabase Auth browser configuration. Publishable Key only.
  // Never place service_role, secret key, passwords, access/refresh tokens, or Worker secrets here.
  supabaseUrl: "https://ropwvdnohadwxfbkcopx.supabase.co",
  supabasePublishableKey: "sb_publishable_0Z9TNjw_B-eLInBFWNW5Ug_X4ymbN6v",

  systemCheckPath: "/api/medical/v1/system-check",

  publicUrls: Object.freeze({
    webBooking: "https://dpromstk2000-lab.github.io/dpro-medical-standard/patient-reservation.html",
    lineBooking: "",
    sameDayReception: "https://dpromstk2000-lab.github.io/dpro-medical-standard/patient-reception.html",
    questionnaire: "https://dpromstk2000-lab.github.io/dpro-medical-standard/patient-questionnaire.html"
  }),

  publicConfigOnly: true
});
