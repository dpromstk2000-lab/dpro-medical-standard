(function(){
  "use strict";
  const shared=window.DPRO_MEDICAL_CONFIG||{};
  const input=window.DPRO_MEDICAL_RUNTIME_INPUT||{};
  const environmentMode=input.environmentMode==="demo" ? "demo" : (shared.environmentMode==="demo" ? "demo" : "production");
  const mockMode=input.mockMode===true || shared.mockMode===true;
  const apiBaseUrl=typeof input.apiBaseUrl==="string" ? input.apiBaseUrl : (typeof shared.apiBaseUrl==="string" ? shared.apiBaseUrl : "");
  const clinicId=typeof input.clinicId==="string" ? input.clinicId : (typeof shared.clinicId==="string" ? shared.clinicId : "");
  window.DPRO_MEDICAL_CONFIG=Object.freeze({...shared,environmentMode,mockMode,apiBaseUrl,clinicId});

  // BRUSHUP-10 RECEPTION MODE SWITCH + CURRENT DIAGNOSIS NUMBER DISPLAY V1.0
  if(typeof document!=="undefined" && /(?:^|\/)patient-(?:reservation|wait-status)\.html$/.test(location.pathname||"")){
    const b10=document.createElement("script");
    b10.src="patient-brushup10-reception-display.js?v=brushup10-1.0";
    b10.defer=true;
    b10.dataset.dproPatientBrushup10="1";
    document.head.appendChild(b10);
  }

  // BRUSHUP-8 ARRIVAL CHECK-IN / QR RUNTIME V1.3
  // BRUSHUP-7 PATIENT APPOINTMENT SELF-SERVICE V1.3
  if(typeof document!=="undefined" && /(?:^|\/)patient-reservation-detail\.html$/.test(location.pathname||"")){
    const s=document.createElement("script");
    s.src="patient-reservation-self-service.js";
    s.defer=true;
    s.dataset.dproPatientAppointmentSelfService="1";
    document.head.appendChild(s);

    const c=document.createElement("script");
    c.src="patient-reservation-post-action-cleanup.js";
    c.defer=true;
    c.dataset.dproPatientAppointmentPostActionCleanup="1";
    document.head.appendChild(c);
  }

  if(typeof document!=="undefined" && /(?:^|\/)member\.html$/.test(location.pathname||"")){
    const m=document.createElement("script");
    m.src="patient-member-checkin-entry.js";
    m.defer=true;
    m.dataset.dproPatientMemberCheckinEntry="1";
    document.head.appendChild(m);
  }

  // patient-reception.html loads patient-reception-live.js directly.
  // This intentionally avoids dynamic/legacy double execution.

  if(typeof document!=="undefined" && /(?:^|\/)patient-digital-card\.html$/.test(location.pathname||"")){
    const q=document.createElement("script");
    q.src="patient-digital-card-qr.js";
    q.defer=true;
    q.dataset.dproPatientDigitalCardQr="1";
    document.head.appendChild(q);
  }
})();
