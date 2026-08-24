(function(){
  "use strict";
  const shared=window.DPRO_MEDICAL_CONFIG||{};
  const input=window.DPRO_MEDICAL_RUNTIME_INPUT||{};
  const environmentMode=input.environmentMode==="demo" ? "demo" : (shared.environmentMode==="demo" ? "demo" : "production");
  const mockMode=input.mockMode===true || shared.mockMode===true;
  const apiBaseUrl=typeof input.apiBaseUrl==="string" ? input.apiBaseUrl : (typeof shared.apiBaseUrl==="string" ? shared.apiBaseUrl : "");
  const clinicId=typeof input.clinicId==="string" ? input.clinicId : (typeof shared.clinicId==="string" ? shared.clinicId : "");
  window.DPRO_MEDICAL_CONFIG=Object.freeze({...shared,environmentMode,mockMode,apiBaseUrl,clinicId});

  // BRUSHUP-7 PATIENT APPOINTMENT SELF-SERVICE V1.0
  if(typeof document!=="undefined" && /(?:^|\/)patient-reservation-detail\.html$/.test(location.pathname||"")){
    const s=document.createElement("script");
    s.src="patient-reservation-self-service.js";
    s.defer=true;
    s.dataset.dproPatientAppointmentSelfService="1";
    document.head.appendChild(s);
  }
})();
