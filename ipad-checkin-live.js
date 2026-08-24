(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-8 IPAD / QR CHECK-IN LIVE V1.0
  let busy=false;

  function cfg(){return window.DPRO_MEDICAL_CLINIC_CONFIG||{};}
  async function request(path,body){
    const token=await window.DPRO_MEDICAL_AUTH.getAccessToken("staff");
    const headers={Accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+token};
    if(cfg().clinicId) headers["X-DPRO-Clinic-ID"]=cfg().clinicId;
    const res=await fetch((cfg().apiBaseUrl||"")+path,{method:"POST",headers,body:JSON.stringify(body||{}),credentials:"include",cache:"no-store"});
    let json=null;try{json=await res.json();}catch(_){throw Object.assign(new Error("受付API応答を確認できませんでした。"),{code:"INVALID_RESPONSE"});}
    if(!res.ok||json?.ok!==true){const e=json?.error||{};throw Object.assign(new Error(e.message||e.code||"受付処理に失敗しました。"),{code:e.code||("HTTP_"+res.status),details:e.details||null});}
    return json.data;
  }
  function resultBox(){
    let box=document.getElementById("dpro-ipad-checkin-result");
    if(box)return box;
    box=document.createElement("div");box.id="dpro-ipad-checkin-result";
    box.style.cssText="position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;width:min(92vw,520px);padding:16px 18px;border:1px solid #c9d5df;background:#fff;border-radius:16px;box-shadow:0 12px 34px rgba(0,0,0,.18);font:14px/1.6 system-ui,-apple-system,'Noto Sans JP',sans-serif;color:#17324a;display:none";
    document.body.appendChild(box);return box;
  }
  function show(text,type,data){
    const box=resultBox();
    const ok=type==="ok", pending=type==="pending";
    box.style.display="block";
    box.style.borderColor=ok?"#9ccfb0":pending?"#c9d5df":"#e2b0b0";
    const number=data?.queue_number;
    box.innerHTML=`<strong style="font-size:18px">${ok?'受付しました':pending?'QR受付を確認中':'受付できませんでした'}</strong><div style="margin-top:6px">${text}</div>${number!=null?`<div style="font-size:28px;font-weight:900;margin-top:6px">受付番号 ${number}</div>`:""}<div style="display:flex;gap:8px;margin-top:12px"><button type="button" data-ipad-checkin-refresh style="border:0;border-radius:10px;background:#1769aa;color:#fff;padding:10px 14px;font-weight:700;cursor:pointer">一覧を更新</button><button type="button" data-ipad-checkin-close style="border:1px solid #c9d5df;border-radius:10px;background:#fff;padding:10px 14px;font-weight:700;cursor:pointer">閉じる</button></div>`;
  }
  function qrTokenFromLocation(){
    try{return new URLSearchParams(String(location.hash||"").replace(/^#/,"")).get("checkin_qr")||"";}catch(_){return "";}
  }
  function cleanupQrParam(){
    const raw=String(location.hash||"").replace(/^#/,"");
    if(!raw)return;
    const params=new URLSearchParams(raw);if(!params.has("checkin_qr"))return;
    params.delete("checkin_qr");
    const nextHash=params.toString()?"#"+params.toString():"";
    history.replaceState(null,"",location.pathname+location.search+nextHash);
  }
  function messageFor(err){
    const c=err?.code||"";
    if(c==="QR_TOKEN_EXPIRED")return "QRの有効期限が切れています。患者側でQRを更新して、もう一度読み取ってください。";
    if(c==="QR_SIGNATURE_INVALID"||c==="QR_SCOPE_MISMATCH"||c==="INVALID_QR_TOKEN")return "このQRを確認できませんでした。患者のデジタル診察券から再表示してください。";
    if(c==="CHECKIN_WINDOW_CLOSED")return "現在は受付可能時間外です。";
    if(c==="IPAD_CHECKIN_DISABLED"||c==="QR_CHECKIN_DISABLED"||c==="FEATURE_DISABLED")return "医院設定でiPad／QR受付が利用できません。";
    if(c==="APPOINTMENT_NOT_CHECKINABLE")return "この予約は現在受付できません。";
    return "受付処理に失敗しました。もう一度お試しください。";
  }
  async function doQr(token){
    if(!token||busy)return;busy=true;
    show("QRを確認しています…","pending");
    try{const d=await request("/api/medical/v1/check-in/qr",{token});show(d.already_checked_in?"すでに受付済みです。最初の受付結果を表示しています。":"QR受付が完了しました。","ok",d);}
    catch(err){show(messageFor(err),"err");}
    finally{busy=false;cleanupQrParam();}
  }
  async function doManual(appointmentId){
    if(!appointmentId||busy)return;busy=true;
    try{const d=await request("/api/medical/v1/check-in/ipad",{appointment_id:appointmentId});show(d.already_checked_in?"すでに受付済みです。最初の受付結果を表示しています。":"iPad受付が完了しました。","ok",d);}
    catch(err){show(messageFor(err),"err");}
    finally{busy=false;}
  }
  function injectGuide(){
    const section=document.getElementById("ipad-reception");if(!section||section.querySelector("[data-brushup8-ipad-guide]"))return;
    const note=document.createElement("div");note.className="notice";note.dataset.brushup8IpadGuide="1";note.style.marginBottom="12px";
    note.innerHTML="<strong>QR受付対応</strong><br>患者のデジタル診察券QRをiPadの標準カメラで読み取ると、この画面を開いて自動受付します。通常の患者検索からの受付も同じ二重受付防止が有効です。";
    section.prepend(note);
  }
  async function clickCapture(e){
    const refresh=e.target?.closest?.("[data-ipad-checkin-refresh]");if(refresh){e.preventDefault();location.reload();return;}
    const close=e.target?.closest?.("[data-ipad-checkin-close]");if(close){e.preventDefault();resultBox().style.display="none";return;}
    const btn=e.target?.closest?.("[data-checkin]");
    if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    await doManual(btn.dataset.checkin||"");
  }
  async function init(){
    try{if(window.DPRO_MEDICAL_CLINIC_BOOT)await window.DPRO_MEDICAL_CLINIC_BOOT;}catch(_){return;}
    document.addEventListener("click",clickCapture,true);
    injectGuide();
    new MutationObserver(injectGuide).observe(document.documentElement,{subtree:true,childList:true});
    const token=qrTokenFromLocation();
    if(token)await doQr(token);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
