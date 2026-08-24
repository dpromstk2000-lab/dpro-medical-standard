(function(global){
  'use strict';
  // BRUSHUP-5 PUBLIC / HP WAITING DISPLAY V1.0
  const MODE_LABELS={datetime:'日時予約',queue:'順番受付',time_window:'時間帯受付',complete_reservation:'完全予約（案内）',walk_in:'直接来院（予約不要）'};
  const FEATURE_BY_MODE={datetime:'feature_datetime_booking',queue:'feature_queue',time_window:'feature_time_window'};
  const $=id=>document.getElementById(id);
  let context=null,appointmentTypes=[];

  function config(){ return global.DPRO_MEDICAL_CLINIC_CONFIG||{}; }
  async function token(){
    if(!global.DPRO_MEDICAL_AUTH||typeof global.DPRO_MEDICAL_AUTH.getAccessToken!=='function') throw new Error('認証情報を取得できません。');
    const t=await global.DPRO_MEDICAL_AUTH.getAccessToken(); if(!t) throw new Error('ログイン情報がありません。'); return t;
  }
  async function request(path,options){
    const opts=Object.assign({method:'GET'},options||{}); const t=await token();
    const headers=Object.assign({Accept:'application/json',Authorization:'Bearer '+t},opts.headers||{});
    if(config().clinicId) headers['X-DPRO-Clinic-ID']=config().clinicId;
    if(opts.body!=null&&!headers['Content-Type']) headers['Content-Type']='application/json';
    const res=await fetch((config().apiBaseUrl||'')+path,Object.assign({},opts,{headers}));
    let body=null; try{body=await res.json();}catch(_){throw new Error('API応答を読み取れませんでした。');}
    if(!res.ok||body?.ok!==true){const e=body?.error;throw new Error(e?.message||e?.code||('HTTP '+res.status));}
    return body.data;
  }
  function setBanner(text,type){const el=$('clinic-settings-banner');if(!el)return;el.textContent=text;el.className='notice'+(type==='ok'?' ok':type==='err'?' error':'');}
  function message(id,text,type){const el=$(id);if(!el)return;el.textContent=text;el.className='settings-message '+(type||'');}
  function busy(v){$('clinic-settings-root')?.classList.toggle('settings-loading',!!v);}
  function allowed(mode){const f=FEATURE_BY_MODE[mode];return !f||context?.features?.[f]===true;}
  function optionHtml(mode,current){const disabled=!allowed(mode);return `<option value="${mode}" ${mode===current?'selected':''} ${disabled?'disabled':''}>${MODE_LABELS[mode]}${disabled?'（Feature OFF）':''}</option>`;}
  function renderBooking(){
    const holder=$('booking-settings-list'); if(!holder)return;
    holder.innerHTML=appointmentTypes.map(t=>{
      const id=String(t.appointment_type_id||t.appointmentTypeId||''); const code=String(t.type_code||t.typeCode||''); const name=String(t.name||'予約種別'); const mode=String(t.booking_mode||t.bookingMode||'datetime');
      const opts=['datetime','queue','time_window','complete_reservation','walk_in'].map(m=>optionHtml(m,mode)).join('');
      return `<div class="booking-setting-item" data-booking-row="${id}"><div class="booking-setting-name"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(code)}</small></div><select data-booking-select="${id}">${opts}</select><button class="btn" type="button" data-booking-save="${id}">保存</button><span class="settings-message" data-booking-message="${id}" style="grid-column:1/-1"></span></div>`;
    }).join('')||'<div class="muted">予約種別がありません。</div>';
    holder.querySelectorAll('[data-booking-save]').forEach(btn=>btn.addEventListener('click',()=>saveBookingMode(btn.dataset.bookingSave)));
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function ensurePublicWaitingCard(){
    const root=$('clinic-settings-root'); if(!root||$('public-waiting-settings-card'))return;
    const card=document.createElement('div'); card.className='card settings-card'; card.id='public-waiting-settings-card';
    card.innerHTML=`<h3>ホームページ待ち状況</h3>
      <p class="settings-note">医院ホームページに表示する待ち状況と自動更新間隔を変更します。</p>
      <div class="setting-row"><div class="setting-copy"><strong>待ち人数を表示</strong><span class="muted">院内全体の現在待ち人数</span></div><label class="switch"><input id="setting-hp-show-waiting" type="checkbox"><span></span></label></div>
      <div class="setting-row"><div class="setting-copy"><strong>現在番号を表示</strong><span class="muted">いま呼ばれている受付番号</span></div><label class="switch"><input id="setting-hp-show-current" type="checkbox"><span></span></label></div>
      <div class="setting-row"><div class="setting-copy"><strong>自動更新</strong><span class="muted">15〜300秒</span></div><select id="setting-hp-refresh-seconds" class="settings-select"><option value="15">15秒</option><option value="30">30秒</option><option value="60">60秒</option><option value="120">120秒</option><option value="300">300秒</option></select></div>
      <div class="settings-actions"><button class="btn primary" id="save-public-waiting-settings" type="button">HP待ち状況設定を保存</button><span id="public-waiting-settings-message" class="settings-message"></span></div>
      <p class="settings-note" id="public-waiting-feature-note"></p>`;
    root.appendChild(card);
    $('save-public-waiting-settings')?.addEventListener('click',savePublicWaiting);
  }
  async function load(){
    busy(true);setBanner('設定を読み込んでいます。');
    try{
      [context,appointmentTypes]=await Promise.all([request('/api/medical/v1/context'),request('/api/medical/v1/appointment-types')]);
      const w=context?.patient_ui?.waiting||context?.patientUi?.waiting||{};
      $('setting-show-current').checked=w.show_current_number??w.showCurrentNumber??true;
      $('setting-show-mine').checked=w.show_my_number??w.showMyNumber??true;
      $('setting-show-ahead').checked=w.show_people_ahead??w.showPeopleAhead??true;
      const seconds=Number(w.refresh_seconds??w.refreshSeconds??30); const select=$('setting-refresh-seconds');
      if(!Array.from(select.options).some(o=>Number(o.value)===seconds)){const o=document.createElement('option');o.value=String(seconds);o.textContent=seconds+'秒';select.appendChild(o);} select.value=String(seconds);
      ensurePublicWaitingCard();
      const hp=context?.public_ui?.waiting||context?.publicUi?.waiting||{};
      $('setting-hp-show-waiting').checked=hp.show_waiting_count??hp.showWaitingCount??true;
      $('setting-hp-show-current').checked=hp.show_current_number??hp.showCurrentNumber??false;
      const hpSeconds=Number(hp.refresh_seconds??hp.refreshSeconds??30); const hpSelect=$('setting-hp-refresh-seconds');
      if(!Array.from(hpSelect.options).some(o=>Number(o.value)===hpSeconds)){const o=document.createElement('option');o.value=String(hpSeconds);o.textContent=hpSeconds+'秒';hpSelect.appendChild(o);} hpSelect.value=String(hpSeconds);
      const hpEnabled=context?.features?.feature_hp_waiting===true;
      ['setting-hp-show-waiting','setting-hp-show-current','setting-hp-refresh-seconds','save-public-waiting-settings'].forEach(id=>{const el=$(id);if(el)el.disabled=!hpEnabled;});
      if($('public-waiting-feature-note')) $('public-waiting-feature-note').textContent=hpEnabled?'feature_hp_waiting：ON':'feature_hp_waiting がOFFのため変更できません。';
      renderBooking();setBanner('現在の設定を読み込みました。','ok');
    }catch(e){setBanner('設定を読み込めませんでした。 '+e.message,'err');}
    finally{busy(false);}
  }
  async function saveWaiting(){
    const btn=$('save-waiting-settings');btn.disabled=true;message('waiting-settings-message','保存中...','');
    const payload={show_current_number:$('setting-show-current').checked,show_my_number:$('setting-show-mine').checked,show_people_ahead:$('setting-show-ahead').checked,refresh_seconds:Number($('setting-refresh-seconds').value)};
    try{await request('/api/medical/v1/clinic-settings/patient-waiting',{method:'PATCH',body:JSON.stringify(payload)});message('waiting-settings-message','保存しました。患者画面へ反映されます。','ok');}
    catch(e){message('waiting-settings-message','保存できませんでした。 '+e.message,'err');}
    finally{btn.disabled=false;}
  }
  async function savePublicWaiting(){
    const btn=$('save-public-waiting-settings'); if(!btn)return; btn.disabled=true;message('public-waiting-settings-message','保存中...','');
    const payload={show_waiting_count:$('setting-hp-show-waiting').checked,show_current_number:$('setting-hp-show-current').checked,refresh_seconds:Number($('setting-hp-refresh-seconds').value)};
    try{await request('/api/medical/v1/clinic-settings/public-waiting',{method:'PATCH',body:JSON.stringify(payload)});message('public-waiting-settings-message','保存しました。ホームページへ反映されます。','ok');}
    catch(e){message('public-waiting-settings-message','保存できませんでした。 '+e.message,'err');}
    finally{btn.disabled=context?.features?.feature_hp_waiting!==true;}
  }
  async function saveBookingMode(id){
    const select=document.querySelector(`[data-booking-select="${CSS.escape(id)}"]`); const msg=document.querySelector(`[data-booking-message="${CSS.escape(id)}"]`); const btn=document.querySelector(`[data-booking-save="${CSS.escape(id)}"]`);
    if(!select||!msg||!btn)return;btn.disabled=true;msg.textContent='保存中...';msg.className='settings-message';
    try{const data=await request('/api/medical/v1/appointment-types/'+encodeURIComponent(id)+'/booking-mode',{method:'PATCH',body:JSON.stringify({booking_mode:select.value})});const t=appointmentTypes.find(x=>(x.appointment_type_id||x.appointmentTypeId)===id);if(t){t.booking_mode=data.booking_mode||select.value;t.bookingMode=t.booking_mode;}msg.textContent='保存しました。患者予約画面へ反映されます。';msg.className='settings-message ok';}
    catch(e){msg.textContent='保存できませんでした。 '+e.message;msg.className='settings-message err';}
    finally{btn.disabled=false;}
  }
  async function init(){
    try{if(global.DPRO_MEDICAL_CLINIC_BOOT) await global.DPRO_MEDICAL_CLINIC_BOOT;}catch(_){return;}
    $('save-waiting-settings')?.addEventListener('click',saveWaiting); await load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
