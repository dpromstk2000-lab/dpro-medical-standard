(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-7 PATIENT APPOINTMENT SELF-SERVICE V1.2
  // LIVE FIX: robust slot load -> preview -> reschedule flow + JST display.
  const $=id=>document.getElementById(id);
  const ALLOWED_STATUS=new Set(["pending","confirmed"]);
  let applying=false;
  let scheduled=false;
  let runtimeApi=null;
  let currentAppt=null;
  let loadedSlots=[];
  let selectedSlot=null;

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

  function status(text,type=""){
    const select=$("changeSlot");
    if(!select) return;
    let el=document.querySelector("[data-slot-load-message]");
    if(!el){
      el=document.createElement("p");
      el.dataset.slotLoadMessage="1";
      el.className="small";
      select.insertAdjacentElement("afterend",el);
    }
    el.textContent=text;
    el.style.margin="8px 0";
    el.style.color=type==="error"?"#982d2d":"";
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

  function explain(statusValue,future,setting,kind){
    if(!setting) return `医院の設定により、患者画面からの予約${kind}は現在利用できません。`;
    if(!ALLOWED_STATUS.has(statusValue)) return `現在の状態（${window.DPRO_MEDICAL_PATIENT_API?.getStatusLabel?.(statusValue)||statusValue||"-"}）では予約${kind}できません。`;
    if(!future) return `過去の予約は患者画面から${kind}できません。`;
    return "";
  }

  function formatJstDateTime(value){
    const d=value?new Date(value):null;
    if(!d || !Number.isFinite(d.getTime())) return String(value||"");
    return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
  }

  function formatJstTime(value){
    const d=value?new Date(value):null;
    if(!d || !Number.isFinite(d.getTime())) return String(value||"");
    return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
  }

  function formatJstRange(appt){
    const start=appt?.start_at ? new Date(appt.start_at) : null;
    const end=appt?.end_at ? new Date(appt.end_at) : null;
    if(start && Number.isFinite(start.getTime())){
      const dateFmt=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"long",day:"numeric"});
      const date=dateFmt.format(start);
      const st=formatJstTime(start);
      const et=end && Number.isFinite(end.getTime()) ? formatJstTime(end) : "";
      return et ? `${date} ${st}〜${et}` : `${date} ${st}`;
    }
    return String(appt?.appointment_date||"").slice(0,10)||"-";
  }

  async function getApi(){
    if(runtimeApi) return runtimeApi;
    if(!window.DPRO_MEDICAL_PATIENT_API) throw new Error("患者APIを準備できませんでした。");
    const runtime=await window.DPRO_MEDICAL_PATIENT_API.prepareRuntime();
    runtimeApi=window.DPRO_MEDICAL_PATIENT_API.createPatientApiAdapter(runtime);
    return runtimeApi;
  }

  async function refreshCurrent(){
    const api=await getApi();
    const top=await api.getPatientTop();
    const appointments=Array.isArray(top?.data?.appointments)?top.data.appointments:[];
    currentAppt=currentAppointment(appointments);
    return {api,top,appointments,appt:currentAppt};
  }

  async function polishDisplay(api,appt){
    const currentTime=$("currentTime");
    if(currentTime){
      const text=formatJstRange(appt);
      if(currentTime.textContent!==text) currentTime.textContent=text;
    }

    let typeName=appt?.appointment_type_name||appt?.type_name||appt?.name||"";
    if(!typeName && appt?.appointment_type_id){
      try{
        const types=await api.getAppointmentTypes();
        const list=Array.isArray(types?.data)?types.data:[];
        const t=list.find(x=>String(x.appointment_type_id)===String(appt.appointment_type_id));
        typeName=t?.name||t?.display_name||"";
      }catch(_){}
    }
    const typeId=$("typeId");
    if(typeId && typeName && typeId.textContent!==typeName) typeId.textContent=typeName;
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

      const {api,top,appt}=await refreshCurrent();
      if(!appt) return;
      await polishDisplay(api,appt);

      const ctx=top?.data?.context||{};
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

  function stopOriginal(e){
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  async function loadSlots(e){
    stopOriginal(e);
    const btn=$("loadChangeSlots");
    const select=$("changeSlot");
    const date=$("changeDate")?.value;
    if(!btn||!select) return;
    if(!date){ status("変更後の日付を選択してください。","error"); return; }
    if(date<tokyoDate()){ status("過去の日付は選択できません。","error"); return; }

    btn.disabled=true;
    status("変更可能枠を取得しています...");
    try{
      const {api,appt}=await refreshCurrent();
      if(!appt?.appointment_type_id) throw new Error("予約種別を確認できませんでした。");
      const r=await api.getAppointmentSlots({date,appointment_type_id:appt.appointment_type_id});
      loadedSlots=(Array.isArray(r?.data)?r.data:[]).filter(s=>s?.appointment_slot_id && s.available!==false && Number(s.remaining_capacity??1)>0);
      selectedSlot=null;
      select.innerHTML='<option value="">選択してください</option>'+loadedSlots.map(s=>{
        const label=`${formatJstTime(s.starts_at)}〜${formatJstTime(s.ends_at)}`;
        return `<option value="${String(s.appointment_slot_id).replace(/"/g,'&quot;')}">${label}</option>`;
      }).join("");
      if(loadedSlots.length) status(`${loadedSlots.length}件の変更可能枠を取得しました。`);
      else status("この日の変更可能枠はありません。","error");
    }catch(err){
      select.innerHTML='<option value="">枠を取得してください</option>';
      status(`変更可能枠を取得できませんでした。${err?.message?` ${err.message}`:""}`,"error");
    }finally{
      btn.disabled=false;
    }
  }

  function previewChange(e){
    stopOriginal(e);
    const id=$("changeSlot")?.value||"";
    selectedSlot=loadedSlots.find(s=>String(s.appointment_slot_id)===String(id))||null;
    if(!selectedSlot){ status("変更後の予約枠を選択してください。","error"); return; }
    const date=$("changeDate")?.value||"";
    const text=$("changeText");
    if(text) text.textContent=`${date.replaceAll("-","/")} ${formatJstTime(selectedSlot.starts_at)}〜${formatJstTime(selectedSlot.ends_at)} へ変更します。`;
    $("changeConfirm")?.classList.remove("hidden");
    status("変更内容を確認してください。");
  }

  async function submitChange(e){
    stopOriginal(e);
    const btn=$("changeSubmit");
    if(!btn||!selectedSlot||!currentAppt) return;
    btn.disabled=true;
    try{
      const api=await getApi();
      const date=$("changeDate")?.value||"";
      const r=await api.rescheduleAppointment({
        appointment_id:currentAppt.appointment_id,
        appointment_slot_id:selectedSlot.appointment_slot_id,
        appointment_date:date,
        start_at:selectedSlot.starts_at,
        end_at:selectedSlot.ends_at
      });
      currentAppt={...currentAppt,...(r?.data||{}),appointment_date:date,start_at:selectedSlot.starts_at,end_at:selectedSlot.ends_at};
      const currentTime=$("currentTime");
      if(currentTime) currentTime.textContent=formatJstRange(currentAppt);
      $("changeConfirm")?.classList.add("hidden");
      const title=$("successTitle"), body=$("successBody"), box=$("success");
      if(title) title.textContent="予約を変更しました";
      if(body) body.textContent=`変更後：${formatJstRange(currentAppt)}`;
      box?.classList.remove("hidden");
      loadedSlots=[]; selectedSlot=null;
      status("予約変更が完了しました。");
      await applyPolicy();
    }catch(err){
      status(`予約変更に失敗しました。${err?.message?` ${err.message}`:""}`,"error");
    }finally{
      btn.disabled=false;
    }
  }

  function installFlow(){
    const load=$("loadChangeSlots"), preview=$("changePreview"), submit=$("changeSubmit");
    if(load && !load.dataset.dproBrushup7Fixed){
      load.dataset.dproBrushup7Fixed="1";
      load.addEventListener("click",loadSlots,true);
    }
    if(preview && !preview.dataset.dproBrushup7Fixed){
      preview.dataset.dproBrushup7Fixed="1";
      preview.addEventListener("click",previewChange,true);
    }
    if(submit && !submit.dataset.dproBrushup7Fixed){
      submit.dataset.dproBrushup7Fixed="1";
      submit.addEventListener("click",submitChange,true);
    }
  }

  function scheduleApply(){
    installFlow();
    if(scheduled) return;
    scheduled=true;
    setTimeout(async()=>{
      scheduled=false;
      installFlow();
      await applyPolicy();
    },0);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",scheduleApply,{once:true});
  else scheduleApply();

  const observer=new MutationObserver(scheduleApply);
  if(document.documentElement) observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
