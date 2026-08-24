(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-7 PATIENT APPOINTMENT SELF-SERVICE V1.1
  // Display polish: JST appointment range + appointment type label.
  const $=id=>document.getElementById(id);
  const ALLOWED_STATUS=new Set(["pending","confirmed"]);
  let applying=false;
  let scheduled=false;

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
    if(el.textContent!==text) el.textContent=text;
  }

  function disable(container,disabled){
    if(!container)return;
    container.querySelectorAll("input,select,button,textarea").forEach(el=>{
      if(el.disabled!==disabled) el.disabled=disabled;
    });
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

  function formatJstRange(appt){
    const start=appt?.start_at ? new Date(appt.start_at) : null;
    const end=appt?.end_at ? new Date(appt.end_at) : null;
    if(start && Number.isFinite(start.getTime())){
      const dateFmt=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"long",day:"numeric"});
      const timeFmt=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hour12:false});
      const date=dateFmt.format(start);
      const st=timeFmt.format(start);
      const et=end && Number.isFinite(end.getTime()) ? timeFmt.format(end) : "";
      return et ? `${date} ${st}〜${et}` : `${date} ${st}`;
    }
    const d=String(appt?.appointment_date||"").slice(0,10);
    return d || "-";
  }

  async function applyPolicy(){
    if(applying) return;
    applying=true;
    try{
      const changeButton=$("changePreview");
      const cancelButton=$("cancelOpen");
      if(!changeButton && !cancelButton) return;

      const changeCard=changeButton?.closest(".card");
      const cancelCard=cancelButton?.closest(".card");
      const date=$("changeDate");
      if(date) date.min=tokyoDate();

      if(!window.DPRO_MEDICAL_PATIENT_API) return;
      const runtime=await window.DPRO_MEDICAL_PATIENT_API.prepareRuntime();
      const api=window.DPRO_MEDICAL_PATIENT_API.createPatientApiAdapter(runtime);
      const top=await api.getPatientTop();
      const ctx=top?.data?.context||{};
      const appointments=Array.isArray(top?.data?.appointments)?top.data.appointments:[];
      const appt=currentAppointment(appointments);
      if(!appt) return;

      // Patient-facing display polish.
      const currentTime=$("currentTime");
      if(currentTime){
        const text=formatJstRange(appt);
        if(currentTime.textContent!==text) currentTime.textContent=text;
      }

      let typeName=appt.appointment_type_name||appt.type_name||appt.name||"";
      if(!typeName && appt.appointment_type_id){
        try{
          const types=await api.getAppointmentTypes();
          const list=Array.isArray(types?.data)?types.data:[];
          const t=list.find(x=>String(x.appointment_type_id)===String(appt.appointment_type_id));
          typeName=t?.name||t?.display_name||"";
        }catch(_){}
      }
      const typeId=$("typeId");
      if(typeId && typeName && typeId.textContent!==typeName) typeId.textContent=typeName;

      const policy=ctx?.patient_ui?.appointments||ctx?.patientUi?.appointments||{};
      const allowReschedule=policy.allow_reschedule??policy.allowReschedule??true;
      const allowCancel=policy.allow_cancel??policy.allowCancel??true;
      const future=isFuture(appt);
      const canReschedule=allowReschedule && ALLOWED_STATUS.has(appt.status) && future;
      const canCancel=allowCancel && ALLOWED_STATUS.has(appt.status) && future;

      disable(changeCard,!canReschedule);
      disable(cancelCard,!canCancel);

      const changeReason=explain(appt.status,future,allowReschedule,"変更");
      const cancelReason=explain(appt.status,future,allowCancel,"キャンセル");
      if(changeReason) note(changeCard,changeReason);
      else changeCard?.querySelector("[data-self-service-note]")?.remove();
      if(cancelReason) note(cancelCard,cancelReason);
      else cancelCard?.querySelector("[data-self-service-note]")?.remove();

      const root=$("detail");
      if(root){
        root.dataset.canReschedule=String(canReschedule);
        root.dataset.canCancel=String(canCancel);
      }
    }catch(_){
      // Existing page error handling remains authoritative.
    }finally{
      applying=false;
    }
  }

  function scheduleApply(){
    if(scheduled) return;
    scheduled=true;
    setTimeout(async()=>{
      scheduled=false;
      await applyPolicy();
    },0);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",scheduleApply,{once:true});
  else scheduleApply();

  // Re-apply after successful cancel/reschedule changes page state.
  const observer=new MutationObserver(scheduleApply);
  if(document.documentElement) observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();