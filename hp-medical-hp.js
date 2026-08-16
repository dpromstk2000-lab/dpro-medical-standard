(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const cfg = window.DPROMedicalHPConfig;

  function setText(sel, value) { const el = $(sel); if (el) el.textContent = value ?? ""; }
  function flag(data, key) { return data?.clinic_settings?.feature_flags?.[key] === true; }
  function show(sel, visible) { const el = $(sel); if (el) el.hidden = !visible; }

  function renderStatus(data) {
    const clinicStatus = data?.clinic_settings?.clinic_status || "UNKNOWN";
    const receptionStatus = data?.clinic_settings?.reception_status || "UNKNOWN";
    const clinicLabels = { OPEN: "診療中", CLOSED: "診療時間外", TEMP_CLOSED: "臨時休診", UNKNOWN: "状態確認中" };
    const receptionLabels = { AVAILABLE: "受付可能", CLOSED: "受付終了", PAUSED: "受付停止中", FULL: "受付上限", UNKNOWN: "受付状況確認中" };
    setText("#clinic-status", clinicLabels[clinicStatus] || "状態確認中");
    setText("#reception-status", receptionLabels[receptionStatus] || "受付状況確認中");
    setText("#status-message", data?.clinic_settings?.status_message || "最新情報を確認しています。");
    setText("#status-updated", data?.clinic_settings?.status_updated_at ? `更新 ${new Date(data.clinic_settings.status_updated_at).toLocaleString("ja-JP")}` : "");
  }

  function renderClinic(data) {
    setText("#clinic-name", data?.clinic?.name || "DPRO MEDICAL");
    setText("#hero-name", data?.clinic?.name || "DPRO MEDICAL");
    setText("#tagline", data?.clinic?.tagline || "");
    setText("#address", data?.clinic?.address || "");
    const phone = data?.clinic?.phone || "";
    const hasPhone = Boolean(String(phone).trim());
    setText("#phone-text", phone);
    show("#phone-link", hasPhone);
    show("#mobile-phone", hasPhone);
    const phoneHref = hasPhone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : "#";
    const phoneLink = $("#phone-link");
    if (phoneLink) phoneLink.href = phoneHref;
    const mobilePhone = $("#mobile-phone");
    if (mobilePhone) mobilePhone.href = phoneHref;
  }

  function renderHours(data) {
    const tbody = $("#hours-body");
    tbody.innerHTML = (data?.clinic_hours || []).map(r => `<tr><th scope="row">${esc(r.day)}</th><td>${esc(r.morning)}</td><td>${esc(r.afternoon)}</td></tr>`).join("");
    const closureBox = $("#closures-list");
    const closures = data?.clinic_closures || [];
    closureBox.innerHTML = closures.length ? closures.map(c => `<li><strong>${esc(c.date)}</strong> ${esc(c.label || c.period)}</li>`).join("") : "<li>現在、臨時休診のお知らせはありません。</li>";
  }

  function renderDepartments(data) {
    $("#departments-list").innerHTML = (data?.departments || []).map(d => `<article class="card"><h3>${esc(d.name)}</h3><p>${esc(d.description)}</p></article>`).join("");
  }

  function renderDoctors(data) {
    const depMap = Object.fromEntries((data?.departments || []).map(d => [d.id, d.name]));
    $("#doctors-list").innerHTML = (data?.doctors || []).map(d => {
      const deps = (d.department_ids || []).map(id => depMap[id]).filter(Boolean).join("・");
      return `<article class="card"><p class="eyebrow">${esc(d.role)}${deps ? ` / ${esc(deps)}` : ""}</p><h3>${esc(d.name)}</h3><p>${esc(d.message)}</p></article>`;
    }).join("");
  }

  function renderNews(data) {
    $("#news-list").innerHTML = (data?.announcements || []).slice(0, 4).map(n => `<li><time>${esc(n.date)}</time><div><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p></div></li>`).join("");
  }

  function renderWaiting(data) {
    const enabled = flag(data, "feature_queue") && flag(data, "feature_hp_waiting");
    show("#waiting-section", enabled);
    if (!enabled) return;
    const w = data?.waiting_summary;
    if (!w || w.available !== true) {
      setText("#waiting-count", "—");
      setText("#waiting-minutes", "現在取得できません");
      setText("#waiting-updated", "");
      return;
    }
    setText("#waiting-count", w.waiting_count == null ? "—" : `${Number(w.waiting_count)}人`);
    setText("#waiting-minutes", w.estimated_minutes == null ? "目安未算出" : `約${Number(w.estimated_minutes)}分`);
    setText("#waiting-updated", w.updated_at ? `最終更新 ${new Date(w.updated_at).toLocaleTimeString("ja-JP", {hour:"2-digit", minute:"2-digit"})}` : "");
  }

  function renderRoutes(data) {
    const mappings = [
      ["#web-booking", "feature_web_booking", cfg.routes.webBooking],
      ["#line-booking", "feature_line_booking", cfg.routes.lineBooking],
      ["#datetime-booking", "feature_datetime_booking", cfg.routes.webBooking],
      ["#questionnaire-link", "feature_questionnaire", cfg.routes.questionnaire],
      ["#questionnaire-cta", "feature_questionnaire", cfg.routes.questionnaire],
      ["#line-booking-card", "feature_line_booking", cfg.routes.lineBooking],
      ["#mobile-line", "feature_line_booking", cfg.routes.lineBooking]
    ];
    mappings.forEach(([sel, key, href]) => {
      const el = $(sel);
      if (!el) return;
      const enabled = flag(data, key) && Boolean(String(href || "").trim());
      el.hidden = !enabled;
      if (enabled) el.href = href;
    });
    const sameDay = $("#same-day-reception");
    if (sameDay) {
      const href = cfg.routes.sameDayReception;
      const enabled = flag(data, "feature_queue") && Boolean(String(href || "").trim());
      sameDay.hidden = !enabled;
      if (enabled) sameDay.href = href;
    }
  }

  function renderRuntimeMode() {
    const isDemo = cfg?.environment === "demo";
    setText("#runtime-mode", `MODE: ${isDemo ? "DEMO" : "PRODUCTION"}`);
    document.body.dataset.environment = isDemo ? "demo" : "production";
  }

  function renderSource(data) {
    setText("#data-source", `DATA SOURCE: ${data.source}`);
    document.body.dataset.source = data.source;
  }

  function renderError(err) {
    console.error(err);
    setText("#clinic-status", "情報取得エラー");
    setText("#reception-status", "受付状況確認中");
    setText("#status-message", "最新情報を取得できません。お急ぎの場合はお電話でご確認ください。");
    setText("#data-source", `DATA SOURCE: ERROR (${err.code || "UNKNOWN"})`);
  }

  async function boot() {
    renderRuntimeMode();
    try {
      const data = await window.DPROMedicalHPCore.load();
      renderClinic(data);
      renderStatus(data);
      renderHours(data);
      renderDepartments(data);
      renderDoctors(data);
      renderNews(data);
      renderWaiting(data);
      renderRoutes(data);
      renderSource(data);
    } catch (err) {
      renderError(err);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
