(() => {
  "use strict";

  // DPRO MEDICAL BRUSHUP-8 PATIENT RECEPTION POST-CHECKIN UX V1.1
  let checkedIn = false;
  let applying = false;

  const $ = id => document.getElementById(id);

  function tokyoDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }

  function dateOf(appt) {
    const d = String(appt?.appointment_date || "").slice(0, 10);
    if (d) return d;
    if (!appt?.start_at) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(appt.start_at));
    const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }

  function formCard() {
    return $("appointmentSelect")?.closest(".card") || null;
  }

  function applyCheckedInUi(options = {}) {
    if (applying) return;
    applying = true;
    try {
      const error = $("errorBox");
      if (error) {
        error.textContent = "";
        error.classList.add("hidden");
      }

      const form = formCard();
      if (form) form.classList.add("hidden");

      const accepted = $("accepted");
      if (accepted) accepted.classList.remove("hidden");

      if (options.restored) {
        const h2 = accepted?.querySelector("h2");
        if (h2) h2.textContent = "受付済みです";
      }

      if (options.queueNumber != null && $("queueNumber")) {
        $("queueNumber").textContent = String(options.queueNumber);
      }
      if (options.queueStatus && $("queueStatus")) {
        $("queueStatus").textContent = String(options.queueStatus);
      }
    } finally {
      applying = false;
    }
  }

  function statusLabel(status) {
    try {
      return window.DPRO_MEDICAL_PATIENT_API?.getStatusLabel?.(status) || status || "-";
    } catch (_) {
      return status || "-";
    }
  }

  async function restoreIfAlreadyCheckedIn() {
    try {
      const runtime = await window.DPRO_MEDICAL_PATIENT_API.prepareRuntime();
      const api = window.DPRO_MEDICAL_PATIENT_API.createPatientApiAdapter(runtime);
      const top = await api.getPatientTop();
      const today = tokyoDate();

      const appt = (top?.data?.appointments || []).find(
        a => a?.status === "checked_in" && dateOf(a) === today
      );
      if (!appt) return;

      checkedIn = true;

      let queueNumber = null;
      let queueStatus = "受付済み";
      try {
        const wait = await api.getWaitStatus();
        const q = wait?.data?.queue || {};
        queueNumber = q.queue_number ?? q.queueNumber ?? null;
        queueStatus = statusLabel(q.status || "waiting");
      } catch (_) {}

      applyCheckedInUi({ restored: true, queueNumber, queueStatus });
    } catch (_) {}
  }

  function observeSuccess() {
    const accepted = $("accepted");
    if (!accepted) return;

    const update = () => {
      if (accepted.classList.contains("hidden")) return;
      checkedIn = true;
      applyCheckedInUi();
    };

    new MutationObserver(update).observe(accepted, {
      attributes: true,
      attributeFilter: ["class"]
    });
    update();
  }

  function keepSuccessClean() {
    const error = $("errorBox");
    if (!error) return;
    new MutationObserver(() => {
      if (checkedIn) applyCheckedInUi();
    }).observe(error, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  async function init() {
    observeSuccess();
    keepSuccessClean();
    await restoreIfAlreadyCheckedIn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();