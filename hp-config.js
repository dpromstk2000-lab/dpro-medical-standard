/* DPRO MEDICAL HP / INTEGRATION-1 production runtime bridge. PUBLIC values only. */
(function(){
  "use strict";
  const shared=window.DPRO_MEDICAL_CONFIG||{};
  const urls=shared.publicUrls||{};
  window.DPROMedicalHPConfig=Object.freeze({
    environment: shared.environmentMode==="demo" ? "demo" : "production",
    mockMode: shared.mockMode===true,
    apiBaseUrl: typeof shared.apiBaseUrl==="string" ? shared.apiBaseUrl : "",
    clinicId: typeof shared.clinicId==="string" ? shared.clinicId : "",
    routes:Object.freeze({
      webBooking: urls.webBooking||"",
      lineBooking: urls.lineBooking||"",
      sameDayReception: urls.sameDayReception||"",
      questionnaire: urls.questionnaire||""
    })
  });
})();
