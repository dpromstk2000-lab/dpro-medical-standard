/** DPRO MEDICAL TAB-B DEMO MOCK ONLY. Never load unconditionally in production HTML. */
(function(){
"use strict";
const M={
 meta:{project:"DPRO MEDICAL",tab:"TAB-B",tab_code:"MED-PATIENT",version:"V1.5",mode:"demo_mock"},
 feature_flags:{feature_web_booking:true,feature_line_booking:true,feature_datetime_booking:true,feature_queue:true,feature_time_window:true,feature_questionnaire:true,feature_family:false,feature_qr_checkin:true,feature_line_call:true,feature_hp_waiting:true},
 clinic:{tenant_id:"mock_tenant_001",clinic_id:"mock_clinic_001",clinic_name:"DPROメディカルクリニック",clinic_hp_url:"#"},
 family_context:{family_id:"mock_family_001",active_patient_id:"mock_patient_001"},
 patients:[{patient_id:"mock_patient_001",patient_number:"000001",last_name:"山田",first_name:"太郎",display_name:"山田 太郎"}],
 appointment_types:[
  {appointment_type_id:"mock_appointment_type_001",name:"内科・日時予約",booking_mode:"datetime",is_active:true},
  {appointment_type_id:"mock_appointment_type_002",name:"当日順番受付",booking_mode:"queue",is_active:true},
  {appointment_type_id:"mock_appointment_type_003",name:"時間帯受付",booking_mode:"time_window",is_active:true},
  {appointment_type_id:"mock_appointment_type_004",name:"来院完結予約",booking_mode:"complete_reservation",is_active:true},
  {appointment_type_id:"mock_appointment_type_005",name:"直接来院",booking_mode:"walk_in",is_active:true}
 ],
 appointment_slots:[
  {appointment_slot_id:"mock_slot_001",appointment_type_id:"mock_appointment_type_001",appointment_date:"2026-08-18",start_at:"2026-08-18T09:00:00+09:00",end_at:"2026-08-18T09:30:00+09:00",available:true},
  {appointment_slot_id:"mock_slot_002",appointment_type_id:"mock_appointment_type_001",appointment_date:"2026-08-18",start_at:"2026-08-18T09:30:00+09:00",end_at:"2026-08-18T10:00:00+09:00",available:true},
  {appointment_slot_id:"mock_slot_003",appointment_type_id:"mock_appointment_type_003",appointment_date:"2026-08-18",start_at:"2026-08-18T10:00:00+09:00",end_at:"2026-08-18T11:00:00+09:00",available:true},
  {appointment_slot_id:"mock_slot_004",appointment_type_id:"mock_appointment_type_001",appointment_date:"2026-08-19",start_at:"2026-08-19T09:30:00+09:00",end_at:"2026-08-19T10:00:00+09:00",available:true}
 ],
 appointments:[
  {appointment_id:"mock_appointment_001",patient_id:"mock_patient_001",appointment_type_id:"mock_appointment_type_001",appointment_slot_id:"mock_slot_001",appointment_date:"2026-08-18",start_at:"2026-08-18T09:00:00+09:00",end_at:"2026-08-18T09:30:00+09:00",booking_mode:"datetime",status:"confirmed",source:"web"},
  {appointment_id:"mock_appointment_002",patient_id:"mock_patient_001",appointment_type_id:"mock_appointment_type_001",appointment_slot_id:"mock_slot_004",appointment_date:"2026-08-19",start_at:"2026-08-19T09:30:00+09:00",end_at:"2026-08-19T10:00:00+09:00",booking_mode:"datetime",status:"pending",source:"line"}
 ],
 visits:[{visit_id:"mock_visit_001",appointment_id:"mock_appointment_001",patient_id:"mock_patient_001",status:"arrived"}],
 queue_entries:[{queue_id:"mock_queue_001",visit_id:"mock_visit_001",appointment_id:"mock_appointment_001",patient_id:"mock_patient_001",queue_number:23,current_queue_number:18,people_ahead:4,status:"waiting"}],
 questionnaire:{questionnaire_id:"mock_questionnaire_001",title:"来院前WEB問診",description:"来院前に入力してください。",submission_state:"draft",questions:[
   {questionnaire_question_id:"qq1",question_type:"notice",label:"緊急症状がある場合は医療機関へ直接ご連絡ください。",required:false},
   {questionnaire_question_id:"qq2",question_type:"text",label:"本日の主な症状",required:true},
   {questionnaire_question_id:"qq3",question_type:"textarea",label:"症状の詳細",required:false},
   {questionnaire_question_id:"qq4",question_type:"number",label:"体温（℃）",required:false},
   {questionnaire_question_id:"qq5",question_type:"date",label:"症状が始まった日",required:true},
   {questionnaire_question_id:"qq6",question_type:"single_select",label:"発熱はありますか？",required:true,options:["はい","いいえ"]},
   {questionnaire_question_id:"qq7",question_type:"multi_select",label:"当てはまる症状",required:false,options:["せき","鼻水","のどの痛み"]},
   {questionnaire_question_id:"qq8",question_type:"yes_no",label:"薬を服用していますか？",required:true},
   {questionnaire_question_id:"qq9",question_type:"checkbox",label:"入力内容を確認しました",required:true},
   {questionnaire_question_id:"qq10",question_type:"text",label:"服用中の薬",required:true,show_condition:{questionnaire_question_id:"qq8",operator:"equals",value:"yes"}}
 ]}
};
M.mock_check_in=({appointment_id})=>{const a=M.appointments.find(x=>x.appointment_id===appointment_id);if(!a)return {ok:false,data:null,error:{code:"MOCK_APPOINTMENT_NOT_FOUND"}};a.status="checked_in";let v=M.visits.find(x=>x.appointment_id===appointment_id);if(!v){v={visit_id:`mock_visit_${Date.now()}`,appointment_id,patient_id:a.patient_id,status:"arrived"};M.visits.push(v);}let q=M.queue_entries.find(x=>x.appointment_id===appointment_id);if(!q){q={queue_id:`mock_queue_${Date.now()}`,visit_id:v.visit_id,appointment_id,patient_id:a.patient_id,queue_number:24,current_queue_number:18,people_ahead:5,status:"waiting"};M.queue_entries.push(q);}return {ok:true,data:{appointment:a,visit:v,queue:q},error:null};};
window.DPRO_MEDICAL_PATIENT_MOCK=M;
})();
