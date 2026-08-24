(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-8 DIGITAL CARD QR CHECK-IN V1.0
  const $=id=>document.getElementById(id);
  let refreshTimer=null;

  function apiBase(){ return String(window.DPRO_MEDICAL_CONFIG?.apiBaseUrl||"").replace(/\/+$/,""); }
  async function requestToken(){
    const token=await window.DPRO_MEDICAL_AUTH.getAccessToken("patient");
    const headers={Accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+token};
    const clinicId=window.DPRO_MEDICAL_CONFIG?.clinicId;
    if(clinicId) headers["X-DPRO-Clinic-ID"]=clinicId;
    const res=await fetch(apiBase()+"/api/medical/v1/patient/checkin-token",{method:"POST",headers,body:"{}",credentials:"include",cache:"no-store"});
    let body=null;try{body=await res.json();}catch(_){throw Object.assign(new Error("受付QRを取得できませんでした。"),{code:"INVALID_RESPONSE"});}
    if(!res.ok||body?.ok!==true){const e=body?.error||{};throw Object.assign(new Error(e.message||"受付QRを取得できませんでした。"),{code:e.code||("HTTP_"+res.status),details:e.details||null});}
    return body.data;
  }
  function fmtJst(value){
    if(!value) return "";
    const d=new Date(value);if(!Number.isFinite(d.getTime()))return "";
    return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
  }
  function fmtRange(a){
    if(!a) return "次回予約：なし";
    if(!a.start_at) return `次回予約：${a.appointment_date||"-"}`;
    const st=new Date(a.start_at), et=a.end_at?new Date(a.end_at):null;
    const dateFmt=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"long",day:"numeric"});
    const timeFmt=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hour12:false});
    return `次回予約：${dateFmt.format(st)} ${timeFmt.format(st)}${et?`〜${timeFmt.format(et)}`:""}`;
  }
  function loadQrLib(){
    if(window.QRCode) return Promise.resolve(window.QRCode);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-dpro-qrcodejs="1"]');
      if(existing){existing.addEventListener("load",()=>resolve(window.QRCode),{once:true});existing.addEventListener("error",reject,{once:true});return;}
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      s.async=true;s.crossOrigin="anonymous";s.dataset.dproQrcodejs="1";
      s.onload=()=>window.QRCode?resolve(window.QRCode):reject(new Error("QR library unavailable"));
      s.onerror=()=>reject(new Error("QR library unavailable"));
      document.head.appendChild(s);
    });
  }
  function checkinUrl(token){
    const u=new URL("owner-ipad.html",location.href);
    u.search="";
    u.hash="checkin_qr="+encodeURIComponent(token);
    return u.href;
  }
  function showPending(text){
    $("qrReady")?.classList.add("hidden");
    $("qrOff")?.classList.add("hidden");
    const p=$("qrPending");if(p){p.textContent=text;p.classList.remove("hidden");}
  }
  function showOff(text){
    $("qrReady")?.classList.add("hidden");
    $("qrPending")?.classList.add("hidden");
    const o=$("qrOff");if(o){o.textContent=text;o.classList.remove("hidden");}
  }
  async function renderQr(data){
    const ready=$("qrReady");if(!ready)return;
    const QR=await loadQrLib();
    ready.textContent="";
    ready.classList.remove("hidden");
    $("qrPending")?.classList.add("hidden");$("qrOff")?.classList.add("hidden");
    const title=document.createElement("h2");title.textContent="来院受付QR";title.style.margin="18px 0 8px";
    const help=document.createElement("p");help.className="small";help.textContent="院内iPadのカメラで読み取って受付します。QRは5分で自動更新されます。";
    const box=document.createElement("div");box.style.cssText="display:flex;justify-content:center;padding:14px;background:#fff;border:1px solid #d9e4ec;border-radius:16px;min-height:248px;align-items:center";
    const expiry=document.createElement("p");expiry.className="small";expiry.textContent=`このQRの有効期限：${fmtJst(data.expires_at)}`;
    ready.append(title,help,box,expiry);
    new QR(box,{text:checkinUrl(data.token),width:220,height:220,correctLevel:QR.CorrectLevel?.M});
    if(refreshTimer) clearTimeout(refreshTimer);
    const ms=Math.max(30000,new Date(data.expires_at).getTime()-Date.now()-30000);
    refreshTimer=setTimeout(refresh,Math.min(ms,240000));
  }
  async function refresh(){
    try{const data=await requestToken();await renderQr(data);}
    catch(err){
      const code=err?.code||"";
      if(code==="QR_CHECKIN_DISABLED"||code==="FEATURE_DISABLED") showOff("QRチェックインは現在利用できません。");
      else if(code==="TODAY_APPOINTMENT_NOT_FOUND") showPending("本日の受付対象予約はありません。");
      else if(code==="CHECKIN_WINDOW_CLOSED") showPending("現在はQR受付の利用時間外です。");
      else if(code==="ALREADY_CHECKED_IN") showPending("本日の予約は受付済みです。");
      else showPending("受付QRを表示できませんでした。受付で患者番号をお伝えください。");
    }
  }
  async function init(){
    try{
      const runtime=await window.DPRO_MEDICAL_PATIENT_API.prepareRuntime();
      const api=window.DPRO_MEDICAL_PATIENT_API.createPatientApiAdapter(runtime);
      const card=await api.getDigitalCard();
      const a=(card?.data?.appointments||[]).find(x=>x.status==="confirmed")||(card?.data?.appointments||[])[0]||null;
      if($("nextAppointment")) $("nextAppointment").textContent=fmtRange(a);
      if(card?.data?.qr_checkin_enabled!==true){showOff("QRチェックインは現在利用できません。");return;}
      await refresh();
    }catch(_){showPending("受付QRを準備できませんでした。");}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
