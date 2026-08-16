/**
 * DPRO MEDICAL TAB-B / MED-PATIENT
 * PATIENT API ADAPTER V1.5 - REAL UI ACTION BINDING
 *
 * SECURITY:
 * - Production is always API mode.
 * - demo_mock requires environmentMode=demo AND mockMode=true AND ?demo=1.
 * - mock-data.js is dynamically loaded only after those conditions pass.
 * - Browser input never supplies tenant_id / clinic_id / patient_id as auth trust source.
 * - Access token is obtained from window.DPRO_MEDICAL_AUTH.getAccessToken(); never persisted here.
 */
(function(){
  "use strict";

  const API_BASE="/api/medical/v1";
  const ADAPTER_SCRIPT_URL=(typeof document!=="undefined"&&document.currentScript?.src)||"";
  const ENDPOINTS=Object.freeze({
    context:"/context",
    patient:(patient_id)=>`/patients/${encodeURIComponent(patient_id)}`,
    appointments:(patient_id)=>`/appointments?patient_id=${encodeURIComponent(patient_id)}`,
    create_appointment:"/appointments",
    appointment_types:"/appointment-types",
    appointment_slots:(date,appointment_type_id)=>`/appointment-slots?date=${encodeURIComponent(date)}&appointment_type_id=${encodeURIComponent(appointment_type_id)}`,
    cancel:(appointment_id)=>`/appointments/${encodeURIComponent(appointment_id)}/cancel`,
    reschedule:(appointment_id)=>`/appointments/${encodeURIComponent(appointment_id)}/reschedule`,
    check_in:"/check-in",
    wait_status:"/patient/wait-status",
    questionnaires:"/questionnaires",
    questionnaire_detail:(questionnaire_id)=>`/questionnaires/${encodeURIComponent(questionnaire_id)}`,
    questionnaire_submit:(questionnaire_id)=>`/questionnaires/${encodeURIComponent(questionnaire_id)}/submissions`
  });
  const FEATURE=Object.freeze({
    booking:["feature_web_booking","feature_line_booking"],datetime:["feature_datetime_booking"],queue:["feature_queue"],time_window:["feature_time_window"],questionnaire:["feature_questionnaire"],family:["feature_family"],qr_checkin:["feature_qr_checkin"],line:["feature_line_booking"]
  });
  const STATUS_LABELS=Object.freeze({pending:"受付待ち",confirmed:"予約済み",checked_in:"受付済み",cancelled:"キャンセル済み",no_show:"未受診",completed:"完了",waiting:"待機中",called:"お呼びしています",paused:"一時停止",skipped:"保留",arrived:"来院済み",exam_wait:"診察待ち",examining:"診察中",consult_wait:"相談待ち",consulting:"相談中",procedure_wait:"処置待ち",procedure:"処置中",payment_wait:"会計待ち",submitted:"送信済み"});

  function success(data){return {ok:true,data,error:null};}
  function makeError(code,message,detail){const e=new Error(message||code);e.code=code;e.detail=detail??null;return e;}
  function getStatusLabel(status){return STATUS_LABELS[status]||status||"-";}
  async function getAccessToken(){
    const provider=window.DPRO_MEDICAL_AUTH?.getAccessToken;
    if(typeof provider!=="function") throw makeError("AUTH_TOKEN_PROVIDER_REQUIRED","認証情報を確認してください。");
    const token=await provider();
    if(!token||typeof token!=="string") throw makeError("AUTH_TOKEN_REQUIRED","認証情報を確認してください。");
    return token;
  }
  async function apiRequest(path,options={}){
    const token=await getAccessToken();
    const runtimeConfig=config();
    const origin=String(runtimeConfig.apiBaseUrl||"").replace(/\/+$/,"");
    const headers={"Content-Type":"application/json","Authorization":`Bearer ${token}`,...(options.headers||{})};
    if(typeof runtimeConfig.clinicId==="string"&&runtimeConfig.clinicId) headers["X-DPRO-Clinic-ID"]=runtimeConfig.clinicId;
    const response=await fetch(origin+API_BASE+path,{method:options.method||"GET",headers,body:options.body===undefined?undefined:JSON.stringify(options.body),credentials:"include"});
    let json;try{json=await response.json();}catch{throw makeError("INVALID_JSON_RESPONSE","通信結果を確認できませんでした。");}
    if(!response.ok||json?.ok!==true){const code=json?.error?.code||`HTTP_${response.status}`;throw makeError(code,json?.error?.message||"CORE_API_ERROR",json?.error||null);}
    return success(json.data);
  }
  function config(){return window.DPRO_MEDICAL_CONFIG||{environmentMode:"production",mockMode:false};}
  function demoSelector(){return typeof location!=="undefined"&&new URLSearchParams(location.search).get("demo")==="1";}
  function mockData(){return window.DPRO_MEDICAL_PATIENT_MOCK||null;}
  function resolveMockUrl(){
    if(ADAPTER_SCRIPT_URL) return new URL("mock-data.js",ADAPTER_SCRIPT_URL).href;
    return "patient-mock-data.js";
  }
  function loadScriptOnce(src){return new Promise((resolve,reject)=>{if(typeof document==="undefined") return reject(makeError("DEMO_SCRIPT_ENV_REQUIRED"));const existing=[...document.scripts].find(s=>s.src===src);if(existing){if(window.DPRO_MEDICAL_PATIENT_MOCK)return resolve();existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",()=>reject(makeError("DEMO_MOCK_LOAD_FAILED")),{once:true});return;}const s=document.createElement("script");s.src=src;s.async=false;s.dataset.dproDemoMock="1";s.onload=resolve;s.onerror=()=>reject(makeError("DEMO_MOCK_LOAD_FAILED","DEMOデータを読み込めませんでした。"));document.head.appendChild(s);});}
  function patientLoginUrl(){
    if(ADAPTER_SCRIPT_URL) return new URL("patient-login.html",ADAPTER_SCRIPT_URL).href;
    return "patient-login.html";
  }
  async function requirePatientAuth(){
    const auth=window.DPRO_MEDICAL_AUTH;
    if(!auth||typeof auth.requireActor!=="function") throw makeError("AUTH_RUNTIME_REQUIRED","DPRO_MEDICAL_AUTH runtimeが必要です。");
    return auth.requireActor("patient",{loginUrl:patientLoginUrl()});
  }
  async function prepareRuntime(){
    const c=config();
    if(c.environmentMode==="production"){
      if(c.mockMode===true) throw makeError("PRODUCTION_MOCK_FORBIDDEN","productionではmockModeを有効にできません。");
      await requirePatientAuth();
      return "api";
    }
    if(c.environmentMode!=="demo") throw makeError("INVALID_ENVIRONMENT_MODE","environmentModeを確認してください。");
    if(c.mockMode===true&&demoSelector()){
      if(!mockData()) await loadScriptOnce(resolveMockUrl());
      if(!mockData()||mockData().meta?.mode!=="demo_mock") throw makeError("DEMO_MOCK_NOT_EXPLICIT","DEMO MOCKを開始できませんでした。");
      return "demo_mock";
    }
    await requirePatientAuth();
    return "api";
  }
  function anyFeatureOn(features,keys){return keys.some(k=>features?.[k]===true);}
  function requireFeature(features,keys,operation){if(!anyFeatureOn(features,keys))throw makeError("FEATURE_DISABLED",`${operation}は現在利用できません。`,{required_any:keys});}
  function resolvePatientId(context,explicit){const id=explicit||context?.patient_id||context?.active_patient_id||context?.patient?.patient_id;if(!id)throw makeError("PATIENT_ID_REQUIRED","患者情報を確認できませんでした。");return id;}
  function sanitizeCreatePayload(input={}){
    const allowed=["appointment_type_id","appointment_slot_id","appointment_date","start_at","end_at","source"];
    const out={};allowed.forEach(k=>{if(input[k]!==undefined&&input[k]!==null&&input[k]!=="")out[k]=input[k];});
    const required=["appointment_type_id","appointment_slot_id","appointment_date","start_at","end_at","source"];
    const missing=required.filter(k=>!out[k]);if(missing.length)throw makeError("APPOINTMENT_PAYLOAD_REQUIRED","予約情報が不足しています。",{missing});
    if(!["line","web"].includes(out.source)) throw makeError("INVALID_APPOINTMENT_SOURCE","予約入口を確認してください。");
    return out;
  }
  function sanitizeReschedulePayload(input={}){
    const allowed=["appointment_slot_id","appointment_date","start_at","end_at"];
    const out={};allowed.forEach(k=>{if(input[k])out[k]=input[k];});
    const missing=allowed.filter(k=>!out[k]);if(missing.length)throw makeError("RESCHEDULE_PAYLOAD_REQUIRED","変更後の予約枠を選択してください。",{missing});
    return out;
  }
  async function getContextApi(mode){
    if(mode==="demo_mock"){const m=mockData();return success({tenant_id:m.clinic.tenant_id,clinic_id:m.clinic.clinic_id,patient_id:m.family_context.active_patient_id,clinic:m.clinic,features:m.feature_flags});}
    return apiRequest(ENDPOINTS.context);
  }
  function createPatientApiAdapter(mode="api"){
    if(!["api","demo_mock"].includes(mode))throw makeError("INVALID_RUNTIME_MODE");
    if(mode==="demo_mock"&&!mockData())throw makeError("DEMO_MOCK_NOT_LOADED");
    const featureMap=(ctx)=>mode==="demo_mock"?(mockData()?.feature_flags||{}):(ctx?.features||{});
    async function getContext(){return getContextApi(mode);}
    async function getPatient(patient_id){if(mode==="demo_mock")return success(mockData().patients.find(p=>p.patient_id===patient_id)||null);return apiRequest(ENDPOINTS.patient(patient_id));}
    async function getAppointments(patient_id){if(mode==="demo_mock")return success(mockData().appointments.filter(a=>a.patient_id===patient_id));return apiRequest(ENDPOINTS.appointments(patient_id));}
    async function getPatientTop(options={}){const ctx=(await getContext()).data;const patient_id=resolvePatientId(ctx,options.patient_id);const [p,a]=await Promise.all([getPatient(patient_id),getAppointments(patient_id)]);return success({context:ctx,clinic:ctx.clinic,feature_flags:featureMap(ctx),patient:p.data,appointments:a.data});}
    async function getDigitalCard(options={}){const top=await getPatientTop(options);return success({patient:top.data.patient,appointments:top.data.appointments,qr_checkin_enabled:top.data.feature_flags?.feature_qr_checkin===true,qr_token:null,demo_qr:mode==="demo_mock"});}
    async function getAppointmentTypes(){const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.booking,"予約");if(mode==="demo_mock")return success(mockData().appointment_types.filter(x=>x.is_active!==false));return apiRequest(ENDPOINTS.appointment_types);}
    async function getAppointmentSlots({date,appointment_type_id}){if(!date||!appointment_type_id)throw makeError("SLOT_QUERY_REQUIRED","日付と予約種別を選択してください。");const ctx=(await getContext()).data;const f=featureMap(ctx);requireFeature(f,[...FEATURE.datetime,...FEATURE.time_window],"予約枠");if(mode==="demo_mock")return success(mockData().appointment_slots.filter(s=>s.appointment_type_id===appointment_type_id&&s.appointment_date===date&&s.available!==false));return apiRequest(ENDPOINTS.appointment_slots(date,appointment_type_id));}
    async function createAppointment(payload){const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.booking,"予約作成");const clean=sanitizeCreatePayload(payload);if(mode==="demo_mock"){const id=`mock_appointment_${String(mockData().appointments.length+1).padStart(3,"0")}`;const appt={appointment_id:id,appointment_type_id:clean.appointment_type_id,appointment_slot_id:clean.appointment_slot_id,appointment_date:clean.appointment_date,start_at:clean.start_at,end_at:clean.end_at,source:clean.source,status:"pending",patient_id:ctx.patient_id,clinic_id:ctx.clinic_id,tenant_id:ctx.tenant_id,booking_mode:mockData().appointment_types.find(t=>t.appointment_type_id===clean.appointment_type_id)?.booking_mode||"datetime"};mockData().appointments.push(appt);return success(appt);}return apiRequest(ENDPOINTS.create_appointment,{method:"POST",body:clean});}
    async function cancelAppointment({appointment_id,cancel_reason}){if(!appointment_id)throw makeError("APPOINTMENT_ID_REQUIRED");const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.booking,"予約キャンセル");if(mode==="demo_mock"){const a=mockData().appointments.find(x=>x.appointment_id===appointment_id);if(!a)throw makeError("MOCK_APPOINTMENT_NOT_FOUND");a.status="cancelled";if(cancel_reason)a.cancel_reason=cancel_reason;return success(a);}return apiRequest(ENDPOINTS.cancel(appointment_id),{method:"POST",body:cancel_reason?{cancel_reason}:undefined});}
    async function rescheduleAppointment({appointment_id,...body}){if(!appointment_id)throw makeError("APPOINTMENT_ID_REQUIRED");const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.booking,"予約変更");const clean=sanitizeReschedulePayload(body);if(mode==="demo_mock"){const a=mockData().appointments.find(x=>x.appointment_id===appointment_id);if(!a)throw makeError("MOCK_APPOINTMENT_NOT_FOUND");Object.assign(a,clean);return success(a);}return apiRequest(ENDPOINTS.reschedule(appointment_id),{method:"POST",body:clean});}
    async function sameDayCheckIn(payload){const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.queue,"当日受付");if(mode==="demo_mock")return mockData().mock_check_in(payload);return apiRequest(ENDPOINTS.check_in,{method:"POST",body:payload});}
    async function getWaitStatus(){const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.queue,"待ち状況");if(mode==="demo_mock")return success({queue:mockData().queue_entries[0],visit:mockData().visits[0]});return apiRequest(ENDPOINTS.wait_status);}
    async function getQuestionnaires(){const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.questionnaire,"WEB問診");if(mode==="demo_mock")return success([{questionnaire_id:mockData().questionnaire.questionnaire_id,title:mockData().questionnaire.title,status:mockData().questionnaire.submission_state}]);return apiRequest(ENDPOINTS.questionnaires);}
    async function getQuestionnaireDetail({questionnaire_id}){if(!questionnaire_id)throw makeError("QUESTIONNAIRE_ID_REQUIRED");const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.questionnaire,"WEB問診");if(mode==="demo_mock")return success({questionnaire:{questionnaire_id:mockData().questionnaire.questionnaire_id,title:mockData().questionnaire.title,description:mockData().questionnaire.description||""},questions:mockData().questionnaire.questions});return apiRequest(ENDPOINTS.questionnaire_detail(questionnaire_id));}
    async function submitQuestionnaire({questionnaire_id,answers}){if(!questionnaire_id)throw makeError("QUESTIONNAIRE_ID_REQUIRED");if(!Array.isArray(answers)||answers.length===0)throw makeError("QUESTIONNAIRE_ANSWERS_REQUIRED","回答を入力してください。");const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.questionnaire,"WEB問診");if(mode==="demo_mock"){mockData().questionnaire.submission_state="submitted";return success({submission_id:`mock_submission_${Date.now()}`,questionnaire_id,status:"submitted",answers});}return apiRequest(ENDPOINTS.questionnaire_submit(questionnaire_id),{method:"POST",body:{answers}});}
    async function getLineEntry(){const ctx=(await getContext()).data;return success({clinic:ctx.clinic,feature_flags:featureMap(ctx)});}
    async function getFamilyMembers(){const ctx=(await getContext()).data;requireFeature(featureMap(ctx),FEATURE.family,"家族切替");if(mode==="demo_mock")return success({family_context:mockData().family_context,patients:mockData().patients});throw makeError("FAMILY_INTEGRATION_HOLD","家族切替はPEDIATRIC AUTH integrationまで準備中です。");}
    return Object.freeze({mode,getContext,getPatient,getPatientTop,getDigitalCard,getAppointments,getAppointmentTypes,getAppointmentSlots,createAppointment,cancelAppointment,rescheduleAppointment,sameDayCheckIn,getWaitStatus,getQuestionnaires,getQuestionnaireDetail,submitQuestionnaire,getLineEntry,getFamilyMembers});
  }
  function runtimeModeFromLocation(){const c=config();if(c.environmentMode==="production")return "api";if(c.environmentMode==="demo"&&c.mockMode===true&&demoSelector()&&mockData())return "demo_mock";return "api";}
  window.DPRO_MEDICAL_PATIENT_API=Object.freeze({API_BASE,ENDPOINTS,FEATURE,STATUS_LABELS,getStatusLabel,apiRequest,prepareRuntime,createPatientApiAdapter,runtimeModeFromLocation,makeError});
})();
