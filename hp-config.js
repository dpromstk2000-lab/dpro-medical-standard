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

  // BRUSHUP-5 PUBLIC / HP WAITING DISPLAY V1.0
  // Additive loader: existing HP runtime remains unchanged.
  const waitingSection=document.getElementById("waiting-section");
  if(waitingSection) waitingSection.hidden=true;
  if(!document.querySelector('script[data-dpro-hp-waiting-live="1"]')){
    const script=document.createElement("script");
    script.src="hp-waiting-live.js";
    script.async=true;
    script.dataset.dproHpWaitingLive="1";
    document.head.appendChild(script);
  }

  // BRUSHUP-10: terminology-only public label layer. The canonical public
  // waiting endpoint and current_queue_number contract are unchanged.
  if(!document.querySelector('script[data-dpro-hp-brushup10="1"]')){
    const b10=document.createElement("script");
    b10.src="hp-brushup10-current-number.js?v=brushup10-1.0";
    b10.defer=true;
    b10.dataset.dproHpBrushup10="1";
    document.head.appendChild(b10);
  }
})();
