(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-8 PATIENT TOP CHECK-IN ENTRY V1.0
  let desiredVisible=null;

  function tokyoDate(){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }
  function dateOf(appt){
    const direct=String(appt?.appointment_date||"").slice(0,10);
    if(direct) return direct;
    if(!appt?.start_at) return "";
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(appt.start_at));
    const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }
  function apply(){
    if(desiredVisible===null)return;
    const btn=document.getElementById("receptionBtn");
    if(!btn)return;
    btn.hidden=!desiredVisible;
    if(desiredVisible){
      btn.textContent="来院受付";
      btn.setAttribute("aria-label","本日の来院受付");
    }
  }
  async function init(){
    try{
      const runtime=await window.DPRO_MEDICAL_PATIENT_API.prepareRuntime();
      const api=window.DPRO_MEDICAL_PATIENT_API.createPatientApiAdapter(runtime);
      const top=await api.getPatientTop();
      const ctx=top?.data?.context||{};
      const setting=ctx?.patient_ui?.checkin||ctx?.patientUi?.checkin||{};
      const allow=setting.allow_patient_web??setting.allowPatientWeb??true;
      const today=tokyoDate();
      const hasTodayConfirmed=(top?.data?.appointments||[]).some(a=>a?.status==="confirmed"&&dateOf(a)===today);
      desiredVisible=Boolean(allow&&hasTodayConfirmed);
      apply();
      setTimeout(apply,500);
      setTimeout(apply,1200);
    }catch(_){desiredVisible=false;apply();}
  }
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:["hidden"]});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
