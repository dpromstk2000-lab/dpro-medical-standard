window.DPROMedicalMock = {
  meta: {
    project: 'DPRO MEDICAL',
    tab: 'TAB-C',
    tenantId: 'tenant_demo_clinic_001',
    environment: 'demo',
    businessDate: '2026-08-16',
    dataSource: 'MOCK',
    generatedAt: '2026-08-16T11:27:00+09:00'
  },
  features: {
    feature_queue: true,
    feature_exam: true
  },
  workflowConfig: {
    show_procedure: true,
    show_payment_wait: true
  },
  permissions: {
    owner: ['dashboard.read','today.read','appointment.read','appointment.check_in','queue.read','queue.update','visit.read','visit.update','patient.read','questionnaire.read','doctor.read','settings.read'],
    staff: ['today.read','appointment.read','appointment.check_in','queue.read','queue.update','visit.read','visit.update','patient.read','questionnaire.read']
  },
  appointmentStatuses: ['pending','confirmed','checked_in','cancelled','no_show','completed'],
  queueStatuses: ['waiting','called','paused','skipped','completed','cancelled'],
  visitStatuses: ['arrived','waiting','exam_wait','examining','consult_wait','consulting','procedure_wait','procedure','payment_wait','completed'],
  dashboard: {
    appointmentsToday: 24,
    checkedIn: 13,
    waitingNow: 5,
    consultingNow: 2,
    completed: 8,
    avgWaitMin: 17
  },
  departments: [
    { departmentId:'dept_001', name:'内科' },
    { departmentId:'dept_002', name:'小児科' },
    { departmentId:'dept_003', name:'皮膚科' }
  ],
  doctors: [
    { id:'doc_001', doctorId:'doc_001', name:'田中 一郎', department:'内科', departmentId:'dept_001', reservable:true, onDuty:true },
    { id:'doc_002', doctorId:'doc_002', name:'佐藤 美咲', department:'小児科', departmentId:'dept_002', reservable:true, onDuty:true },
    { id:'doc_003', doctorId:'doc_003', name:'高橋 健', department:'皮膚科', departmentId:'dept_003', reservable:false, onDuty:false }
  ],
  patients: [
    { patientId:'P-10021', name:'山田 太郎', kana:'ヤマダ タロウ', phone:'090-1234-5678', lineLinked:true },
    { patientId:'P-10022', name:'鈴木 花子', kana:'スズキ ハナコ', phone:'080-2222-3344', lineLinked:true },
    { patientId:'P-10023', name:'佐々木 翼', kana:'ササキ ツバサ', phone:'070-3333-4455', lineLinked:false },
    { patientId:'P-10024', name:'中村 葵', kana:'ナカムラ アオイ', phone:'090-5555-6677', lineLinked:true },
    { patientId:'P-10025', name:'伊藤 悠', kana:'イトウ ユウ', phone:'080-7777-8899', lineLinked:false }
  ],
  appointments: [
    { appointmentId:'A-240816-01', patientId:'P-10021', time:'09:30', department:'内科', doctorId:'doc_001', status:'confirmed', questionnaire:'answered' },
    { appointmentId:'A-240816-02', patientId:'P-10022', time:'09:45', department:'小児科', doctorId:'doc_002', status:'checked_in', questionnaire:'answered' },
    { appointmentId:'A-240816-03', patientId:'P-10023', time:'10:00', department:'内科', doctorId:'doc_001', status:'checked_in', questionnaire:'needs_review' },
    { appointmentId:'A-240816-04', patientId:'P-10024', time:'10:30', department:'小児科', doctorId:'doc_002', status:'confirmed', questionnaire:'unanswered' }
  ],
  visits: [
    { visitId:'V-240816-02', patientId:'P-10022', appointmentId:'A-240816-02', status:'consult_wait', workflowStage:'診察前確認', waitMin:14 },
    { visitId:'V-240816-03', patientId:'P-10023', appointmentId:'A-240816-03', status:'exam_wait', workflowStage:'採血待ち', waitMin:22 },
    { visitId:'V-240816-05', patientId:'P-10025', appointmentId:null, status:'waiting', workflowStage:'待合', waitMin:8 }
  ],
  queueEntries: [
    { queueId:'Q-001', visitId:'V-240816-02', status:'waiting', number:12 },
    { queueId:'Q-002', visitId:'V-240816-03', status:'waiting', number:13 },
    { queueId:'Q-003', visitId:'V-240816-05', status:'waiting', number:14 }
  ],
  questionnaires: [
    { submissionId:'QS-001', patientId:'P-10021', appointmentId:'A-240816-01', status:'answered', summary:'発熱なし／咳あり／服薬あり', submittedAt:'09:02' },
    { submissionId:'QS-002', patientId:'P-10022', appointmentId:'A-240816-02', status:'answered', summary:'発熱37.8℃／食欲低下', submittedAt:'09:11' },
    { submissionId:'QS-003', patientId:'P-10023', appointmentId:'A-240816-03', status:'needs_review', summary:'アレルギー回答あり／要確認', submittedAt:'09:24' }
  ],
  appointmentTypes: [],
  appointmentSlots: []
};
