(function (global, document) {
  'use strict';

  const shared = global.DPRO_MEDICAL_CONFIG || {};
  const specific = global.DPRO_MEDICAL_CLINIC_RUNTIME_INPUT || {};
  const input = Object.assign({}, shared, specific);
  const params = new URLSearchParams(global.location ? global.location.search : '');
  const pageRole = global.DPRO_MEDICAL_CLINIC_ROLE_HINT === 'staff' ? 'staff' : 'owner';

  // Authorization policy is owned by the static application route.
  // DPRO_MEDICAL_CLINIC_ROLE_HINT is presentation-only and must never select
  // API-mode authorization requirements.
  const PAGE_POLICY = Object.freeze({
    'owner.html': Object.freeze({ requiredPermissions: Object.freeze(['system_check.execute']) }),
    'owner-ipad.html': Object.freeze({ requiredPermissions: Object.freeze(['system_check.execute']) }),
    'owner-ipad-demo.html': Object.freeze({ requiredPermissions: Object.freeze(['system_check.execute']) }),
    'staff.html': Object.freeze({ requiredPermissions: Object.freeze([]) })
  });

  function currentPageName() {
    const pathname = global.location && typeof global.location.pathname === 'string'
      ? global.location.pathname
      : '';
    return pathname.split('/').filter(Boolean).pop() || '';
  }

  function currentPagePolicy() {
    const pageName = currentPageName();
    const policy = PAGE_POLICY[pageName];
    if (!policy) throw new Error('DPRO MEDICAL clinic runtime: unknown canonical page route: ' + pageName);
    return policy;
  }

  const pagePolicy = currentPagePolicy();

  const environmentMode = input.environmentMode === 'demo'
    ? 'demo'
    : 'production';

  const queryMockSelected = params.get('mock') === '1';
  const configuredMockSelected = input.mockMode === true && input.explicitMockSelector === true;
  const explicitMockSelected = queryMockSelected || configuredMockSelected;

  if (environmentMode === 'production' && (queryMockSelected || input.mockMode === true || input.mode === 'mock')) {
    throw new Error('DPRO MEDICAL production guard: mock/mockMode is forbidden in production.');
  }

  const mockMode = environmentMode === 'demo' && explicitMockSelected;
  const mode = mockMode ? 'mock' : 'api';

  global.DPRO_MEDICAL_CLINIC_CONFIG = Object.freeze({
    environmentMode,
    mockMode,
    mode,
    apiBaseUrl: typeof input.apiBaseUrl === 'string' ? input.apiBaseUrl : '',
    clinicId: typeof input.clinicId === 'string' ? input.clinicId : '',
    role: pageRole
  });

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve(src);
      script.onerror = () => reject(new Error('Failed to load runtime asset: ' + src));
      document.head.appendChild(script);
    });
  }

  function showBootstrapError(error) {
    const render = () => {
      let box = document.getElementById('clinic-runtime-error');
      if (!box) {
        box = document.createElement('div');
        box.id = 'clinic-runtime-error';
        box.style.cssText = 'margin:12px;padding:12px;border:1px solid #b94a48;background:#fff2f2;color:#7a1f1f;border-radius:10px;font:14px/1.5 sans-serif';
        (document.body || document.documentElement).prepend(box);
      }
      box.textContent = 'Runtime bootstrap error: ' + error.message;
    };
    if (document.body) render(); else document.addEventListener('DOMContentLoaded', render, { once: true });
  }

  async function bootstrap() {
    if (!mockMode) {
      const auth = global.DPRO_MEDICAL_AUTH;
      if (!auth || typeof auth.requireActor !== 'function') {
        throw new Error('DPRO_MEDICAL_AUTH.requireActor() is required in API mode.');
      }
      await auth.requireActor('staff', {
        loginUrl: 'login.html',
        requiredPermissions: Array.from(pagePolicy.requiredPermissions)
      });
    }
    if (mockMode) {
      await loadScript('clinic-mock-data.js');
      if (!global.DPROMedicalMock) throw new Error('Explicit demo mock selected, but DPROMedicalMock was not initialized.');
    }
    await loadScript('clinic-api-adapter.js');
    // BRUSHUP-8: bridge existing clinic UI check-in control to canonical visit.write.
    // No new permission key is introduced into MED-AUTH-001.
    if (currentPageName() === 'owner-ipad.html') await loadScript('ipad-permission-bridge.js');
    // BRUSHUP-9: cache-bust the clinic workflow runtime so queue controls are authoritative immediately after GitHub Pages deploy.
    await loadScript('clinic.js?v=brushup9-1.1-permission-hotfix');
  }

  global.DPRO_MEDICAL_CLINIC_BOOT = bootstrap().catch(error => {
    showBootstrapError(error);
    throw error;
  });
})(window, document);
