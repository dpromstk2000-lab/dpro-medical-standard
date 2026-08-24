(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-7 PATIENT APPOINTMENT SELF-SERVICE V1.0
  const $=id=>document.getElementById(id);
  const ALLOWED_STATUS=new Set(["pending","confirmed"]);

  function tokyoDate(){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }
  function isFuture(appt){
    if(appt?.start_at){
      const t=new Date(appt.start_at).getTime();
      if(Number.isFinite(t)) return t>Date.now();
    }
    const d=String(appt?.appointment_date||"").slice(0,10);
    return !d || d>=tokyoDate();
  }
  function note(container,text){
    if(!container) return;
    let el=container.querySelector("[data-self-service-note]");
    if(!el){
      el=document.createElement("p");
      el.className="note";
      el.dataset.selfServiceNote="1";
      container.insertBefore(el,container.children[1]||null);
    }
    el.textContent=text;
  }
  function disable(container,disabled){
    if(!container)return;
    container.querySelectorAll("input,select,button,textarea").forEach(el=>{el.disabled=disabled;});
  }
  function currentAppointment(appointments){
    const id=new URLSearchParams(location.search).get("appointment_id") || $("appointmentId")?.textContent?.trim();
    if(id) return appointments.find(a=>String(a.appointment_id)===String(id))||null;
    return appointments.length===1?appointments[0]:null;
  }
  function explain(status,future,setting,kind){
    if(!setting) return `医院の設定により、患者画面からの予約${kind}は現在利用できません。`;
    if(!ALLOWED_STATUS.has(status)) return `現在の状態（${window.DPRO_MEDICAL_PATIENT_API?.getStatusLabel?.(status)||status||"-"}）では予約${kind}できません。`;
    if(!future) return `過去の予約は患者画面から${kind}できません。`;
    return "";
  }

  async function applyPolicy(){
    const changeButton=$("changePreview");
    const cancelButton=$("cancelOpen");
    if(!changeButton && !cancelButton) return;

    const changeCard=changeButton?.closest(".card");
    const cancelCard=cancelButton?.closest(".card");
    const date=$("changeDate");
    if(date) date.min=tokyoDate();

    try{
      if(!window.DPRO_MEDICAL_PATIENT_API) return;
      const runtime=await window.DPRO_MEDICAL_PATIENT_API.prepareRuntime();
      const api=window.DPRO_MEDICAL_PATIENT_API.createPatientApiAdapter(runtime);
      const top=await api.getPatientTop();
      const ctx=top?.data?.context||{};
      const appointments=Array.isArray(top?.data?.appointments)?top.data.appointments:[];
      const appt=currentAppointment(appointments);
      const policy=ctx?.patient_ui?.appointments||ctx?.patientUi?.appointments||{};
      const allowReschedule=policy.allow_reschedule??policy.allowReschedule??true;
      const allowCancel=policy.allow_cancel??policy.allowCancel??true;
      if(!appt) return;

      const future=isFuture(appt);
      const canReschedule=allowReschedule && ALLOWED_STATUS.has(appt.status) && future;
      const canCancel=allowCancel && ALLOWED_STATUS.has(appt.status) && future;

      disable(changeCard,!canReschedule);
      disable(cancelCard,!canCancel);

      const changeReason=explain(appt.status,future,allowReschedule,"変更");
      const cancelReason=explain(appt.status,future,allowCancel,"キャンセル");
      if(changeReason) note(changeCard,changeReason);
      if(cancelReason) note(cancelCard,cancelReason);

      if(canReschedule) changeCard?.querySelector("[data-self-service-note]")?.remove();
      if(canCancel) cancelCard?.querySelector("[data-self-service-note]")?.remove();

      const root=$("detail");
      if(root){
        root.dataset.canReschedule=String(canReschedule);
        root.dataset.canCancel=String(canCancel);
      }
    }catch(_){
      // Existing page error handling remains authoritative.
    }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(applyPolicy,0),{once:true});
  else setTimeout(applyPolicy,0);

  // Re-apply after successful cancel/reschedule changes the page state.
  const observer=new MutationObserver(()=>setTimeout(applyPolicy,0));
  if(document.documentElement) observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
