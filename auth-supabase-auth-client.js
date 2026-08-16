/*
 * DPRO MEDICAL INTEGRATION-1 / STANDARD V1.3
 * Browser Auth Runtime Adapter
 *
 * Public client config only:
 *   window.DPRO_MEDICAL_CONFIG.supabaseUrl
 *   window.DPRO_MEDICAL_CONFIG.supabasePublishableKey
 *
 * SECURITY:
 * - Uses official supabase-js v2 browser client lifecycle.
 * - Does not manually persist access_token / refresh_token.
 * - Browser role / tenant / patient values are never authorization trust sources.
 * - Server /api/medical/v1/context remains the authorization source of truth.
 */
(function (global, document) {
  'use strict';

  const SDK_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const API_BASE = '/api/medical/v1';
  let clientPromise = null;
  let authWatcher = null;

  class DproAuthError extends Error {
    constructor(code, message, details) {
      super(message || code);
      this.name = 'DproAuthError';
      this.code = code;
      this.details = details || null;
    }
  }

  function fail(code, message, details) {
    return new DproAuthError(code, message, details);
  }

  function cfg() {
    return global.DPRO_MEDICAL_CONFIG || {};
  }

  function validatePublicConfig() {
    const c = cfg();
    const url = String(c.supabaseUrl || '').trim().replace(/\/+$/, '');
    const key = String(c.supabasePublishableKey || '').trim();
    if (!url || !/^https:\/\//i.test(url)) {
      throw fail('AUTH_CONFIG_REQUIRED', 'Supabase URL が設定されていません。');
    }
    if (!key) {
      throw fail('AUTH_CONFIG_REQUIRED', 'Supabase Publishable Key が設定されていません。');
    }
    if (/service[_-]?role|secret[_-]?key|eyJ[a-zA-Z0-9_-]+\./i.test(key)) {
      throw fail('AUTH_PUBLIC_KEY_INVALID', 'Browser config には Publishable Key のみ設定してください。');
    }
    return { url, key };
  }

  function loadSupabaseSdk() {
    if (global.supabase && typeof global.supabase.createClient === 'function') {
      return Promise.resolve(global.supabase);
    }
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-dpro-supabase-sdk="1"]');
      if (existing) {
        if (global.supabase && typeof global.supabase.createClient === 'function') return resolve(global.supabase);
        existing.addEventListener('load', () => resolve(global.supabase), { once: true });
        existing.addEventListener('error', () => reject(fail('AUTH_SDK_LOAD_FAILED', 'Supabase Auth SDK を読み込めませんでした。')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = SDK_CDN;
      script.async = true;
      script.dataset.dproSupabaseSdk = '1';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (!global.supabase || typeof global.supabase.createClient !== 'function') {
          reject(fail('AUTH_SDK_INVALID', 'Supabase Auth SDK の初期化に失敗しました。'));
          return;
        }
        resolve(global.supabase);
      };
      script.onerror = () => reject(fail('AUTH_SDK_LOAD_FAILED', 'Supabase Auth SDK を読み込めませんでした。'));
      document.head.appendChild(script);
    });
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const { url, key } = validatePublicConfig();
        const sdk = await loadSupabaseSdk();
        return sdk.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce'
          }
        });
      })().catch(err => {
        clientPromise = null;
        throw err;
      });
    }
    return clientPromise;
  }

  async function getSession() {
    const client = await getClient();
    const first = await client.auth.getSession();
    if (first.error) throw fail('AUTH_SESSION_INVALID', '認証セッションを確認できませんでした。', first.error);
    let session = first.data && first.data.session ? first.data.session : null;
    if (!session) return null;

    const expiresAt = Number(session.expires_at || 0);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (expiresAt && expiresAt <= nowSeconds + 15) {
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error || !refreshed.data || !refreshed.data.session) {
        throw fail('AUTH_SESSION_EXPIRED', '認証セッションの有効期限が切れました。再ログインしてください。', refreshed.error || null);
      }
      session = refreshed.data.session;
    }
    return session;
  }

  async function getAccessToken() {
    const session = await getSession();
    if (!session || !session.access_token) {
      throw fail('AUTH_SESSION_REQUIRED', 'ログインが必要です。');
    }
    return session.access_token;
  }

  async function getUser() {
    const client = await getClient();
    const result = await client.auth.getUser();
    if (result.error) throw fail('AUTH_USER_INVALID', 'ログインユーザーを確認できませんでした。', result.error);
    return result.data ? result.data.user || null : null;
  }

  function normalizeCredentials(input, passwordMaybe) {
    if (typeof input === 'string') return { email: input.trim(), password: String(passwordMaybe || '') };
    const o = input && typeof input === 'object' ? input : {};
    return { email: String(o.email || '').trim(), password: String(o.password || '') };
  }

  async function signInWithPassword(input, passwordMaybe) {
    const credentials = normalizeCredentials(input, passwordMaybe);
    if (!credentials.email || !credentials.password) throw fail('AUTH_CREDENTIALS_REQUIRED', 'メールアドレスとパスワードを入力してください。');
    const client = await getClient();
    const result = await client.auth.signInWithPassword(credentials);
    if (result.error) throw fail('AUTH_SIGN_IN_FAILED', 'ログインできませんでした。', result.error);
    return result.data;
  }

  async function signInStaff(input, passwordMaybe) {
    return signInWithPassword(input, passwordMaybe);
  }

  async function signInPatient(input, passwordMaybe) {
    return signInWithPassword(input, passwordMaybe);
  }

  async function signOut() {
    const client = await getClient();
    const result = await client.auth.signOut({ scope: 'local' });
    if (result.error) throw fail('AUTH_SIGN_OUT_FAILED', 'ログアウト処理に失敗しました。', result.error);
    return true;
  }

  function onAuthStateChange(callback) {
    let inner = null;
    let cancelled = false;
    getClient().then(client => {
      if (cancelled) return;
      const result = client.auth.onAuthStateChange((event, session) => {
        try { callback(event, session); } catch (_) { /* callback isolation */ }
      });
      inner = result && result.data ? result.data.subscription : null;
      if (cancelled && inner && typeof inner.unsubscribe === 'function') inner.unsubscribe();
    }).catch(() => {});
    return {
      unsubscribe() {
        cancelled = true;
        if (inner && typeof inner.unsubscribe === 'function') inner.unsubscribe();
      }
    };
  }

  function contextUrl() {
    const c = cfg();
    return String(c.apiBaseUrl || '').replace(/\/+$/, '') + API_BASE + '/context';
  }

  async function getMedicalContext() {
    const token = await getAccessToken();
    const c = cfg();
    const headers = { Accept: 'application/json', Authorization: 'Bearer ' + token };
    if (typeof c.clinicId === 'string' && c.clinicId.trim()) headers['X-DPRO-Clinic-ID'] = c.clinicId.trim();
    const response = await fetch(contextUrl(), { method: 'GET', credentials: 'include', headers });
    let payload = null;
    try { payload = await response.json(); } catch (_) { throw fail('AUTH_CONTEXT_INVALID', '認証コンテキストの応答を確認できませんでした。'); }
    if (!response.ok || !payload || payload.ok !== true || !payload.data) {
      const code = payload && payload.error && payload.error.code ? payload.error.code : 'AUTHORIZATION_FAILED';
      const message = payload && payload.error && payload.error.message ? payload.error.message : '医療システムの利用権限を確認できませんでした。';
      throw fail(code, message, payload && payload.error ? payload.error : null);
    }
    return payload.data;
  }

  function safeNextUrl(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    try {
      const u = new URL(raw, global.location.href);
      if (u.origin !== global.location.origin) return fallback;
      return u.pathname + u.search + u.hash;
    } catch (_) {
      return fallback;
    }
  }

  function explicitDemoMockSelected() {
    const c = cfg();
    if (c.environmentMode !== 'demo' || c.mockMode !== true) return false;
    try { return new URLSearchParams(global.location.search).get('demo') === '1'; }
    catch (_) { return false; }
  }

  function clearProtectedDom() {
    try {
      document.querySelectorAll('[data-dpro-sensitive], main, .app, .staff-shell, .ipad-shell').forEach(el => {
        if (el && el.parentNode) el.textContent = '';
      });
    } catch (_) {}
  }

  async function signOutAndRedirect(loginUrl) {
    try { await signOut(); } catch (_) {}
    clearProtectedDom();
    global.location.replace(loginUrl || 'login.html');
  }

  function mountLogout(loginUrl) {
    if (!document.body || document.getElementById('dpro-auth-logout')) return;
    const button = document.createElement('button');
    button.id = 'dpro-auth-logout';
    button.type = 'button';
    button.textContent = 'ログアウト';
    button.setAttribute('aria-label', 'ログアウト');
    button.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;border:1px solid #c9d5df;background:#fff;color:#17324a;border-radius:999px;padding:9px 13px;font:700 13px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.12);cursor:pointer';
    button.addEventListener('click', () => signOutAndRedirect(loginUrl));
    document.body.appendChild(button);
  }

  function redirectToLogin(loginUrl, code) {
    if (!loginUrl) return;
    const current = global.location.pathname + global.location.search + global.location.hash;
    const u = new URL(loginUrl, global.location.href);
    u.searchParams.set('next', current);
    if (code) u.searchParams.set('reason', code);
    global.location.replace(u.pathname + u.search + u.hash);
  }

  function startProtectedWatcher(loginUrl) {
    if (authWatcher) return;
    authWatcher = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        clearProtectedDom();
        redirectToLogin(loginUrl, 'AUTH_SESSION_REQUIRED');
      }
    });
  }

  async function requireActor(actorType, options) {
    const o = options && typeof options === 'object' ? options : {};
    if (o.allowExplicitDemoMock === true && explicitDemoMockSelected()) return { actor_type: actorType, demo_mock: true, permissions: [] };
    try {
      const context = await getMedicalContext();
      if (context.actor_type !== actorType) throw fail('AUTH_ACTOR_MISMATCH', 'この画面を利用できるアカウントではありません。');
      if (actorType === 'patient' && !context.patient_id) throw fail('AUTHORIZATION_FAILED', '患者紐付けを確認できませんでした。');
      const required = Array.isArray(o.requiredPermissions) ? o.requiredPermissions : [];
      const actual = Array.isArray(context.permissions) ? context.permissions : [];
      const missing = required.filter(permission => !actual.includes(permission));
      if (missing.length) throw fail('PERMISSION_DENIED', 'この画面を表示する権限がありません。', { missing });
      mountLogout(o.loginUrl || (actorType === 'patient' ? 'patient-login.html' : 'login.html'));
      startProtectedWatcher(o.loginUrl || (actorType === 'patient' ? 'patient-login.html' : 'login.html'));
      return context;
    } catch (error) {
      if (o.redirect !== false) redirectToLogin(o.loginUrl || (actorType === 'patient' ? 'patient-login.html' : 'login.html'), error.code || 'AUTH_REQUIRED');
      throw error;
    }
  }

  function routeAfterLogin(context, requestedNext, actorType) {
    if (!context || context.actor_type !== actorType) return actorType === 'patient' ? 'patient-login.html' : 'login.html';
    if (requestedNext) return safeNextUrl(requestedNext, actorType === 'patient' ? 'member.html' : 'staff.html');
    if (actorType === 'patient') return 'member.html';
    const permissions = Array.isArray(context.permissions) ? context.permissions : [];
    return permissions.includes('system_check.execute') ? 'owner.html' : 'staff.html';
  }

  global.DPRO_MEDICAL_AUTH = Object.freeze({
    getAccessToken,
    getSession,
    getUser,
    signInStaff,
    signInPatient,
    signOut,
    onAuthStateChange,
    getMedicalContext,
    requireActor,
    signOutAndRedirect,
    routeAfterLogin,
    safeNextUrl
  });
})(window, document);
