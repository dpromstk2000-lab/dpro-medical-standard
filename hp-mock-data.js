window.DPROMedicalHPMockData = Object.freeze({
  clinic: {
    id: "clinic_demo_standard",
    name: "DPROメディカルクリニック",
    tagline: "地域の毎日に、わかりやすく安心できる医療を。",
    phone: "092-000-0000",
    address: "福岡県○○市○○1-2-3"
  },
  clinic_settings: {
    clinic_status: "OPEN",
    reception_status: "AVAILABLE",
    status_message: "本日は通常どおり診療しています。",
    status_updated_at: "2026-08-16T10:45:00+09:00",
    feature_flags: {
      feature_web_booking: true,
      feature_line_booking: true,
      feature_datetime_booking: true,
      feature_queue: true,
      feature_questionnaire: true,
      feature_hp_waiting: true
    }
  },
  clinic_hours: [
    { day: "月", morning: "09:00–12:30", afternoon: "14:30–18:00" },
    { day: "火", morning: "09:00–12:30", afternoon: "14:30–18:00" },
    { day: "水", morning: "09:00–12:30", afternoon: "休診" },
    { day: "木", morning: "09:00–12:30", afternoon: "14:30–18:00" },
    { day: "金", morning: "09:00–12:30", afternoon: "14:30–18:00" },
    { day: "土", morning: "09:00–13:00", afternoon: "休診" },
    { day: "日・祝", morning: "休診", afternoon: "休診" }
  ],
  clinic_closures: [
    { id: "closure_demo_1", date: "2026-08-20", period: "AFTERNOON", label: "午後休診" }
  ],
  doctors: [
    { id: "doctor_demo_1", name: "山田 太郎", role: "院長", department_ids: ["dept_internal"], message: "丁寧でわかりやすい説明を大切にしています。" },
    { id: "doctor_demo_2", name: "佐藤 花子", role: "医師", department_ids: ["dept_pediatrics"], message: "お子さまとご家族が安心できる診療を心がけています。" }
  ],
  departments: [
    { id: "dept_internal", name: "内科", description: "発熱・咳・生活習慣病など一般内科診療" },
    { id: "dept_pediatrics", name: "小児科", description: "お子さまの体調不良・予防接種・健康相談" }
  ],
  announcements: [
    { id: "news_demo_1", date: "2026-08-16", title: "診療体制のお知らせ", body: "本日は通常どおり診療しています。" },
    { id: "news_demo_2", date: "2026-08-14", title: "8月20日の午後休診について", body: "8月20日は午後休診となります。" }
  ],
  waiting_summary: {
    waiting_count: 4,
    estimated_minutes: 20,
    updated_at: "2026-08-16T10:45:00+09:00",
    available: true
  }
});
