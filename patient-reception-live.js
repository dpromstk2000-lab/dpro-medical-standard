(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-8 PATIENT RECEPTION LIVE V1.2
  // No MutationObserver. One authoritative state transition only.
  const $ = id => document.getElementById(id);
  let api = null;
  let top = null;
  let busy = false;
  let eligibleApps = [];

  function tokyoDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit"
    }).formatToParts(new Date());
    const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }

  function dateOf(appt) {
    const d = String(appt?.appointment_date || "").slice(0, 10);
    if (d) return d;
    if (!appt?.start_at) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit"
    }).formatToParts(new Date(appt.start_at));
    const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }

  function timeText(value) {
    if (!value) return "";
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone:"Asia/Tokyo", hour:"2-digit", minute:"2-digit", hour12:false
    }).format(d);
  }

  function rangeText(appt) {
    const st = timeText(appt?.start_at), et = timeText(appt?.end_at);
    return st ? (et ? `${st}〜${et}` : st) : "時間指定なし";
  }

  function withinWindow(appt, settings) {
    if (dateOf(appt) !== tokyoDate()) return false;
    const start = appt?.start_at ? new Date(appt.start_at).getTime() : NaN;
    const end = appt?.end_at ? new Date(appt.end_at).getTime() : NaN;
    if (!Number.isFinite(start)) return true;
    const before = Number(settings?.before_minutes ?? settings?.beforeMinutes ?? 60);
    const after = Number(settings?.after_minutes ?? settings?.afterMinutes ?? 120);
    const now = Date.now();
    return now >= start - before * 60000 &&
           now <= (Number.isFinite(end) ? end : start) + after * 60000;
  }

  function clearError() {
    const e = $("errorBox");
    if (!e) return;
    e.textContent = "";
    e.classList.add("hidden");
  }

  function showError(text) {
    const e = $("errorBox");
    if (!e) return;
    e.textContent = text;
    e.classList.remove("hidden");
  }

  function receptionCard() {
    return $("appointmentSelect")?.closest(".card") || null;
  }

  function showAccepted(data = {}, restored = false) {
    clearError();

    const form = receptionCard();
    if (form) form.classList.add("hidden");

    const accepted = $("accepted");
    if (accepted) {
      accepted.classList.remove("hidden");
      const h2 = accepted.querySelector("h2");
      if (h2) h2.textContent = restored ? "受付済みです" : "受付しました";
    }

    const number = data.queue_number ?? data.queueNumber ?? null;
    const status = data.queue_status ?? data.queueStatus ?? data.status ?? "waiting";

    if ($("queueNumber")) $("queueNumber").textContent = number ?? "-";
    if ($("queueStatus")) {
      $("queueStatus").textContent =
        window.DPRO_MEDICAL_PATIENT_API?.getStatusLabel?.(status) ||
        (status === "waiting" ? "待機中" : "受付済み");
    }

    const link = accepted?.querySelector('a[href="patient-wait-status.html"]');
    const features = top?.data?.feature_flags || {};
    if (link) link.classList.toggle("hidden", features.feature_queue !== true);

    let note = accepted?.querySelector("[data-checkin-idempotent-note]");
    if (data.already_checked_in) {
      if (!note && accepted) {
        note = document.createElement("p");
        note.className = "small";
        note.dataset.checkinIdempotentNote = "1";
        accepted.appendChild(note);
      }
      if (note) note.textContent = "すでに受付済みです。最初の受付結果を表示しています。";
    } else {
      note?.remove();
    }
  }

  async function restoreCheckedInIfNeeded(all) {
    const checked = all.find(a => a?.status === "checked_in" && dateOf(a) === tokyoDate());
    if (!checked) return false;

    let data = { status:"checked_in" };
    try {
      const wait = await api.getWaitStatus();
      const q = wait?.data?.queue || {};
      data = {
        queue_number: q.queue_number ?? q.queueNumber ?? null,
        status: q.status || "waiting",
        already_checked_in: true
      };
    } catch (_) {
      data = { status:"checked_in", already_checked_in:true };
    }

    showAccepted(data, true);
    return true;
  }

  async function loadInitial() {
    const runtime = await window.DPRO_MEDICAL_PATIENT_API.prepareRuntime();
    api = window.DPRO_MEDICAL_PATIENT_API.createPatientApiAdapter(runtime);
    top = await api.getPatientTop();

    const features = top?.data?.feature_flags || {};
    const ctx = top?.data?.context || {};
    const settings = ctx?.patient_ui?.checkin || ctx?.patientUi?.checkin || {};
    const allow = settings.allow_patient_web ?? settings.allowPatientWeb ?? true;
    const all = Array.isArray(top?.data?.appointments) ? top.data.appointments : [];

    if (await restoreCheckedInIfNeeded(all)) return;

    const eligible = all.filter(a =>
      a.status === "confirmed" &&
      dateOf(a) === tokyoDate() &&
      withinWindow(a, settings)
    );

    const types = await api.getAppointmentTypes().catch(() => ({data:[]}));
    const typeMap = new Map(
      (Array.isArray(types?.data) ? types.data : []).map(
        t => [String(t.appointment_type_id), t.name || t.display_name || "予約"]
      )
    );

    eligibleApps = eligible;

    const select = $("appointmentSelect");
    const btn = $("acceptBtn");
    if (select) {
      select.innerHTML =
        '<option value="">選択してください</option>' +
        eligible.map(a => {
          const name = a.appointment_type_name ||
                       a.type_name ||
                       typeMap.get(String(a.appointment_type_id)) ||
                       "予約";
          const id = String(a.appointment_id).replace(/"/g, "&quot;");
          return `<option value="${id}">${name} / ${rangeText(a)}</option>`;
        }).join("");
    }

    if (!allow) {
      if (btn) btn.disabled = true;
      showError("この医院では患者スマホからの来院受付を利用できません。");
      return;
    }

    if (!eligible.length) {
      if (btn) btn.disabled = true;
      const before = Number(settings.before_minutes ?? settings.beforeMinutes ?? 60);
      const after = Number(settings.after_minutes ?? settings.afterMinutes ?? 120);
      showError(`現在受付可能な本日の予約はありません。受付時間は予約時刻の${before}分前から終了後${after}分までです。`);
      return;
    }

    if (btn) btn.disabled = false;
    clearError();

    if (!features.feature_queue) {
      const link = $("accepted")?.querySelector('a[href="patient-wait-status.html"]');
      if (link) link.classList.add("hidden");
    }
  }

  async function accept(event) {
    const button = event.target?.closest?.("#acceptBtn");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (busy || !api) return;

    const appointmentId = $("appointmentSelect")?.value || "";
    if (!appointmentId) {
      showError("受付する予約を選択してください。");
      return;
    }

    busy = true;
    button.disabled = true;
    clearError();

    try {
      const features = top?.data?.feature_flags || {};
      const response = await api.sameDayCheckIn({
        appointment_id: appointmentId,
        use_queue: features.feature_queue === true
      });

      const data = response?.data || {};
      showAccepted(data, false);

      // Important: do NOT call loadInitial() again here.
      // The appointment is now checked_in, so reloading the eligible list would
      // incorrectly render "受付可能な予約なし" as an error.
    } catch (err) {
      const code = err?.code || "";
      const msg =
        code === "CHECKIN_WINDOW_CLOSED" ? "現在は受付可能時間外です。" :
        code === "APPOINTMENT_NOT_CHECKINABLE" ? "この予約は現在受付できません。" :
        "受付処理に失敗しました。もう一度お試しください。";
      showError(msg);
      button.disabled = false;
    } finally {
      busy = false;
    }
  }

  async function init() {
    document.addEventListener("click", accept, true);
    try {
      await loadInitial();
    } catch (_) {
      showError("受付画面を準備できませんでした。");
      if ($("acceptBtn")) $("acceptBtn").disabled = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();