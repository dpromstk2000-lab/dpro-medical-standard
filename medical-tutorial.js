(function (global, document) {
  'use strict';

  const VERSION = 'DPRO MEDICAL TUTORIAL STANDARD V1.1 / R4';
  const STORAGE_KEY = 'dpro-tutorial:medical:first10';
  const STEP_PREFIX = 'dpro-tutorial:medical:first10:';
  const MARGIN = 8;

  const STEPS = Object.freeze([
    {id:'medical-first10-01-start-tour',order:1,selector:'.hero-btn.primary[onclick="startTour()"]',fallback:['.hero-actions .hero-btn.primary','.hero'],title:'30秒体験を開始',copy:'公開DEMOの30秒導線を開始し、患者・医院・診療科の見方を確認します。',anchor:'#tour'},
    {id:'medical-first10-02-patient-tour',order:2,selector:'#tour1 button',fallback:['#tour1','#tour'],title:'患者スマホを開く',copy:'患者側の画面例へ切り替え、予約・問診・受付がまとまる入口を確認します。',anchor:'#tour'},
    {id:'medical-first10-03-owner-tour',order:3,selector:'#tour2 button',fallback:['#tour2','#tour'],title:'医院管理PCを見る',copy:'医院側の管理画面例へ切り替え、患者側と医院側が同じ流れでつながる構成を確認します。',anchor:'#tour'},
    {id:'medical-first10-04-compare-presets',order:4,selector:'#tour3 button',fallback:['#presets','.preset-zone'],title:'6診療科モデルを比較',copy:'STANDARD・眼科・小児科など、共通基盤の上で診療科ごとの違いを比較します。',anchor:'#presets'},
    {id:'medical-first10-05-eye-preset',order:5,selector:'.preset-card[data-preset="EYE"]',fallback:['#presetGrid','#presets'],title:'眼科PRESETへ切替',copy:'眼科モデルへ切り替え、検査進行・手術案内・術後フォローなどの表示差分を確認します。',anchor:'#viewer'},
    {id:'medical-first10-06-patient-role',order:6,selector:'.role-card[data-role="patient"]',fallback:['#roleTabs','#roles'],title:'患者画面の役割を確認',copy:'患者スマホの役割を表示し、予約・問診・受付の入口が患者向けに整理されていることを確認します。',anchor:'#viewer'},
    {id:'medical-first10-07-owner-role',order:7,selector:'.role-card[data-role="owner"]',fallback:['#roleTabs','#roles'],title:'医院管理PCの役割を確認',copy:'医院管理PCの画面例へ切り替え、予約・受付・待ち・診察中などの全体把握を確認します。',anchor:'#viewer'},
    {id:'medical-first10-08-ipad-role',order:8,selector:'.role-card[data-role="ipad"]',fallback:['#roleTabs','#roles'],title:'受付iPadの役割を確認',copy:'受付iPadの画面例へ切り替え、受付業務に必要な情報へ集中した構成を確認します。',anchor:'#viewer'},
    {id:'medical-first10-09-staff-role',order:9,selector:'.role-card[data-role="staff"]',fallback:['#roleTabs','#roles'],title:'スタッフ画面の役割を確認',copy:'スタッフ画面例へ切り替え、院内進行と担当業務を確認します。',anchor:'#viewer'},
    {id:'medical-first10-10-hp-role',order:10,selector:'.role-card[data-role="hp"]',fallback:['#roleTabs','#roles'],title:'医院HPの公開境界を確認',copy:'医院HPの画面例へ切り替え、公開可能な予約導線・待ち状況・お知らせの見せ方を確認します。',anchor:'#viewer'}
  ].map(x => Object.freeze(Object.assign({}, x, {resumeKey: STEP_PREFIX + String(x.order).padStart(2,'0')}))));

  let state = loadState();
  let ui = null;
  let activeTarget = null;
  let targetSource = 'none';
  let refreshRaf = 0;

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }
  function normalizedState(value) {
    const s = value && typeof value === 'object' ? value : {};
    const step = Math.max(0, Math.min(STEPS.length - 1, Number.isInteger(s.step) ? s.step : 0));
    const status = ['idle','active','completed','skipped'].includes(s.status) ? s.status : 'idle';
    return {step, status, updatedAt: String(s.updatedAt || '')};
  }
  function loadState() {
    let found = safeParse(localStorage.getItem(STORAGE_KEY));
    if (found) return normalizedState(found);
    for (let i = STEPS.length; i >= 1; i--) {
      const candidate = safeParse(localStorage.getItem(STEP_PREFIX + String(i).padStart(2,'0')));
      if (candidate) return normalizedState(candidate);
    }
    return {step:0,status:'idle',updatedAt:''};
  }
  function persist() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    for (const step of STEPS) localStorage.removeItem(step.resumeKey);
    if (state.status === 'active') localStorage.setItem(STEPS[state.step].resumeKey, JSON.stringify(state));
    refreshLauncher();
  }
  function injectStyle() {
    if (document.getElementById('dpro-medical-tutorial-style')) return;
    const style = document.createElement('style');
    style.id = 'dpro-medical-tutorial-style';
    style.textContent = `
#dpro-tutorial-launcher{position:fixed;right:12px;bottom:76px;z-index:2147483600;min-height:44px;border:0;border-radius:999px;padding:0 15px;background:#102d45;color:#fff;font-weight:900;box-shadow:0 10px 28px rgba(0,0,0,.22);cursor:pointer;max-width:calc(100vw - 24px)}
#dpro-tutorial-launcher:focus-visible,#dpro-tutorial-launcher:focus,.dpro-tutorial-card button:focus-visible,.dpro-tutorial-card button:focus,.dpro-tutorial-drag:focus-visible,.dpro-tutorial-drag:focus{outline:3px solid #ffbf47;outline-offset:3px}
.dpro-tutorial-card{position:fixed;right:14px;top:14px;z-index:2147483601;width:min(370px,calc(100vw - 20px));max-height:calc(100vh - 20px);overflow:auto;background:#fff;color:#15324a;border:1px solid #bfd0dc;border-radius:18px;box-shadow:0 18px 54px rgba(7,32,49,.28);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}
.dpro-tutorial-drag{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#102d45;color:#fff;border-radius:17px 17px 0 0;cursor:grab;touch-action:none;user-select:none;font-weight:900}
.dpro-tutorial-drag:active{cursor:grabbing}.dpro-tutorial-drag small{font-size:11px;opacity:.8;font-weight:700}.dpro-tutorial-body{padding:15px}.dpro-tutorial-progress{font-size:12px;color:#1769aa;font-weight:900;letter-spacing:.05em}.dpro-tutorial-title{font-size:19px;line-height:1.35;margin:6px 0 8px}.dpro-tutorial-copy{font-size:14px;line-height:1.7;color:#476278;margin:0}.dpro-tutorial-target-status{margin-top:10px;padding:8px 10px;border-radius:10px;background:#eef6fb;font-size:12px;color:#38566d}.dpro-tutorial-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.dpro-tutorial-actions button{min-height:40px;border:1px solid #c8d8e3;border-radius:10px;background:#fff;color:#15324a;padding:0 12px;font-weight:850;cursor:pointer}.dpro-tutorial-actions button[data-primary="1"]{background:#1769aa;color:#fff;border-color:#1769aa}.dpro-tutorial-actions button:disabled{opacity:.42;cursor:not-allowed}.dpro-tutorial-close{border:0!important;background:transparent!important;color:#fff!important;padding:0 4px!important;min-height:30px!important;font-size:20px}.dpro-tutorial-highlight{position:fixed;z-index:2147483598;pointer-events:none;border:3px solid #1769aa;border-radius:12px;box-shadow:0 0 0 5px rgba(23,105,170,.15),0 0 0 9999px rgba(8,30,45,.08);transition:left .16s ease,top .16s ease,width .16s ease,height .16s ease}.dpro-tutorial-highlight[data-fallback="1"]{border-style:dashed}.dpro-tutorial-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:520px){#dpro-tutorial-launcher{bottom:72px;right:10px}.dpro-tutorial-card{top:10px;right:10px;width:calc(100vw - 20px);max-height:calc(100vh - 20px)}.dpro-tutorial-actions{display:grid;grid-template-columns:1fr 1fr}.dpro-tutorial-actions button{width:100%}}
`;
    document.head.appendChild(style);
  }
  function buildUI() {
    if (ui) return ui;
    injectStyle();
    const launcher = document.createElement('button');
    launcher.id = 'dpro-tutorial-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-controls','dpro-tutorial-card');
    launcher.addEventListener('click', () => {
      if (state.status === 'active') resume();
      else if (state.status === 'completed' || state.status === 'skipped') replay();
      else start();
    });

    const card = document.createElement('section');
    card.id = 'dpro-tutorial-card';
    card.className = 'dpro-tutorial-card';
    card.hidden = true;
    card.setAttribute('role','dialog');
    card.setAttribute('aria-modal','false');
    card.setAttribute('aria-labelledby','dpro-tutorial-title');
    card.innerHTML = `
      <div class="dpro-tutorial-drag" tabindex="0" aria-label="操作ガイドをドラッグして移動">
        <span>DPRO MEDICAL 操作ガイド <small>⋮⋮ ドラッグ</small></span>
        <button class="dpro-tutorial-close" type="button" aria-label="操作ガイドを閉じる">×</button>
      </div>
      <div class="dpro-tutorial-body">
        <div class="dpro-tutorial-progress"></div>
        <h2 class="dpro-tutorial-title" id="dpro-tutorial-title"></h2>
        <p class="dpro-tutorial-copy"></p>
        <div class="dpro-tutorial-target-status" aria-live="polite"></div>
        <div class="dpro-tutorial-actions">
          <button type="button" data-action="back">戻る</button>
          <button type="button" data-action="next" data-primary="1">次へ</button>
          <button type="button" data-action="skip">スキップ</button>
          <button type="button" data-action="close">閉じる</button>
        </div>
        <div class="dpro-tutorial-sr" aria-live="assertive"></div>
      </div>`;
    const highlight = document.createElement('div');
    highlight.className = 'dpro-tutorial-highlight';
    highlight.hidden = true;

    document.body.append(launcher, highlight, card);
    ui = {
      launcher, card, highlight,
      drag: card.querySelector('.dpro-tutorial-drag'),
      closeTop: card.querySelector('.dpro-tutorial-close'),
      progress: card.querySelector('.dpro-tutorial-progress'),
      title: card.querySelector('.dpro-tutorial-title'),
      copy: card.querySelector('.dpro-tutorial-copy'),
      targetStatus: card.querySelector('.dpro-tutorial-target-status'),
      sr: card.querySelector('.dpro-tutorial-sr'),
      back: card.querySelector('[data-action="back"]'),
      next: card.querySelector('[data-action="next"]'),
      skip: card.querySelector('[data-action="skip"]'),
      close: card.querySelector('[data-action="close"]')
    };
    ui.closeTop.addEventListener('click', close);
    ui.close.addEventListener('click', close);
    ui.back.addEventListener('click', back);
    ui.next.addEventListener('click', next);
    ui.skip.addEventListener('click', skip);
    installDrag();
    refreshLauncher();
    return ui;
  }
  function refreshLauncher() {
    if (!ui) return;
    const label = state.status === 'active' ? `操作ガイドを再開（${state.step + 1}/10）` :
      (state.status === 'completed' || state.status === 'skipped') ? '操作ガイドをもう一度見る' : '操作ガイドを開始';
    ui.launcher.textContent = label;
    ui.launcher.setAttribute('aria-label', label);
  }
  function elementVisible(el) {
    if (!el || !el.isConnected) return false;
    const cs = global.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) !== 0 && r.width > 0 && r.height > 0;
  }
  function resolveTarget(step) {
    const candidates = [step.selector].concat(step.fallback || []);
    for (let i = 0; i < candidates.length; i++) {
      let el = null;
      try { el = document.querySelector(candidates[i]); } catch (_) { el = null; }
      if (elementVisible(el)) return {el, source:i === 0 ? 'primary' : `fallback-${i}`};
    }
    return {el:null, source:'missing'};
  }
  function targetInViewport(el) {
    const r = el.getBoundingClientRect();
    return r.bottom >= 6 && r.right >= 6 && r.top <= global.innerHeight - 6 && r.left <= global.innerWidth - 6;
  }
  function moveHighlight() {
    refreshRaf = 0;
    if (!ui || ui.card.hidden || !activeTarget || !activeTarget.isConnected || !elementVisible(activeTarget)) {
      if (ui) ui.highlight.hidden = true;
      return;
    }
    const r = activeTarget.getBoundingClientRect();
    const pad = 5;
    const left = Math.max(2, r.left - pad);
    const top = Math.max(2, r.top - pad);
    const right = Math.min(global.innerWidth - 2, r.right + pad);
    const bottom = Math.min(global.innerHeight - 2, r.bottom + pad);
    ui.highlight.style.left = left + 'px';
    ui.highlight.style.top = top + 'px';
    ui.highlight.style.width = Math.max(0, right - left) + 'px';
    ui.highlight.style.height = Math.max(0, bottom - top) + 'px';
    ui.highlight.dataset.fallback = targetSource === 'primary' ? '0' : '1';
    ui.highlight.hidden = false;
  }
  function scheduleHighlight() {
    if (!refreshRaf) refreshRaf = global.requestAnimationFrame(moveHighlight);
  }
  function clampCard() {
    if (!ui || ui.card.hidden) return;
    const r = ui.card.getBoundingClientRect();
    let left = r.left, top = r.top;
    const maxLeft = Math.max(MARGIN, global.innerWidth - r.width - MARGIN);
    const maxTop = Math.max(MARGIN, global.innerHeight - r.height - MARGIN);
    left = Math.min(maxLeft, Math.max(MARGIN, left));
    top = Math.min(maxTop, Math.max(MARGIN, top));
    if (Math.abs(left - r.left) > .5 || Math.abs(top - r.top) > .5) {
      ui.card.style.right = 'auto'; ui.card.style.bottom = 'auto';
      ui.card.style.left = left + 'px'; ui.card.style.top = top + 'px';
    }
  }
  function renderStep(options) {
    buildUI();
    const step = STEPS[state.step];
    ui.card.hidden = false;
    ui.progress.textContent = `STEP ${String(step.order).padStart(2,'0')} / 10`;
    ui.title.textContent = step.title;
    ui.copy.textContent = step.copy;
    ui.back.disabled = state.step === 0;
    ui.next.textContent = state.step === STEPS.length - 1 ? '完了' : '次へ';

    const resolved = resolveTarget(step);
    activeTarget = resolved.el;
    targetSource = resolved.source;
    ui.targetStatus.textContent = activeTarget ?
      (targetSource === 'primary' ? '対象を青枠で表示しています。操作は自動実行しません。' : '対象が見つからないため、安全な表示領域を青い点線で案内しています。') :
      '対象を表示できません。操作は実行せず、この説明だけで続行できます。';
    if (activeTarget && !targetInViewport(activeTarget)) {
      activeTarget.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
    }
    scheduleHighlight();
    clampCard();
    ui.sr.textContent = `ステップ${step.order}、${step.title}`;
    if (!options || options.focus !== false) global.setTimeout(() => ui.next.focus({preventScroll:true}), 0);
  }
  function setActive(stepIndex) {
    state = {step:Math.max(0,Math.min(STEPS.length - 1,stepIndex)),status:'active',updatedAt:''};
    persist();
    renderStep();
    return snapshot();
  }
  function start() { return setActive(0); }
  function resume() {
    if (state.status !== 'active') return start();
    persist(); renderStep(); return snapshot();
  }
  function replay() { return setActive(0); }
  function next() {
    if (state.status !== 'active') return start();
    if (state.step >= STEPS.length - 1) {
      state.status = 'completed'; persist(); close(false); return snapshot();
    }
    return setActive(state.step + 1);
  }
  function back() {
    if (state.status !== 'active') return start();
    return setActive(Math.max(0, state.step - 1));
  }
  function skip() {
    state.status = 'skipped'; persist(); close(false); return snapshot();
  }
  function close(returnFocus) {
    if (!ui) return snapshot();
    ui.card.hidden = true; ui.highlight.hidden = true; activeTarget = null;
    if (returnFocus !== false) global.setTimeout(() => ui.launcher.focus({preventScroll:true}), 0);
    return snapshot();
  }
  function goTo(index) {
    const n = Number(index);
    if (!Number.isFinite(n)) return snapshot();
    return setActive(Math.max(0, Math.min(STEPS.length - 1, Math.trunc(n))));
  }
  function snapshot() {
    return Object.freeze({step:state.step,status:state.status,updatedAt:state.updatedAt,stepId:STEPS[state.step]?.id || null,targetSource});
  }
  function installDrag() {
    const handle = ui.drag;
    let drag = null;
    handle.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button,a,input,select,textarea')) return;
      const r = ui.card.getBoundingClientRect();
      drag = {id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
      ui.card.style.right = 'auto'; ui.card.style.bottom = 'auto';
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    handle.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const r = ui.card.getBoundingClientRect();
      const maxLeft = Math.max(MARGIN, global.innerWidth - r.width - MARGIN);
      const maxTop = Math.max(MARGIN, global.innerHeight - r.height - MARGIN);
      const left = Math.min(maxLeft, Math.max(MARGIN, e.clientX - drag.dx));
      const top = Math.min(maxTop, Math.max(MARGIN, e.clientY - drag.dy));
      ui.card.style.left = left + 'px'; ui.card.style.top = top + 'px';
      e.preventDefault();
    });
    function end(e) {
      if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
      try { handle.releasePointerCapture(drag.id); } catch (_) {}
      drag = null; clampCard();
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function init() {
    buildUI();
    global.addEventListener('resize', () => { clampCard(); scheduleHighlight(); }, {passive:true});
    global.addEventListener('scroll', scheduleHighlight, {passive:true,capture:true});
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ui && !ui.card.hidden) { e.preventDefault(); close(); }
    });
  }

  global.DPROMedicalTutorial = Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    steps: STEPS,
    state: snapshot,
    start, resume, replay, next, back, skip, close, goTo,
    open: resume
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})(window, document);


(function (global, document) {
  'use strict';
  const T = global.DPROMedicalTutorial;
  if (!T || !Array.isArray(T.steps) || T.steps.length !== 10) return;
  const GUIDE_VERSION = 'DPRO MEDICAL GUIDE CENTER STANDARD V1.1 / R4';
  let ui = null;

  function style() {
    if (document.getElementById('dpro-medical-guide-style')) return;
    const s=document.createElement('style');
    s.id='dpro-medical-guide-style';
    s.textContent=`
#dpro-guide-launcher{position:fixed;left:12px;bottom:76px;z-index:2147483600;min-height:44px;border:0;border-radius:999px;padding:0 15px;background:#fff;color:#102d45;border:1px solid #b9cbd8;font-weight:900;box-shadow:0 10px 28px rgba(0,0,0,.16);cursor:pointer;max-width:calc(100vw - 24px)}
#dpro-guide-launcher:focus,#dpro-guide-launcher:focus-visible,.dpro-guide-panel button:focus,.dpro-guide-panel button:focus-visible{outline:3px solid #ffbf47;outline-offset:3px}
.dpro-guide-panel{position:fixed;inset:18px;z-index:2147483602;width:min(920px,calc(100vw - 36px));height:min(760px,calc(100vh - 36px));margin:auto;overflow:auto;background:#f7fafc;color:#15324a;border:1px solid #b9cbd8;border-radius:20px;box-shadow:0 24px 80px rgba(7,32,49,.34);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}
.dpro-guide-head{position:sticky;top:0;z-index:2;background:#102d45;color:#fff;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:10px}.dpro-guide-head h2{font-size:20px;margin:0}.dpro-guide-head button{min-height:38px;border:1px solid rgba(255,255,255,.35);border-radius:10px;background:transparent;color:#fff;padding:0 12px;font-weight:850;cursor:pointer}.dpro-guide-body{padding:16px}.dpro-guide-controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.dpro-guide-controls button{min-height:42px;border:1px solid #c7d8e3;border-radius:11px;background:#fff;color:#15324a;padding:0 14px;font-weight:900;cursor:pointer}.dpro-guide-controls button[data-primary="1"]{background:#1769aa;color:#fff;border-color:#1769aa}.dpro-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dpro-guide-item{background:#fff;border:1px solid #d5e2eb;border-radius:15px;padding:14px}.dpro-guide-item small{display:block;color:#1769aa;font-weight:900}.dpro-guide-item h3{font-size:16px;margin:5px 0 7px}.dpro-guide-item p{font-size:13px;line-height:1.6;color:#536d81;margin:0 0 10px}.dpro-guide-item button{min-height:38px;border:1px solid #c7d8e3;border-radius:10px;background:#fff;color:#1769aa;padding:0 12px;font-weight:900;cursor:pointer}.dpro-guide-note{font-size:12px;color:#60788b;margin:0 0 12px}
@media(max-width:620px){#dpro-guide-launcher{left:10px;bottom:122px}.dpro-guide-panel{inset:10px;width:calc(100vw - 20px);height:calc(100vh - 20px)}.dpro-guide-grid{grid-template-columns:1fr}.dpro-guide-controls{display:grid;grid-template-columns:1fr 1fr}.dpro-guide-controls button{width:100%}}
`;
    document.head.appendChild(s);
  }
  function build(){
    if(ui) return ui;
    style();
    const launcher=document.createElement('button');
    launcher.id='dpro-guide-launcher';launcher.type='button';launcher.textContent='Guide Center';launcher.setAttribute('aria-controls','dpro-guide-panel');
    const panel=document.createElement('section');
    panel.id='dpro-guide-panel';panel.className='dpro-guide-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','dpro-guide-title');
    panel.innerHTML=`<div class="dpro-guide-head"><h2 id="dpro-guide-title">DPRO MEDICAL Guide Center</h2><button type="button" data-guide-close>閉じる</button></div><div class="dpro-guide-body"><p class="dpro-guide-note">First10と同じ10ステップ・同じ順序・同じResume状態を使います。Guide Centerから業務操作を自動実行することはありません。</p><div class="dpro-guide-controls"><button type="button" data-guide-start data-primary="1">Start</button><button type="button" data-guide-resume>Resume</button><button type="button" data-guide-replay>Replay</button></div><div class="dpro-guide-grid"></div></div>`;
    const grid=panel.querySelector('.dpro-guide-grid');
    T.steps.forEach((step,i)=>{
      const item=document.createElement('article');item.className='dpro-guide-item';item.dataset.stepId=step.id;item.dataset.stepOrder=String(step.order);
      item.innerHTML=`<small>STEP ${String(step.order).padStart(2,'0')} / 10</small><h3></h3><p></p><button type="button" data-guide-index="${i}">このステップを見る</button>`;
      item.querySelector('h3').textContent=step.title;item.querySelector('p').textContent=step.copy;grid.appendChild(item);
    });
    document.body.append(launcher,panel);
    ui={launcher,panel,close:panel.querySelector('[data-guide-close]'),start:panel.querySelector('[data-guide-start]'),resume:panel.querySelector('[data-guide-resume]'),replay:panel.querySelector('[data-guide-replay]')};
    launcher.addEventListener('click',open);
    ui.close.addEventListener('click',close);
    ui.start.addEventListener('click',()=>{T.start();close(false);});
    ui.resume.addEventListener('click',()=>{T.resume();close(false);});
    ui.replay.addEventListener('click',()=>{T.replay();close(false);});
    panel.querySelectorAll('[data-guide-index]').forEach(btn=>btn.addEventListener('click',()=>{T.goTo(Number(btn.dataset.guideIndex));close(false);}));
    return ui;
  }
  // R4 GUIDE FOCUS RECOVERY FIX V1.0: never leave Tutorial overlay open behind Guide Center.
  function open(){build();if(T&&typeof T.close==='function')T.close(false);ui.panel.hidden=false;setTimeout(()=>ui.close.focus({preventScroll:true}),0);return snapshot();}
  function close(returnFocus=true){if(!ui)return snapshot();ui.panel.hidden=true;if(returnFocus)setTimeout(()=>ui.launcher.focus({preventScroll:true}),0);return snapshot();}
  function snapshot(){return Object.freeze({version:GUIDE_VERSION,count:T.steps.length,open:!!ui&&!ui.panel.hidden,stepIds:T.steps.map(s=>s.id)});}
  function init(){build();document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui&&!ui.panel.hidden){e.preventDefault();e.stopImmediatePropagation();close();}},true);}
  global.DPROMedicalGuideCenter=Object.freeze({version:GUIDE_VERSION,open,close,state:snapshot,count:()=>T.steps.length,steps:T.steps});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window, document);
