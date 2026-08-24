(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-5 PUBLIC / HP WAITING LIVE V1.0
  const cfg=window.DPROMedicalHPConfig||{};
  let timer=null;
  let inFlight=false;
  let lastRefreshSeconds=30;

  const $=sel=>document.querySelector(sel);
  const clampRefresh=value=>{
    const n=Number(value);
    return Number.isInteger(n)&&n>=15&&n<=300?n:30;
  };
  const bool=(value,fallback)=>typeof value==="boolean"?value:fallback;

  function endpoint(){
    const base=String(cfg.apiBaseUrl||"").replace(/\/$/,"");
    const clinic=encodeURIComponent(String(cfg.clinicId||"").trim());
    if(!base||!clinic) return "";
    return `${base}/api/medical/v1/clinics/${clinic}/waiting-count`;
  }

  function ensureUi(){
    const section=$("#waiting-section");
    const card=section?.querySelector(".waiting-card");
    if(!section||!card) return null;
    card.classList.add("hp-waiting-live-grid");

    let currentMetric=$("#hp-current-number-metric");
    if(!currentMetric){
      currentMetric=document.createElement("div");
      currentMetric.id="hp-current-number-metric";
      currentMetric.className="metric";
      currentMetric.innerHTML='<span>現在番号</span><strong id="hp-current-number">—</strong>';
      card.insertBefore(currentMetric,card.children[1]||null);
    }

    const minutesMetric=$("#waiting-minutes")?.closest(".metric");
    if(minutesMetric) minutesMetric.id="hp-waiting-minutes-metric";
    const countMetric=$("#waiting-count")?.closest(".metric");
    if(countMetric) countMetric.id="hp-waiting-count-metric";

    let note=$("#hp-waiting-refresh-note");
    if(!note){
      note=document.createElement("p");
      note.id="hp-waiting-refresh-note";
      note.className="small";
      const updated=$("#waiting-updated");
      if(updated?.parentNode) updated.parentNode.insertBefore(note,updated);
    }

    if(!$("#hp-waiting-live-style")){
      const style=document.createElement("style");
      style.id="hp-waiting-live-style";
      style.textContent='.waiting-card.hp-waiting-live-grid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}';
      document.head.appendChild(style);
    }
    return {section,currentMetric,countMetric,minutesMetric,note};
  }

  function setWaitingNavigationVisible(visible){
    document.querySelectorAll('a[href="#waiting-section"]').forEach(el=>{
      if(el.id==="same-day-reception") return;
      el.hidden=!visible;
    });
  }

  function hideSection(){
    const section=$("#waiting-section");
    if(section) section.hidden=true;
    setWaitingNavigationVisible(false);
  }

  function normalize(raw){
    const display=raw&&typeof raw.display==="object"&&raw.display?raw.display:{};
    const count=raw?.waiting_count==null?null:Number(raw.waiting_count);
    const current=raw?.current_queue_number==null?null:Number(raw.current_queue_number);
    const estimated=raw?.estimated_minutes==null?null:Number(raw.estimated_minutes);
    return {
      available:raw?.available===true,
      waiting_count:Number.isFinite(count)?count:null,
      current_queue_number:Number.isFinite(current)?current:null,
      estimated_minutes:Number.isFinite(estimated)?estimated:null,
      updated_at:raw?.updated_at||null,
      display:{
        show_waiting_count:bool(display.show_waiting_count,true),
        show_current_number:bool(display.show_current_number,false),
        refresh_seconds:clampRefresh(display.refresh_seconds)
      }
    };
  }

  function render(raw){
    const ui=ensureUi();
    if(!ui) return;
    const w=normalize(raw);
    lastRefreshSeconds=w.display.refresh_seconds;
    const anyVisible=w.display.show_waiting_count||w.display.show_current_number;
    ui.section.hidden=!w.available||!anyVisible;
    setWaitingNavigationVisible(!ui.section.hidden);
    if(ui.section.hidden) return;

    if(ui.countMetric) ui.countMetric.hidden=!w.display.show_waiting_count;
    ui.currentMetric.hidden=!w.display.show_current_number;
    if(ui.minutesMetric) ui.minutesMetric.hidden=w.estimated_minutes==null;

    const count=$("#waiting-count");
    if(count&&w.display.show_waiting_count) count.textContent=w.waiting_count==null?"—":`${w.waiting_count}人`;
    const current=$("#hp-current-number");
    if(current&&w.display.show_current_number) current.textContent=w.current_queue_number==null?"—":String(w.current_queue_number);
    const minutes=$("#waiting-minutes");
    if(minutes&&w.estimated_minutes!=null) minutes.textContent=`約${w.estimated_minutes}分`;
    const updated=$("#waiting-updated");
    if(updated) updated.textContent=w.updated_at?`最終更新 ${new Date(w.updated_at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`:"";
    if(ui.note) ui.note.textContent=`${lastRefreshSeconds}秒ごとに自動更新`;
  }

  async function fetchWaiting(){
    const url=endpoint();
    if(!url){hideSection();return null;}
    const response=await fetch(url,{method:"GET",cache:"no-store",headers:{Accept:"application/json"}});
    let body=null;
    try{body=await response.json();}catch(_){throw new Error("waiting response invalid");}
    if(!response.ok||body?.ok!==true){
      const code=body?.error?.code||"WAITING_API_ERROR";
      const e=new Error(code);e.code=code;throw e;
    }
    return body.data;
  }

  function schedule(){
    clearTimeout(timer); timer=null;
    if(document.hidden) return;
    timer=setTimeout(refresh,lastRefreshSeconds*1000);
  }

  async function refresh(){
    if(inFlight||document.hidden){schedule();return;}
    inFlight=true;
    try{render(await fetchWaiting());}
    catch(err){
      if(["FEATURE_DISABLED","FORBIDDEN","NOT_FOUND"].includes(err?.code)) hideSection();
      // transient errors keep the last valid public display instead of flashing.
    } finally { inFlight=false;schedule(); }
  }

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){clearTimeout(timer);timer=null;}
    else refresh();
  });

  // Own the public waiting section refresh cycle. Run once immediately and
  // once again after the existing full-page HP boot settles, then use the
  // configured interval.
  refresh();
  setTimeout(refresh,2200);
})();
