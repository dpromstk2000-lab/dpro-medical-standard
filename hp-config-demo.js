/* DPRO MEDICAL HP V1.2 explicit DEMO configuration.
 * DEMO ONLY. Do not deploy this file as the production runtime config.
 * PUBLIC values only. No secret / patient data.
 */
window.DPROMedicalHPConfig = Object.freeze({
  environment: "demo",
  mockMode: true,
  apiBaseUrl: "",
  clinicId: "clinic_demo_standard",
  mockDataUrl: "hp-mock-data.js",
  routes: Object.freeze({
    webBooking: "#booking",
    lineBooking: "#line-section",
    sameDayReception: "#waiting-section",
    questionnaire: "#questionnaire"
  })
});
