(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-7 POST ACTION CLEANUP V1.3
  let scheduled=false;

  function cleanup(){
    const statusText=(document.getElementById("statusLabel")?.textContent||"").trim();
    const cancelled=/キャンセル済み|cancelled/i.test(statusText);
    if(!cancelled) return;

    const slotMessage=document.querySelector("[data-slot-load-message]");
    if(slotMessage && /予約変更が完了しました/.test(slotMessage.textContent||"")){
      slotMessage.remove();
    }

    const changeConfirm=document.getElementById("changeConfirm");
    if(changeConfirm) changeConfirm.classList.add("hidden");

    const changeSelect=document.getElementById("changeSlot");
    if(changeSelect){
      changeSelect.selectedIndex=0;
    }
  }

  function schedule(){
    if(scheduled) return;
    scheduled=true;
    setTimeout(()=>{
      scheduled=false;
      cleanup();
    },0);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",schedule,{once:true});
  }else{
    schedule();
  }

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();