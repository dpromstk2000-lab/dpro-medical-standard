(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-8 PATIENT RECEPTION LIVE V1.0
  const $=id=>document.getElementById(id);
  let api=null, top=null, apps=[];
  let busy=false, shouldEnable=false;

  function tokyoDate(){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }
  function dateOf(appt){
    const d=String(appt?.appointment_date||"").slice(0,10);
    if(d) return d;
    if(appt?.start_at){
      const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(appt.start_at));
      const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      return `${m.year}-${m.month}-${m.day}`;
    }
    return "";
  }
  function timeText(value){
    if(!value) return "";
    const d=new Date(value); if(!Number.isFinite(d.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
  }
  function rangeText(appt){
    const st=timeText(appt?.start_at), et=timeText(appt?.end_at);
    if(st) return et?`${st}〜${et}`:st;
    return "時間指定なし";
  }
  function withinWindow(appt,settings){
    if(dateOf(appt)!==tokyoDate()) return false;
    const start=appt?.start_at?new Date(appt.start_at).getTime():NaN;
    const end=appt?.end_at?new Date(appt.end_at).getTime():NaN;
    if(!Number.isFinite(start)) return true;
    const before=Number(settings?.before_minutes??settings?.beforeMinutes??60);
    const after=Number(settings?.after_minutes??settings?.afterMinutes??120);
    const now=Date.now();
    return now>=start-before*60000 && now<=(Number.isFinite(end)?end:start)+after*60000;
  }
  function showError(text){
    const e=$("errorBox"); if(!e)return;
    e.textContent=text; e.classList.remove("hidden");
  }
  function clearError(){ $("errorBox")?.classList.add("hidden"); }
  async function load(){
    const runtime=await window.DPRO_MEDICAL_PATIENT_API.prepareRuntime();
    api=window.DPRO_MEDICAL_PATIENT_API.createPatientApiAdapter(runtime);
    top=await api.getPatientTop();
    const features=top?.data?.feature_flags||{};
    const ctx=top?.data?.context||{};
    const settings=ctx?.patient_ui?.checkin||ctx?.patientUi?.checkin||{};
    const allow=settings.allow_patient_web??settings.allowPatientWeb??true;
    const all=Array.isArray(top?.data?.appointments)?top.data.appointments:[];
    const eligible=all.filter(a=>a.status==="confirmed" && dateOf(a)===tokyoDate() && withinWindow(a,settings));
    const types=await api.getAppointmentTypes().catch(()=>({data:[]}));
    const typeMap=new Map((Array.isArray(types?.data)?types.data:[]).map(t=>[String(t.appointment_type_id),t.name||t.display_name||"予約"]));
    apps=eligible;
    const select=$("appointmentSelect"), btn=$("acceptBtn");
    if(select){
      select.innerHTML='<option value="">選択してください</option>'+eligible.map(a=>{
        const name=a.appointment_type_name||a.type_name||typeMap.get(String(a.appointment_type_id))||"予約";
        return `<option value="${String(a.appointment_id).replace(/"/g,'&quot;')}">${name} / ${rangeText(a)}</option>`;
      }).join('');
    }
    shouldEnable=allow&&eligible.length>0;
    if(!allow){
      if(btn) btn.disabled=true;
      showError("この医院では患者スマホからの来院受付を利用できません。");
      return;
    }
    if(!eligible.length){
      if(btn) btn.disabled=true;
      const before=Number(settings.before_minutes??settings.beforeMinutes??60);
      const after=Number(settings.after_minutes??settings.afterMinutes??120);
      showError(`現在受付可能な本日の予約はありません。受付時間は予約時刻の${before}分前から終了後${after}分までです。`);
      return;
    }
    if(btn) btn.disabled=false;
    clearError();
    if(!features.feature_queue){
      const link=$("accepted")?.querySelector('a[href="patient-wait-status.html"]');
      if(link) link.classList.add("hidden");
    }
  }
  async function accept(e){
    if(!e.target?.closest?.("#acceptBtn")) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(busy||!api) return;
    const id=$("appointmentSelect")?.value||"";
    if(!id){showError("受付する予約を選択してください。");return;}
    busy=true; $("acceptBtn").disabled=true; clearError();
    try{
      const features=top?.data?.feature_flags||{};
      const r=await api.sameDayCheckIn({appointment_id:id,use_queue:features.feature_queue===true});
      const d=r?.data||{};
      $("queueNumber").textContent=d.queue_number??"-";
      $("queueStatus").textContent=d.queue_number!=null?(d.already_checked_in?"受付済み（受付済みの番号）":"待機中"):(d.already_checked_in?"受付済み":"受付済み");
      $("accepted")?.classList.remove("hidden");
      const card=$("accepted");
      if(card){
        let note=card.querySelector("[data-checkin-idempotent-note]");
        if(d.already_checked_in){
          if(!note){note=document.createElement("p");note.className="small";note.dataset.checkinIdempotentNote="1";card.appendChild(note);}
          note.textContent="すでに受付済みです。最初の受付結果を表示しています。";
        } else note?.remove();
      }
      await load();
    }catch(err){
      const code=err?.code||"";
      const msg=code==="CHECKIN_WINDOW_CLOSED"?"現在は受付可能時間外です。":code==="APPOINTMENT_NOT_CHECKINABLE"?"この予約は現在受付できません。":"受付処理に失敗しました。もう一度お試しください。";
      showError(msg);
    }finally{busy=false;if(apps.length) $("acceptBtn").disabled=false;}
  }
  async function init(){
    document.addEventListener("click",accept,true);
    const btn=$("acceptBtn");
    if(btn)new MutationObserver(()=>{if(shouldEnable&&!busy&&btn.disabled)btn.disabled=false;}).observe(btn,{attributes:true,attributeFilter:["disabled"]});
    try{await load();setTimeout(()=>load().catch(()=>{}),700);}catch(_){showError("受付画面を準備できませんでした。");btn&&(btn.disabled=true);}
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();
