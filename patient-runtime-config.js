(function(){
  "use strict";
  const shared=window.DPRO_MEDICAL_CONFIG||{};
  const input=window.DPRO_MEDICAL_RUNTIME_INPUT||{};
  const environmentMode=input.environmentMode==="demo" ? "demo" : (shared.environmentMode==="demo" ? "demo" : "production");
  const mockMode=input.mockMode===true || shared.mockMode===true;
  const apiBaseUrl=typeof input.apiBaseUrl==="string" ? input.apiBaseUrl : (typeof shared.apiBaseUrl==="string" ? shared.apiBaseUrl : "");
  const clinicId=typeof input.clinicId==="string" ? input.clinicId : (typeof shared.clinicId==="string" ? shared.clinicId : "");
  window.DPRO_MEDICAL_CONFIG=Object.freeze({...shared,environmentMode,mockMode,apiBaseUrl,clinicId});

  // BRUSHUP-8 ARRIVAL CHECK-IN / QR RUNTIME V1.1
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

  if(typeof document!=="undefined" && /(?:^|\/)patient-reception\.html$/.test(location.pathname||"")){
    const r=document.createElement("script");
    r.src="patient-reception-live.js";
    r.defer=true;
    r.dataset.dproPatientReceptionLive="1";
    document.head.appendChild(r);

    const p=document.createElement("script");
    p.src="patient-reception-post-checkin.js";
    p.defer=true;
    p.dataset.dproPatientReceptionPostCheckin="1";
    document.head.appendChild(p);
  }

  if(typeof document!=="undefined" && /(?:^|\/)patient-digital-card\.html$/.test(location.pathname||"")){
    const q=document.createElement("script");
    q.src="patient-digital-card-qr.js";
    q.defer=true;
    q.dataset.dproPatientDigitalCardQr="1";
    document.head.appendChild(q);
  }

})();