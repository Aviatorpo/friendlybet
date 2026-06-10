// ============================================================
// FriendlyBet - Main Application Logic
// ============================================================

// ============================================================
// State Management
// ============================================================
const state = {
  currentScreen: 'loading-screen',
  currentPool: null,        // ההימור שמצאנו
  currentUser: null,        // המשתמש שלנו
  pendingNickname: null,    // כינוי שעדיין לא נשמר
  pendingPoolName: null,    // שם הימור שעדיין לא נוצר
  pendingRecoveryCode: null // קוד שחזור שעדיין לא שמר
};

// ============================================================
// Screen Navigation
// ============================================================

// v2.10: 72h knockout-recovery flag. Declared HERE (above showScreen, which clears
// it on leaving the walkthrough) so it's always initialized before showScreen can
// run — no temporal-dead-zone risk. Set true ONLY inside spReopenKnockout().
let spReopenActive = false;
let _spReopenStatus = null;   // last my_knockout_reopen result {locked,eligible,approved,used,can_reenter,expires_at}

function showScreen(screenId) {
  // v2.5.37: stop any auto-refresh that was running on the previous screen.
  // Currently only matches-screen registers timers; this hook keeps it
  // simple to add others later.
  if (state.currentScreen === 'matches-screen' && screenId !== 'matches-screen') {
    if (typeof _stopMatchesAutoRefresh === 'function') _stopMatchesAutoRefresh();
  }
  // v2.10: leaving the knockout walkthrough by ANY route clears the recovery flag
  // so it can't leak into a normal save. (Flag is declared just above, so no TDZ.)
  if (spReopenActive && screenId !== 'ko-single-screen') {
    spReopenActive = false;
  }
  // Stop the pundit rotation when leaving the dashboard so its 9s interval can't
  // pile up (re-entering the dashboard restarts it). _punditState is defined
  // later but exists by the time showScreen runs.
  if (screenId !== 'user-dashboard-screen' && typeof _punditState !== 'undefined') {
    if (_punditState.timer) { clearInterval(_punditState.timer); _punditState.timer = null; }
    if (_punditState.refreshTimer) { clearInterval(_punditState.refreshTimer); _punditState.refreshTimer = null; }
  }

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });

  // Show target screen
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    state.currentScreen = screenId;
    window.scrollTo(0, 0);
  } else {
    console.error('Screen not found:', screenId);
  }
}

// ============================================================
// Toast Notifications
// ============================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'ti-circle-check' : 
               type === 'error' ? 'ti-circle-x' : 
               'ti-info-circle';
  
  toast.innerHTML = `<i class="ti ${icon}"></i><span></span>`;
  toast.querySelector('span').textContent = message; // textContent: message may carry dynamic data
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
// Helper Functions
// ============================================================

// יצירת קוד אקראי (5 תווים לקוד הימור, 16 תווים לקוד שחזור)
function generateRandomCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ללא 0, O, I, 1
  let code = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

// יצירת קוד שחזור בפורמט XXXX-XXXX-XXXX-XXXX
function generateRecoveryCode() {
  const raw = generateRandomCode(16);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

// Hash של קוד שחזור (פשוט, ל-MVP. בעתיד נשתמש ב-bcrypt)
async function hashRecoveryCode(code) {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// v2.5.16: log in to an existing account using a recovery code.
// v2.5.29: the stored hash is of the ORIGINAL hyphenated format
// ("ABCD-EFGH-IJKL-MNOP") produced by generateRecoveryCode(). We must
// re-create that exact format from the user's input before hashing -
// the previous version stripped hyphens then hashed bare chars, which
// never matched. We also try both formats (with hyphens and without)
// for forward-compat in case any user codes were hashed differently.
function _formatRecoveryCodeForHash(rawInput) {
  // 1. strip everything that isn't a code character, uppercase
  const chars = String(rawInput || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  // 2. group into XXXX-XXXX-XXXX-XXXX (matches generateRecoveryCode output)
  const m = chars.match(/.{1,4}/g);
  return m ? m.join('-') : chars;
}

// Shared recovery-code lookup (NO UI). Returns {user, pool, hyphenated} on success,
// or {error:'short'|'server'|'notFound'|'noPool'} on a handled failure. Throws on a
// real network/db error. Reused by manual login, ?login= auto-login, and QR decode.
async function _lookupUserByRecoveryCode(rawInput) {
  const bareChars = String(rawInput || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (bareChars.length < 12) return { error: 'short' };
  if (!supabaseClient) { initSupabase(); return { error: 'server' }; }
  const hyphenated = _formatRecoveryCodeForHash(bareChars);

  // Preferred: server-side login RPC. It validates the code in the DB and
  // returns the user row WITHOUT recovery_code_hash, so the hash never leaves
  // the server (and the client never needs to read that column). If the RPC
  // isn't deployed in this environment yet, supabase returns an error and we
  // fall back to the legacy direct-hash query below.
  try {
    const { data: u, error: rpcErr } = await supabaseClient.rpc('login', { p_code: bareChars });
    if (!rpcErr) {
      if (!u) return { error: 'notFound' };          // RPC ran, no matching code
      const { data: pool, error: poolErr } = await supabaseClient
        .from('pools').select('*').eq('id', u.pool_id).maybeSingle();
      if (poolErr) return { error: 'server' };
      if (!pool) return { error: 'noPool' };
      return { user: u, pool, hyphenated };
    }
    // RPC returned an error. Only fall through to the legacy hash query if the
    // function genuinely isn't deployed in THIS environment. A real error from a
    // deployed login() must NOT hit the legacy select('*') on users — that 401s
    // once SELECT is column-restricted — so surface a retryable error instead of
    // a misleading "not found".
    if (!_rpcMissing(rpcErr)) return { error: 'server' };
  } catch (_) {
    // A thrown error (network) from a deployed RPC: surface rather than fall to
    // the legacy path (which would also fail and mislabel the result).
    return { error: 'server' };
  }

  // Legacy fallback: direct hash query (only works where SELECT(recovery_code_hash)
  // is still granted). Kept so a deploy with the RPC not-yet-present still logs in.
  for (const candidate of [hyphenated, bareChars]) {
    const hash = await hashRecoveryCode(candidate);
    const { data: users, error: userErr } = await supabaseClient
      .from('users').select('*').eq('recovery_code_hash', hash).limit(1);
    if (userErr) throw userErr;
    if (users && users.length > 0) {
      const user = users[0];
      const { data: pool, error: poolErr } = await supabaseClient
        .from('pools').select('*').eq('id', user.pool_id).maybeSingle();
      if (poolErr) throw poolErr;
      if (!pool) return { error: 'noPool' };
      return { user, pool, hyphenated };
    }
  }
  return { error: 'notFound' };
}

function _applyRecoveryLogin(found) {
  state.currentUser = found.user;
  state.currentPool = found.pool;
  saveLocalUser(found.user);
  try { localStorage.setItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE, found.hyphenated); } catch (_) {}
  if (typeof fbMirrorSession === 'function') fbMirrorSession();
}

// ---- Server-side write gateway (Phase 2 security wiring) -----------------
// The caller's recovery code is the credential the SECURITY DEFINER RPCs use to
// resolve identity server-side. It's stored at login/signup; returns null for a
// legacy session that pre-dates storing it -> callers then fall back to legacy.
function _currentRecoveryCode() {
  try {
    return state.pendingRecoveryCode ||
           localStorage.getItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE) || null;
  } catch (_) { return null; }
}

// True only when an RPC error means the function is NOT deployed in this
// environment (PostgREST PGRST202 / "not found in schema cache"), so the caller
// should fall back to the legacy direct write. A genuine business error from a
// deployed RPC (e.g. 'pool locked', 'invalid pick payload') returns FALSE so the
// caller surfaces it instead of silently double-writing via the legacy path.
function _rpcMissing(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  // PostgREST returns PGRST202 "Could not find the function ... in the schema
  // cache" when an RPC isn't deployed. Keep this NARROW: a broad match (e.g. a
  // generic "does not exist") could misclassify a real business error and wrongly
  // fall back to the legacy direct write.
  return code === 'PGRST202' ||
         /Could not find the function|schema cache/i.test(msg);
}

// v2.9.12: resilient write-RPC caller. The single-phase pick tables are
// anon-REVOKEd (writes go ONLY through these SECURITY DEFINER RPCs — the legacy
// direct write 401s for every real user). PostgREST briefly returns PGRST202
// ("function not in schema cache") whenever its schema reloads — which happens
// on EVERY migration/DDL. During that window a save would otherwise fall through
// to the dead direct-write path and silently lose the user's picks (this was the
// root cause of the mass knockout-bracket loss: the June-4 anon REVOKE turned the
// fallback into a guaranteed 401, and the June 5-6 migrations triggered the
// reload windows). So: retry a transient PGRST202 a few times before giving up.
// Returns { ok, error, missing } — `missing` true only if STILL PGRST202 after
// all retries (genuinely undeployed, e.g. a stale environment), so callers fall
// back only as a true last resort.
async function _rpcWrite(fn, args, { retries = 4, baseDelayMs = 700 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabaseClient.rpc(fn, args);
    if (!error) return { ok: true, data, error: null, missing: false };
    lastErr = error;
    if (!_rpcMissing(error)) return { ok: false, error, missing: false };
    // transient schema-cache miss — wait (linear backoff) and retry
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  return { ok: false, error: lastErr, missing: true };
}

// Auto-login from a recovery code (QR scan / ?login= / "Recover with QR" picker).
// Returns true on success. opts.silent suppresses the success toast.
async function loginViaRecoveryCode(rawInput, opts = {}) {
  try {
    const found = await _lookupUserByRecoveryCode(rawInput);
    if (!found || found.error) return false;
    _applyRecoveryLogin(found);
    if (!opts.silent) showToast(t('recoveryLogin.success', { nickname: escapeHtml(found.user.nickname) }), 'success');
    await goToDashboard();
    return true;
  } catch (err) { console.error('loginViaRecoveryCode err:', err); return false; }
}
window.loginViaRecoveryCode = loginViaRecoveryCode;

async function submitRecoveryLogin() {
  const input = document.getElementById('recovery-login-input');
  const errEl = document.getElementById('recovery-login-error');
  if (errEl) errEl.style.display = 'none';
  if (!input) return;
  try {
    const found = await _lookupUserByRecoveryCode(input.value);
    if (!found || found.error) {
      const key = { short: 'recoveryLogin.errorShort', server: 'errors.serverConnecting',
        notFound: 'recoveryLogin.errorNotFound', noPool: 'recoveryLogin.errorNoPool' }[found && found.error] || 'errors.unexpected';
      if (errEl) { errEl.textContent = t(key); errEl.style.display = ''; }
      return;
    }
    _applyRecoveryLogin(found);
    showToast(t('recoveryLogin.success', { nickname: escapeHtml(found.user.nickname) }), 'success');
    await goToDashboard();
  } catch (err) {
    console.error('submitRecoveryLogin err:', err);
    if (errEl) { errEl.textContent = t('errors.unexpected'); errEl.style.display = ''; }
  }
}
window.submitRecoveryLogin = submitRecoveryLogin;

// ============================================================
// QR login: the recovery code as a scannable login QR. Scanning the QR (or picking
// the saved image) lands on ?login=CODE and auto-logs the user in. SECURITY: the QR
// encodes the full credential — it is treated/labelled as a private key.
// ============================================================
function _rcLoginUrl(code) {
  const bare = String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `${location.origin}/?login=${bare}`;
}
function _ensureQRCode() {
  if (window.qrcode) return Promise.resolve();
  if (window._qrPromise) return window._qrPromise;
  window._qrPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window._qrPromise;
}
async function _qrDataUrl(text) {
  await _ensureQRCode();
  const qr = window.qrcode(0, 'M');   // type 0 = auto-fit, error-correction M
  qr.addData(text);
  qr.make();
  return qr.createDataURL(6, 12);     // (cellSize, margin) -> image data URL
}
function _ensureJsQR() {
  if (window.jsQR) return Promise.resolve();
  if (window._jsqrPromise) return window._jsqrPromise;
  window._jsqrPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window._jsqrPromise;
}
// Decode a QR from a picked image File -> the embedded text (or null).
async function _decodeQrFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const W = Math.min(img.naturalWidth || 1000, 1600);
    const H = Math.round((img.naturalHeight || W) * (W / (img.naturalWidth || W)));
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
    if (window.BarcodeDetector) {
      try {
        const codes = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(canvas);
        if (codes && codes.length) return codes[0].rawValue;
      } catch (_) {}
    }
    await _ensureJsQR();
    const data = ctx.getImageData(0, 0, W, H);
    const r = window.jsQR(data.data, W, H);
    return r ? r.data : null;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1500); }
}
// Pull the recovery code out of a decoded QR value (a ?login=/?recovery= URL or a bare code).
function _codeFromQrValue(val) {
  if (!val) return null;
  const m = String(val).match(/[?&](?:login|recovery)=([A-Za-z0-9\-]+)/i);
  if (m) return m[1];
  const bare = String(val).replace(/[^A-Za-z0-9]/g, '');
  return bare.length >= 12 ? bare : null;
}
// "Recover with QR" on the login screen: open the photo picker, decode, log in.
function rcLoginPickQr() {
  let inp = document.getElementById('rc-login-qr-file');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'rc-login-qr-file'; inp.style.display = 'none';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; inp.value = '';
      const errEl = document.getElementById('recovery-login-error');
      if (errEl) errEl.style.display = 'none';
      if (!f) return;
      try {
        const code = _codeFromQrValue(await _decodeQrFromFile(f));
        if (!code) { if (errEl) { errEl.textContent = t('recoveryLogin.qrNotFound'); errEl.style.display = ''; } return; }
        const ok = await loginViaRecoveryCode(code);
        if (!ok && errEl) { errEl.textContent = t('recoveryLogin.errorNotFound'); errEl.style.display = ''; }
      } catch (e) {
        console.error('rcLoginPickQr err:', e);
        if (errEl) { errEl.textContent = t('recoveryLogin.qrNotFound'); errEl.style.display = ''; }
      }
    });
    document.body.appendChild(inp);
  }
  inp.click();
}
window.rcLoginPickQr = rcLoginPickQr;

// v2.5.29: live auto-format the recovery code input as the user types
// (and on paste) so it always reads XXXX-XXXX-XXXX-XXXX. The underlying
// chars + caret position are preserved as best we can.
function recoveryLoginInputFormat(ev) {
  const input = ev.target;
  const before = input.value;
  const beforeCaret = input.selectionStart || 0;

  // Count alphanumeric chars before the caret in the original string
  let bareBeforeCaret = 0;
  for (let i = 0; i < beforeCaret && i < before.length; i++) {
    if (/[A-Za-z0-9]/.test(before[i])) bareBeforeCaret++;
  }

  const chars = before.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
  const groups = chars.match(/.{1,4}/g) || [];
  const formatted = groups.join('-');

  if (formatted !== before) {
    input.value = formatted;
    // Recompute caret: walk formatted until we've passed bareBeforeCaret chars
    let newCaret = 0;
    let bareCount = 0;
    while (newCaret < formatted.length && bareCount < bareBeforeCaret) {
      if (/[A-Za-z0-9]/.test(formatted[newCaret])) bareCount++;
      newCaret++;
    }
    try { input.setSelectionRange(newCaret, newCaret); } catch (_) { /* IE fallback */ }
  }
}
window.recoveryLoginInputFormat = recoveryLoginInputFormat;

// Pillar 3: in-app browser (WhatsApp/Telegram/Instagram webview) resilience.
// These webviews frequently sandbox or wipe localStorage between visits, logging the
// user out of a link opened from a group chat. So we MIRROR the session keys into a
// first-party cookie (which survives more of those cases) and, at boot, HEAL a wiped
// localStorage from the cookie. localStorage stays the primary store; cookies are a
// transparent backup — if either is unavailable the app still works.
const _FB_SESSION_KEYS = [
  CONFIG.STORAGE_KEYS.USER_ID, CONFIG.STORAGE_KEYS.POOL_ID, CONFIG.STORAGE_KEYS.NICKNAME,
  CONFIG.STORAGE_KEYS.IS_ADMIN, CONFIG.STORAGE_KEYS.RECOVERY_CODE, CONFIG.STORAGE_KEYS.LANGUAGE
];
function _fbCookieSet(k, v) {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${k}=${encodeURIComponent(v)}; path=/; max-age=31536000; SameSite=Lax${secure}`;
  } catch (_) {}
}
function _fbCookieGet(k) {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + k.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch (_) { return null; }
}
function fbMirrorSession() {
  // Back the session up to BOTH sessionStorage (survives a reload within the same
  // window even if the webview wiped localStorage) and a cookie (survives more cases).
  for (const k of _FB_SESSION_KEYS) {
    let v = null; try { v = localStorage.getItem(k); } catch (_) {}
    if (v != null) {
      _fbCookieSet(k, v);
      try { sessionStorage.setItem(k, v); } catch (_) {}
    }
  }
}
function fbHealSessionFromCookies() {
  // Restore priority: localStorage (primary) -> sessionStorage (same-window survivor)
  // -> cookie. Heals a localStorage that the in-app webview wiped mid-session.
  for (const k of _FB_SESSION_KEYS) {
    let v = null; try { v = localStorage.getItem(k); } catch (_) {}
    if (v != null) continue;
    let backup = null;
    try { backup = sessionStorage.getItem(k); } catch (_) {}
    if (backup == null) backup = _fbCookieGet(k);
    if (backup != null) { try { localStorage.setItem(k, backup); } catch (_) {} }
  }
}

// שמירת מצב משתמש מקומית
function saveLocalUser(userData) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ID, userData.id);
  localStorage.setItem(CONFIG.STORAGE_KEYS.POOL_ID, userData.pool_id);
  localStorage.setItem(CONFIG.STORAGE_KEYS.NICKNAME, userData.nickname);
  localStorage.setItem(CONFIG.STORAGE_KEYS.IS_ADMIN, userData.is_admin ? '1' : '0');
  fbMirrorSession(); // back the session up to a cookie for webview resilience
}

// Pillar 3 (preventive): detect an in-app browser (WhatsApp/Instagram/FB/Android WebView).
// These isolated, often-ephemeral webviews are why a user "isn't recognized later". On
// Android we can break OUT to Chrome via an intent: URL (one tap, reliable — Android blocks
// silent gesture-less intents). On iOS there is no API to open Safari, so we instruct.
function _fbIsAndroidInApp() {
  const ua = navigator.userAgent || '';
  return /Android/.test(ua) && (/;\s*wv\)/.test(ua) || /(FBAN|FBAV|FB_IAB|Instagram|Line\/|GSA\/)/.test(ua));
}
function _fbIsIOSInApp() {
  const ua = navigator.userAgent || '';
  const iOS = /(iPhone|iPod|iPad)/.test(ua);
  // A raw in-app WKWebView lacks the "Safari" token that real Safari carries.
  return iOS && !/Safari/.test(ua) && !window.navigator.standalone;
}
function _fbOpenInChrome() {
  // intent: URL that hands the current page to Chrome, with a plain-https fallback if
  // Chrome isn't installed. Must run from a user gesture (tap) to be honoured by Android.
  try {
    const target = location.href.replace(/^https?:\/\//, '');
    const fallback = encodeURIComponent(location.href);
    location.href = `intent://${target}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  } catch (_) {}
}
function maybeShowOpenInBrowserBanner() {
  // ?oib=1 forces the banner in ANY browser so it can be previewed/tested (normally it
  // only appears inside an in-app webview like WhatsApp/Instagram).
  let forced = false;
  try { forced = new URLSearchParams(location.search).get('oib') === '1'; } catch (_) {}
  if (!forced) { try { if (sessionStorage.getItem('fb_oib_dismissed') === '1') return; } catch (_) {} }
  const ua = navigator.userAgent || '';
  const isIOSdevice = /(iPhone|iPad|iPod)/.test(ua);
  const android = forced ? !isIOSdevice : _fbIsAndroidInApp();
  const ios = forced ? isIOSdevice : (!android && _fbIsIOSInApp());
  if (!android && !ios) return;
  if (document.getElementById('fb-oib-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'fb-oib-banner';
  bar.dir = (typeof getCurrentLanguage === 'function' && getCurrentLanguage() === 'en') ? 'ltr' : 'rtl';
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;gap:12px;' +
    'padding:12px 16px;background:rgba(16,16,22,0.98);border-top:1px solid rgba(217,180,106,0.45);' +
    'box-shadow:0 -10px 30px rgba(0,0,0,0.5);font-family:inherit';
  const msg = android ? t('openInBrowser.android') : t('openInBrowser.ios');
  const btn = android
    ? `<button id="fb-oib-open" type="button" style="flex:0 0 auto;background:linear-gradient(100deg,#d9b46a,#f0d493);color:#0a0a0a;font-weight:800;font-size:14px;border:0;border-radius:10px;padding:10px 16px;cursor:pointer">${t('openInBrowser.button')}</button>`
    : '';
  bar.innerHTML = `<span style="flex:1;color:#f5f3ee;font-size:13px;line-height:1.4">${msg}</span>${btn}` +
    `<button id="fb-oib-x" type="button" aria-label="close" style="flex:0 0 auto;background:transparent;color:#8d8d8d;border:0;font-size:18px;cursor:pointer;padding:4px 8px">✕</button>`;
  document.body.appendChild(bar);
  const openBtn = document.getElementById('fb-oib-open');
  if (openBtn) openBtn.addEventListener('click', _fbOpenInChrome);
  const x = document.getElementById('fb-oib-x');
  if (x) x.addEventListener('click', () => {
    try { sessionStorage.setItem('fb_oib_dismissed', '1'); } catch (_) {}
    bar.remove();
  });
}

// טעינת מצב משתמש מקומי
function loadLocalUser() {
  const userId = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);
  if (!userId) return null;
  
  return {
    id: userId,
    pool_id: localStorage.getItem(CONFIG.STORAGE_KEYS.POOL_ID),
    nickname: localStorage.getItem(CONFIG.STORAGE_KEYS.NICKNAME),
    is_admin: localStorage.getItem(CONFIG.STORAGE_KEYS.IS_ADMIN) === '1'
  };
}

// ניקוי נתוני משתמש מקומיים
function clearLocalUser() {
  Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
    // Pillar 3 fix: also clear the sessionStorage + cookie mirrors, otherwise the boot-time
    // heal would resurrect a session the user just left (the "already a member" bug).
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`; } catch (_) {}
  });
}

// ============================================================
// JOIN POOL FLOW
// ============================================================

async function checkPoolCode() {
  const input = document.getElementById('pool-code-input');
  const errorDiv = document.getElementById('join-error');
  const code = input.value.trim().toUpperCase();
  
  // Validation
  errorDiv.style.display = 'none';
  
  if (!code) {
    showError('join-error', t('errors.joinCodeRequired'));
    return;
  }

  if (code.length !== 5) {
    showError('join-error', t('errors.joinCodeLen'));
    return;
  }

  // Make sure supabase is ready
  if (!supabaseClient) {
    showError('join-error', t('errors.serverConnecting'));
    initSupabase();
    return;
  }

  // Search pool
  // v2.5.29: removed "Searching pool..." info toast - the pool-found
  // screen is itself the feedback.
  try {
    const { data, error } = await supabaseClient
      .from('pools')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      console.error('Pool search error:', error);
      showError('join-error', t('errors.poolSearchError'));
      return;
    }

    if (!data) {
      showError('join-error', t('errors.poolNotFoundCode', { code }));
      return;
    }

    // Check if pool is locked. v2.10.5: also reject locked_at (set at kickoff) -
    // not just the manual is_locked flag - so a tournament-locked pool fails
    // this preflight early instead of only at the final join_pool RPC. The
    // server RPC remains the source of truth and rejects both.
    if (isPoolWriteLocked(data)) {
      showError('join-error', t('errors.poolLockedNoJoin'));
      return;
    }
    
    // Count members
    const { count: memberCount } = await supabaseClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('pool_id', data.id);
    
    // Save pool to state
    state.currentPool = { ...data, member_count: memberCount || 0 };
    
    // Show pool details
    document.getElementById('found-pool-name').textContent = data.name;
    document.getElementById('found-pool-code').textContent = data.code;
    document.getElementById('found-pool-members').textContent = memberCount || 0;
    
    const statusMap = {
      'open': t('poolFound.statusOpen'),
      'group_locked': t('poolFound.statusGroupLocked'),
      'knockout_active': t('poolFound.statusKnockout'),
      'finished': t('poolFound.statusFinished')
    };
    document.getElementById('found-pool-status').textContent = statusMap[data.status] || data.status;

    showScreen('pool-found-screen');

  } catch (err) {
    console.error('Unexpected error:', err);
    showError('join-error', t('errors.unexpected'));
  }
}

// ============================================================
// NICKNAME FLOW
// ============================================================

let nicknameCheckTimeout;

document.addEventListener('DOMContentLoaded', () => {
  const nicknameInput = document.getElementById('nickname-input');
  const statusDiv = document.getElementById('nickname-status');
  
  if (nicknameInput) {
    nicknameInput.addEventListener('input', () => {
      clearTimeout(nicknameCheckTimeout);
      const nickname = nicknameInput.value.trim();
      
      if (nickname.length < CONFIG.MIN_NICKNAME_LENGTH) {
        statusDiv.innerHTML = '';
        return;
      }
      
      statusDiv.innerHTML = `<span class="status-checking">${t('nickname.checking')}</span>`;

      nicknameCheckTimeout = setTimeout(() => checkNicknameAvailability(nickname), 500);
    });
  }
});

async function checkNicknameAvailability(nickname) {
  const statusDiv = document.getElementById('nickname-status');
  
  if (!state.currentPool) {
    statusDiv.innerHTML = '';
    return;
  }
  
  try {
    const { data } = await supabaseClient
      .from('users')
      .select('id')
      .eq('pool_id', state.currentPool.id)
      .eq('nickname', nickname)
      .maybeSingle();
    
    if (data) {
      statusDiv.innerHTML = `<span class="status-taken"><i class="ti ti-x"></i> ${t('nickname.taken')}</span>`;
    } else {
      statusDiv.innerHTML = `<span class="status-available"><i class="ti ti-check"></i> ${t('nickname.available')}</span>`;
    }
  } catch (err) {
    console.error('Nickname check error:', err);
    statusDiv.innerHTML = '';
  }
}

async function submitNickname() {
  const input = document.getElementById('nickname-input');
  const nickname = input.value.trim();
  
  // Validation
  if (!nickname) {
    showError('nickname-error', t('nickname.errorRequired'));
    return;
  }

  if (nickname.length < CONFIG.MIN_NICKNAME_LENGTH) {
    showError('nickname-error', t('nickname.errorMin', { n: CONFIG.MIN_NICKNAME_LENGTH }));
    return;
  }

  if (nickname.length > CONFIG.MAX_NICKNAME_LENGTH) {
    showError('nickname-error', t('nickname.errorMax', { n: CONFIG.MAX_NICKNAME_LENGTH }));
    return;
  }

  // Make sure supabase is ready
  if (!supabaseClient) {
    showError('nickname-error', t('errors.serverConnecting'));
    initSupabase();
    return;
  }

  // Check availability again
  try {
    const { data: existing } = await supabaseClient
      .from('users')
      .select('id')
      .eq('pool_id', state.currentPool.id)
      .eq('nickname', nickname)
      .maybeSingle();

    if (existing) {
      showError('nickname-error', t('nickname.errorTaken'));
      return;
    }
    
    // Save nickname for next step
    state.pendingNickname = nickname;

    // Generate recovery code
    state.pendingRecoveryCode = generateRecoveryCode();
    document.getElementById('recovery-code-value').textContent = state.pendingRecoveryCode;

    // v2.1: Use new dramatic recovery screen for joiners
    if (typeof showRecoveryCode === 'function') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE, state.pendingRecoveryCode);
      showRecoveryCode('joined', state.pendingRecoveryCode, state.currentPool && state.currentPool.name);
    } else {
      showScreen('recovery-code-screen');
    }

  } catch (err) {
    console.error('Submit nickname error:', err);
    showError('nickname-error', t('errors.unexpected'));
  }
}

// ============================================================
// RECOVERY CODE FLOW
// ============================================================

function copyRecoveryCode() {
  const code = state.pendingRecoveryCode;
  if (!code) return;
  
  navigator.clipboard.writeText(code).then(() => {
    showToast(t('recoveryCode.copiedSave'), 'success');
  }).catch(() => {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = code;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast(t('recoveryCode.copied'), 'success');
  });
}

function shareRecoveryToWhatsApp() {
  const code = state.pendingRecoveryCode;
  const poolName = state.currentPool?.name || 'FriendlyBet';

  const text = t('recoveryCode.shareText', { poolName, code, url: window.location.origin });
  
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

async function completeRegistration() {
  if (!state.pendingNickname || !state.pendingRecoveryCode || !state.currentPool) {
    showToast(t('errors.missingData'), 'error');
    return;
  }

  // Make sure supabase is ready
  if (!supabaseClient) {
    showToast(t('errors.serverConnecting'), 'error');
    initSupabase();
    return;
  }

  try {
    // v2.5.29: removed "Creating user..." info toast - dashboard
    // transition follows shortly.

    const _src = _fbGetSignupSource();
    const _country = await _fbEnsureCountry();
    const _rcode = state.pendingRecoveryCode;

    // Preferred: server-side join_pool RPC. is_admin is forced FALSE in the DB,
    // the returned user row carries NO recovery_code_hash (so signup keeps working
    // after SELECT(hash) is revoked), and the pool code + lock are validated.
    // Falls back to the legacy direct insert only when the RPC isn't deployed.
    if (_rcode && state.currentPool.code) {
      const { data: res, error: rpcErr } = await supabaseClient.rpc('join_pool', {
        p_pool_code: state.currentPool.code,
        p_nickname: state.pendingNickname,
        p_recovery_code: _rcode,
        p_signup_source: _src.source,
        p_signup_referrer: _src.referrer,
        p_utm_source: _src.utm_source,
        p_utm_medium: _src.utm_medium,
        p_utm_campaign: _src.utm_campaign,
        p_country: _country
      });
      if (!rpcErr && res && res.user) {
        saveLocalUser(res.user);
        state.currentUser = res.user;
        if (res.pool) state.currentPool = res.pool;
        try { localStorage.setItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE, _rcode); } catch (_) {}
        state.pendingNickname = null;
        state.pendingRecoveryCode = null;
        setTimeout(() => goToDashboard(), 200);
        return;
      }
      if (rpcErr && !_rpcMissing(rpcErr)) {
        console.error('join_pool RPC error:', rpcErr);
        if (rpcErr.code === '23505' || /duplicate key|nickname/i.test(rpcErr.message || '')) {
          showToast(t('nickname.errorTaken'), 'error');
          showScreen('choose-nickname-screen');
          return;
        }
        showToast(t('errors.creatingUserFail', { msg: rpcErr.message }), 'error');
        return;
      }
      // RPC absent -> fall through to the legacy direct insert below.
    }

    // Hash recovery code
    const recoveryHash = await hashRecoveryCode(state.pendingRecoveryCode);

    // Create user - joins immediately, admin can approve/remove later
    const _joinerInsert = {
      pool_id: state.currentPool.id,
      nickname: state.pendingNickname,
      recovery_code_hash: recoveryHash,
      is_admin: false,
      is_approved: true, // Legacy field - keep true
      approval_status: 'pending', // New: admin can approve later
      signup_source: _src.source,
      signup_referrer: _src.referrer,
      utm_source: _src.utm_source,
      utm_medium: _src.utm_medium,
      utm_campaign: _src.utm_campaign,
      country: _country
    };
    let { data: user, error } = await supabaseClient
      .from('users').insert(_joinerInsert).select().single();
    if (error && _fbIsMissingColumnError(error)) {
      console.warn('signup_source columns missing on users - falling back');
      delete _joinerInsert.signup_source; delete _joinerInsert.signup_referrer;
      delete _joinerInsert.utm_source; delete _joinerInsert.utm_medium; delete _joinerInsert.utm_campaign;
      delete _joinerInsert.country;
      ({ data: user, error } = await supabaseClient
        .from('users').insert(_joinerInsert).select().single());
    }

    if (error) {
      console.error('User creation error:', error);
      // If a DB unique (pool_id, nickname) constraint is in place, two people who
      // tapped the same WhatsApp link and picked the same nickname at the same moment
      // can race past the app-level check. The loser's INSERT fails with 23505 — send
      // them back to pick another name instead of a scary generic error.
      if (error.code === '23505' || /duplicate key|users_pool_nickname_unique/i.test(error.message || '')) {
        showToast(t('nickname.errorTaken'), 'error');
        showScreen('choose-nickname-screen');
        return;
      }
      showToast(t('errors.creatingUserFail', { msg: error.message }), 'error');
      return;
    }

    // Save locally
    saveLocalUser(user);
    state.currentUser = user;

    // Clear pending data
    state.pendingNickname = null;
    state.pendingRecoveryCode = null;

    // v2.4.2: removed "welcomeToast" - the dashboard itself shows the pool
    // name + greeting on arrival, so the toast was just duplicate noise.
    // Go to dashboard - user can play immediately!
    setTimeout(() => {
      goToDashboard();
    }, 200);

  } catch (err) {
    console.error('Complete registration error:', err);
    showToast(t('errors.unexpected'), 'error');
  }
}

// ============================================================
// CREATE POOL FLOW
// ============================================================

function useSuggestion(name) {
  document.getElementById('pool-name-input').value = name;
}

function useSuggestionByKey(key) {
  document.getElementById('pool-name-input').value = t(key);
}

function submitPoolName() {
  const input = document.getElementById('pool-name-input');
  const name = input.value.trim();

  if (!name) {
    showError('create-error', t('createPool.errorRequired'));
    return;
  }

  if (name.length < CONFIG.MIN_POOL_NAME_LENGTH) {
    showError('create-error', t('createPool.errorMin', { n: CONFIG.MIN_POOL_NAME_LENGTH }));
    return;
  }

  state.pendingPoolName = name;
  showScreen('admin-nickname-screen');
}

async function createPool() {
  const input = document.getElementById('admin-nickname-input');
  const adminNickname = input.value.trim();

  if (!adminNickname) {
    showError('admin-error', t('adminNickname.errorRequired'));
    return;
  }

  if (adminNickname.length < CONFIG.MIN_NICKNAME_LENGTH) {
    showError('admin-error', t('nickname.errorMin', { n: CONFIG.MIN_NICKNAME_LENGTH }));
    return;
  }

  // Make sure supabase is ready
  if (!supabaseClient) {
    showError('admin-error', t('errors.serverConnecting'));
    initSupabase();
    return;
  }

  try {
    // v2.5.29: removed "Creating pool..." info toast - the recovery
    // code screen that follows is the success confirmation.

    // Generate unique pool code
    let poolCode;
    let attempts = 0;
    while (attempts < 10) {
      poolCode = generateRandomCode(CONFIG.POOL_CODE_LENGTH);
      const { data: existing } = await supabaseClient
        .from('pools')
        .select('id')
        .eq('code', poolCode)
        .maybeSingle();
      
      if (!existing) break;
      attempts++;
    }
    
    if (attempts >= 10) {
      showToast(t('errors.uniqueCodeFail'), 'error');
      return;
    }
    
    // Generate recovery code for admin (needed up-front for the atomic RPC).
    const adminRecoveryCode = generateRecoveryCode();
    const _src = _fbGetSignupSource();
    const _country = await _fbEnsureCountry();

    let pool, adminUser;

    // Preferred: atomic server-side create_pool RPC (creates pool + admin in one
    // transaction, sets is_admin server-side, returns both WITHOUT the hash).
    // Falls back to the legacy multi-step insert only when the RPC isn't deployed.
    const _rpcRes = await supabaseClient.rpc('create_pool', {
      p_code: poolCode,
      p_name: state.pendingPoolName,
      p_language: 'he',
      p_betting_mode: null,
      p_scoring_rules: null,
      p_use_multipliers: null,
      p_admin_nickname: adminNickname,
      p_recovery_code: adminRecoveryCode,
      p_signup_source: _src.source,
      p_signup_referrer: _src.referrer,
      p_utm_source: _src.utm_source,
      p_utm_medium: _src.utm_medium,
      p_utm_campaign: _src.utm_campaign,
      p_country: _country
    });
    if (!_rpcRes.error && _rpcRes.data && _rpcRes.data.pool) {
      pool = _rpcRes.data.pool;
      adminUser = _rpcRes.data.user;
    } else if (_rpcRes.error && !_rpcMissing(_rpcRes.error)) {
      console.error('create_pool RPC error:', _rpcRes.error);
      showToast(t('errors.creatingPoolFail', { msg: _rpcRes.error.message }), 'error');
      return;
    } else {
      // RPC absent -> legacy multi-step create (pool, admin, link, rollback).
      const adminRecoveryHash = await hashRecoveryCode(adminRecoveryCode);
      const { data: lpool, error: poolError } = await supabaseClient
        .from('pools')
        .insert({ code: poolCode, name: state.pendingPoolName, language: 'he', tournament: 'wc2026', status: 'open' })
        .select().single();
      if (poolError) {
        console.error('Pool creation error:', poolError);
        showToast(t('errors.creatingPoolFail', { msg: poolError.message }), 'error');
        return;
      }
      const { data: ladmin, error: userError } = await supabaseClient
        .from('users')
        .insert({
          pool_id: lpool.id,
          nickname: adminNickname,
          recovery_code_hash: adminRecoveryHash,
          is_admin: true,
          is_approved: true,
          approval_status: 'approved',
          approved_at: new Date().toISOString()
        })
        .select().single();
      if (userError) {
        console.error('Admin user creation error:', userError);
        showToast(t('errors.creatingAdminFail', { msg: userError.message }), 'error');
        await supabaseClient.from('pools').delete().eq('id', lpool.id); // Rollback pool
        return;
      }
      await supabaseClient.from('pools').update({ admin_user_id: ladmin.id }).eq('id', lpool.id);
      pool = lpool;
      adminUser = ladmin;
    }

    // Save locally
    state.currentPool = pool;
    state.currentUser = adminUser;
    state.pendingRecoveryCode = adminRecoveryCode;
    saveLocalUser(adminUser);

    // v2.4.2: removed "Pool created!" toast - the recovery code screen we're
    // about to show already announces it in its hero title.
    // v2.1.3: legacy path - go straight to dashboard via the new recovery screen
    localStorage.setItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE, adminRecoveryCode);
    if (typeof showRecoveryCode === 'function') {
      showRecoveryCode('created', adminRecoveryCode, pool.name);
    } else {
      goToDashboard();
    }

  } catch (err) {
    console.error('Create pool error:', err);
    showToast(t('errors.unexpected'), 'error');
  }
}

// ============================================================
// SHARE FUNCTIONS
// ============================================================

// ============================================================
// LEGACY SHARE FUNCTIONS (kept for backward compat - delegate to new)
// ============================================================

function shareWhatsApp() {
  shareToWhatsApp();  // New function
}

function shareTelegram() {
  shareToTelegram();  // New function
}

function copyShareLink() {
  copyInviteLink();  // New function - copies URL only
}

// ============================================================
// DASHBOARD
// ============================================================

// v2.7.7: retention heartbeat. Calls record_activity at most once per UTC day
// per browser so we can compute DAU/WAU/MAU + cohort retention. Best-effort:
// needs a stored recovery code, swallows all errors. The "done for today" flag
// is written ONLY on success, so a transient network failure retries on the next
// dashboard visit instead of silently dropping the whole day; an in-memory guard
// prevents duplicate in-flight calls within the same session.
let _activityInFlight = false;
function _recordActivityOncePerDay() {
  try {
    const code = localStorage.getItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE);
    if (!code || !supabaseClient) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC, matches DB current_date)
    if (localStorage.getItem('fb_activity_day') === today) return; // already recorded today
    if (_activityInFlight) return;                                  // a call is already running this session
    _activityInFlight = true;
    const bare = code.replace(/-/g, '');
    supabaseClient.rpc('record_activity', { p_code: bare })
      .then(({ error }) => { if (!error) { try { localStorage.setItem('fb_activity_day', today); } catch (_) {} } })
      .catch(() => {})
      .finally(() => { _activityInFlight = false; });
  } catch (_) { /* best-effort */ }
}

// v2.8.2: best-effort bracket-share tracking (forward-looking, fire-and-forget,
// never blocks the share). 'click' = the user triggered a bracket share; 'completed'
// = navigator.share actually resolved (a real share). Only the native share sheet can
// observe completion — desktop link-intent shares are recorded as 'click' only. No
// throttle (we want every event); resolves the caller server-side from the recovery
// code, exactly like record_activity. Aggregated in app-dashboard (share_metrics,
// excluding country='IL').
function _recordShare(source, kind) {
  try {
    const code = localStorage.getItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE);
    if (!code || !supabaseClient) return;
    supabaseClient.rpc('record_share', { p_code: code.replace(/-/g, ''), p_source: source || '', p_kind: kind })
      .then(() => {}).catch(() => {});
  } catch (_) { /* best-effort */ }
}

async function goToDashboard() {
  spReopenActive = false;   // v2.10: never let the recovery flag leak outside the flow
  // v2.5.49: defensive guards. If we hit this without a supabase client
  // (very slow network) or any of the DB reads fail, fall back to the
  // home-screen instead of half-rendering a blank dashboard.
  if (!supabaseClient) {
    console.warn('goToDashboard: no supabase client; routing home.');
    showScreen('home-screen');
    return;
  }
  if (!state.currentUser || !state.currentPool) {
    const local = loadLocalUser();
    if (!local) {
      showScreen('home-screen');
      return;
    }

    let pool, user;
    try {
      ({ data: pool } = await supabaseClient
        .from('pools').select('*').eq('id', local.pool_id).maybeSingle());
      ({ data: user } = await supabaseClient
        .from('users').select(USER_PUBLIC_COLS).eq('id', local.id).maybeSingle());
    } catch (err) {
      console.error('goToDashboard: failed to hydrate user/pool', err);
      clearLocalUser();
      showScreen('home-screen');
      return;
    }

    if (!pool || !user) {
      // Account or pool no longer exists - drop the stale local session
      // and send the user back to home so they can rejoin or sign in.
      clearLocalUser();
      showScreen('home-screen');
      return;
    }

    state.currentPool = pool;
    state.currentUser = user;
  }

  // v2.7.7: retention heartbeat - record that this user was active today
  // (throttled to once/day per browser; fire-and-forget, never blocks render).
  _recordActivityOncePerDay();

  // Load real-world results data
  await loadResultsData();

  // v2.4: auto-lock pool when first match starts (both single_phase and two_phase)
  if (typeof spAutoLockPoolIfNeeded === 'function') {
    await spAutoLockPoolIfNeeded();
  }

  // v2.4.5: prefetch the squads_released flag into localStorage so that
  // when the user enters the top-scorer step the cache is already warm
  // and we don't flash the locked view before the unlocked one.
  try {
    const { data: srData } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'squads_released')
      .maybeSingle();
    const released = !!(srData && srData.value === 'true');
    localStorage.setItem('fb_squads_released', released ? 'true' : 'false');
  } catch (e) { /* ignore - cache stays as-is */ }

  // Update dashboard display (v2.1.4: pool-code card + stats moved/removed)
  document.getElementById('dashboard-pool-name').textContent = state.currentPool.name;
  document.getElementById('dashboard-user-name').textContent = state.currentUser.nickname;

  // Decide pre/post-tournament state by whether any scoring has happened in this pool.
  const { data: allUsers } = await supabaseClient
    .from('users')
    .select('id, total_score')
    .eq('pool_id', state.currentPool.id)
    .order('total_score', { ascending: false });
  const totalAcrossPool = (allUsers || []).reduce((s, u) => s + (u.total_score || 0), 0);
  const tournamentStarted = totalAcrossPool > 0;

  // v2.6.74: the pre-tournament progress card was removed (it duplicated the
  // betting CTA). Only the stats card toggles now: shown once the tournament
  // starts, hidden before then.
  const statsEl = document.getElementById('dashboard-stats');
  if (statsEl) {
    if (tournamentStarted) {
      statsEl.style.display = '';
      const pointsEl = document.getElementById('user-points');
      if (pointsEl) pointsEl.textContent = state.currentUser.total_score || 0;
      if (allUsers) {
        const rank = allUsers.findIndex(u => u.id === state.currentUser.id) + 1;
        const rankEl = document.getElementById('user-rank');
        if (rankEl) rankEl.textContent = rank;
      }
    } else {
      statsEl.style.display = 'none';
    }
  }
  
  // v2.5.38: only admins see the "invite friends" CTA on the dashboard.
  // Regular members joined via a link or pool code - they don't need to
  // recruit. The menu still has a share entry for admins to find anytime.
  // v2.10.4/v2.10.5: once the pool locks, hide it entirely - a locked pool
  // rejects new members (server join_pool RPC + checkPoolCode), so inviting
  // after kickoff is a dead-end. isPoolJoinClosed() covers both locked_at
  // (kickoff) and is_locked (manual); tournamentStarted is a score-based
  // fallback in case locked_at hasn't been written yet for this pool.
  const inviteBtn = document.querySelector('#user-dashboard-screen .invite-friends-btn');
  if (inviteBtn) {
    const poolLocked = isPoolJoinClosed() || tournamentStarted;
    const showInvite = state.currentUser && state.currentUser.is_admin && !poolLocked;
    inviteBtn.style.display = showInvite ? '' : 'none';
  }

  // Update betting status based on actual picks
  updateBettingStatusOnDashboard();
  // v2.10: await so state._userNeedsKnockoutRecovery is set before the admin nudge
  // reads it (an affected admin must never briefly see both banners).
  try { await updateKnockoutStatusOnDashboard(); } catch (_) {}

  // v2.9.22: admin-only nudge about members who lost their knockout bracket.
  updateAdminNudgeOnDashboard();

  // v2.10.8: two-phase incident banner (members + admin) — apology + re-enter +
  // 72h grace deadline for pools affected by the two-phase pick-loss bug.
  updateTwoPhaseIncidentBanner();

  // The Pundit - live rotating commentary (fire-and-forget, never blocks the dashboard)
  renderPundit();

  // Countdown to the first match (pre-tournament only). Fire-and-forget: it
  // resolves the real kickoff from matches.json then ticks every second.
  initDashboardCountdown(tournamentStarted);

  showScreen('user-dashboard-screen');
}

// v2.9.22: admin-only dashboard nudge. When members of the admin's single-phase
// pool lost their knockout bracket to the save bug (groups complete but bracket
// < 31), surface a banner with a one-tap copy of a ready-made reminder for the
// group chat — the realistic outreach channel, since we have no email/push.
// The count is computed DB-side (pool_knockout_gap_count) so it's correct for
// big pools past the 1000-row REST cap. Fire-and-forget; never blocks the render.
async function updateAdminNudgeOnDashboard() {
  const el = document.getElementById('admin-nudge-banner');
  if (!el) return;
  const hide = () => { el.style.display = 'none'; };
  try {
    if (!state.currentUser || !state.currentUser.is_admin || !state.currentPool) return hide();
    if (state.currentPool.betting_mode !== 'single_phase') return hide();
    // v2.10: if the admin THEMSELVES still needs to recover their own knockout,
    // their personal recovery banner takes priority — don't stack the members
    // nudge on top of it (no two overlapping banners). It returns once they're done.
    if (state._userNeedsKnockoutRecovery) return hide();
    // Include the admin in the count (no p_exclude) so the banner number matches
    // the ⚠️-flagged members in the "Who?" list (which shows everyone). If the
    // admin themselves is affected, they also get their own recover banner.
    const { data, error } = await supabaseClient.rpc('pool_knockout_gap_count', {
      p_pool_id: state.currentPool.id
    });
    const n = (typeof data === 'number') ? data : parseInt(data, 10);
    if (error || !n || n < 1) return hide();

    const titleEl = document.getElementById('admin-nudge-title');
    if (titleEl) titleEl.textContent = t('dashboard.adminNudge.title', { n });
    // onclick (not addEventListener) so repeated dashboard renders never stack.
    const copyBtn = document.getElementById('admin-nudge-copy');
    if (copyBtn) copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(t('adminMembersEx.nudgeMessage'));
        showToast(t('adminMembersEx.nudgeCopied'), 'success');
      } catch (_) { showToast(t('adminMembersEx.nudgeMessage'), 'info'); }
    };
    const viewBtn = document.getElementById('admin-nudge-view');
    if (viewBtn) viewBtn.onclick = () => { showMembers(); };
    el.style.display = 'flex';
  } catch (_) { hide(); }
}

// v2.10.8: two-phase incident banner. The two-phase save path lost picks at scale
// (silent save failure + a destructive sync job; two-phase had no backup). The
// AFFECTED pools were granted a 72h post-kickoff grace (pools.lock_at_override).
// This banner — shown to members AND the admin of such a pool whose group picks
// are still incomplete — apologises, points them to re-enter, and shows the new
// deadline. The admin additionally gets a one-tap copy of an apology message to
// paste into the group chat (our only realistic outreach channel).
function _formatGraceDeadline(iso) {
  try {
    const d = new Date(iso);
    const lang = (typeof currentLanguage !== 'undefined' && currentLanguage === 'he') ? 'he-IL' : 'en-US';
    return d.toLocaleString(lang, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
}

function _poolGraceActive(pool) {
  const iso = pool && pool.lock_at_override;
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > Date.now();
}

function isPoolWriteLocked(pool = state.currentPool) {
  if (!pool) return false;
  if (_poolGraceActive(pool)) return false;
  return !!(pool.locked_at || pool.is_locked);
}

async function updateTwoPhaseIncidentBanner() {
  const el = document.getElementById('tp-incident-banner');
  if (!el) return;
  const hide = () => { el.style.display = 'none'; };
  try {
    if (!state.currentUser || !state.currentPool) return hide();
    if (state.currentPool.betting_mode !== 'two_phase') return hide();
    // Only AFFECTED pools got the grace override; unaffected pools show nothing.
    let override = state.currentPool.lock_at_override;
    // Defensive: some login paths hydrate currentPool without this column. If it's
    // not present at all (undefined, not an explicit null), read it authoritatively.
    if (typeof override === 'undefined') {
      try {
        const { data } = await supabaseClient.from('pools')
          .select('lock_at_override, locked_at').eq('id', state.currentPool.id).maybeSingle();
        if (data) {
          override = data.lock_at_override;
          state.currentPool.lock_at_override = data.lock_at_override;
          if (data.locked_at) state.currentPool.locked_at = data.locked_at;
        }
      } catch (_) {}
    }
    if (!_poolGraceActive({ lock_at_override: override })) return hide();
    // Only nudge users whose group picks are INCOMPLETE (those who lost / never
    // finished). A user with a full set saved doesn't need the apology.
    const { data: gp } = await supabaseClient.from('group_picks')
      .select('group_letter, team_code')
      .eq('user_id', state.currentUser.id).eq('pool_id', state.currentPool.id);
    const byGroup = {};
    (gp || []).forEach(r => { (byGroup[r.group_letter] = byGroup[r.group_letter] || []).push(r.team_code); });
    // Hide only when the user's two-phase group stage is genuinely COMPLETE
    // (exactly 32 with 2-3 per group). 24 (top-2 each group, no thirds) still
    // needs the 8 best-third picks, so the banner stays up for 24-31 too.
    if (isTwoPhaseGroupComplete(byGroup)) return hide();

    const deadline = _formatGraceDeadline(override);
    const isAdmin = !!state.currentUser.is_admin;
    const titleEl = document.getElementById('tpi-title');
    const subEl = document.getElementById('tpi-sub');
    const dlEl = document.getElementById('tpi-deadline');
    const cta = document.getElementById('tpi-cta');
    const copy = document.getElementById('tpi-copy');
    if (titleEl) titleEl.textContent = t('dashboard.tpIncident.title');
    if (subEl) subEl.textContent = t('dashboard.tpIncident.sub');
    if (dlEl) dlEl.textContent = t('dashboard.tpIncident.deadline', { date: deadline });
    if (cta) { cta.textContent = t('dashboard.tpIncident.cta'); cta.onclick = () => startBettingFromDashboard(); }
    if (copy) {
      if (isAdmin) {
        copy.style.display = '';
        copy.textContent = t('dashboard.tpIncident.copy');
        copy.onclick = async () => {
          const link = (window.location.origin || 'https://friendlybet.live') + '/?join=' + state.currentPool.code;
          const msg = t('dashboard.tpIncident.copyMessage', { date: deadline, link });
          try { await navigator.clipboard.writeText(msg); showToast(t('dashboard.tpIncident.copied'), 'success'); }
          catch (_) { showToast(msg, 'info'); }
        };
      } else {
        copy.style.display = 'none';
      }
    }
    el.style.display = 'flex';
  } catch (_) { hide(); }
}

// ============================================================
// Countdown to first match (v2.7.1)
// ============================================================
// A live ticking banner at the top of the dashboard that builds urgency to
// finish predictions before the pool auto-locks at kickoff. Shown only before
// the tournament starts; once kickoff passes it flips to a "tournament has
// started" line and stops. The kickoff datetime is read from the same
// matches.json snapshot the rest of the app uses (earliest match_date), so it
// stays accurate to the minute even if FIFA shifts the schedule; falls back to
// a constant if the snapshot is unavailable.
const FIRST_MATCH_FALLBACK_ISO = '2026-06-11T16:00:00-06:00'; // opening match, CDMX time
let _countdownTimer = null;
let _countdownKickoffMs = null;

async function _resolveFirstKickoffMs() {
  if (_countdownKickoffMs) return _countdownKickoffMs;
  let ms = Date.parse(FIRST_MATCH_FALLBACK_ISO);
  try {
    const matches = await fetchMatchesFromCDN(5 * 60 * 1000);
    if (Array.isArray(matches) && matches.length) {
      const earliest = matches
        .map(m => Date.parse(m.match_date))
        .filter(t => !isNaN(t))
        .sort((a, b) => a - b)[0];
      if (earliest) ms = earliest;
    }
  } catch (_) { /* keep fallback */ }
  _countdownKickoffMs = ms;
  return ms;
}

async function initDashboardCountdown(tournamentStarted) {
  const banner = document.getElementById('dashboard-countdown');
  if (!banner) return;
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }

  // Once any score exists in the pool the tournament is clearly underway -
  // hand the space over to the stats card and don't show the countdown.
  if (tournamentStarted) { banner.style.display = 'none'; return; }

  const kickoff = await _resolveFirstKickoffMs();
  const tick = () => {
    const diff = kickoff - Date.now();
    if (diff <= 0) {
      // Kicked off - flip to a live line and stop ticking.
      banner.classList.add('is-live');
      const clock = document.getElementById('countdown-clock');
      const label = document.getElementById('countdown-label');
      if (clock) clock.style.display = 'none';
      if (label) label.textContent = t('dashboard.countdown.live');
      if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
      return;
    }
    const secs = Math.floor(diff / 1000);
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('cd-days', d);
    set('cd-hours', String(h).padStart(2, '0'));
    set('cd-mins', String(m).padStart(2, '0'));
    set('cd-secs', String(s).padStart(2, '0'));
  };

  banner.classList.remove('is-live');
  const clock = document.getElementById('countdown-clock');
  if (clock) clock.style.display = '';
  banner.style.display = '';
  tick();
  _countdownTimer = setInterval(tick, 1000);
}

// ============================================================
// The Pundit - live rotating dashboard commentary (v2.6.68)
// ============================================================
// Reads public-data/pundit.json (CDN edge), rotates through the items, and
// renders each in the active language with a confidence badge + source links.
// The feed is generated by scripts/generate-pundit.js (data items, zero
// hallucination) merged with verified news items, so nothing here can invent
// a claim - we only display what the feed already vetted.
let _punditState = { items: [], idx: 0, timer: null, refreshTimer: null, loadedAt: 0, ctx: '', pool: null };

// Identifies the pool+user the cached pundit feed was built for. Pool-pulse
// items ("X joined", "X locked in", leader teases) are scoped to ONE pool and
// ONE viewer, so the cache MUST be invalidated the moment either changes -
// otherwise switching/creating a pool within the 5-min cache window would show
// another pool's buzz (e.g. a solo pool claiming "someone joined"). Critical.
function _punditCtxKey() {
  const p = (state.currentPool && state.currentPool.id) || '';
  const u = (state.currentUser && state.currentUser.id) || '';
  return p + '|' + u;
}

// Clears all cached pundit state. Call whenever the pool/user context is torn
// down (logout, leave/delete pool) so nothing leaks into the next context.
function resetPunditState() {
  if (_punditState.timer) { clearInterval(_punditState.timer); _punditState.timer = null; }
  if (_punditState.refreshTimer) { clearInterval(_punditState.refreshTimer); _punditState.refreshTimer = null; }
  _punditState.items = [];
  _punditState.idx = 0;
  _punditState.loadedAt = 0;
  _punditState.ctx = '';
  _punditState.pool = null;
}

async function loadPundit() {
  try {
    const ctx = _punditCtxKey();
    // Invalidate the whole feed (items AND the member snapshot) when the
    // pool/user context changes, regardless of cache age.
    if (_punditState.ctx !== ctx) {
      _punditState.items = [];
      _punditState.idx = 0;
      _punditState.loadedAt = 0;
      _punditState.pool = null;
      _punditState.ctx = ctx;
    }
    if (_punditState.items.length && (Date.now() - _punditState.loadedAt) < 5 * 60 * 1000) {
      return _punditState.items;
    }
    const res = await fetch('/public-data/pundit.json', { cache: 'no-store' });
    const now = Date.now();
    let globalItems = [];
    if (res.ok) {
      const j = await res.json();
      globalItems = (j && Array.isArray(j.items) ? j.items : [])
        .filter(it => it && (it.he || it.en))
        .filter(it => !it.expires_at || Date.parse(it.expires_at) > now);
    }

    // v2.6.79: merge in pool-specific "pool pulse" commentary computed live on
    // the client (aggregate facts only, never any pick value).
    let poolItems = [];
    try { poolItems = await buildPoolPundit(); } catch (_) { /* never block the feed */ }
    const newsItems = globalItems.filter(it => it.type === 'news');
    const nonNews = globalItems.filter(it => it.type !== 'news');

    // v2.6.84: GUARANTEED hourly-fresh feed.
    // Before, all news items led the feed, so when the verified-news file was
    // stable (the normal case pre-tournament - it only changes when the news
    // agent runs, often once a day) the card showed the SAME news for hours/days
    // and the hourly evergreen rotation never kicked in (it only padded a
    // shortfall, but a full slate of news left no room). Fix, two parts:
    //   (a) rotate the news WINDOW by the hour so the leading news advances
    //       every hour (full cycle over all news across the day), and
    //   (b) ALWAYS reserve at least one slot for an evergreen line that rotates
    //       by the hour - so the card visibly changes every single hour even
    //       when news AND pool are completely static.
    const PUNDIT_TARGET = 5;
    const POOL_SLOTS = 2; // owner layout: first 2 = this pool, next 3 = news
    const H = Math.floor(now / (60 * 60 * 1000)); // global clock-hour index

    // v2.7.6 - NO-REPEAT rotation. Goal: every hour the 5 lines change to content
    // NOT shown recently, and nothing repeats until everything else has cycled.
    // Mechanism: a per-browser "seen" memory (id -> last hour shown). Each hour we
    // pick the LEAST-recently-shown candidates, then record them; the pick is
    // frozen for the clock hour so the 10-min refetch can't churn it mid-hour and
    // it advances only on the hour. News candidates = live verified news + live
    // computed data (results/fixtures/countdown) which lead, then the evergreen
    // deck; pool candidates = live pool facts + pool evergreens.
    const newsCands = _ppDedup([...newsItems, ...nonNews, ..._punditDeck()]);
    const poolCands = _ppDedup(poolItems);
    const POOL_N = Math.min(POOL_SLOTS, poolCands.length);
    const NEWS_N = PUNDIT_TARGET - POOL_N; // 3 normally; 4-5 if the user has no pool buzz

    const seenMap = _ppSeenLoad();
    const frozen = _ppHourLoad();
    const byId = (cands) => { const m = new Map(); cands.forEach(c => m.set(c.id, c)); return m; };
    const mapIds = (ids, m) => (ids || []).map(id => m.get(id)).filter(Boolean);

    let poolPart = [], newsPart = [];
    if (frozen && frozen.H === H) {
      poolPart = mapIds(frozen.pool, byId(poolCands));
      newsPart = mapIds(frozen.news, byId(newsCands));
    }
    // Recompute when the hour rolled over, on first run, or if a frozen id went
    // stale (e.g. a news item expired) and the set is now short.
    if (poolPart.length < POOL_N || newsPart.length < NEWS_N) {
      poolPart = _ppLeastRecent(poolCands, POOL_N, seenMap, H);
      newsPart = _ppLeastRecent(newsCands, NEWS_N, seenMap, H);
      [...poolPart, ...newsPart].forEach(it => { if (it && it.id) seenMap[it.id] = H; });
      _ppSeenSave(seenMap);
      _ppHourSave({ H, pool: poolPart.map(i => i.id), news: newsPart.map(i => i.id) });
    }

    const items = [...poolPart, ...newsPart].slice(0, PUNDIT_TARGET);

    if (!items.length) return [];
    _punditState.items = items;
    _punditState.loadedAt = now;
    if (_punditState.idx >= items.length) _punditState.idx = 0;
    return items;
  } catch (_) { return []; }
}

// ---- Pool pulse: client-side, privacy-safe pool commentary -----------------
// Builds teasing/celebratory items about THIS pool's activity from AGGREGATE
// facts only: member count, who joined, who submitted (a boolean), and public
// scores. It NEVER reads any pick value (group_position_picks / knockout_picks
// / tournament_winner_picks), so a specific prediction can't leak by
// construction - the "surprises" lines are pure flavor, not derived from picks.
const _PP_DAY_MS = 24 * 60 * 60 * 1000;

function _ppSeed() {
  // Rotates template/variant choices once a day: fresh daily, stable per render.
  return Math.floor(Date.now() / _PP_DAY_MS);
}
function _ppPick(arr, seed) {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

async function _loadPoolMembers() {
  const pool = state.currentPool;
  if (!pool || !pool.id || typeof supabaseClient === 'undefined' || !supabaseClient) return null;
  const cache = _punditState.pool;
  if (cache && cache.poolId === pool.id && (Date.now() - cache.fetchedAt) < 5 * 60 * 1000) {
    return cache.members;
  }
  try {
    // Aggregate-only columns. No picks are ever selected here. We also pull
    // pool_id purely to re-assert pool scoping on the client (defense-in-depth
    // against any RLS/query slip) before the data is ever used for buzz.
    const { data, error } = await supabaseClient
      .from('users')
      .select('id,pool_id,nickname,joined_at,predictions_submitted_at,total_score')
      .eq('pool_id', pool.id)
      .range(0, 9999);
    if (error || !data) return null;
    const scoped = data.filter(m => m && m.pool_id === pool.id);
    _punditState.pool = { poolId: pool.id, members: scoped, fetchedAt: Date.now() };
    return scoped;
  } catch (_) { return null; }
}

async function buildPoolPundit() {
  const pool = state.currentPool, viewer = state.currentUser;
  if (!pool || !viewer || !viewer.id) return [];
  const members = await _loadPoolMembers();
  if (!members || !members.length) return [];

  // Hard invariant: the snapshot MUST belong to the current pool, and the
  // viewer MUST be one of its members. If either fails the data is for a
  // different/stale context - emit NO pool buzz rather than risk telling a
  // solo pool that "someone joined". Belt-and-suspenders on top of the
  // ctx-keyed cache + pool-scoped query.
  if (_punditState.pool && _punditState.pool.poolId && _punditState.pool.poolId !== pool.id) return [];
  if (!members.some(m => m.id === viewer.id)) return [];

  const lang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'he';
  const now = Date.now();
  const seed = Math.floor(now / (60 * 60 * 1000)); // hourly: pool wording + slot selection refresh each hour
  const total = members.length;
  const submitted = members.filter(m => m.predictions_submitted_at).length;
  const pending = total - submitted;
  const tournamentStarted = members.some(m => (m.total_score || 0) > 0);
  const me = members.find(m => m.id === viewer.id) || null;
  const iSubmitted = !!(me && me.predictions_submitted_at);
  const nameOf = (m) => (m && m.nickname) ? m.nickname : (lang === 'he' ? 'מישהו' : 'someone');

  // Most-recent submitter / joiner OTHER than the viewer, within a fresh window.
  const recentSubmitter = members
    .filter(m => m.id !== viewer.id && m.predictions_submitted_at &&
                 (now - Date.parse(m.predictions_submitted_at)) < _PP_DAY_MS)
    .sort((a, b) => Date.parse(b.predictions_submitted_at) - Date.parse(a.predictions_submitted_at))[0];
  const recentJoiner = members
    .filter(m => m.id !== viewer.id && m.joined_at &&
                 (now - Date.parse(m.joined_at)) < 2 * _PP_DAY_MS)
    .sort((a, b) => Date.parse(b.joined_at) - Date.parse(a.joined_at))[0];
  const leader = tournamentStarted
    ? members.slice().sort((a, b) => (b.total_score || 0) - (a.total_score || 0))[0]
    : null;

  const cand = []; // { id, prio, he, en } - lower prio = more important
  const push = (id, prio, variants) => {
    const v = _ppPick(variants, seed);
    cand.push({ id, prio, he: v.he, en: v.en });
  };

  if (total <= 1) {
    push('pool-solo', 1, [{
      he: 'אתה הראשון בהימור! תזמין כמה חברים שיהיה מעניין 😎',
      en: "You're first in the pool! Invite a few friends to make it interesting 😎",
    }]);
    // 2nd solo line so the pool section always fills its 2 slots (owner layout).
    push('pool-solo-ready', 2, [
      { he: 'בינתיים אתה לבד בהימור — השלם את כל הניחושים ותהיה מוכן לפני כולם 📋',
        en: "For now you're solo in the pool — complete all your picks and be ready before anyone else 📋" },
      { he: 'הפול שלך מחכה ליריבים. נעל בחירות עכשיו ושלח לינק לחברים 🔗',
        en: 'Your pool is waiting for rivals. Lock in your picks now and send friends the link 🔗' },
    ]);
  }

  // Personal nudge: others are betting, the viewer isn't (pre-tournament only).
  if (!tournamentStarted && total > 1 && !iSubmitted && submitted > 0) {
    push('pool-you-pending', 1, [
      { he: 'כולם מסביבך כבר מהמרים — וההימור שלך עדיין ריק 😅',
        en: "Everyone around you is already betting — and your slip is still empty 😅" },
      { he: `${submitted} חברים כבר נעלו בחירות. אתה עוד לא — הדדליין לא מחכה ⏰`,
        en: `${submitted} friends already locked in. You haven't — the deadline won't wait ⏰` },
    ]);
  }

  if (recentSubmitter) {
    const n = nameOf(recentSubmitter);
    push('pool-recent-submit', 2, [
      { he: `${n} בדיוק נעל את הבחירות — ויש שם כמה הפתעות 👀`,
        en: `${n} just locked in — and there are some surprises in there 👀` },
      { he: `${n} סיים להמר! מי יודע אילו הפתעות הכין 🤔`,
        en: `${n} finished betting! Who knows what surprises they cooked up 🤔` },
      { he: `${n} כבר נעל בחירות. אתם עדיין מתלבטים? ⏳`,
        en: `${n} already locked in. Still deciding? ⏳` },
    ]);
  }

  if (leader && (leader.total_score || 0) > 0) {
    const n = nameOf(leader), s = leader.total_score || 0;
    push('pool-leader', 2, [
      { he: `${n} מוביל את ההימור עם ${s} נקודות — מישהו יתפוס אותו? 🏃`,
        en: `${n} leads the pool with ${s} points — can anyone catch them? 🏃` },
      { he: `${n} בראש הטבלה עם ${s} נקודות. הפער עוד נסגר 😏`,
        en: `${n} tops the table with ${s} points. That gap can still close 😏` },
    ]);
  }

  if (recentJoiner) {
    const n = nameOf(recentJoiner);
    push('pool-recent-join', 3, [
      { he: `${n} הצטרף להימור! התחרות מתחממת 🔥`,
        en: `${n} joined the pool! The competition is heating up 🔥` },
      { he: `${n} נכנס למשחק. עוד יריב להביס 😏`,
        en: `${n} is in the game. One more rival to beat 😏` },
    ]);
  }

  if (!tournamentStarted && pending > 0 && submitted > 0) {
    push('pool-pending', 4, [
      { he: `עוד ${pending} חברים לא סיימו להמר — אל תפספסו את הדדליין!`,
        en: `${pending} friends still haven't finished betting — don't miss the deadline!` },
      { he: `${submitted} סיימו, ${pending} עדיין מתלבטים. מי יהיה האחרון? 🐢`,
        en: `${submitted} done, ${pending} still deciding. Who'll be last? 🐢` },
    ]);
  }

  if (!tournamentStarted && total > 1 && pending === 0) {
    push('pool-all-done', 4, [{
      he: 'כולם נעלו בחירות! שיזכה המהמר הטוב ביותר 🏆',
      en: "Everyone's locked in! May the best predictor win 🏆",
    }]);
  }

  if (total >= 3) {
    push('pool-growth', 5, [
      { he: `כבר ${total} חברים בהימור! איזה כיף 🎉`,
        en: `Already ${total} friends in the pool! 🎉` },
      { he: `${total} מהמרים בהימור, וכל אחד בטוח שהוא יזכה 😄`,
        en: `${total} predictors in the pool, each sure they'll win 😄` },
    ]);
  }

  // Pool-flavored evergreen lines (always available, lower priority than the
  // live aggregate facts above). They DEEPEN the pool-candidate list so the 2
  // pool slots can PAGE to different lines every hour (v2.7.4) instead of being
  // stuck on the same 1-2 facts. Still about THIS pool / the viewer's own
  // predictions, never a fabricated member fact.
  push('pool-ev-lock', 7, [{
    he: 'הבחירות שלך בפול ננעלות עם שריקת הפתיחה. עבור עליהן שוב לפני שיהיה מאוחר ⏰',
    en: 'Your pool picks lock at kickoff. Give them one more look before it is too late ⏰' }]);
  push('pool-ev-ko', 8, [{
    he: 'בפול שלך כל ניחוש נכון בשלב הנוקאאוט שווה יותר נקודות. תכוון רחוק 🚀',
    en: 'In your pool every correct knockout pick is worth more points. Aim deep 🚀' }]);
  push('pool-ev-champion', 9, [{
    he: 'מי האלוף שבחרת? בפול שלך כל אחד בטוח שהוא צדק 🏆',
    en: 'Who is your champion pick? In your pool everyone is sure they are right 🏆' }]);
  push('pool-ev-topscorer', 10, [{
    he: 'מלך השערים שתבחר יכול להכריע את הפול שלך ⚽',
    en: 'The top scorer you pick could decide your pool ⚽' }]);
  push('pool-ev-share', 11, [{
    he: 'שתף את הלינק של הפול. ככל שיותר חברים מצטרפים, כיף יותר להוביל 🔗',
    en: 'Share your pool link. The more friends join, the more fun it is to lead 🔗' }]);
  push('pool-ev-compare', 12, [{
    he: 'אחרי שלב הבתים, השווה את הבחירות שלך מול שאר הפול 📊',
    en: 'After the group stage, compare your picks against the rest of your pool 📊' }]);

  if (!cand.length) return [];
  cand.sort((a, b) => a.prio - b.prio);

  // Return the FULL ordered, de-duplicated candidate list. loadPundit pages the
  // 2 pool slots by the hour over this list, so the pool items turn over every
  // hour too (live facts lead; the evergreen lines fill out the rotation).
  const seenPool = new Set();
  return cand
    .filter(it => it && it.id && !seenPool.has(it.id) && (seenPool.add(it.id), true))
    .map(it => ({
      id: it.id, type: 'pool', confidence: 'confirmed', he: it.he, en: it.en, sources: [],
    }));
}

// ---- Evergreen filler: keeps the card at a constant 5 items ----------------
// Brand commentary that's true in any phase (no time-sensitive claims, so it
// can never go stale/wrong). Used only to pad a shortfall after the real
// news/data/pool items; rotated by the hour so the feed visibly refreshes
// every hour even before the tournament when little real content exists.
const _PP_EVERGREEN = [
  { id: 'ev-3hosts', he: 'מונדיאל 2026 הוא הראשון אי פעם שמתארח ב‑3 מדינות — ארה״ב, קנדה ומקסיקו 🇺🇸🇨🇦🇲🇽',
    en: 'World Cup 2026 is the first ever hosted across 3 countries — USA, Canada & Mexico 🇺🇸🇨🇦🇲🇽' },
  { id: 'ev-48teams', he: '48 נבחרות, 104 משחקים, אלוף אחד. מי שלכם? 🏆',
    en: '48 teams, 104 matches, one champion. Who\'s yours? 🏆' },
  { id: 'ev-ko-points', he: 'כל ניחוש נכון בשלב הנוקאאוט שווה יותר נקודות — תכוונו רחוק! 🎯',
    en: 'Every correct knockout pick is worth more points — aim deep! 🎯' },
  { id: 'ev-topscorer', he: 'מי יהיה מלך השערים של 2026? הבחירה הזו יכולה להכריע את ההימור ⚽',
    en: 'Who\'ll be the 2026 top scorer? That pick could decide your pool ⚽' },
  { id: 'ev-darkhorse', he: 'אל תזלזלו באאוטסיידרים — הפתעה בשלב הבתים שווה זהב 👀',
    en: 'Don\'t sleep on the dark horses — a group-stage surprise is worth gold 👀' },
  { id: 'ev-share', he: 'כיף יותר כשמתחרים — שתפו את ההימור עם עוד חברים 😎',
    en: 'It\'s more fun with rivals — share your pool with more friends 😎' },
  { id: 'ev-biggest', he: 'המונדיאל הגדול בהיסטוריה. אתם מוכנים? 🔥',
    en: 'The biggest World Cup in history. Are you ready? 🔥' },
  { id: 'ev-everypick', he: 'כל בחירה נחשבת — בתים, נוקאאוט ומלך שערים. אל תשאירו שדה ריק ✍️',
    en: 'Every pick counts — groups, knockout and top scorer. Don\'t leave a blank ✍️' },
  { id: 'ev-favorites', he: 'הפייבוריטיות ברורות, אבל מונדיאל תמיד מפתיע. על מי אתם מהמרים? 🤔',
    en: 'The favorites are clear, but the World Cup always surprises. Who are you betting on? 🤔' },
  { id: 'ev-final', he: 'הדרך לגמר ארוכה — כל סיבוב שתנחשו נכון מקרב אתכם לראש הטבלה 🥇',
    en: 'The road to the final is long — every round you nail climbs you up the table 🥇' },
  // --- Deck expansion (v2.7.6): a deeper bank of verified, evergreen WC2026
  // facts + talking points so the no-repeat rotation has many distinct items to
  // cycle through before anything shown before comes back. All are well-
  // established facts (hosts/format/groups) or timeless tips, never stale.
  { id: 'ev-r32', he: 'לראשונה בהיסטוריה יש שלב נוקאאוט של 32 קבוצות. 32 מתוך 48 עולות משלב הבתים 🗺️',
    en: 'For the first time ever there is a Round of 32. 32 of the 48 teams advance from the groups 🗺️' },
  { id: 'ev-third', he: '8 הנבחרות הטובות שמסיימות במקום השלישי גם עולות הלאה. הפסד אחד לא מוציא אתכם 👌',
    en: 'The 8 best third-placed teams also advance. One defeat does not knock you out 👌' },
  { id: 'ev-final-venue', he: 'הגמר ייערך ב-19 ביולי 2026 באצטדיון MetLife בניו ג\'רזי 🏟️',
    en: 'The final is on July 19, 2026 at MetLife Stadium in New Jersey 🏟️' },
  { id: 'ev-opening', he: 'משחק הפתיחה: 11 ביוני באצטקה במקסיקו סיטי. מי תפתח בניצחון? ⚽',
    en: 'Opening match: June 11 at the Azteca in Mexico City. Who opens with a win? ⚽' },
  { id: 'ev-16venues', he: '16 ערים מארחות פרוסות על פני ארה״ב, קנדה ומקסיקו 🌎',
    en: '16 host cities spread across the USA, Canada and Mexico 🌎' },
  { id: 'ev-host-auto', he: 'שלוש המארחות, ארה״ב קנדה ומקסיקו, העפילו אוטומטית. על מי מהן אתם מהמרים? 🏠',
    en: 'The three hosts, USA, Canada and Mexico, qualified automatically. Backing any of them? 🏠' },
  { id: 'ev-holders', he: 'ארגנטינה מגיעה כאלופת העולם המכהנת. תהמרו שהיא תגן על התואר? 🇦🇷',
    en: 'Argentina arrive as the reigning world champions. Backing them to defend the crown? 🇦🇷' },
  { id: 'ev-upsets', he: 'במונדיאל מורחב, הפתעה בשלב הבתים שווה זהב. אל תזלזלו באאוטסיידרים 👀',
    en: 'In an expanded World Cup a group-stage upset is worth gold. Do not sleep on the outsiders 👀' },
  { id: 'ev-grpA', he: 'בית A: המארחת מקסיקו מובילה מול דרום אפריקה, קוריאה וצ\'כיה. מי תעלה? 🇲🇽',
    en: 'Group A: hosts Mexico headline alongside South Africa, Korea and Czechia. Who advances? 🇲🇽' },
  { id: 'ev-grpB', he: 'בית B: המארחת קנדה עם בוסניה, קטאר ושווייץ. מי שלכם בבית הזה? 🇨🇦',
    en: 'Group B: hosts Canada with Bosnia, Qatar and Switzerland. Who is your pick here? 🇨🇦' },
  { id: 'ev-grpC', he: 'בית C: ברזיל מובילה מול מרוקו, האיטי וסקוטלנד. תסחב את הבית? 🇧🇷',
    en: 'Group C: Brazil lead against Morocco, Haiti and Scotland. Will they take the group? 🇧🇷' },
  { id: 'ev-grpD', he: 'בית D: המארחת ארה״ב עם פרגוואי, אוסטרליה וטורקיה. מי תעלה? 🇺🇸',
    en: 'Group D: hosts USA with Paraguay, Australia and Turkey. Who goes through? 🇺🇸' },
  { id: 'ev-grpE', he: 'בית E: גרמניה מול קוראסאו, חוף השנהב ואקוודור. מי שלכם? 🇩🇪',
    en: 'Group E: Germany against Curacao, Ivory Coast and Ecuador. Who is your pick? 🇩🇪' },
  { id: 'ev-grpF', he: 'בית F: הולנד מול יפן, שוודיה ותוניסיה. תסחב את הבית? 🇳🇱',
    en: 'Group F: Netherlands against Japan, Sweden and Tunisia. Who takes it? 🇳🇱' },
  { id: 'ev-grpG', he: 'בית G: בלגיה מול מצרים, איראן וניו זילנד. מי תעלה? 🇧🇪',
    en: 'Group G: Belgium against Egypt, Iran and New Zealand. Who advances? 🇧🇪' },
  { id: 'ev-grpH', he: 'בית H: ספרד מובילה מול כף ורדה, סעודיה ואורוגוואי. מי שלכם? 🇪🇸',
    en: 'Group H: Spain lead against Cape Verde, Saudi Arabia and Uruguay. Who is your pick? 🇪🇸' },
  { id: 'ev-grpI', he: 'בית I: צרפת מול סנגל, עיראק ונורווגיה. תסחב את הבית? 🇫🇷',
    en: 'Group I: France against Senegal, Iraq and Norway. Will they take the group? 🇫🇷' },
  { id: 'ev-grpJ', he: 'בית J: אלופת העולם ארגנטינה מול אלג\'יריה, אוסטריה וירדן. מי תעלה? 🇦🇷',
    en: 'Group J: holders Argentina with Algeria, Austria and Jordan. Who advances? 🇦🇷' },
  { id: 'ev-grpK', he: 'בית K: פורטוגל מול קונגו, אוזבקיסטן וקולומביה. מי שלכם? 🇵🇹',
    en: 'Group K: Portugal against DR Congo, Uzbekistan and Colombia. Who is your pick? 🇵🇹' },
  { id: 'ev-grpL', he: 'בית L: אנגליה מול קרואטיה, גאנה ופנמה. תסחב את הבית? 🏴',
    en: 'Group L: England against Croatia, Ghana and Panama. Will they take it? 🏴' },
];

// Rotates an array by `hourSeed` so the leading window advances every hour.
// Returns a fresh array (never mutates the input); identity for <=1 items.
function _ppRotateByHour(arr, hourSeed) {
  if (!Array.isArray(arr) || arr.length <= 1) return Array.isArray(arr) ? arr.slice() : [];
  const off = ((hourSeed % arr.length) + arr.length) % arr.length;
  return arr.slice(off).concat(arr.slice(0, off));
}

// Returns a window of `size` items whose start offset advances by a FULL `size`
// every hour (so consecutive hours show a NON-overlapping set, until the pool is
// exhausted). This is what makes the 3 news lines genuinely DIFFERENT each hour
// rather than the same trio reshuffled. With a pool deeper than `size` it cycles
// through every item across the day. Returns the whole array when it is <= size.
function _ppPageByHour(arr, hourSeed, size) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  if (a.length <= size) return a;
  const off = (((hourSeed * size) % a.length) + a.length) % a.length;
  const out = [];
  for (let i = 0; i < size; i++) out.push(a[(off + i) % a.length]);
  return out;
}

// ---- No-repeat rotation (v2.7.6) -------------------------------------------
// A per-browser "seen" memory (localStorage) guarantees the Pundit never re-shows
// an item until every OTHER available item has been shown first: each hour we pick
// the items shown LEAST recently, then record them at the current hour index. The
// choice is frozen per clock hour (see loadPundit) so the 10-min refetch can't
// churn it mid-hour. Live news/data is preferred over evergreen deck facts among
// equally-unseen items, so genuinely fresh news still leads the feed.
const _PP_SEEN_KEY = 'fb_pundit_seen';   // { id: lastHourIndexShown }
const _PP_HOUR_KEY = 'fb_pundit_hour';   // { H, pool:[ids], news:[ids] }
const _PP_SEEN_MAX = 600;                // cap stored ids so localStorage stays small

function _ppHash(s) {
  let h = 0; const str = String(s);
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}
function _ppDedup(list) {
  const m = new Map();
  (list || []).forEach(it => { if (it && it.id && !m.has(it.id)) m.set(it.id, it); });
  return [...m.values()];
}
function _ppSeenLoad() {
  try { return JSON.parse(localStorage.getItem(_PP_SEEN_KEY) || '{}') || {}; } catch (_) { return {}; }
}
function _ppSeenSave(map) {
  try {
    let m = map || {};
    const keys = Object.keys(m);
    if (keys.length > _PP_SEEN_MAX) {
      // keep only the most-recently-seen ids (highest hour index)
      const kept = keys.sort((a, b) => m[b] - m[a]).slice(0, _PP_SEEN_MAX);
      const trimmed = {}; kept.forEach(k => { trimmed[k] = m[k]; }); m = trimmed;
    }
    localStorage.setItem(_PP_SEEN_KEY, JSON.stringify(m));
  } catch (_) { /* storage disabled/full - rotation still works, just less history */ }
}
function _ppHourLoad() { try { return JSON.parse(localStorage.getItem(_PP_HOUR_KEY) || 'null'); } catch (_) { return null; } }
function _ppHourSave(o) { try { localStorage.setItem(_PP_HOUR_KEY, JSON.stringify(o)); } catch (_) { /* ignore */ } }

// Pick `count` LEAST-recently-shown items from `cands`. Never-shown items (no
// memory entry) sort first; ties break by content rank (live news/data/pool
// before evergreen filler) then a stable hour-salted hash so it stays varied and
// deterministic within the hour. Returns the chosen item objects.
function _ppLeastRecent(cands, count, seen, H) {
  const rank = (it) => {
    if (!it) return 1;
    // Pool evergreen filler ranks below live pool facts (someone joined / the
    // leader / your-still-pending) so the real buzz leads the pool slots.
    if (typeof it.id === 'string' && it.id.indexOf('pool-ev-') === 0) return 1;
    const ty = it.type;
    if (ty === 'news' || ty === 'result' || ty === 'fixture' || ty === 'stat' || ty === 'pool') return 0;
    return 1; // countdown + evergreen deck filler
  };
  return (cands || [])
    .filter(it => it && it.id)
    .map(it => ({ it, last: (seen && it.id in seen) ? seen[it.id] : -1 }))
    .sort((a, b) => (a.last - b.last) || (rank(a.it) - rank(b.it)) || (_ppHash(a.it.id + '|' + H) - _ppHash(b.it.id + '|' + H)))
    .slice(0, count)
    .map(s => s.it);
}

// The evergreen "deck": a deep bank of verified WC2026 facts/talking points that
// fills the news slots so the no-repeat rotation has many distinct items to cycle
// through before anything shown before comes back.
function _punditDeck() {
  return _PP_EVERGREEN.map(it => ({ id: it.id, type: 'evergreen', confidence: 'confirmed', he: it.he, en: it.en, sources: [] }));
}

function _evergreenPundit(count, hourSeed, exclude) {
  if (count <= 0) return [];
  const used = new Set((exclude || []).map(it => it && it.id));
  const pool = _PP_EVERGREEN.filter(it => !used.has(it.id));
  if (!pool.length) return [];
  const start = ((hourSeed % pool.length) + pool.length) % pool.length;
  const out = [];
  for (let i = 0; i < pool.length && out.length < count; i++) {
    const it = pool[(start + i) % pool.length];
    out.push({ id: it.id, type: 'evergreen', confidence: 'confirmed', he: it.he, en: it.en, sources: [] });
  }
  return out;
}

async function renderPundit() {
  const card = document.getElementById('pundit-card');
  if (!card) return;
  const items = await loadPundit();
  if (!items.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  // Build the pagination dots once per render.
  const dotsEl = document.getElementById('pundit-dots');
  if (dotsEl) {
    dotsEl.innerHTML = '';
    if (items.length > 1) {
      items.forEach((_, i) => {
        const s = document.createElement('span');
        if (i === _punditState.idx) s.classList.add('active');
        s.onclick = () => { _punditState.idx = i; _punditDraw(); _punditRestartTimer(); };
        dotsEl.appendChild(s);
      });
    }
  }
  // "See more" toggle: expand/collapse the clamped text. Wire once.
  const toggleEl = document.getElementById('pundit-toggle');
  const textEl = document.getElementById('pundit-text');
  if (toggleEl && textEl && !toggleEl._punditWired) {
    toggleEl._punditWired = true;
    toggleEl.onclick = () => {
      const expanded = textEl.classList.toggle('expanded');
      toggleEl.textContent = expanded ? t('pundit.seeLess') : t('pundit.seeMore');
      // Pause auto-rotation while the user is reading the full text.
      if (expanded) {
        if (_punditState.timer) { clearInterval(_punditState.timer); _punditState.timer = null; }
      } else {
        _punditRestartTimer();
      }
    };
  }

  _punditDraw();
  _punditRestartTimer();

  // Auto-refresh the feed in place so new verified news (the agent runs a few
  // times a day) and the hourly news rotation appear WITHOUT a manual reload.
  // The 9s timer only advances the displayed item; it never re-fetches. We tick
  // every 10 min: force loadPundit to re-fetch (its 5-min cache has expired by
  // then) and, only if the item set actually changed, redraw from the top.
  if (!_punditState.refreshTimer) {
    _punditState.refreshTimer = setInterval(async () => {
      const c = document.getElementById('pundit-card');
      if (!c || document.hidden) return; // skip when the tab/card isn't visible
      const before = (_punditState.items || []).map(i => i && i.id).join('|');
      _punditState.loadedAt = 0; // bypass the in-memory cache -> real re-fetch
      const fresh = await loadPundit();
      const after = (fresh || []).map(i => i && i.id).join('|');
      if (after && after !== before) { _punditState.idx = 0; _punditDraw(); _punditRestartTimer(); }
    }, 10 * 60 * 1000);
  }
}

function _punditDraw() {
  const items = _punditState.items;
  if (!items.length) return;
  const it = items[_punditState.idx % items.length];
  const lang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'he';

  const textEl = document.getElementById('pundit-text');
  const toggleEl = document.getElementById('pundit-toggle');
  if (textEl) {
    textEl.classList.add('pundit-fade');
    setTimeout(() => {
      textEl.textContent = (lang === 'he' ? it.he : it.en) || it.he || it.en || '';
      textEl.classList.remove('pundit-fade');
      // Reset to collapsed and decide whether "see more" is needed for this item.
      textEl.classList.remove('expanded');
      if (toggleEl) {
        toggleEl.style.display = (textEl.scrollHeight > textEl.clientHeight + 2) ? '' : 'none';
        toggleEl.textContent = t('pundit.seeMore');
      }
    }, 180);
  }

  const tagEl = document.getElementById('pundit-tag');
  if (tagEl) {
    if (it.type === 'news') {
      const conf = it.confidence === 'confirmed';
      tagEl.textContent = conf ? t('pundit.badge.confirmed') : t('pundit.badge.reported');
      tagEl.className = 'pundit-tag ' + (conf ? 'confirmed' : 'reported');
      tagEl.style.display = '';
    } else if (it.type === 'pool') {
      tagEl.textContent = t('pundit.badge.pool');
      tagEl.className = 'pundit-tag pool';
      tagEl.style.display = '';
    } else {
      tagEl.style.display = 'none';
    }
  }

  // Show the team flag when the item is about a single nation (it.team = code).
  const flagEl = document.getElementById('pundit-flag');
  if (flagEl) {
    if (it.team && typeof getCountryFlag === 'function') {
      flagEl.innerHTML = getCountryFlag(it.team);
      flagEl.style.display = '';
    } else {
      flagEl.innerHTML = '';
      flagEl.style.display = 'none';
    }
  }

  const srcEl = document.getElementById('pundit-sources');
  if (srcEl) {
    const sources = Array.isArray(it.sources) ? it.sources.filter(s => s && s.url) : [];
    if (sources.length) {
      srcEl.style.display = '';
      srcEl.innerHTML = '';
      const label = document.createElement('span');
      label.className = 'pundit-source-label';
      label.textContent = t('pundit.source');
      srcEl.appendChild(label);
      sources.forEach(s => {
        // v2.6.75: sources are non-clickable text chips now (no link).
        const chip = document.createElement('span');
        chip.className = 'pundit-source';
        let name = s.name;
        if (!name) { try { name = new URL(s.url).hostname.replace('www.', ''); } catch (_) { name = s.url; } }
        chip.textContent = name;
        srcEl.appendChild(chip);
      });
    } else {
      // Keep the row present (CSS reserves its height) so items without sources
      // don't shrink the card - the fixed-size card only grows on "see more".
      srcEl.style.display = '';
      srcEl.innerHTML = '';
    }
  }

  const dotsEl = document.getElementById('pundit-dots');
  if (dotsEl) {
    Array.from(dotsEl.children).forEach((c, i) => c.classList.toggle('active', i === (_punditState.idx % items.length)));
  }
}

function _punditNext() {
  if (!_punditState.items.length) return;
  _punditState.idx = (_punditState.idx + 1) % _punditState.items.length;
  _punditDraw();
}

function _punditRestartTimer() {
  if (_punditState.timer) clearInterval(_punditState.timer);
  if (_punditState.items.length > 1) _punditState.timer = setInterval(_punditNext, 9000);
}

// ============================================================
// REAL RESULTS DATA - For showing "got it right" indicators
// ============================================================

// Global cache of results
state.results = {
  // Per match: { match_id, status, winner_code, home_team, away_team, scores, stage, group }
  matchesByTeam: {},   // team_code -> [matches]
  finishedMatches: [],
  myScores: {},        // match_id -> score earned
  groupAdvancers: {},  // group letter -> [team_codes that advanced]
  knockoutWinners: {}, // match_id -> winning_team_code
  lastLoaded: null
};

// Pillar 1: read the CDN match snapshot (Vercel edge) first so live-match spikes hit the
// CDN instead of Postgres. Returns a matches array, or null to fall back to Supabase.
let _matchesSnapCache = { at: 0, data: null, updatedAt: 0 };
async function fetchMatchesFromCDN(maxAgeMs = 25000) {
  try {
    if (_matchesSnapCache.data && (Date.now() - _matchesSnapCache.at) < maxAgeMs) return _matchesSnapCache.data;
    const res = await fetch('/public-data/matches.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || !Array.isArray(j.matches) || j.matches.length === 0) return null;
    const m0 = j.matches[0];
    if (!m0 || typeof m0.id === 'undefined' || typeof m0.status === 'undefined') return null; // shape sanity
    _matchesSnapCache = { at: Date.now(), data: j.matches, updatedAt: Date.parse(j.updatedAt) || 0 };
    return j.matches;
  } catch (_) { return null; }
}

// Defense-in-depth: when a match is live (or its kickoff has passed but it isn't
// finished yet - e.g. right after kickoff, when the snapshot can still say
// "upcoming") and the snapshot is older than maxAgeMs, the sync->snapshot->CDN
// pipeline is lagging. Bypass it and read live scores straight from Postgres
// (which the live-poller keeps ~60s fresh) so a stale CDN copy can't freeze the
// score - or show a kicked-off match as "upcoming".
const _LIVE_MATCH_STATUSES = ['IN_PLAY', 'PAUSED', 'LIVE'];
// All user columns EXCEPT recovery_code_hash (a credential). Cross-user reads
// (leaderboard, members list) must use this so a pool member can't dump every
// other member's auth hash from the network response. NOTE (updated 2026-06-10):
// this is no longer only client-side — production now enforces COLUMN-LEVEL grants:
// anon can SELECT the public columns (verified `?select=id,nickname,...` -> 200) but
// SELECTing recovery_code_hash (or `select=*`, which includes it) -> 401. So the
// hash is protected at the DB, and these public-column cross-user reads work as
// intended; do NOT "fix" them by re-granting broad anon SELECT on users.
// NOTE: signup_source/signup_referrer/utm_*/country are intentionally EXCLUDED.
// They are write-only attribution (set at signup, consumed only by backend
// analytics, never rendered in-app), so the client never needs to read them.
// Excluding them lets the DB revoke anon SELECT on those columns (F4) without
// breaking any in-app read - a pool member can't dump every other member's
// acquisition data from the network response.
const USER_PUBLIC_COLS = 'id,pool_id,nickname,is_admin,is_approved,is_late_joiner,whatsapp_url,telegram_url,total_score,group_score,knockout_score,top_scorer_score,joined_at,last_active_at,last_score_calc,groups_score,bonus_score,approval_status,approved_at,approved_by,group_points,knockout_points,bonus_points,predictions_locked,predictions_submitted_at';
const _TERMINAL_MATCH_STATUSES = ['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED'];
const _MAX_MATCH_MS = 3.5 * 60 * 60 * 1000; // longest plausible match incl. ET + pens
function _snapshotStaleDuringLive(matches, maxAgeMs = 60000) {
  if (!matches || !_matchesSnapCache.updatedAt) return false;
  const now = Date.now();
  const liveish = matches.some(m => {
    if (_LIVE_MATCH_STATUSES.includes(m.status)) return true;
    // kicked off (within the last ~3.5h) but not finished -> almost certainly live now
    const ko = Date.parse(m.match_date);
    return !isNaN(ko) && ko <= now && (now - ko) < _MAX_MATCH_MS && !_TERMINAL_MATCH_STATUSES.includes(m.status);
  });
  return liveish && (now - _matchesSnapCache.updatedAt) > maxAgeMs;
}

async function loadResultsData() {
  if (!supabaseClient || !state.currentUser) return;

  // Cache for 60 seconds to avoid spam
  if (state.results.lastLoaded && (Date.now() - state.results.lastLoaded) < 60000) {
    return;
  }

  try {
    // Load finished matches — prefer the CDN snapshot, filter locally; fall back to the DB.
    let matches = await fetchMatchesFromCDN();
    if (matches) {
      matches = matches.filter(m => m.status === 'FINISHED');
    } else {
      const { data } = await supabaseClient
        .from('matches')
        .select('*')
        .eq('status', 'FINISHED');
      matches = data || [];
    }

    state.results.finishedMatches = matches || [];
    
    // Build per-team match list
    state.results.matchesByTeam = {};
    (matches || []).forEach(m => {
      if (m.home_team_code) {
        if (!state.results.matchesByTeam[m.home_team_code]) {
          state.results.matchesByTeam[m.home_team_code] = [];
        }
        state.results.matchesByTeam[m.home_team_code].push(m);
      }
      if (m.away_team_code) {
        if (!state.results.matchesByTeam[m.away_team_code]) {
          state.results.matchesByTeam[m.away_team_code] = [];
        }
        state.results.matchesByTeam[m.away_team_code].push(m);
      }
    });
    
    // Build knockout winners map
    state.results.knockoutWinners = {};
    (matches || []).forEach(m => {
      if (!m.stage || m.stage === 'GROUP_STAGE') return;
      // Prefer winner_code (accounts for extra time / penalty shootouts, where
      // home_score == away_score); fall back to the score comparison.
      if (m.winner_code) {
        state.results.knockoutWinners[m.id] = m.winner_code;
      } else if (m.home_score !== null && m.away_score !== null) {
        if (m.home_score > m.away_score) {
          state.results.knockoutWinners[m.id] = m.home_team_code;
        } else if (m.away_score > m.home_score) {
          state.results.knockoutWinners[m.id] = m.away_team_code;
        }
      }
    });
    
    // Build group advancers map (top 2 of each group)
    // For now: based on who appears in knockout matches
    state.results.groupAdvancers = {};
    (matches || []).forEach(m => {
      if (m.stage === 'LAST_16') {
        // Teams in R16 advanced from groups
        if (m.home_team_code) {
          // Find their group
          const groupMatch = (matches || []).find(gm => 
            gm.stage === 'GROUP_STAGE' && 
            (gm.home_team_code === m.home_team_code || gm.away_team_code === m.home_team_code)
          );
          if (groupMatch?.group_letter) {
            if (!state.results.groupAdvancers[groupMatch.group_letter]) {
              state.results.groupAdvancers[groupMatch.group_letter] = new Set();
            }
            state.results.groupAdvancers[groupMatch.group_letter].add(m.home_team_code);
          }
        }
        if (m.away_team_code) {
          const groupMatch = (matches || []).find(gm => 
            gm.stage === 'GROUP_STAGE' && 
            (gm.home_team_code === m.away_team_code || gm.away_team_code === m.away_team_code)
          );
          if (groupMatch?.group_letter) {
            if (!state.results.groupAdvancers[groupMatch.group_letter]) {
              state.results.groupAdvancers[groupMatch.group_letter] = new Set();
            }
            state.results.groupAdvancers[groupMatch.group_letter].add(m.away_team_code);
          }
        }
      }
    });
    
    // Load my scores per match
    const { data: myScores } = await supabaseClient
      .from('user_scores')
      .select('*')
      .eq('user_id', state.currentUser.id);
    
    state.results.myScores = {};
    (myScores || []).forEach(s => {
      const key = `${s.match_id}_${s.pick_type}`;
      state.results.myScores[key] = s;
    });
    
    state.results.lastLoaded = Date.now();
    
  } catch (err) {
    console.error('Load results error:', err);
  }
}

// Check if a team advanced from group stage (for group betting indicator)
function didTeamAdvance(teamCode, groupLetter) {
  const advancers = state.results.groupAdvancers[groupLetter];
  if (!advancers) return null; // Unknown yet
  return advancers.has(teamCode);
}

// Check if a knockout pick was correct
function wasKnockoutPickCorrect(matchId, pickedTeamCode) {
  const winner = state.results.knockoutWinners[matchId];
  if (!winner) return null; // Match not finished
  return winner === pickedTeamCode;
}

// Get my score for a specific match+type
function getMyMatchScore(matchId, pickType) {
  const key = `${matchId}_${pickType}`;
  return state.results.myScores[key];
}

// ============================================================
// MENU (Bottom Sheet)
// ============================================================

function openMenu() {
  // Update menu user info
  const user = state.currentUser;
  const pool = state.currentPool;
  
  if (!user || !pool) return;
  
  // User avatar (first letter)
  const safeNick = user.nickname || t('dashboard.fallback.nickname');
  document.getElementById('menu-user-initial').textContent = safeNick.charAt(0).toUpperCase();
  document.getElementById('menu-user-name').textContent = safeNick;
  document.getElementById('menu-user-role').textContent = user.is_admin ? t('dashboard.role.adminMember') : t('dashboard.role.member');
  document.getElementById('menu-pool-name').textContent = pool.name || t('dashboard.fallback.poolName');
  document.getElementById('menu-pool-code').textContent = pool.code || '-----';
  
  // Show admin section if admin
  const adminSection = document.getElementById('menu-admin-section');
  if (adminSection) {
    adminSection.style.display = user.is_admin ? 'block' : 'none';
  }
  
  // If admin - check pending count
  if (user.is_admin) {
    updatePendingBadge();
  }
  
  // Open the sheet
  document.getElementById('menu-overlay').classList.add('active');
  document.getElementById('menu-sheet').classList.add('active');
  document.body.style.overflow = 'hidden';
}

async function updatePendingBadge() {
  try {
    const { count, error } = await supabaseClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('pool_id', state.currentPool.id)
      .eq('approval_status', 'pending')
      .eq('is_admin', false);
    
    if (error) return;
    
    const badge = document.getElementById('menu-pending-badge');
    if (badge) {
      if (count && count > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = count;
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Pending badge update failed:', err);
  }
}

function closeMenu() {
  document.getElementById('menu-overlay').classList.remove('active');
  document.getElementById('menu-sheet').classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================================
// Quick share from dashboard
// ============================================================

function quickSharePool() {
  // Open the new viral share modal
  showShareModal();
}

// ============================================================
// Menu actions
// ============================================================

function showRecoveryCodeAgain() {
  closeMenu();
  showScreen('recovery-display-screen');
}

// v2.9.24: fetch ALL rows for a pool, paging past PostgREST's hard 1000-row cap
// (.range does not lift it on this project). Used by the members list so big
// pools aren't silently truncated. Stops on a short page or an error.
async function _fetchAllPoolRows(table, cols, poolId) {
  const PAGE = 1000;
  let all = [];
  for (let from = 0, guard = 0; guard < 50; guard++, from += PAGE) {   // 50k-row ceiling
    let data = null, lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {   // retry a transient page error
      const res = await supabaseClient
        .from(table).select(cols).eq('pool_id', poolId).range(from, from + PAGE - 1);
      if (!res.error) { data = res.data || []; lastError = null; break; }
      lastError = res.error;
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
    // Never return PARTIAL data on a page failure — that would silently re-create
    // the truncation bug. Throw so the caller shows an error instead of rendering
    // confidently-wrong member statuses.
    if (lastError) throw lastError;
    if (!data.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
  }
  return all;
}

async function showMembers() {
  closeMenu();

  if (!state.currentPool || !supabaseClient) {
    showToast(t('errors.loadError'), 'error');
    return;
  }

  showScreen('members-screen');

  // Load all members
  const { data: members, error } = await supabaseClient
    .from('users')
    .select(USER_PUBLIC_COLS)
    .eq('pool_id', state.currentPool.id)
    .order('joined_at', { ascending: true });

  if (error || !members) {
    console.error('Members load error:', error);
    showToast(t('membersList.loadError'), 'error');
    return;
  }
  
  // v2.5.24: pick the correct picks table per betting_mode. The legacy
  // group_picks belongs to two_phase pools; single_phase pools store
  // picks in group_position_picks.
  // v2.5.37: also fetch knockout picks so the per-member status can reflect
  // "groups done but knockout not done" vs. "everything done".
  const isV2 = state.currentPool.betting_mode === 'single_phase';
  const picksTable = isV2 ? 'group_position_picks' : 'group_picks';
  // v2.9.24: PostgREST caps a query at 1000 rows (verified on prod — .range does
  // NOT lift it), so a big pool (e.g. 200 members ≈ 10k group-pick rows) was
  // truncated and most members showed a WRONG status. Page through all rows so
  // the per-member counts (and the ⚠️ "needs knockout" flag) are correct, and
  // agree with the dashboard nudge count.
  let groupData, koData;
  try {
    [groupData, koData] = await Promise.all([
      _fetchAllPoolRows(picksTable, 'user_id', state.currentPool.id),
      _fetchAllPoolRows('knockout_picks', 'user_id', state.currentPool.id)
    ]);
  } catch (err) {
    console.error('Members pick pagination failed:', err);
    showToast(t('membersList.loadError'), 'error');
    return;   // don't render partial/misleading statuses
  }

  // Count group + knockout picks per user
  const picksPerUser = {};
  const koPerUser = {};
  groupData.forEach(p => {
    picksPerUser[p.user_id] = (picksPerUser[p.user_id] || 0) + 1;
  });
  koData.forEach(p => {
    koPerUser[p.user_id] = (koPerUser[p.user_id] || 0) + 1;
  });

  // Build summary
  const total = members.length;
  let betted = 0;
  let notBetted = 0;

  members.forEach(m => {
    const picks = picksPerUser[m.id] || 0;
    if (picks > 0) betted++;
    else notBetted++;
  });

  document.getElementById('members-total').textContent = total;
  document.getElementById('members-betted').textContent = betted;
  document.getElementById('members-not-betted').textContent = notBetted;

  // Render list
  const list = document.getElementById('members-list');
  list.innerHTML = '';

  members.forEach(member => {
    const picks = picksPerUser[member.id] || 0;
    const koPicks = koPerUser[member.id] || 0;
    const card = createMemberCard(member, picks, koPicks, isV2);
    list.appendChild(card);
  });
}

function createMemberCard(member, picksCount, koPicksCount, isV2) {
  const card = document.createElement('div');
  card.className = 'member-card';

  const isMe = state.currentUser && member.id === state.currentUser.id;
  if (isMe) card.classList.add('is-me');
  if (member.is_admin) card.classList.add('is-admin');

  // v2.5.37: precise status reflects groups + knockout (and, for single_phase,
  // the predictions_submitted_at flag). Three states only:
  //  - noBets: hasn't picked anything (0 group + 0 knockout)
  //  - inProgress: has some picks but not all
  //  - allDone: every required pick is in
  // v2.9.8: "done" now REQUIRES a full bracket for single-phase (31 positions) —
  // we no longer trust predictions_submitted_at alone, because the silent
  // bracket-save bug let users submit with groups+champion but no bracket. Those
  // members must show as needing their knockout, so the admin can nudge them.
  // v2.10.9: two-phase group stage is complete at EXACTLY 32 (not 24) — see
  // isTwoPhaseGroupComplete. single_phase keeps its 48-cell check.
  const groupComplete = isV2 ? (picksCount >= 48) : isTwoPhaseGroupComplete(picksCount);
  const koComplete = isV2 ? (koPicksCount >= 31) : (koPicksCount >= 16);
  const allDone = groupComplete && koComplete;

  let statusClass, statusText;
  if (picksCount === 0 && koPicksCount === 0) {
    statusClass = 'not-started';
    statusText = t('membersList.noBets');
  } else if (allDone) {
    statusClass = 'completed';
    statusText = t('membersList.allDone');
  } else if (isV2 && groupComplete && !koComplete) {
    // groups in, knockout bracket missing/incomplete — the nudge state
    statusClass = 'partial';
    statusText = t('membersList.needsKnockout');
  } else {
    statusClass = 'partial';
    statusText = t('membersList.inProgress');
  }

  // Joined date (guard null joined_at so it never renders "Invalid Date")
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  let joinedText = '';
  if (member.joined_at) {
    const joinedDate = new Date(member.joined_at);
    const today = new Date();
    const daysAgo = Math.floor((today - joinedDate) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) joinedText = t('membersList.joinedToday');
    else if (daysAgo === 1) joinedText = t('membersList.joinedYesterday');
    else if (daysAgo < 7) joinedText = t('membersList.joinedDaysAgo', { n: daysAgo });
    else joinedText = t('membersList.joinedOn', { date: joinedDate.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' }) });
  }

  const safeNickname = member.nickname || t('membersList.fallbackUser');
  const safeInitial = safeNickname.charAt(0).toUpperCase();

  card.innerHTML = `
    <div class="lb-avatar-small">${safeInitial}</div>
    <div class="member-info">
      <div class="member-name">
        ${escapeHtml(safeNickname)}
        ${member.is_admin ? `<span class="admin-badge">${t('common.admin')}</span>` : ''}
        ${isMe ? `<span class="lb-badge">${t('common.you')}</span>` : ''}
      </div>
      <div class="member-status ${statusClass}">
        <span class="member-status-dot"></span>
        <span>${statusText}</span>
      </div>
    </div>
    <div class="member-joined">${joinedText}</div>
  `;
  
  return card;
}

function shareInviteFromMembers() {
  if (_inviteShareBlocked()) return;
  shareWhatsApp();
}

// ============================================================
// ADMIN MEMBERS MANAGEMENT
// ============================================================

const adminState = {
  members: [],
  selectedMember: null,
  poolData: null
};

async function showAdminMembers() {
  closeMenu();
  
  // Verify user is admin
  if (!state.currentPool || !state.currentUser.is_admin) {
    showToast(t('adminMembersEx.notAdmin'), 'error');
    return;
  }
  
  showScreen('admin-members-screen');
  await loadAdminMembers();
}

async function loadAdminMembers() {
  const list = document.getElementById('admin-members-list');
  const loading = document.getElementById('admin-members-loading');
  
  loading.style.display = 'block';
  list.innerHTML = '';
  
  try {
    // Load pool fresh
    const { data: pool, error: poolError } = await supabaseClient
      .from('pools')
      .select('*')
      .eq('id', state.currentPool.id)
      .single();
    
    if (poolError) throw poolError;
    adminState.poolData = pool;
    updatePoolLockCard();
    
    // Load all users in pool
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select(USER_PUBLIC_COLS)
      .eq('pool_id', state.currentPool.id)
      .order('joined_at', { ascending: true });
    
    if (usersError) throw usersError;
    
    // v2.5.24: pick the right group-picks table per mode (legacy group_picks
    // for two_phase, group_position_picks for single_phase). knockout_picks
    // is shared across both modes (bracket_position column was added in the
    // 2026-05-17 migration for the v2 flow).
    const isV2 = pool.betting_mode === 'single_phase';
    const groupTable = isV2 ? 'group_position_picks' : 'group_picks';

    // Load picks stats for each user
    const userIds = users.map(u => u.id);

    // Also load the champion (tournament winner) + top-scorer picks so we can tell a
    // FINISHED member (everything incl. champion + Golden Boot) from one who only STARTED.
    const [groupPicksRes, knockoutPicksRes, winnerPicksRes, topScorerPicksRes] = await Promise.all([
      supabaseClient
        .from(groupTable)
        .select('user_id')
        .in('user_id', userIds),
      supabaseClient
        .from('knockout_picks')
        .select('user_id')
        .in('user_id', userIds),
      supabaseClient
        .from('tournament_winner_picks')
        .select('user_id')
        .in('user_id', userIds),
      supabaseClient
        .from('top_scorer_picks')
        .select('user_id')
        .in('user_id', userIds)
    ]);

    const groupPicksByUser = {};
    (groupPicksRes.data || []).forEach(p => {
      groupPicksByUser[p.user_id] = (groupPicksByUser[p.user_id] || 0) + 1;
    });

    const knockoutPicksByUser = {};
    (knockoutPicksRes.data || []).forEach(p => {
      knockoutPicksByUser[p.user_id] = (knockoutPicksByUser[p.user_id] || 0) + 1;
    });

    const hasWinnerByUser = {};
    (winnerPicksRes.data || []).forEach(p => { hasWinnerByUser[p.user_id] = true; });
    const hasTopScorerByUser = {};
    (topScorerPicksRes.data || []).forEach(p => { hasTopScorerByUser[p.user_id] = true; });

    // Enrich users with stats
    adminState.members = users.map(u => ({
      ...u,
      groupPicksCount: groupPicksByUser[u.id] || 0,
      knockoutPicksCount: knockoutPicksByUser[u.id] || 0,
      hasWinner: !!hasWinnerByUser[u.id],
      hasTopScorer: !!hasTopScorerByUser[u.id],
      isAdmin: u.is_admin === true
    }));
    adminState.isV2 = isV2;
    
    renderAdminMembers();
    
  } catch (err) {
    console.error('Load admin members error:', err);
    showToast(t('adminMembersEx.loadError'), 'error');
  } finally {
    loading.style.display = 'none';
  }
}

// Per-member betting status for the admin dashboard.
//  - started:  has begun (at least one group pick, or any later pick / submission)
//  - finished: EVERYTHING is in — all groups + full bracket + champion + top scorer
//    (top scorer is only required once squads are released, since the flow skips that
//    step until then).
function _adminMemberProgress(member) {
  const isV2 = adminState.isV2;
  // v2.10.9: two-phase groups complete at EXACTLY 32 (not 24). single_phase 48.
  const groupsFull = isV2 ? (member.groupPicksCount >= 48) : isTwoPhaseGroupComplete(member.groupPicksCount);
  const bracketFull = member.knockoutPicksCount >= (isV2 ? 31 : 16);
  let squadsReleased = false;
  try { squadsReleased = localStorage.getItem('fb_squads_released') === 'true'; } catch (_) {}

  const started = member.groupPicksCount >= 1 || member.knockoutPicksCount >= 1 ||
    member.hasWinner || member.hasTopScorer || !!member.predictions_submitted_at;

  const finished = isV2
    ? (groupsFull && bracketFull && member.hasWinner && (member.hasTopScorer || !squadsReleased))
    : (groupsFull && bracketFull);

  // v2.9.8: groups in but the knockout bracket isn't full → the member needs to
  // (re-)fill the knockout. Surfaced so the admin can see exactly who to nudge.
  const needsKnockout = isV2 && groupsFull && !bracketFull;

  return { started, finished, needsKnockout };
}

function renderAdminMembers() {
  const list = document.getElementById('admin-members-list');
  
  // Stats
  const total = adminState.members.length;
  const pending = adminState.members.filter(m => m.approval_status === 'pending' && !m.isAdmin).length;
  // Aggregate counts that mirror the per-member statuses: how many STARTED (>=1 group)
  // and how many FINISHED (all groups + full bracket + champion + top scorer).
  const startedCount = adminState.members.filter(m => _adminMemberProgress(m).started).length;
  const finishedCount = adminState.members.filter(m => _adminMemberProgress(m).finished).length;

  document.getElementById('admin-stat-total').textContent = total;
  document.getElementById('admin-stat-groups').textContent = startedCount;
  document.getElementById('admin-stat-knockout').textContent = finishedCount;
  
  // Show pending banner if any
  const pendingBanner = document.getElementById('admin-pending-banner');
  if (pendingBanner) {
    if (pending > 0) {
      pendingBanner.style.display = 'flex';
      const countEl = document.getElementById('admin-pending-count');
      if (countEl) countEl.textContent = pending;
      // Keep the banner title in sync (updatePoolLockCard runs before members
      // load, so it would otherwise show a stale 0).
      const titleEl = document.getElementById('admin-pending-banner-title');
      if (titleEl) titleEl.innerHTML = t('adminMembersEx.pendingCount', { n: pending });
    } else {
      pendingBanner.style.display = 'none';
    }
  }
  
  // Sort: pending first, then approved
  const sorted = [...adminState.members].sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    if (a.approval_status === 'pending' && b.approval_status !== 'pending') return -1;
    if (a.approval_status !== 'pending' && b.approval_status === 'pending') return 1;
    return (a.nickname || '').localeCompare(b.nickname || '');
  });
  
  // Render list
  list.innerHTML = '';

  // v2.9.8/v2.9.9: aggregate nudge — how many members still need their knockout
  // bracket. Explains the technical glitch + offers a ready-to-send message the
  // admin can paste into the group chat to ask those members to re-fill it.
  const needsKoCount = adminState.members.filter(m => _adminMemberProgress(m).needsKnockout).length;
  if (needsKoCount > 0) {
    const nudge = document.createElement('div');
    nudge.className = 'admin-ko-nudge-banner';
    nudge.innerHTML =
      '<div class="akn-text">⚠️ ' + t('adminMembersEx.needsKnockoutGlitch', { n: needsKoCount }) + '</div>' +
      '<button type="button" class="akn-copy" id="admin-ko-copy-btn">' +
      '<i class="ti ti-copy"></i><span>' + t('adminMembersEx.copyNudge') + '</span></button>';
    list.appendChild(nudge);
    const copyBtn = nudge.querySelector('#admin-ko-copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(t('adminMembersEx.nudgeMessage'));
        showToast(t('adminMembersEx.nudgeCopied'), 'success');
      } catch (_) { showToast(t('adminMembersEx.nudgeMessage'), 'info'); }
    });
  }

  sorted.forEach(member => {
    const card = document.createElement('div');
    card.className = 'admin-member-card';
    if (member.isAdmin) card.classList.add('is-admin');
    if (member.approval_status === 'pending' && !member.isAdmin) {
      card.classList.add('is-pending');
    }
    
    const initial = member.nickname ? member.nickname.charAt(0).toUpperCase() : '?';
    
    const adminBadge = member.isAdmin ? `<span class="admin-member-badge">${t('adminMembersEx.adminBadge')}</span>` : '';
    const pendingBadge = (member.approval_status === 'pending' && !member.isAdmin)
      ? `<span class="admin-member-pending-badge">${t('adminMembersEx.pendingBadge')}</span>`
      : '';

    // Two distinct statuses: Started (>=1 group) and Finished (everything incl. champion + top scorer)
    const { started, finished, needsKnockout } = _adminMemberProgress(member);
    // v2.9.8: amber flag so the admin instantly spots who must (re-)fill the knockout.
    const koFlag = needsKnockout ? `<span class="admin-member-ko-flag">${t('adminMembersEx.needsKnockout')}</span>` : '';

    // Quick action buttons for pending users
    let quickActions = '';
    if (member.approval_status === 'pending' && !member.isAdmin) {
      quickActions = `
        <div class="admin-member-quick-actions">
          <button class="admin-quick-btn approve" data-member-id="${member.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${t('adminMembersEx.approve')}</span>
          </button>
          <button class="admin-quick-btn reject" data-member-id="${member.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>${t('adminMembersEx.remove')}</span>
          </button>
        </div>
      `;
    } else if (!member.isAdmin) {
      quickActions = '<div class="admin-member-arrow">‹</div>';
    }

    card.innerHTML = `
      <div class="admin-member-avatar">${initial}</div>
      <div class="admin-member-info">
        <div class="admin-member-name">${adminBadge}${pendingBadge}${escapeHtml(member.nickname || t('membersList.fallbackUser'))}</div>
        <div class="admin-member-progress">
          <span class="admin-member-progress-dot ${started ? 'done' : ''}">
            ${started ? t('adminMembersEx.startedYes') : t('adminMembersEx.startedNo')}
          </span>
          <span class="admin-member-progress-dot ${finished ? 'done' : ''}">
            ${finished ? t('adminMembersEx.finishedYes') : t('adminMembersEx.finishedNo')}
          </span>
          ${koFlag}
        </div>
      </div>
      ${quickActions}
    `;
    
    // Click handlers
    if (!member.isAdmin) {
      // Quick action buttons
      const approveBtn = card.querySelector('.admin-quick-btn.approve');
      const rejectBtn = card.querySelector('.admin-quick-btn.reject');
      
      if (approveBtn) {
        approveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          quickApproveMember(member);
        });
      }
      
      if (rejectBtn) {
        rejectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          quickRejectMember(member);
        });
      }
      
      // Main card click - open detail modal
      card.addEventListener('click', () => openAdminActionModal(member));
    } else {
      card.style.cursor = 'default';
    }

    list.appendChild(card);

    // v2.10: post-lock, let the admin approve THIS member's 72h knockout re-entry
    // and copy a ready personal nudge. Appended as a full-width sibling so it
    // doesn't disturb the card's row layout. Server validates full eligibility.
    if (spIsLocked() && needsKnockout && !member.isAdmin) {
      const rec = document.createElement('div');
      rec.className = 'admin-member-reopen';
      rec.innerHTML = `<button type="button" class="amr-allow">${t('reopen.admin.allowBtn')}</button>`;
      rec.addEventListener('click', e => e.stopPropagation());
      const allowBtn = rec.querySelector('.amr-allow');
      allowBtn.addEventListener('click', async () => {
        allowBtn.disabled = true; allowBtn.textContent = '…';
        const res = await _adminApproveReopen(member.id);
        if (res && res.ok) {
          rec.innerHTML = `<div class="amr-ok">${t('reopen.admin.granted')}</div>` +
            `<button type="button" class="amr-copy">${t('reopen.admin.copyBtn', { name: member.nickname || '' })}</button>`;
          const cp = rec.querySelector('.amr-copy');
          cp.addEventListener('click', (ev) => { ev.stopPropagation(); _adminCopyReopenMsg(member.nickname); });
        } else {
          allowBtn.disabled = false; allowBtn.textContent = t('reopen.admin.allowBtn');
          showToast(t('reopen.admin.notEligible'), 'error');
        }
      });
      list.appendChild(rec);
    }
  });
}

// v2.10: admin approves a member's knockout re-entry (server validates admin-of-pool
// + full eligibility). Returns the RPC result {ok:...}.
async function _adminApproveReopen(targetUserId) {
  try {
    const code = _currentRecoveryCode();
    if (!code) { showToast(t('reopen.admin.noCode'), 'error'); return { ok: false }; }
    const { data, error } = await supabaseClient.rpc('approve_knockout_reopen', { p_code: code, p_target_user: targetUserId });
    return error ? { ok: false } : (data || { ok: false });
  } catch (_) { return { ok: false }; }
}

// Copy a ready, personalized re-entry reminder the admin can DM to that member.
function _adminCopyReopenMsg(name) {
  const msg = t('reopen.admin.personalMsg', { name: name || '' });
  try { navigator.clipboard.writeText(msg); showToast(t('reopen.admin.copied'), 'success'); }
  catch (_) { showToast(msg, 'info'); }
}

// Quick approve - one click
async function quickApproveMember(member) {
  try {
    // Preferred: server-side RPC (validates admin-of-pool, logs the audit row
    // server-side). Falls back to the legacy direct update + client log only
    // when the RPC isn't deployed.
    const code = _currentRecoveryCode();
    if (code) {
      const { error: rpcErr } = await supabaseClient.rpc('approve_member', { p_code: code, p_member_id: member.id });
      if (!rpcErr) {
        showToast(t('adminMembersEx.approvedToast', { name: member.nickname }), 'success');
        await loadAdminMembers();
        return;
      }
      if (!_rpcMissing(rpcErr)) { console.error('approve_member RPC error:', rpcErr); showToast(t('adminMembersEx.approveError'), 'error'); return; }
      // RPC absent -> fall through to the legacy direct write below.
    }

    const { error } = await supabaseClient
      .from('users')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: state.currentUser.id
      })
      .eq('id', member.id);

    if (error) throw error;

    // Log action
    await supabaseClient.from('admin_actions').insert({
      pool_id: state.currentPool.id,
      admin_id: state.currentUser.id,
      action_type: 'USER_APPROVED',
      target_user_id: member.id,
      details: { nickname: member.nickname }
    });

    showToast(t('adminMembersEx.approvedToast', { name: member.nickname }), 'success');

    // Reload
    await loadAdminMembers();

  } catch (err) {
    console.error('Approve error:', err);
    showToast(t('adminMembersEx.approveError'), 'error');
  }
}

// Quick reject - confirm + remove
async function quickRejectMember(member) {
  const confirmed = window.confirm(t('adminMembersEx.confirmRemoveAll', { name: member.nickname }));
  if (!confirmed) return;

  try {
    // Preferred: server-side remove_member RPC (purges picks + logs server-side).
    const code = _currentRecoveryCode();
    if (code) {
      const { error: rpcErr } = await supabaseClient.rpc('remove_member', { p_code: code, p_member_id: member.id });
      if (!rpcErr) {
        showToast(t('adminMembersEx.removedToast', { name: member.nickname }), 'success');
        await loadAdminMembers();
        return;
      }
      if (!_rpcMissing(rpcErr)) { console.error('remove_member RPC error:', rpcErr); showToast(t('adminMembersEx.removeError'), 'error'); return; }
      // RPC absent -> fall through to the legacy direct delete below.
    }

    const { error } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', member.id);

    if (error) throw error;

    // Log
    await supabaseClient.from('admin_actions').insert({
      pool_id: state.currentPool.id,
      admin_id: state.currentUser.id,
      action_type: 'USER_REJECTED',
      target_user_id: member.id,
      details: { nickname: member.nickname }
    });

    showToast(t('adminMembersEx.removedToast', { name: member.nickname }), 'success');

    await loadAdminMembers();

  } catch (err) {
    console.error('Reject error:', err);
    showToast(t('adminMembersEx.removeError'), 'error');
  }
}

function updatePoolLockCard() {
  const card = document.getElementById('pool-lock-card');
  const icon = document.getElementById('pool-lock-icon');
  const title = document.getElementById('pool-lock-title');
  const text = document.getElementById('pool-lock-text');
  const btn = document.getElementById('pool-lock-btn');
  
  const isLocked = adminState.poolData?.is_locked === true;
  
  if (isLocked) {
    card.classList.add('locked');
    icon.textContent = '🔒';
    title.textContent = t('adminMembersEx.lockedTitle');
    text.textContent = t('adminMembersEx.lockedText');
    btn.textContent = t('adminMembersEx.unlockBtn');
  } else {
    card.classList.remove('locked');
    icon.textContent = '🔓';
    title.textContent = t('adminMembersEx.openTitle');
    text.textContent = t('adminMembersEx.openText');
    btn.textContent = t('adminMembersEx.lockBtn');
  }

  // Pending banner title (dynamic count)
  const pendingTitleEl = document.getElementById('admin-pending-banner-title');
  if (pendingTitleEl) {
    const cnt = document.getElementById('admin-pending-count');
    const n = cnt ? cnt.textContent : '0';
    pendingTitleEl.innerHTML = t('adminMembersEx.pendingCount', { n });
  }
}

async function togglePoolLock() {
  if (!state.currentPool || !state.currentUser.is_admin) {
    showToast(t('adminMembersEx.notAdminAction'), 'error');
    return;
  }

  const isCurrentlyLocked = adminState.poolData?.is_locked === true;
  const newState = !isCurrentlyLocked;

  const actionKey = newState ? 'adminMembersEx.actionLock' : 'adminMembersEx.actionUnlock';
  const confirm = window.confirm(t('adminMembersEx.confirmAction', { action: t(actionKey) }));
  if (!confirm) return;

  const btn = document.getElementById('pool-lock-btn');
  btn.disabled = true;
  btn.textContent = t('common.processing');
  
  try {
    // Preferred: server-side set_pool_lock RPC (validates admin-of-pool, logs
    // server-side). Falls back to the legacy direct update + client log only when
    // the RPC isn't deployed.
    const code = _currentRecoveryCode();
    let done = false;
    if (code) {
      const { error: rpcErr } = await supabaseClient.rpc('set_pool_lock', { p_code: code, p_locked: newState });
      if (!rpcErr) {
        done = true;
      } else if (!_rpcMissing(rpcErr)) {
        console.error('set_pool_lock RPC error:', rpcErr);
        showToast(t('adminMembersEx.toggleError'), 'error');
        btn.disabled = false;
        updatePoolLockCard();
        return;
      }
      // RPC absent -> fall through to the legacy direct write below.
    }

    if (!done) {
      const { error } = await supabaseClient
        .from('pools')
        .update({
          is_locked: newState,
          locked_at: newState ? new Date().toISOString() : null,
          locked_by: newState ? state.currentUser.id : null
        })
        .eq('id', state.currentPool.id);

      if (error) throw error;

      // Log action
      await supabaseClient.from('admin_actions').insert({
        pool_id: state.currentPool.id,
        admin_id: state.currentUser.id,
        action_type: newState ? 'POOL_LOCKED' : 'POOL_UNLOCKED'
      });
    }

    adminState.poolData.is_locked = newState;
    updatePoolLockCard();

    showToast(newState ? t('adminMembersEx.poolLocked') : t('adminMembersEx.poolUnlocked'), 'success');

  } catch (err) {
    console.error('Toggle lock error:', err);
    showToast(t('adminMembersEx.toggleError'), 'error');
    btn.disabled = false;
    updatePoolLockCard();
  }
}

function openAdminActionModal(member) {
  adminState.selectedMember = member;
  
  const avatar = document.getElementById('admin-modal-avatar');
  const name = document.getElementById('admin-modal-name');
  const meta = document.getElementById('admin-modal-meta');
  
  const initial = member.nickname ? member.nickname.charAt(0).toUpperCase() : '?';
  avatar.textContent = initial;
  name.textContent = member.nickname || t('membersList.fallbackUser');

  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  const joinedDate = member.joined_at ? new Date(member.joined_at).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US') : '—';
  meta.textContent = t('adminMembersEx.memberJoinedMeta', { date: joinedDate, g: member.groupPicksCount, k: member.knockoutPicksCount });
  
  document.getElementById('admin-action-overlay').classList.add('active');
  document.getElementById('admin-action-modal').classList.add('active');
}

function closeAdminActionModal() {
  document.getElementById('admin-action-overlay').classList.remove('active');
  document.getElementById('admin-action-modal').classList.remove('active');
  adminState.selectedMember = null;
}

async function adminGenerateNewCode() {
  const member = adminState.selectedMember;
  if (!member) return;
  
  const confirm = window.confirm(t('adminMembersEx.confirmNewCode', { name: member.nickname }));
  if (!confirm) return;
  
  try {
    // Generate new recovery code (16 chars). The plaintext is generated + shown
    // client-side; only the new hash is set in the DB.
    const newCode = generateRecoveryCode();

    // Preferred: server-side admin_reset_member_code RPC (validates admin-of-pool,
    // hashes server-side, logs the audit row). Falls back to the legacy direct
    // hash update + client log only when the RPC isn't deployed.
    const code = _currentRecoveryCode();
    if (code) {
      const { error: rpcErr } = await supabaseClient.rpc('admin_reset_member_code', { p_code: code, p_member_id: member.id, p_new_code: newCode });
      if (!rpcErr) {
        closeAdminActionModal();
        showNewRecoveryCode(member.nickname, newCode);
        return;
      }
      if (!_rpcMissing(rpcErr)) { console.error('admin_reset_member_code RPC error:', rpcErr); showToast(t('adminMembersEx.newCodeError'), 'error'); return; }
      // RPC absent -> fall through to the legacy direct write below.
    }

    const newCodeHash = await hashRecoveryCode(newCode);

    // Update user
    const { error } = await supabaseClient
      .from('users')
      .update({ recovery_code_hash: newCodeHash })
      .eq('id', member.id);

    if (error) throw error;

    // Log action
    await supabaseClient.from('admin_actions').insert({
      pool_id: state.currentPool.id,
      admin_id: state.currentUser.id,
      action_type: 'RECOVERY_CODE_RESET',
      target_user_id: member.id
    });

    // Show the new code
    closeAdminActionModal();
    showNewRecoveryCode(member.nickname, newCode);
    
  } catch (err) {
    console.error('Generate code error:', err);
    showToast(t('adminMembersEx.newCodeError'), 'error');
  }
}

// v2.5.36: opens the admin-share-code modal instead of a plain alert.
// Modal lets the admin push the code to the user via WhatsApp/Telegram
// with a prefilled message, or copy a direct /?recovery=… link.
function showNewRecoveryCode(userName, code) {
  adminShareCodeState.code = code;
  adminShareCodeState.userName = userName;
  adminShareCodeState.poolName = (state.currentPool && state.currentPool.name) || '';
  adminShareCodeState.link = `${window.location.origin}/?recovery=${encodeURIComponent(code)}`;

  const subtitleEl = document.getElementById('admin-share-code-subtitle');
  if (subtitleEl) subtitleEl.textContent = t('adminShareCode.subtitle', { name: userName });
  const codeEl = document.getElementById('admin-share-code-value');
  if (codeEl) codeEl.textContent = code;
  const linkEl = document.getElementById('admin-share-code-link');
  if (linkEl) linkEl.textContent = adminShareCodeState.link;

  document.getElementById('admin-share-code-overlay').classList.add('active');
  document.getElementById('admin-share-code-modal').classList.add('active');
}

const adminShareCodeState = { code: '', userName: '', poolName: '', link: '' };

function closeAdminShareCodeModal() {
  document.getElementById('admin-share-code-overlay').classList.remove('active');
  document.getElementById('admin-share-code-modal').classList.remove('active');
}
window.closeAdminShareCodeModal = closeAdminShareCodeModal;

function _adminShareCodeMessage() {
  return t('adminShareCode.message', {
    name: adminShareCodeState.userName,
    pool: adminShareCodeState.poolName,
    code: adminShareCodeState.code,
    link: adminShareCodeState.link
  });
}

function adminShareCodeWhatsApp() {
  const text = encodeURIComponent(_adminShareCodeMessage());
  window.open(`https://wa.me/?text=${text}`, '_blank');
}
window.adminShareCodeWhatsApp = adminShareCodeWhatsApp;

function adminShareCodeTelegram() {
  const url = encodeURIComponent(adminShareCodeState.link);
  const text = encodeURIComponent(_adminShareCodeMessage());
  window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
}
window.adminShareCodeTelegram = adminShareCodeTelegram;

function adminCopyCodeLink() {
  const link = adminShareCodeState.link;
  if (!link) return;
  const ok = (text) => {
    showToast(t('adminShareCode.linkCopied'), 'success');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => ok(link)).catch(() => ok(link));
  } else {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = link;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    ok(link);
  }
}
window.adminCopyCodeLink = adminCopyCodeLink;

function adminConfirmRemove() {
  const member = adminState.selectedMember;
  if (!member) return;

  const confirm = window.confirm(t('adminMembersEx.confirmDeleteFull', {
    name: member.nickname,
    g: member.groupPicksCount,
    k: member.knockoutPicksCount
  }));
  if (!confirm) return;

  // Double confirm for safety
  const doubleConfirm = window.confirm(t('adminMembersEx.finalConfirm', { name: member.nickname }));
  if (!doubleConfirm) return;

  adminPerformRemove(member);
}

async function adminPerformRemove(member) {
  try {
    // Preferred: server-side remove_member RPC (purges picks + logs server-side).
    const code = _currentRecoveryCode();
    if (code) {
      const { error: rpcErr } = await supabaseClient.rpc('remove_member', { p_code: code, p_member_id: member.id });
      if (!rpcErr) {
        closeAdminActionModal();
        showToast(t('adminMembersEx.finalRemovedToast', { name: member.nickname }), 'success');
        await loadAdminMembers();
        return;
      }
      if (!_rpcMissing(rpcErr)) { console.error('remove_member RPC error:', rpcErr); showToast(t('adminMembersEx.finalRemoveError'), 'error'); return; }
      // RPC absent -> fall through to the legacy direct delete below.
    }

    // Delete user (cascade should delete picks)
    const { error } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', member.id);

    if (error) throw error;

    // Log action
    await supabaseClient.from('admin_actions').insert({
      pool_id: state.currentPool.id,
      admin_id: state.currentUser.id,
      action_type: 'USER_REMOVED',
      target_user_id: member.id,
      details: { display_name: member.nickname }
    });

    closeAdminActionModal();
    showToast(t('adminMembersEx.finalRemovedToast', { name: member.nickname }), 'success');

    // Reload list
    await loadAdminMembers();

  } catch (err) {
    console.error('Remove user error:', err);
    showToast(t('adminMembersEx.finalRemoveError'), 'error');
  }
}

// Helper - escape HTML
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showApprovals() {
  // v2.5.29: stripped placeholder "Processing..." toast - unimplemented stub
  closeMenu();
}

// ============================================================
// TOP SCORER PREDICTION
// ============================================================

const topScorerState = {
  allPlayers: [],
  filteredPlayers: [],
  currentPick: null,  // The player selected
  searchTimeout: null,
  showAll: false  // false = show only stars, true = show all
};

// v2.4.1: localStorage key for caching the squads_released flag so we can
// show the right initial view BEFORE the app_settings round-trip finishes.
// Without this cache the screen flashes locked->unlocked on every entry.
const TS_RELEASED_CACHE_KEY = 'fb_squads_released';

async function showTopScorer() {
  closeMenu();

  if (!state.currentUser || !state.currentPool) {
    showToast(t('errors.reconnect'), 'error');
    return;
  }

  if (!supabaseClient) {
    showToast(t('errors.serverConnectingShort'), 'error');
    return;
  }

  // v2.3: hide SP-flow nav unless explicitly entered via spStartTopScorerStep
  const tsNav = document.getElementById('ts-sp-flow-nav');
  if (tsNav && !state.spInFlow) tsNav.style.display = 'none';

  // v2.4.1: pre-select the correct view from cache so there's no flash on
  // desktop while we wait for the app_settings query. The cache is refreshed
  // every time the query returns; it is conservative (defaults to "locked"
  // when unknown). If we already have players loaded in-memory we know
  // squads were released - prefer that signal.
  const lockedView = document.getElementById('ts-locked-view');
  const unlockedView = document.getElementById('ts-unlocked-view');
  let initialUnlocked = false;
  try {
    initialUnlocked = (
      localStorage.getItem(TS_RELEASED_CACHE_KEY) === 'true' ||
      (topScorerState && topScorerState.allPlayers && topScorerState.allPlayers.length > 0)
    );
  } catch (e) { /* localStorage disabled - fall through */ }
  if (lockedView) lockedView.style.display = initialUnlocked ? 'none' : 'block';
  if (unlockedView) unlockedView.style.display = initialUnlocked ? 'block' : 'none';

  showScreen('top-scorer-screen');

  // Check if feature is unlocked (fresh state from server)
  const { data: settings } = await supabaseClient
    .from('app_settings')
    .select('*')
    .in('key', ['squads_released', 'squads_player_count', 'squads_last_check']);

  const settingsMap = {};
  (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

  const isUnlocked = settingsMap.squads_released === 'true';
  const playerCount = parseInt(settingsMap.squads_player_count) || 0;

  // Refresh the cache (next entry will skip the flash entirely)
  try { localStorage.setItem(TS_RELEASED_CACHE_KEY, isUnlocked ? 'true' : 'false'); } catch (e) {}

  if (!isUnlocked) {
    if (lockedView) lockedView.style.display = 'block';
    if (unlockedView) unlockedView.style.display = 'none';
    updateLockedView(settingsMap);
    return;
  }

  if (lockedView) lockedView.style.display = 'none';
  if (unlockedView) unlockedView.style.display = 'block';

  // v2.4.5: hero description uses the pool's actual top_scorer scoring
  // rule, not a hardcoded number. Falls back to the default (10) if the rule
  // is missing (e.g. legacy pools that predate scoring_rules).
  const tsBonus = (state.currentPool && state.currentPool.scoring_rules &&
                   state.currentPool.scoring_rules.top_scorer) || 10;
  const heroDescEl = document.querySelector('#ts-unlocked-view .ts-hero-desc');
  if (heroDescEl) {
    heroDescEl.innerHTML = t('tsUnlocked.heroDesc', { n: tsBonus });
  }

  // Load players if not loaded
  if (topScorerState.allPlayers.length === 0) {
    await loadAllPlayers();
  }

  // Load existing pick
  await loadMyTopScorerPick();

  // Render
  renderTopScorerList();
}

function updateLockedView(settings) {
  const lastCheck = settings.squads_last_check;
  if (lastCheck) {
    const date = new Date(lastCheck);
    const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
    const formatted = date.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    const el = document.getElementById('ts-last-check');
    if (el) el.textContent = t('tsLocked.lastCheck', { time: formatted });
  }
  
  // Calculate days until tournament
  const tournamentStart = new Date('2026-06-11');
  const now = new Date();
  const daysUntil = Math.max(0, Math.ceil((tournamentStart - now) / (1000 * 60 * 60 * 24)));
  
  const countdownEl = document.getElementById('ts-countdown');
  if (countdownEl) {
    countdownEl.textContent = daysUntil;
  }
}

async function loadAllPlayers() {
  try {
    // Use range to fetch all players (Supabase default limit is 1000)
    const { data: players, error } = await supabaseClient
      .from('players')
      .select('*')
      .range(0, 9999);  // Get up to 10,000 players
    
    if (error) {
      console.error('Players load error:', error);
      showToast(t('tsLocked.loadingPlayers'), 'error');
      return;
    }
    
    // Smart sort - rank by likelihood of being top scorer
    const sorted = (players || []).slice().sort((a, b) => {
      const scoreA = calculateScorerRank(a);
      const scoreB = calculateScorerRank(b);
      
      if (scoreA !== scoreB) return scoreB - scoreA;
      
      const nameA = (a.name_he || a.name_en || '').toLowerCase();
      const nameB = (b.name_he || b.name_en || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    topScorerState.allPlayers = sorted;
    topScorerState.filteredPlayers = sorted;
    
    console.log(`✅ Loaded ${sorted.length} players`);
    
  } catch (err) {
    console.error('Load players error:', err);
    showToast(t('errors.unexpected'), 'error');
  }
}

// ============================================================
// Smart ranking algorithm for top scorer candidates
// ============================================================

const FAVORITE_TEAMS_FOR_RANK = new Set([
  'ARG', 'BRA', 'FRA', 'ENG', 'ESP', 'POR', 'GER', 'NED'
]);

const CONTENDER_TEAMS_FOR_RANK = new Set([
  'BEL', 'CRO', 'URU', 'COL', 'MAR', 'SUI', 'USA', 'MEX',
  'JPN', 'KOR', 'SEN', 'IRN', 'ECU'
]);

const STRIKER_POSITIONS = new Set([
  'Centre-Forward', 'Offence', 'FORWARD', 'ATTACK'
]);

const WINGER_POSITIONS = new Set([
  'Left Winger', 'Right Winger'
]);

const ATTACKING_MID_POSITIONS = new Set([
  'Attacking Midfield'
]);

const MIDFIELDER_POSITIONS = new Set([
  'Midfield', 'Centre-Midfield', 'MIDFIELDER', 'MID'
]);

const DEFENSIVE_POSITIONS = new Set([
  'Goalkeeper', 'Centre-Back', 'Left-Back', 'Right-Back', 
  'Defensive Midfield', 'Defence', 'DEFENDER', 'GOALKEEPER'
]);

function calculateScorerRank(player) {
  let score = 0;
  
  // Filter out defenders/goalkeepers entirely
  if (player.position && DEFENSIVE_POSITIONS.has(player.position)) {
    return -100;  // Always last
  }
  
  // 1. Actual goals scored (most important DURING tournament)
  // Worth a LOT - 1 goal in tournament beats any pre-tournament prediction
  const goals = player.goals_so_far || 0;
  score += goals * 1000;
  
  // 2. POSITION is the primary factor before tournament
  // Strikers score 70% of goals, then wingers, then attacking mids
  if (player.position) {
    if (STRIKER_POSITIONS.has(player.position)) {
      score += 100;  // Strikers - top tier
    } else if (WINGER_POSITIONS.has(player.position)) {
      score += 60;   // Wingers - second tier
    } else if (ATTACKING_MID_POSITIONS.has(player.position)) {
      score += 40;   // Attacking mids - third tier
    } else if (MIDFIELDER_POSITIONS.has(player.position)) {
      score += 10;   // Regular mids - low chance
    }
  }
  
  // 3. Team strength multiplier
  // Top scorer always comes from a strong team (more games, more chances)
  if (FAVORITE_TEAMS_FOR_RANK.has(player.team_code)) {
    score += 50;   // Strong boost for top 8 teams
  } else if (CONTENDER_TEAMS_FOR_RANK.has(player.team_code)) {
    score += 20;
  }
  
  // 4. Marked as star (manual override for known names)
  if (player.is_star) {
    score += 25;
  }
  
  return score;
}

async function loadMyTopScorerPick() {
  try {
    const { data, error } = await supabaseClient
      .from('top_scorer_picks')
      .select('*, players(*)')
      .eq('user_id', state.currentUser.id)
      .maybeSingle();
    
    if (error) {
      // If table doesn't have the foreign key, fallback
      console.warn('Top scorer load fallback:', error);
      const { data: simpleData } = await supabaseClient
        .from('top_scorer_picks')
        .select('*')
        .eq('user_id', state.currentUser.id)
        .maybeSingle();
      
      if (simpleData?.player_id) {
        // Manually fetch the player
        const { data: player } = await supabaseClient
          .from('players')
          .select('*')
          .eq('id', simpleData.player_id)
          .maybeSingle();
        
        if (player) {
          topScorerState.currentPick = player;
        }
      }
    } else if (data) {
      topScorerState.currentPick = data.players || data;
    }
    
    updateCurrentPickDisplay();
    
  } catch (err) {
    console.error('Load my top scorer pick error:', err);
  }
}

function updateCurrentPickDisplay() {
  const currentPickEl = document.getElementById('ts-current-pick');
  if (!currentPickEl) return;
  
  if (!topScorerState.currentPick) {
    currentPickEl.style.display = 'none';
    return;
  }
  
  const pick = topScorerState.currentPick;
  
  currentPickEl.style.display = 'block';
  document.getElementById('ts-current-flag').innerHTML = getCountryFlag(pick.team_code); // returns an <img> now
  document.getElementById('ts-current-name').textContent = pick.name_he;
  document.getElementById('ts-current-club').textContent = `${getTeamName(pick.team_code)} · ${pick.club || ''}`.replace(/ · $/, '');
}

function onTopScorerSearch(query) {
  clearTimeout(topScorerState.searchTimeout);
  
  // Show/hide clear button
  const clearBtn = document.getElementById('ts-search-clear');
  if (clearBtn) {
    clearBtn.style.display = query ? 'flex' : 'none';
  }
  
  // Show/hide UI elements based on search state
  const hints = document.getElementById('ts-search-hints');
  const list = document.getElementById('ts-players-list');
  const noResults = document.getElementById('ts-no-results');
  
  if (!query || !query.trim()) {
    // No search - show hints, hide results
    if (hints) hints.style.display = 'block';
    if (list) list.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    return;
  }
  
  // Searching - hide hints
  if (hints) hints.style.display = 'none';
  
  // Debounce the search - search directly in DB
  topScorerState.searchTimeout = setTimeout(() => {
    performTopScorerSearch(query.trim());
  }, 250);
}

function setSearchValue(value) {
  const input = document.getElementById('ts-search-input');
  if (input) {
    input.value = value;
    onTopScorerSearch(value);
  }
}

// v2.4.3: clicking a player hint chip ("Messi", "Kane", ...) used to
// only pre-fill the search and ask the user to click the result. That
// was an extra step for what is essentially an explicit pick. This
// helper searches and, if it finds a clean match, selects that player
// directly so the UI flips to "your pick: X" without a middle step.
async function pickTopScorerByName(name) {
  const input = document.getElementById('ts-search-input');
  if (input) input.value = name;

  await performTopScorerSearch(name);

  const results = topScorerState.filteredPlayers || [];
  if (results.length === 0) {
    // Nothing matched - just render the empty/no-results state.
    renderTopScorerList();
    return;
  }

  // Prefer an exact match on the English or Hebrew display name; otherwise
  // take the top sorted result (performTopScorerSearch already puts the
  // most relevant entry first).
  const lower = name.toLowerCase();
  const exact = results.find(p =>
    (p.name_en && p.name_en.toLowerCase() === lower) ||
    (p.name_he && p.name_he.toLowerCase() === lower)
  );
  await selectTopScorer(exact || results[0]);
}
window.pickTopScorerByName = pickTopScorerByName;

async function performTopScorerSearch(query) {
  if (!query) {
    topScorerState.filteredPlayers = [];
    renderTopScorerList();
    return;
  }
  
  console.log(`🔍 Searching DB for "${query}"`);
  
  try {
    // Search directly in DB with ILIKE - bypasses all limits.
    // Strip PostgREST filter delimiters so a crafted query can't break out of
    // the ilike value and inject extra .or() conditions (filter injection).
    const lowerQuery = query.toLowerCase();
    const q = String(query).replace(/[(),\\]/g, '').trim();
    if (!q) { topScorerState.filteredPlayers = []; renderTopScorerList(); return; }

    const { data, error } = await supabaseClient
      .from('players')
      .select('*')
      .or(`name_en.ilike.%${q}%,name_he.ilike.%${q}%,team_code.ilike.%${q}%`)
      .limit(50);
    
    if (error) {
      console.error('Search error:', error);
      topScorerState.filteredPlayers = [];
      renderTopScorerList();
      return;
    }
    
    console.log(`   Found ${data?.length || 0} matches in DB`);
    
    const results = data || [];
    
    // Sort: exact starts-with first
    results.sort((a, b) => {
      const aEn = (a.name_en || '').toLowerCase();
      const bEn = (b.name_en || '').toLowerCase();
      const aHe = (a.name_he || '').toLowerCase();
      const bHe = (b.name_he || '').toLowerCase();
      
      const aStarts = aEn.startsWith(lowerQuery) || aHe.startsWith(lowerQuery);
      const bStarts = bEn.startsWith(lowerQuery) || bHe.startsWith(lowerQuery);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      // Stars first
      if (a.is_star && !b.is_star) return -1;
      if (!a.is_star && b.is_star) return 1;
      
      return aEn.localeCompare(bEn);
    });
    
    topScorerState.filteredPlayers = results;
    renderTopScorerList();
    
  } catch (err) {
    console.error('Search exception:', err);
    topScorerState.filteredPlayers = [];
    renderTopScorerList();
  }
}

function updateSectionTitle(mode, query = '') {
  const title = document.getElementById('ts-section-title');
  if (!title) return;
  
  if (mode === 'search') {
    title.innerHTML = `
      <span>🔍</span>
      <span>${t('tsUnlocked.searchResults', { q: escapeHtml(query) })}</span>
    `;
  } else {
    // Check if tournament has started (anyone scored?)
    const hasGoals = topScorerState.allPlayers.some(p => (p.goals_so_far || 0) > 0);

    if (hasGoals) {
      title.innerHTML = `
        <span>🏆</span>
        <span>${t('tsUnlocked.currentLeaders')}</span>
      `;
    } else {
      title.innerHTML = `
        <span>⚽</span>
        <span>${t('tsUnlocked.forwardsWings')}</span>
      `;
    }
  }
}

function renderTopScorerList() {
  const list = document.getElementById('ts-players-list');
  const noResults = document.getElementById('ts-no-results');
  const hints = document.getElementById('ts-search-hints');
  if (!list) return;
  
  // Check if we're searching
  const searchInput = document.getElementById('ts-search-input');
  const hasQuery = searchInput && searchInput.value.trim();
  
  // No search? Show hints, hide list
  if (!hasQuery) {
    if (hints) hints.style.display = 'block';
    list.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    return;
  }
  
  // Searching - hide hints
  if (hints) hints.style.display = 'none';
  
  // No results found
  if (topScorerState.filteredPlayers.length === 0) {
    list.style.display = 'none';
    if (noResults) noResults.style.display = 'block';
    return;
  }
  
  // Show results
  if (noResults) noResults.style.display = 'none';
  list.style.display = 'flex';
  list.innerHTML = '';
  
  // Show up to 50 results
  const playersToShow = topScorerState.filteredPlayers.slice(0, 50);
  
  playersToShow.forEach(player => {
    const card = createPlayerCard(player, searchInput.value.trim());
    list.appendChild(card);
  });
  
  // Show "showing X of Y" if more results
  if (topScorerState.filteredPlayers.length > playersToShow.length) {
    const moreInfo = document.createElement('div');
    moreInfo.className = 'ts-results-count';
    moreInfo.textContent = t('tsUnlocked.showing', { n: playersToShow.length, total: topScorerState.filteredPlayers.length });
    list.appendChild(moreInfo);
  }
}

function toggleShowAllPlayers() {
  topScorerState.showAll = !topScorerState.showAll;
  
  // Update section title
  const title = document.getElementById('ts-section-title');
  if (title && !topScorerState.showAll) {
    // Check if tournament has started
    const hasGoals = topScorerState.allPlayers.some(p => (p.goals_so_far || 0) > 0);
    if (hasGoals) {
      title.innerHTML = `
        <span>🏆</span>
        <span>${t('tsUnlocked.currentLeaders')}</span>
      `;
    } else {
      title.innerHTML = `
        <span>⚽</span>
        <span>${t('tsUnlocked.forwardsWings')}</span>
      `;
    }
  } else if (title && topScorerState.showAll) {
    title.innerHTML = `
      <span>👥</span>
      <span>${t('tsUnlocked.allPlayers')}</span>
    `;
  }
  
  renderTopScorerList();
  
  // Scroll to top of list smoothly
  if (topScorerState.showAll) {
    setTimeout(() => {
      const expandBtn = document.querySelector('.ts-expand-btn');
      if (expandBtn) {
        expandBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }
}

function createPlayerCard(player, searchQuery = '') {
  const card = document.createElement('div');
  card.className = 'ts-player-card';
  if (player.is_star) card.classList.add('star');
  if (topScorerState.currentPick?.id === player.id) {
    card.classList.add('selected');
  }
  
  const flag = getCountryFlag(player.team_code);
  const teamName = getTeamName(player.team_code);
  const goals = player.goals_so_far || 0;
  
  // Highlight matching text
  let displayName = player.name_he || player.name_en || t('tsUnlocked.fallbackPlayer');
  if (searchQuery) {
    displayName = highlightMatch(displayName, searchQuery);
  }

  // Build badges
  let badges = '';
  if (goals > 0) {
    // Goal-scorer badge (highest priority)
    badges = `<span class="ts-player-goals-badge">⚽ ${goals}</span>`;
  } else if (player.is_star) {
    badges = `<span class="ts-player-star-badge">${t('tsUnlocked.starBadge')}</span>`;
  }
  
  const positionBadge = player.position ? `<span class="ts-player-position">${player.position}</span>` : '';

  card.innerHTML = `
    <span class="ts-player-flag">${flag}</span>
    <div class="ts-player-info">
      <div class="ts-player-name">${badges}${displayName}</div>
      <div class="ts-player-meta">
        ${positionBadge}
        <span>${teamName}</span>
        ${player.club ? `<span>· ${escapeHtml(player.club)}</span>` : ''}
      </div>
    </div>
    <div class="ts-player-action">
      ${topScorerState.currentPick?.id === player.id 
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '‹'
      }
    </div>
  `;
  
  card.addEventListener('click', () => selectTopScorer(player));
  
  return card;
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  
  const escapedText = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  
  return escapedText.replace(regex, '<span class="ts-highlight">$1</span>');
}

let _spTsSaveChain = Promise.resolve();
async function selectTopScorer(player) {
  if (!state.currentUser || !state.currentPool) return;
  
  // Confirm if changing
  if (topScorerState.currentPick && topScorerState.currentPick.id !== player.id) {
    const confirmed = window.confirm(t('tsUnlocked.confirmChange', {
      from: topScorerState.currentPick.name_he || topScorerState.currentPick.name_en,
      to: player.name_he || player.name_en
    }));
    if (!confirmed) return;
  }

  // v2.9.17/18: serialize saves on a chain so rapid A→B taps persist IN ORDER —
  // the DB deterministically ends on the LAST tap (B), never an out-of-order A.
  // savingPromise points at this (latest) save so spTopScorerNext awaits it before
  // opening the summary. Resolved in finally below.
  const _prevSave = _spTsSaveChain;
  let _resolveSave;
  _spTsSaveChain = new Promise(r => { _resolveSave = r; });
  topScorerState.savingPromise = _spTsSaveChain;
  topScorerState.isSaving = true;
  try {
  try { await _prevSave; } catch (_) {}  // wait for any in-flight save to land first
  const playerName = player.name_he || player.name_en || t('tsUnlocked.fallbackPlayer');
  // Preferred: server-side RPC; legacy direct write only if the RPC is absent.
  const rcode = _currentRecoveryCode();
  if (rcode) {
    const { error: rpcErr } = await supabaseClient.rpc('save_top_scorer', {
      p_code: rcode, p_player_id: String(player.id), p_player_name: playerName, p_team_code: player.team_code || ''
    });
    if (!rpcErr) {
      topScorerState.currentPick = player;
      updateCurrentPickDisplay();
      renderTopScorerList();
      const si = document.getElementById('ts-search-input');
      if (si && si.value) { si.value = ''; onTopScorerSearch(''); }
      return;
    }
    if (!_rpcMissing(rpcErr)) {
      console.error('Save top scorer RPC error:', rpcErr);
      showToast(t('tsUnlocked.saveError', { msg: rpcErr.message || '' }), 'error');
      return;
    }
    // RPC absent -> fall through to the legacy direct write below.
  }

  try {
    // Strategy: delete existing + insert new (more reliable than upsert)
    await supabaseClient
      .from('top_scorer_picks')
      .delete()
      .eq('user_id', state.currentUser.id)
      .eq('pool_id', state.currentPool.id);

    // Insert new pick - include all required fields
    const { error } = await supabaseClient
      .from('top_scorer_picks')
      .insert({
        user_id: state.currentUser.id,
        pool_id: state.currentPool.id,
        player_id: player.id,
        player_name: playerName,
        team_code: player.team_code || ''
      });

    if (error) {
      console.error('Save top scorer error:', error);
      showToast(t('tsUnlocked.saveError', { msg: error.message || '' }), 'error');
      return;
    }

    topScorerState.currentPick = player;
    updateCurrentPickDisplay();
    renderTopScorerList();

    // v2.5.44: removed the "✓ You picked X" toast - the "current pick"
    // panel at the top already reflects the new selection, so the toast
    // was just visual noise that obscured the underlying screen state.

    // Clear search
    const searchInput = document.getElementById('ts-search-input');
    if (searchInput && searchInput.value) {
      searchInput.value = '';
      onTopScorerSearch('');
    }

  } catch (err) {
    console.error('Select top scorer error:', err);
    showToast(t('errors.unexpectedMsg', { msg: err.message || '' }), 'error');
  }
  } finally {
    topScorerState.isSaving = false;
    if (_resolveSave) _resolveSave();
  }
}

async function clearTopScorerPick() {
  if (!topScorerState.currentPick) return;

  const confirmed = window.confirm(t('tsUnlocked.confirmClear'));
  if (!confirmed) return;

  // Preferred: server-side RPC (empty player_id => deletes the caller's pick).
  const rcode = _currentRecoveryCode();
  if (rcode) {
    const { error: rpcErr } = await supabaseClient.rpc('save_top_scorer', {
      p_code: rcode, p_player_id: '', p_player_name: '', p_team_code: ''
    });
    if (!rpcErr) {
      topScorerState.currentPick = null;
      updateCurrentPickDisplay();
      renderTopScorerList();
      showToast(t('tsUnlocked.clearedToast'), 'info');
      return;
    }
    if (!_rpcMissing(rpcErr)) { console.error('Clear top scorer RPC error:', rpcErr); showToast(t('tsUnlocked.clearError'), 'error'); return; }
    // RPC absent -> fall through to the legacy direct delete below.
  }

  try {
    // v2.9.16: scope this destructive delete to the current pool. With the
    // confirmed 1-pool-per-user model this is belt-and-suspenders (a user_id
    // only ever has rows in one pool), but a delete should never be broader
    // than necessary and the save-path delete above is already pool-scoped.
    let _del = supabaseClient.from('top_scorer_picks').delete().eq('user_id', state.currentUser.id);
    if (state.currentPool && state.currentPool.id) _del = _del.eq('pool_id', state.currentPool.id);
    const { error } = await _del;

    if (error) {
      console.error('Clear top scorer error:', error);
      showToast(t('tsUnlocked.clearError'), 'error');
      return;
    }

    topScorerState.currentPick = null;
    updateCurrentPickDisplay();
    renderTopScorerList();

    showToast(t('tsUnlocked.clearedToast'), 'info');
    
  } catch (err) {
    console.error('Clear top scorer error:', err);
  }
}

function clearTopScorerSearch() {
  const input = document.getElementById('ts-search-input');
  if (input) {
    input.value = '';
    onTopScorerSearch('');
  }
}

// ============================================================
// POOL SETTINGS - Full settings screen
// ============================================================

// In-memory copy of settings being edited
let editingSettings = null;

async function showPoolSettings() {
  closeMenu();
  
  if (!state.currentPool) {
    showToast(t('poolSettings.notFound'), 'error');
    return;
  }

  // Re-fetch latest pool data
  const { data: pool, error } = await supabaseClient
    .from('pools')
    .select('*')
    .eq('id', state.currentPool.id)
    .single();

  if (error || !pool) {
    showToast(t('poolSettings.loadError'), 'error');
    return;
  }
  
  state.currentPool = pool;
  
  // Count members
  const { count: memberCount } = await supabaseClient
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', pool.id);
  
  // Save initial settings for comparison
  editingSettings = { ...pool };
  
  // Populate the form
  document.getElementById('settings-pool-name').value = pool.name;
  document.getElementById('settings-pool-code').textContent = pool.code;
  document.getElementById('settings-member-count').textContent = memberCount || 1;
  
  // Game format
  setToggleValue('num_stages', pool.num_stages.toString());
  setToggleValue('group_pick_type', pool.group_pick_type);
  
  // Multipliers
  document.getElementById('settings-use-multipliers').checked = pool.use_multipliers;
  // v2.5.4: hide multipliers entirely for single_phase pools (concept doesn't apply)
  const multSection = document.getElementById('settings-multipliers-section');
  if (multSection) multSection.style.display = (pool.betting_mode === 'single_phase') ? 'none' : '';
  // v2.5.40: paint the three category multiplier values from the pool's
  // scoring_rules instead of the hardcoded ×1 / ×1.5 / ×2 markup.
  _fbRenderPoolMultipliersDetail(pool);

  // v2.5.7: gate v2 vs legacy sections based on betting_mode
  const isV2 = pool.betting_mode === 'single_phase';
  const v2ModeSection = document.getElementById('settings-v2-mode-section');
  const v2ScoringSection = document.getElementById('settings-v2-scoring-section');
  const legacyFormat = document.getElementById('settings-legacy-format-section');
  const legacyScoring = document.getElementById('settings-legacy-scoring-section');
  const legacyTopScorer = document.getElementById('settings-legacy-topscorer-section');
  if (v2ModeSection)   v2ModeSection.style.display   = isV2 ? '' : 'none';
  if (v2ScoringSection) v2ScoringSection.style.display = isV2 ? '' : 'none';
  if (legacyFormat)    legacyFormat.style.display    = isV2 ? 'none' : '';
  if (legacyScoring)   legacyScoring.style.display   = isV2 ? 'none' : '';
  if (legacyTopScorer) legacyTopScorer.style.display = isV2 ? 'none' : '';

  if (isV2) {
    // Mode label
    const modeEl = document.getElementById('settings-betting-mode-value');
    if (modeEl) modeEl.textContent = t('wizard.step1.singlePhase.title');
    // Render scoring rules from JSONB into the v2 list
    _renderV2ScoringList(pool);
  }
  
  // Scoring
  document.getElementById('score-group-stage').textContent = pool.scoring_group_stage;
  document.getElementById('score-r32').textContent = pool.scoring_r32;
  document.getElementById('score-r16').textContent = pool.scoring_r16;
  document.getElementById('score-qf').textContent = pool.scoring_qf;
  document.getElementById('score-sf').textContent = pool.scoring_sf;
  document.getElementById('score-final').textContent = pool.scoring_final;
  
  // Top scorer
  document.getElementById('settings-top-scorer').checked = pool.top_scorer_enabled;
  setTopScorerBonus(pool.top_scorer_bonus, false);
  
  // Participants
  const hasLimit = pool.max_participants !== null;
  document.getElementById('settings-limit-members').checked = hasLimit;
  document.getElementById('limit-members-detail').style.display = hasLimit ? 'flex' : 'none';
  if (hasLimit) {
    document.getElementById('settings-max-members').value = pool.max_participants;
  }
  
  // v2.5.16: "approve users before betting" toggle removed entirely.

  // Lock controls if rules are locked or member count > 1
  const isLocked = pool.rules_locked || (memberCount && memberCount > 1);
  applyLockState(isLocked);
  
  // Setup toggle button listeners
  setupToggleListeners();
  
  // Limit members toggle
  document.getElementById('settings-limit-members').onchange = function() {
    document.getElementById('limit-members-detail').style.display = this.checked ? 'flex' : 'none';
  };
  
  showScreen('pool-settings-screen');
}

function applyLockState(isLocked) {
  const banner = document.getElementById('settings-lock-banner');
  banner.style.display = isLocked ? 'flex' : 'none';
  
  // Disable all interactive elements (except delete pool)
  const inputs = document.querySelectorAll('#pool-settings-screen input:not(#settings-pool-name), #pool-settings-screen .toggle-option, #pool-settings-screen .score-btn, #pool-settings-screen .bonus-btn, #pool-settings-screen #save-settings-main-btn, #pool-settings-screen #save-settings-btn');
  inputs.forEach(el => {
    if (isLocked) {
      el.setAttribute('disabled', 'disabled');
    } else {
      el.removeAttribute('disabled');
    }
  });
  
  // Pool name input - allow editing even when locked
  document.getElementById('settings-pool-name').removeAttribute('disabled');
  
  // Reset scoring button
  const resetBtn = document.querySelector('.btn-reset-scoring');
  if (resetBtn) {
    if (isLocked) resetBtn.setAttribute('disabled', 'disabled');
    else resetBtn.removeAttribute('disabled');
  }
}

function setupToggleListeners() {
  document.querySelectorAll('.settings-toggle-group').forEach(group => {
    const settingName = group.dataset.setting;
    group.querySelectorAll('.toggle-option').forEach(btn => {
      btn.onclick = function() {
        if (this.disabled) return;
        group.querySelectorAll('.toggle-option').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      };
    });
  });
}

function setToggleValue(settingName, value) {
  const group = document.querySelector(`.settings-toggle-group[data-setting="${settingName}"]`);
  if (!group) return;
  const opts = group.querySelectorAll('.toggle-option');
  let matched = false;
  opts.forEach(btn => {
    const on = btn.dataset.value === value;
    btn.classList.toggle('active', on);
    if (on) matched = true;
  });
  // Deprecated values (e.g. legacy 6-stage / full_ranking pools) no longer have
  // a button — keep the first (only) remaining option selected instead of blank.
  if (!matched && opts.length) opts[0].classList.add('active');
}

function getToggleValue(settingName) {
  const active = document.querySelector(`.settings-toggle-group[data-setting="${settingName}"] .toggle-option.active`);
  return active ? active.dataset.value : null;
}

function adjustScore(stage, delta) {
  const el = document.getElementById('score-' + stage.replace(/_/g, '-'));
  if (!el) return;
  let current = parseInt(el.textContent) || 0;
  current = Math.max(0, Math.min(99, current + delta));
  el.textContent = current;
}

function resetScoringToGolazo() {
  document.getElementById('score-group-stage').textContent = 1;
  document.getElementById('score-r32').textContent = 1;
  document.getElementById('score-r16').textContent = 2;
  document.getElementById('score-qf').textContent = 3;
  document.getElementById('score-sf').textContent = 4;
  document.getElementById('score-final').textContent = 8;
  showToast(t('poolSettings.resetToast'), 'success');
}

function setTopScorerBonus(value, showFeedback = true) {
  document.querySelectorAll('.bonus-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.bonus) === value);
  });
  if (showFeedback) {
    showToast(t('poolSettings.bonusToast', { n: value }), 'success');
  }
}

async function savePoolSettings() {
  if (!state.currentPool || !state.currentUser) {
    showToast(t('errors.missingData'), 'error');
    return;
  }

  if (!state.currentUser.is_admin) {
    showToast(t('poolSettings.notAdmin'), 'error');
    return;
  }
  
  // Gather values from form
  const newSettings = {
    name: document.getElementById('settings-pool-name').value.trim(),
    num_stages: parseInt(getToggleValue('num_stages')) || 2,
    group_pick_type: getToggleValue('group_pick_type') || 'select_advancing',
    use_multipliers: document.getElementById('settings-use-multipliers').checked,
    scoring_group_stage: parseInt(document.getElementById('score-group-stage').textContent) || 1,
    scoring_r32: parseInt(document.getElementById('score-r32').textContent) || 1,
    scoring_r16: parseInt(document.getElementById('score-r16').textContent) || 2,
    scoring_qf: parseInt(document.getElementById('score-qf').textContent) || 3,
    scoring_sf: parseInt(document.getElementById('score-sf').textContent) || 4,
    scoring_final: parseInt(document.getElementById('score-final').textContent) || 8,
    top_scorer_enabled: document.getElementById('settings-top-scorer').checked,
    top_scorer_bonus: parseInt(document.querySelector('.bonus-btn.active')?.dataset.bonus) || 25,
    // v2.5.16: approve_before_betting removed from settings
  };
  
  // Max participants
  if (document.getElementById('settings-limit-members').checked) {
    newSettings.max_participants = parseInt(document.getElementById('settings-max-members').value) || null;
  } else {
    newSettings.max_participants = null;
  }
  
  // Validate name
  if (!newSettings.name || newSettings.name.length < CONFIG.MIN_POOL_NAME_LENGTH) {
    showToast(t('poolSettings.poolNameShort'), 'error');
    return;
  }

  try {
    // v2.5.29: dropped "Saving settings..." info toast - the success toast
    // 1-2 seconds later is sufficient feedback.
    // Preferred: server-side update_pool_settings RPC (server-side whitelist;
    // freezes scoring fields once the pool is locked). Falls back to the legacy
    // direct update only when the RPC isn't deployed.
    const code = _currentRecoveryCode();
    let done = false;
    if (code) {
      const { error: rpcErr } = await supabaseClient.rpc('update_pool_settings', { p_code: code, p_settings: newSettings });
      if (!rpcErr) {
        done = true;
      } else if (!_rpcMissing(rpcErr)) {
        console.error('update_pool_settings RPC error:', rpcErr);
        showToast(t('poolSettings.saveError', { msg: rpcErr.message }), 'error');
        return;
      }
      // RPC absent -> fall through to the legacy direct write below.
    }

    if (!done) {
      const { error } = await supabaseClient
        .from('pools')
        .update(newSettings)
        .eq('id', state.currentPool.id);

      if (error) {
        console.error('Settings save error:', error);
        showToast(t('poolSettings.saveError', { msg: error.message }), 'error');
        return;
      }
    }

    // Update local state
    Object.assign(state.currentPool, newSettings);

    showToast(t('poolSettings.savedToast'), 'success');

    // Return to dashboard after short delay
    setTimeout(() => {
      goToDashboard();
    }, 800);

  } catch (err) {
    console.error('Save settings error:', err);
    showToast(t('errors.unexpected'), 'error');
  }
}

async function confirmDeletePool() {
  if (!state.currentPool || !state.currentUser?.is_admin) return;

  const poolName = state.currentPool.name;
  const confirmed = confirm(t('poolSettings.deleteWarning', { name: poolName }));

  if (!confirmed) return;

  // Second confirmation
  const finalConfirm = prompt(t('poolSettings.deletePrompt', { name: poolName }));

  if (finalConfirm !== poolName) {
    showToast(t('poolSettings.deleteCancelled'), 'info');
    return;
  }

  try {
    // Preferred: server-side delete_pool RPC (validates admin-of-pool, purges all
    // child rows server-side). Falls back to the legacy direct delete only when
    // the RPC isn't deployed.
    const code = _currentRecoveryCode();
    let done = false;
    if (code) {
      const { error: rpcErr } = await supabaseClient.rpc('delete_pool', { p_code: code });
      if (!rpcErr) {
        done = true;
      } else if (!_rpcMissing(rpcErr)) {
        console.error('delete_pool RPC error:', rpcErr);
        showToast(t('poolSettings.deleteError', { msg: rpcErr.message }), 'error');
        return;
      }
      // RPC absent -> fall through to the legacy direct delete below.
    }

    if (!done) {
      const { error } = await supabaseClient
        .from('pools')
        .delete()
        .eq('id', state.currentPool.id);

      if (error) {
        console.error('Delete pool error:', error);
        showToast(t('poolSettings.deleteError', { msg: error.message }), 'error');
        return;
      }
    }

    clearLocalUser();
    state.currentPool = null;
    state.currentUser = null;
    if (typeof resetPunditState === 'function') resetPunditState();

    showToast(t('poolSettings.deletedToast'), 'info');
    setTimeout(() => {
      showScreen('home-screen');
    }, 1000);

  } catch (err) {
    console.error('Delete pool error:', err);
    showToast(t('errors.unexpected'), 'error');
  }
}

// toggleLanguage() and setLanguage() are now provided by i18n.js

function logoutConfirm() {
  closeMenu();
  setTimeout(() => {
    if (confirm(t('poolSettings.leaveConfirm'))) {
      clearLocalUser();
      state.currentUser = null;
      state.currentPool = null;
      if (typeof resetPunditState === 'function') resetPunditState();
      showScreen('home-screen');
      showToast(t('poolSettings.leftToast'), 'info');
    }
  }, 300);
}

// ============================================================
// GROUP BETTING - The core of the app
// ============================================================

// State for betting
const bettingState = {
  groupOrder: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
  currentGroupIndex: 0,
  groupedTeams: {},  // {A: [team, team, team, team], B: [...]}
  picks: {},          // {A: ['ENG', 'SWE', 'VIE'], B: [...]}
  loading: false,
  completedFirstCycle: false  // true after user clicks "next" from group L
};

async function startGroupBetting() {
  if (!state.currentUser || !state.currentPool) {
    showToast(t('errors.reconnect'), 'error');
    return;
  }

  if (!supabaseClient) {
    showToast(t('errors.serverConnectingRetry'), 'error');
    initSupabase();
    return;
  }

  // Load results data for "got it right" indicators
  await loadResultsData();

  // v2.4.2: removed "Loading teams..." toast - the screen change to the
  // group-betting screen is itself the feedback; the toast only confused
  // when the load was fast.

  try {
    // Load all teams grouped by group_letter
    const { data: teams, error: teamsError } = await supabaseClient
      .from('teams')
      .select('*')
      .not('group_letter', 'is', null)
      .order('group_letter')
      .order('fifa_ranking');
    
    if (teamsError || !teams || teams.length === 0) {
      console.error('Teams load error:', teamsError);
      showToast(t('groups.teamsSyncing'), 'error');
      return;
    }
    
    // Group teams by letter
    bettingState.groupedTeams = {};
    teams.forEach(team => {
      const letter = team.group_letter;
      if (!bettingState.groupedTeams[letter]) {
        bettingState.groupedTeams[letter] = [];
      }
      bettingState.groupedTeams[letter].push(team);
    });
    
    // Load existing picks
    const { data: existingPicks } = await supabaseClient
      .from('group_picks')
      .select('*')
      .eq('user_id', state.currentUser.id);
    
    // Build picks state
    bettingState.picks = {};
    bettingState.groupOrder.forEach(letter => {
      bettingState.picks[letter] = [];
    });
    
    if (existingPicks) {
      existingPicks.forEach(pick => {
        if (!bettingState.picks[pick.group_letter]) {
          bettingState.picks[pick.group_letter] = [];
        }
        bettingState.picks[pick.group_letter].push(pick.team_code);
      });
    }

    // v2.10.8: self-heal — if the live group_picks are missing/short but a durable
    // backup or local cache holds picks (a prior save was blocked/wiped), restore
    // the missing groups so the user never sees a wrongly-empty bracket. Only FILLS
    // empty groups; never overwrites a group that already loaded from the DB.
    await _tpSelfHealGroups();

    // If user already has picks in most groups, assume they completed first cycle
    const groupsWithPicks = bettingState.groupOrder.filter(l => (bettingState.picks[l] || []).length > 0).length;
    bettingState.completedFirstCycle = groupsWithPicks >= 10;
    
    // Determine current group (first unfinished group, or first group)
    bettingState.currentGroupIndex = findFirstIncompleteGroup();
    
    // Render
    renderGroupBetting();
    showScreen('group-betting-screen');
    
  } catch (err) {
    console.error('Start group betting error:', err);
    showToast(t('errors.unexpected'), 'error');
  }
}

function findFirstIncompleteGroup() {
  for (let i = 0; i < bettingState.groupOrder.length; i++) {
    const letter = bettingState.groupOrder[i];
    const picks = bettingState.picks[letter] || [];
    if (picks.length < 2) {
      return i;
    }
  }
  return 0; // All complete - start from beginning for review
}

function getCurrentGroupLetter() {
  return bettingState.groupOrder[bettingState.currentGroupIndex];
}

function getPreviousGroupIndex() {
  return (bettingState.currentGroupIndex - 1 + 12) % 12;
}

function getNextGroupIndex() {
  return (bettingState.currentGroupIndex + 1) % 12;
}

function renderGroupBetting() {
  const currentLetter = getCurrentGroupLetter();

  // Update title (these are safe - they're not overwritten)
  const currentGroupLetterEl = document.getElementById('current-group-letter');
  const instructionGroupLetterEl = document.getElementById('instruction-group-letter');
  const currentGroupStepEl = document.getElementById('current-group-step');

  if (currentGroupLetterEl) currentGroupLetterEl.textContent = currentLetter;
  if (instructionGroupLetterEl) instructionGroupLetterEl.textContent = currentLetter;
  if (currentGroupStepEl) currentGroupStepEl.textContent = t('groups.stepProgress', { current: bettingState.currentGroupIndex + 1, total: 12 });

  // v2.4.6: dynamic points hint - shows the pool's actual reward per
  // correct advancing team (the legacy two_phase model uses group_first).
  const ptsHint = document.getElementById('group-points-hint');
  if (ptsHint) {
    const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
    const perTeam = rules.group_first ?? state.currentPool.scoring_group_stage ?? 1;
    ptsHint.innerHTML = `<span class="pts-pill">${t('groups.pointsPerAdvancingTeam', { pts: perTeam })}</span>`;
  }
  
  // Note: prev-group-letter and next-group-letter are managed by updateNextButtonState
  // and updatePrevButtonState - don't update them here
  
  // Render teams
  const teams = bettingState.groupedTeams[currentLetter] || [];
  const picks = bettingState.picks[currentLetter] || [];
  
  const teamsList = document.getElementById('teams-list');
  if (teamsList) {
    teamsList.innerHTML = '';
    
    teams.forEach(team => {
      const isSelected = picks.includes(team.code);
      const card = createTeamCard(team, isSelected);
      teamsList.appendChild(card);
    });
  }
  
  // Update group info
  updateGroupPicksInfo();
  
  // Update global progress
  updateGlobalProgress();
  
  // Update quick navigation
  renderQuickGroupsNav();
  
  // Update navigation buttons (this rebuilds them with current data)
  updatePrevButtonState();
  updateNextButtonState();
  
  // Update floating button
  updateFloatingStatusButton();
}

function updatePrevButtonState() {
  const prevBtn = document.getElementById('prev-group-btn');
  if (!prevBtn) return;
  
  const prevLetter = bettingState.groupOrder[getPreviousGroupIndex()];
  prevBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 6 15 12 9 18"></polyline>
    </svg>
    <span>${t('groups.prevGroup', { letter: prevLetter })}</span>
  `;
}

function updateNextButtonState() {
  const nextBtn = document.getElementById('next-group-btn');
  if (!nextBtn) return;
  
  const currentLetter = getCurrentGroupLetter();
  const picks = bettingState.picks[currentLetter] || [];
  const isLastGroup = bettingState.currentGroupIndex === bettingState.groupOrder.length - 1;
  const nextLetter = bettingState.groupOrder[getNextGroupIndex()];
  
  if (picks.length < 2) {
    // BLOCKED: less than 2 picks
    nextBtn.classList.add('btn-disabled-warning');
    nextBtn.classList.remove('btn-primary');
    const need = 2 - picks.length;
    nextBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      <span class="next-btn-warning-text">${t('groups.needMore', { n: need, plural: need > 1 ? 's' : '' })}</span>
    `;
  } else {
    // ALLOWED
    nextBtn.classList.remove('btn-disabled-warning');
    nextBtn.classList.add('btn-primary');

    // Special: last group with incomplete total
    const total = countTotalPicks();
    if (isLastGroup && total < 32 && total > 0) {
      // Show "check status" instead of "next group"
      nextBtn.innerHTML = `
        <span>${t('groups.finishBetting')}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    } else {
      // Normal next
      nextBtn.innerHTML = `
        <span>${t('groups.nextGroup', { letter: nextLetter })}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 6 9 12 15 18"></polyline>
        </svg>
      `;
    }
  }
}

function updateFloatingStatusButton() {
  const btn = document.getElementById('floating-status-btn');
  if (!btn) return;
  
  const total = countTotalPicks();
  
  // Show only if: completed first cycle AND total < 32
  if (bettingState.completedFirstCycle && total < 32 && total > 0) {
    btn.style.display = 'flex';
    document.getElementById('floating-status-text').textContent = `${total}/32`;
  } else {
    btn.style.display = 'none';
  }
}

function createTeamCard(team, isSelected) {
  const card = document.createElement('div');
  card.className = 'team-card' + (isSelected ? ' selected' : '');
  card.setAttribute('data-team-code', team.code);
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  
  // v2.5.40: show the actual resolved multiplier per pool settings instead
  // of a static tier label. The number reflects per-team overrides,
  // pool category multipliers, and finally global defaults - whatever the
  // admin configured wins.
  const usesMultipliers = state.currentPool.use_multipliers !== false;
  let tierBadge = '';
  if (usesMultipliers) {
    const tierClass = team.tier === 'favorite' ? 'team-tier-favorite' :
                      team.tier === 'contender' ? 'team-tier-contender' :
                      'team-tier-underdog';
    const mult = (typeof getPoolTeamMultiplier === 'function')
      ? getPoolTeamMultiplier(state.currentPool, team.code)
      : (team.tier === 'underdog' ? 2 : team.tier === 'contender' ? 1.5 : 1);
    const multStr = (mult % 1 === 0) ? mult.toFixed(0) : mult.toFixed(1);
    tierBadge = `<span class="team-tier-badge ${tierClass}">×${multStr}</span>`;
  }

  // Check real-world result if user selected this team
  let resultIndicator = '';
  if (isSelected && team.group_letter) {
    const advanced = didTeamAdvance(team.code, team.group_letter);
    if (advanced === true) {
      card.classList.add('result-correct');
      resultIndicator = `
        <div class="team-result-badge correct" title="${t('groups.tooltipAdvanced')}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `;
    } else if (advanced === false) {
      card.classList.add('result-wrong');
      resultIndicator = `
        <div class="team-result-badge wrong" title="${t('groups.tooltipEliminated')}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
      `;
    }
  }

  // Flag emoji from country code
  const flagEmoji = getCountryFlag(team.code);
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  const teamName = lang === 'he' ? (team.name_he || team.name_en) : (team.name_en || team.name_he);

  // v2.4.5: SVG checkmark inside the team-checkbox - the previous CSS
  // ::after with "✓" character wasn't reliably visible on Windows.
  card.innerHTML = `
    <div class="team-flag">${flagEmoji}</div>
    <div class="team-info">
      <div class="team-name">${teamName}</div>
      ${tierBadge}
    </div>
    ${resultIndicator}
    <div class="team-checkbox">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
  `;
  
  // Use addEventListener instead of onclick for reliability
  card.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const code = this.getAttribute('data-team-code');
    console.log('Team clicked:', code);
    toggleTeamSelection(code);
  });
  
  return card;
}

// 3-letter team code -> flagcdn code (ISO-3166 alpha-2, or gb-eng/gb-sct for home nations).
const FLAG_ISO = {
  ARG: 'ar', FRA: 'fr', BRA: 'br', ENG: 'gb-eng', ESP: 'es', POR: 'pt', NED: 'nl', GER: 'de',
  BEL: 'be', CRO: 'hr', URU: 'uy', USA: 'us', MEX: 'mx', SUI: 'ch', AUT: 'at', SWE: 'se',
  SEN: 'sn', MAR: 'ma', JPN: 'jp', KOR: 'kr', AUS: 'au', CAN: 'ca', TUR: 'tr',
  NOR: 'no', IRN: 'ir', SCO: 'gb-sct', CZE: 'cz', ALG: 'dz', CIV: 'ci', TUN: 'tn', EGY: 'eg',
  GHA: 'gh', PAN: 'pa', PAR: 'py', NZL: 'nz', UZB: 'uz', IRQ: 'iq',
  SAU: 'sa', JOR: 'jo', RSA: 'za', HAI: 'ht', BIH: 'ba', CPV: 'cv', COD: 'cd', QAT: 'qa', CUR: 'cw',
  ECU: 'ec', COL: 'co'
};
function getCountryFlag(code) {
  // Use flag IMAGES, not emoji: flag emoji do NOT render on Windows / Chrome desktop
  // (they fall back to the 2-letter code), so an <img> is the only cross-platform way to
  // actually show a flag. On image-load failure we drop back to the team code text.
  const iso = FLAG_ISO[code];
  if (!iso) return '<span class="flag-img-fallback">⚽</span>';
  return `<img class="flag-img" src="https://flagcdn.com/${iso}.svg" alt="${code}" loading="lazy" ` +
    `style="height:1.05em;width:1.55em;object-fit:cover;border-radius:3px;vertical-align:middle;display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,0.25)" ` +
    `onerror="this.replaceWith(document.createTextNode(this.alt))">`;
}

function toggleTeamSelection(teamCode) {
  // v2.4: soft lock - groups freeze automatically once the tournament starts
  // (pool.locked_at set by spAutoLockPoolIfNeeded). Admins can still see them
  // read-only via the leaderboard.
  if (isPoolWriteLocked()) {
    showToast(t('groups.lockedTournamentStarted'), 'error');
    return;
  }

  const currentLetter = getCurrentGroupLetter();
  const picks = bettingState.picks[currentLetter] || [];

  if (picks.includes(teamCode)) {
    // Remove
    bettingState.picks[currentLetter] = picks.filter(c => c !== teamCode);
  } else {
    // Add - but max 3 per group
    if (picks.length >= 3) {
      showToast(t('groups.maxReachedToast'), 'error');
      return;
    }
    // v2.10.9: and at most 32 advancing picks total (the real knockout size).
    // Mirrors the server cap in save_group_picks_2p so a legal selection never
    // trips a save rejection; over-32 was an invalid, score-inflating shape.
    if (countTotalPicks() >= 32) {
      showToast(t('groups.maxTotalReached'), 'error');
      return;
    }
    bettingState.picks[currentLetter] = [...picks, teamCode];
  }
  
  // Re-render
  renderGroupBetting();
  
  // Auto-save in the background (debounced)
  autoSavePicks();
}

function updateGroupPicksInfo() {
  const currentLetter = getCurrentGroupLetter();
  const picks = bettingState.picks[currentLetter] || [];
  const info = document.getElementById('group-picks-info');
  
  if (picks.length === 0) {
    info.className = 'group-picks-info';
    info.innerHTML = `<span class="text-faint">${t('groups.pickSubtitleDefault')}</span>`;
  } else if (picks.length === 1) {
    info.className = 'group-picks-info invalid';
    info.innerHTML = t('groups.pickOneOnly');
  } else if (picks.length === 2) {
    info.className = 'group-picks-info valid';
    info.innerHTML = t('groups.pickedTwo');
  } else if (picks.length === 3) {
    info.className = 'group-picks-info valid';
    info.innerHTML = t('groups.pickedThree');
  }
}

function updateGlobalProgress() {
  const total = countTotalPicks();
  document.getElementById('total-picks-count').textContent = total;
  document.getElementById('total-picks-progress').style.width = Math.min(100, (total / 32) * 100) + '%';
  
  const validation = document.getElementById('picks-validation');
  const validationText = document.getElementById('picks-validation-text');
  const finishBtn = document.getElementById('finish-betting-btn');
  
  if (total === 0) {
    validation.className = 'picks-validation hidden';
    finishBtn.style.display = 'none';
  } else if (total < 32) {
    validation.className = 'picks-validation warning';
    validationText.textContent = t('groups.validationRemaining', { n: 32 - total });
    finishBtn.style.display = 'none';
  } else if (total === 32) {
    // Check that every group has valid picks (2 or 3)
    const allValid = bettingState.groupOrder.every(letter => {
      const count = (bettingState.picks[letter] || []).length;
      return count >= 2 && count <= 3;
    });

    if (allValid) {
      validation.className = 'picks-validation success';
      validationText.textContent = t('groups.validationDone');
      finishBtn.style.display = 'flex';
    } else {
      validation.className = 'picks-validation error';
      validationText.textContent = t('groups.validationProblem');
      finishBtn.style.display = 'none';
    }
  } else {
    validation.className = 'picks-validation error';
    validationText.textContent = t('groups.validationTooMany', { n: total - 32 });
    finishBtn.style.display = 'none';
  }
}

function countTotalPicks() {
  let total = 0;
  bettingState.groupOrder.forEach(letter => {
    total += (bettingState.picks[letter] || []).length;
  });
  return total;
}

// v2.10.9: single source of truth for "is the two-phase group stage COMPLETE".
// WC2026 = 12 groups of 4; the knockout takes 32 teams (top-2 of each group = 24,
// plus the 8 best third-placed teams), so a complete advancing set is EXACTLY 32
// picks with 2-3 per group. 24 (just the obvious top-2 of every group) is NOT
// complete. Accepts a raw pick COUNT (number) or a {group_letter: array|count}
// map; the map form also enforces the per-group 2-3 shape.
function isTwoPhaseGroupComplete(arg) {
  if (typeof arg === 'number') return arg === 32;
  if (!arg || typeof arg !== 'object') return false;
  const letters = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  let total = 0;
  for (const L of letters) {
    const v = arg[L];
    const n = Array.isArray(v) ? v.length : (typeof v === 'number' ? v : 0);
    if (n < 2 || n > 3) return false;
    total += n;
  }
  return total === 32;
}

function renderQuickGroupsNav() {
  const nav = document.getElementById('quick-groups-nav');
  nav.innerHTML = '';
  
  bettingState.groupOrder.forEach((letter, idx) => {
    const picks = bettingState.picks[letter] || [];
    const btn = document.createElement('button');
    
    let className = 'group-nav-pill';
    if (idx === bettingState.currentGroupIndex) {
      className += ' current';
    } else if (picks.length === 3) {
      className += ' has-three';  // Green dot
    } else if (picks.length === 2) {
      className += ' has-two';    // Orange dot
    } else if (picks.length === 1) {
      className += ' partial';    // Yellow dot (warning - shouldn't happen since blocked)
    }
    // 0 picks = no dot (clean)
    
    btn.className = className;
    btn.textContent = letter;
    btn.setAttribute('data-index', idx);
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const targetIdx = parseInt(this.getAttribute('data-index'));
      console.log('Quick nav: going to group index', targetIdx);
      goToGroup(targetIdx);
    });
    
    nav.appendChild(btn);
  });
}

// ============================================================
// STATUS MODAL
// ============================================================

function openStatusModal() {
  // Make sure state is fresh
  const total = countTotalPicks();
  const missing = 32 - total;
  
  // Update modal content
  document.getElementById('status-modal-current').textContent = total;
  document.getElementById('status-modal-missing').textContent = missing > 0 ? missing : 0;
  
  if (missing > 0) {
    document.getElementById('status-modal-title').textContent = t('statusModal.almostTitle');
    const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
    const heSuffix = missing > 1 ? 'ות' : 'ה';
    const enSuffix = missing > 1 ? 's' : '';
    document.getElementById('status-modal-subtitle').textContent =
      t('statusModal.missingPicks', { n: missing, plural: lang === 'he' ? heSuffix : enSuffix, pluralN: heSuffix });
  } else {
    document.getElementById('status-modal-title').textContent = t('statusModal.doneTitle');
    document.getElementById('status-modal-subtitle').textContent = t('statusModal.doneSubtitle');
  }
  
  // Find groups with EXACTLY 2 picks (where you can add a third)
  // Important: filter strictly to length === 2
  const expandableGroups = [];
  bettingState.groupOrder.forEach(letter => {
    const picks = bettingState.picks[letter] || [];
    if (picks.length === 2) {
      expandableGroups.push(letter);
    }
  });
  
  console.log('Expandable groups (with 2 picks):', expandableGroups);
  console.log('Current picks state:', bettingState.picks);
  
  // Render group buttons
  const container = document.getElementById('status-modal-groups');
  container.innerHTML = '';
  
  if (expandableGroups.length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; padding: 12px; color: rgba(255,255,255,0.5); text-align: center; font-size: 12px;">${t('statusModal.noGroupsToAdd')}</div>`;
  } else {
    // Update section title with count
    const sectionTitle = document.querySelector('.status-section-title');
    if (sectionTitle) {
      sectionTitle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ecd49a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-left: 4px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        ${t('statusModal.expandable', { n: expandableGroups.length })}
      `;
    }
    
    expandableGroups.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'status-modal-group-btn';
      btn.textContent = letter;
      btn.setAttribute('data-letter', letter);
      
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const targetLetter = this.getAttribute('data-letter');
        const idx = bettingState.groupOrder.indexOf(targetLetter);
        console.log('Modal: navigating to group', targetLetter, 'index', idx);
        
        closeStatusModal();
        
        // Use setTimeout to ensure modal closes first
        setTimeout(() => {
          goToGroup(idx);
        }, 50);
      });
      
      container.appendChild(btn);
    });
  }
  
  // Show modal
  document.getElementById('status-modal-overlay').classList.add('active');
  document.getElementById('status-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeStatusModal() {
  document.getElementById('status-modal-overlay').classList.remove('active');
  document.getElementById('status-modal').classList.remove('active');
  document.body.style.overflow = '';
}

function goToGroup(index) {
  // Allow free navigation via quick nav
  bettingState.currentGroupIndex = index;
  renderGroupBetting();
  window.scrollTo(0, 0);
}

function goToPreviousGroup() {
  // Previous is always allowed
  bettingState.currentGroupIndex = getPreviousGroupIndex();
  renderGroupBetting();
  window.scrollTo(0, 0);
}

function goToNextGroup() {
  const currentLetter = getCurrentGroupLetter();
  const picks = bettingState.picks[currentLetter] || [];
  
  // BLOCK: cannot proceed if current group has < 2 picks
  if (picks.length < 2) {
    showToast(t('groups.mustPickTwo', { letter: currentLetter }), 'error');

    // Visual shake feedback on the next button
    const btn = document.getElementById('next-group-btn');
    btn.style.animation = 'shake 0.4s';
    setTimeout(() => { btn.style.animation = ''; }, 400);

    return;
  }
  
  // Special case: about to wrap from L back to A
  const isLastGroup = bettingState.currentGroupIndex === bettingState.groupOrder.length - 1;
  if (isLastGroup) {
    const total = countTotalPicks();
    
    // Mark that we completed first cycle (for floating button)
    bettingState.completedFirstCycle = true;
    
    if (total === 32) {
      // All good - finish!
      finishGroupBetting();
      return;
    }
    
    if (total < 32) {
      // Show modal with available groups
      openStatusModal();
      return;
    }
  }
  
  bettingState.currentGroupIndex = getNextGroupIndex();
  renderGroupBetting();
  window.scrollTo(0, 0);
}

// Debounced auto-save
let autoSaveTimeout;
function autoSavePicks() {
  _tpCacheSave(); // v2.10.8: mirror locally + durable backup FIRST so a failed/blocked DB save never loses work
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => savePicksToDb(false), 1000);
}

// v2.10.9: returns a STRUCTURED result { ok, reason? } so callers (finish/exit)
// can block "completed/saved" UI when the save didn't actually land. ok:true also
// covers the legitimate empty-skip (nothing to save); every failure is ok:false.
async function savePicksToDb(showFeedback = true) {
  if (!state.currentUser || !state.currentPool) return { ok: false, reason: 'no-context' };
  if (!supabaseClient) return { ok: false, reason: 'no-client' };

  // v2.4: soft lock - block writes once the tournament has started.
  if (isPoolWriteLocked()) {
    if (showFeedback) showToast(t('groups.lockedTournamentStarted'), 'error');
    return { ok: false, reason: 'locked' };
  }

  if (bettingState.loading) return { ok: false, reason: 'busy' };
  bettingState.loading = true;

  // SAFETY GUARD (parity with the single-phase saves): never let a stale EMPTY
  // in-memory state wipe real DB picks. A debounced auto-save can fire after
  // navigation / bettingState re-init reset picks to empty; both the RPC and the
  // legacy path below delete-then-insert, so an empty payload would destroy every
  // saved group pick. Skip the write entirely when there's nothing to save.
  const _totalGroupPicks = bettingState.groupOrder.reduce((n, l) => n + ((bettingState.picks[l] || []).length), 0);
  if (_totalGroupPicks === 0) {
    console.warn('savePicksToDb: in-memory picks empty - skipping DB write to avoid wiping real picks');
    bettingState.loading = false;
    return { ok: true, skipped: 'empty' };
  }

  // v2.10.7: the ONLY working write path is the SECURITY DEFINER RPC. anon
  // INSERT/DELETE on group_picks is REVOKEd (June-4 hardening), so the legacy
  // direct write below 401s for every real user. Mirror the single-phase v2.9.12
  // fix: retry a transient PGRST202 (PostgREST schema-cache reload after any
  // migration) before giving up, and NEVER silently fall through to the dead
  // direct write — that silent failure is exactly why two-phase pools ended up
  // with empty brackets at scale (0 saved knockout rows across 313 pools). The
  // RPC computes multiplier_applied SERVER-SIDE (closes the multiplier cheat).
  const code = _currentRecoveryCode();
  if (!code) {
    // No code in this session → the RPC can't authenticate the writer and the
    // direct write is REVOKEd. Be honest instead of dropping the save silently.
    console.error('savePicksToDb: no recovery code in session — cannot save group picks');
    showToast(t('bracketSave.noCode'), 'error');
    bettingState.loading = false;
    return { ok: false, reason: 'no-code' };
  }

  const picks = [];
  bettingState.groupOrder.forEach(letter => {
    (bettingState.picks[letter] || []).forEach(teamCode => picks.push({ group_letter: letter, team_code: teamCode }));
  });
  const res = await _rpcWrite('save_group_picks_2p', { p_code: code, p_picks: picks });
  bettingState.loading = false;
  if (res.ok) {
    if (showFeedback) showToast(t('groups.savedOk'), 'success');
    return { ok: true };
  }
  if (!res.missing) {
    // Genuine business error from the deployed RPC (e.g. 'pool locked').
    console.error('Save picks RPC error:', res.error);
    showToast(t('groups.saveError'), 'error');
    return { ok: false, reason: 'rpc-error', error: res.error };
  }
  // Still PGRST202 after all retries: RPC transiently unreachable and the direct
  // write is dead for anon — don't attempt it (it would only 401). Tell the user
  // honestly so they retry instead of losing picks silently.
  console.error('savePicksToDb: save_group_picks_2p unreachable after retries');
  showToast(t('bracketSave.retryLater'), 'error');
  return { ok: false, reason: 'unreachable' };
}

async function saveProgressAndExit() {
  // v2.10.9: only leave to the dashboard if the save actually landed. On failure
  // savePicksToDb already showed an honest error toast — stay put so the user can
  // retry instead of walking away thinking their progress was saved. (An empty
  // in-progress state legitimately returns ok:true/skipped and exits.)
  const res = await savePicksToDb(true);
  if (!res || !res.ok) return;
  setTimeout(() => {
    goToDashboard();
  }, 500);
}

function exitGroupBetting() {
  const total = countTotalPicks();
  if (total > 0 && total < 32) {
    if (!confirm(t('groups.exitConfirm', { n: total }))) {
      return;
    }
  }
  goToDashboard();
}

async function finishGroupBetting() {
  // Final validation
  let allValid = true;
  let total = 0;
  
  bettingState.groupOrder.forEach(letter => {
    const count = (bettingState.picks[letter] || []).length;
    if (count < 2 || count > 3) {
      allValid = false;
    }
    total += count;
  });
  
  if (total !== 32) {
    showToast(t('groups.exactly32', { n: total }), 'error');
    return;
  }

  if (!allValid) {
    showToast(t('groups.eachGroup2or3'), 'error');
    return;
  }

  // v2.10.9: the completion screen IS the success confirmation, so it must only
  // appear when the save genuinely landed. savePicksToDb already toasts an honest
  // error on failure (even with showFeedback=false), so just block here.
  const _saveRes = await savePicksToDb(false);
  if (!_saveRes || !_saveRes.ok) return;

  // v2.5.35: use pool-aware multiplier resolver (scoring_rules.team_multipliers
  // override → scoring_rules.multipliers[tier] → global default). Falls back
  // to legacy tier-only lookup when the pool has no custom multipliers config.
  let maxPoints = 0;
  // Wizard pools store points in scoring_rules JSONB (group_first); the legacy
  // scoring_group_stage column only exists on old pools. Prefer the former.
  const _rules = (state.currentPool && state.currentPool.scoring_rules) || {};
  const scoringGroupStage = _rules.group_first ?? state.currentPool.scoring_group_stage ?? 1;
  const useMult = state.currentPool.use_multipliers !== false;

  bettingState.groupOrder.forEach(letter => {
    const picks = bettingState.picks[letter] || [];
    picks.forEach(teamCode => {
      if (useMult) {
        maxPoints += scoringGroupStage * getPoolTeamMultiplier(state.currentPool, teamCode);
      } else {
        maxPoints += scoringGroupStage;
      }
    });
  });

  // Round to nearest integer
  maxPoints = Math.round(maxPoints);
  
  // Show completion screen
  document.getElementById('max-possible-points').textContent = maxPoints;
  showScreen('betting-complete-screen');
}

function reviewBettingPicks() {
  bettingState.currentGroupIndex = 0;
  renderGroupBetting();
  showScreen('group-betting-screen');
}

// v2.4.5: drive the horizontal progress bar at the bottom of the dominant
// Start CTA card. Hidden when picked=0 (the "Start" pristine state shows
// only the play icon). Switches the leading icon to a checkmark at 100%.
function _fbSetCtaProgress(picked, total) {
  const row = document.getElementById('bet-cta-progress-row');
  const fill = document.getElementById('bet-cta-progress-fill');
  const text = document.getElementById('bet-cta-progress-text');
  const icon = document.getElementById('bet-cta-icon-simple');
  if (!row || !fill || !text || !icon) return;

  const safePicked = Math.max(0, Math.min(total, picked || 0));
  const pct = total > 0 ? Math.round((safePicked / total) * 100) : 0;

  if (safePicked === 0) {
    row.style.display = 'none';
  } else {
    row.style.display = 'flex';
    fill.style.width = pct + '%';
    text.textContent = `${safePicked} / ${total}`;
  }

  // v2.4.9: swap leading glyph using inline SVGs (Tabler-icons font sometimes
  // fails to render on Windows / fresh PWA installs, leaving a blank disc).
  if (safePicked === 0) {
    icon.innerHTML = _fbCtaSvgSoccerBall();
  } else if (safePicked >= total) {
    icon.innerHTML = _fbCtaSvgCheck();
  } else {
    icon.innerHTML = _fbCtaSvgFlag();
  }
}

// v2.4.9: inline-SVG glyphs for the dominant Start CTA leading icon.
function _fbCtaSvgSoccerBall() {
  return '<svg class="bet-cta-svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9.5"/>' +
    '<polygon points="12,7.5 15.8,10.3 14.4,14.8 9.6,14.8 8.2,10.3" fill="currentColor" stroke="none"/>' +
    '<line x1="12" y1="2.5" x2="12" y2="7.5"/>' +
    '<line x1="15.8" y1="10.3" x2="20.7" y2="8.7"/>' +
    '<line x1="8.2" y1="10.3" x2="3.3" y2="8.7"/>' +
    '<line x1="9.6" y1="14.8" x2="6.7" y2="19.5"/>' +
    '<line x1="14.4" y1="14.8" x2="17.3" y2="19.5"/>' +
  '</svg>';
}
function _fbCtaSvgFlag() {
  return '<svg class="bet-cta-svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<line x1="6" y1="3.5" x2="6" y2="20.5"/>' +
    '<path d="M6 4.5 L19 4.5 L16 9 L19 13.5 L6 13.5 Z" fill="currentColor" stroke="none"/>' +
  '</svg>';
}
function _fbCtaSvgCheck() {
  return '<svg class="bet-cta-svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="5,12 10,17 19,7"/>' +
  '</svg>';
}

// Update dashboard CTA card to reflect betting progress (v2.3 mode-aware)
// v2.5.36: paint the slim status card above the CTA with state-aware text.
// state: 'notStarted' | 'adminInviteFirst' | 'partial' | 'allSet'
// v2.5.38: adminInviteFirst is a notStarted subvariant for admins, so the
// CSS keeps the gold "not started" treatment for both.
function _fbSetDashboardProgressCard(rawState) {
  const card = document.getElementById('dashboard-pre-tournament');
  if (!card) return;
  // Promote notStarted -> adminInviteFirst for admins so they get the
  // "invite friends first" copy instead of the generic ready-to-play text.
  let st = rawState;
  if (st === 'notStarted' && state.currentUser && state.currentUser.is_admin) {
    st = 'adminInviteFirst';
  }
  const titleEl = card.querySelector('.pre-tournament-title');
  const subtitleEl = card.querySelector('.pre-tournament-subtitle');
  if (!titleEl || !subtitleEl) return;
  titleEl.textContent = t(`dashboard.progress.${st}.title`);
  subtitleEl.textContent = t(`dashboard.progress.${st}.subtitle`);
  card.classList.remove('progress-notStarted', 'progress-adminInviteFirst', 'progress-partial', 'progress-allSet');
  // adminInviteFirst inherits the notStarted visual class for styling.
  card.classList.add('progress-' + (st === 'adminInviteFirst' ? 'notStarted' : st));
  card.classList.add('progress-' + st);
  // Swap icon by state
  const iconEl = card.querySelector('i.ti');
  if (iconEl) {
    iconEl.className = 'ti ' + (
      st === 'allSet' ? 'ti-circle-check' :
      st === 'partial' ? 'ti-progress' :
      st === 'adminInviteFirst' ? 'ti-user-plus' : 'ti-soccer-field'
    );
  }
}

async function updateBettingStatusOnDashboard() {
  if (!state.currentUser || !supabaseClient) return;

  const ctaEl = document.getElementById('bet-status-groups');
  if (!ctaEl) return;
  const titleEl = ctaEl.querySelector('.bet-cta-title');
  const subtitleEl = ctaEl.querySelector('.bet-cta-subtitle');
  if (!titleEl || !subtitleEl) return;

  const isSingle = state.currentPool && state.currentPool.betting_mode === 'single_phase';

  // v2.4: single_phase users predict everything in one flow (groups + bracket +
  // top scorer), so the separate "Knockout stage" / "Top scorer" status cards
  // on the dashboard are redundant. Hide them entirely for single_phase pools.
  const koCard = document.getElementById('bet-status-knockout');
  const tsCard = document.getElementById('bet-status-top-scorer');
  if (koCard) koCard.style.display = isSingle ? 'none' : '';
  if (tsCard) tsCard.style.display = isSingle ? 'none' : '';

  if (isSingle) {
    // v2.6.3: compute the TRUE completion state across EVERY stage so the CTA
    // always matches reality — groups → knockout bracket → champion → top
    // scorer. We read the DB directly (not in-memory spState) so it's accurate
    // even right after a page load. `predictions_submitted_at` is no longer the
    // sole gate; the actual picks decide the label.
    const uid = state.currentUser.id;
    // v2.9.15: scope every count to the CURRENT pool. Without the pool_id
    // filter, a user in multiple pools (or with legacy cross-pool rows) saw
    // wrong start/continue/all-set state on the dashboard.
    const pid = state.currentPool.id;
    const [gpp, kop, twp, tsp] = await Promise.all([
      supabaseClient.from('group_position_picks').select('id').eq('user_id', uid).eq('pool_id', pid),
      supabaseClient.from('knockout_picks').select('bracket_position').eq('user_id', uid).eq('pool_id', pid),
      supabaseClient.from('tournament_winner_picks').select('id').eq('user_id', uid).eq('pool_id', pid),
      supabaseClient.from('top_scorer_picks').select('id').eq('user_id', uid).eq('pool_id', pid)
    ]);
    const groupRows    = (gpp.data || []).length;                 // 4 per group, max 48
    const groupsFilled = Math.floor(groupRows / 4);                // 0..12
    const groupsDone   = groupRows >= 48;
    const bracketCount = (kop.data || []).filter(r => r.bracket_position != null).length; // 0..31
    const bracketDone  = bracketCount >= 31;
    const winnerChosen = (twp.data || []).length >= 1;
    const championDone = winnerChosen || bracketDone;              // final pick = champion
    const tsChosen     = (tsp.data || []).length >= 1;
    const tsRequired = spTopScorerRequired();

    // v2.9.2: a full bracket is now REQUIRED for "all set" — previously groups +
    // champion alone counted as complete, which hid the silent bracket-save loss
    // (users saw "ALL SET" while having 0 knockout picks → 0 knockout points).
    const allComplete = groupsDone && bracketDone && championDone && (!tsRequired || tsChosen);
    if (allComplete && !spHasUserSubmitted()) {
      await spMarkPredictionsSubmitted('dashboard-complete');
    }

    // v2.9.2: apology + recover banner — show when the user has engaged (champion
    // or groups) but their knockout bracket didn't fully save. Tapping it reopens
    // the flow to re-enter the knockout stage.
    // v2.10: MUTUAL EXCLUSIVITY after kickoff. Pre-lock → the original recover
    // banner (tapping it re-enters the knockout, which works while unlocked).
    // Post-lock → that banner is hidden and the NEW recovery banner takes over
    // (amber "ask your admin" / green "you're approved"). The two are gated on
    // opposite lock states, so a user never sees both at once.
    const affected = (winnerChosen || groupsDone) && !bracketDone;
    const locked = spIsLocked();
    state._userNeedsKnockoutRecovery = (affected && locked);
    try {
      const brb = document.getElementById('bracket-recover-banner');
      if (brb) brb.style.display = (affected && !locked) ? 'flex' : 'none';
    } catch (_) {}
    try { await _updateReopenBanner(affected && locked); } catch (_) {}

    // Overall progress (drives the bar): groups + bracket (+ top scorer if open).
    const total  = 48 + 31 + (tsRequired ? 1 : 0);
    const picked = Math.min(groupRows, 48) + Math.min(bracketCount, 31) + (tsRequired ? (tsChosen ? 1 : 0) : 0);

    if (allComplete) {
      titleEl.textContent = t('dashboard.viewCta.title');
      subtitleEl.textContent = t('dashboard.viewCta.subtitle');
      ctaEl.classList.add('done');
      const row = document.getElementById('bet-cta-progress-row');
      if (row) row.style.display = 'none';
      const iconWrap = document.getElementById('bet-cta-icon-simple');
      if (iconWrap) iconWrap.innerHTML = _fbCtaSvgCheck();
      _fbSetDashboardProgressCard('allSet');
      return;
    }

    ctaEl.classList.remove('done');
    if (groupRows === 0) {
      // Hasn't started at all
      titleEl.textContent = t('dashboard.startCta.title');
      subtitleEl.textContent = t('dashboard.startCta.subtitle');
      _fbSetDashboardProgressCard('notStarted');
    } else if (!groupsDone) {
      // Mid-groups
      titleEl.textContent = t('dashboard.continueCta.title');
      subtitleEl.textContent = t('dashboard.continueCta.partialGroups', { n: groupsFilled, total: 12 });
      _fbSetDashboardProgressCard('partial');
    } else if (!bracketDone) {
      // v2.9.3: groups done but the knockout bracket is incomplete — point the
      // user at the bracket (not the top scorer), even if a champion is set.
      titleEl.textContent = t('dashboard.continueCta.title');
      subtitleEl.textContent = t('dashboard.continueCta.bracket');
      _fbSetDashboardProgressCard('partial');
    } else {
      // Bracket done; only the (now-unlocked) top scorer is left
      titleEl.textContent = t('dashboard.continueCta.title');
      subtitleEl.textContent = t('dashboard.continueCta.topScorer');
      _fbSetDashboardProgressCard('partial');
    }
    _fbSetCtaProgress(picked, total);
    return;
  }

  // Two-phase (legacy) - use group_picks AND knockout_picks for full state
  const { data: picks } = await supabaseClient
    .from('group_picks').select('id', { count: 'exact' })
    .eq('user_id', state.currentUser.id);
  const picksCount = picks ? picks.length : 0;
  const { data: koPicks } = await supabaseClient
    .from('knockout_picks').select('id', { count: 'exact' })
    .eq('user_id', state.currentUser.id);
  const koCount = koPicks ? koPicks.length : 0;
  // v2.5.36: "all set" in two_phase requires groups (32) + knockout (16)
  const twoPhaseAllSet = picksCount >= 32 && koCount >= 16;

  if (picksCount === 0) {
    titleEl.textContent = t('dashboard.startCta.title');
    subtitleEl.textContent = t('dashboard.startCta.subtitle');
    ctaEl.classList.remove('done');
    _fbSetDashboardProgressCard('notStarted');
  } else if (picksCount < 32) {
    titleEl.textContent = t('dashboard.continueCta.title');
    subtitleEl.textContent = t('dashboard.status.partialGroups', { n: picksCount });
    ctaEl.classList.remove('done');
    _fbSetDashboardProgressCard('partial');
  } else {
    titleEl.textContent = t('dashboard.editCta.title');
    subtitleEl.textContent = t('dashboard.status.completedGroups');
    ctaEl.classList.add('done');
    _fbSetDashboardProgressCard(twoPhaseAllSet ? 'allSet' : 'partial');
  }
  _fbSetCtaProgress(picksCount, 32);
}

// ============================================================
// KNOCKOUT BETTING - The unique feature
// ============================================================

const knockoutState = {
  currentRound: 'R32',
  matches: {
    R32: [],
    R16: [],
    QF: [],
    SF: [],
    FINAL: []
  },
  picks: {},  // {match_id: 'team_code'}
  selectedGroupTeams: [],  // 32 teams from group stage
  allTeams: {}  // {code: team object}
};

const ROUND_INFO = {
  R32: { nameKey: 'knockoutEx.r32Full', total: 16, points: 1, order: 1 },
  R16: { nameKey: 'knockoutEx.r16Full', total: 8, points: 2, order: 2 },
  QF:  { nameKey: 'knockoutEx.qfFull',  total: 4, points: 3, order: 3 },
  SF:  { nameKey: 'knockoutEx.sfFull',  total: 2, points: 4, order: 4 },
  FINAL: { nameKey: 'knockoutEx.finalFull', total: 1, points: 8, order: 5 }
};

async function startKnockoutBetting() {
  if (!state.currentUser || !state.currentPool) {
    showToast(t('errors.reconnect'), 'error');
    return;
  }

  if (!supabaseClient) {
    showToast(t('errors.serverConnectingShort'), 'error');
    return;
  }

  // Load results data for "got it right" indicators
  await loadResultsData();

  // First: check if group betting is complete (need 32 picks)
  const { data: groupPicks } = await supabaseClient
    .from('group_picks')
    .select('team_code, group_letter')
    .eq('user_id', state.currentUser.id);

  if (!groupPicks || groupPicks.length < 32) {
    showToast(t('knockoutEx.needGroups'), 'error');
    return;
  }

  // v2.4.2: removed "Loading knockout..." toast - the screen change is the
  // feedback. If load is slow, the screen just appears a beat later.

  // Load all teams
  const { data: teams } = await supabaseClient
    .from('teams')
    .select('*');

  if (!teams) {
    showToast(t('knockoutEx.loadError'), 'error');
    return;
  }
  
  // Build teams map
  knockoutState.allTeams = {};
  teams.forEach(t => { knockoutState.allTeams[t.code] = t; });
  
  // Get the 32 teams the user picked
  knockoutState.selectedGroupTeams = groupPicks.map(p => p.team_code);
  
  // Generate R32 matchups (16 matches from 32 teams)
  generateR32Matches();
  
  // Load existing knockout picks
  const { data: existingPicks } = await supabaseClient
    .from('knockout_picks')
    .select('*')
    .eq('user_id', state.currentUser.id);
  
  knockoutState.picks = {};
  if (existingPicks) {
    existingPicks.forEach(p => {
      knockoutState.picks[p.match_id] = p.predicted_winner;
    });
  }
  
  // Propagate picks through subsequent rounds
  propagateKnockoutBracket();
  
  // Show first incomplete round
  knockoutState.currentRound = findFirstIncompleteRound();
  
  renderKnockout();
  showScreen('knockout-screen');
}

function generateR32Matches() {
  // Pair up the 32 selected teams into 16 matches
  // Strategy: shuffle into pairs to avoid biases
  // For consistency, we'll pair by index after sorting
  
  const teams = [...knockoutState.selectedGroupTeams];
  // Sort by FIFA ranking for fair matchups (best vs worst)
  teams.sort((a, b) => {
    const ta = knockoutState.allTeams[a];
    const tb = knockoutState.allTeams[b];
    return (ta?.fifa_ranking || 99) - (tb?.fifa_ranking || 99);
  });
  
  // Create matches: 1st vs 16th, 2nd vs 15th, etc.
  const matches = [];
  for (let i = 0; i < 16; i++) {
    const team1 = teams[i];
    const team2 = teams[31 - i];
    matches.push({
      id: `R32_M${i + 1}`,
      round: 'R32',
      number: i + 1,
      team1: team1,
      team2: team2,
      nextMatch: `R16_M${Math.floor(i / 2) + 1}`
    });
  }
  
  knockoutState.matches.R32 = matches;
  
  // Initialize empty matches for subsequent rounds
  knockoutState.matches.R16 = [];
  for (let i = 0; i < 8; i++) {
    knockoutState.matches.R16.push({
      id: `R16_M${i + 1}`,
      round: 'R16',
      number: i + 1,
      team1: null,
      team2: null,
      nextMatch: `QF_M${Math.floor(i / 2) + 1}`
    });
  }
  
  knockoutState.matches.QF = [];
  for (let i = 0; i < 4; i++) {
    knockoutState.matches.QF.push({
      id: `QF_M${i + 1}`,
      round: 'QF',
      number: i + 1,
      team1: null,
      team2: null,
      nextMatch: `SF_M${Math.floor(i / 2) + 1}`
    });
  }
  
  knockoutState.matches.SF = [];
  for (let i = 0; i < 2; i++) {
    knockoutState.matches.SF.push({
      id: `SF_M${i + 1}`,
      round: 'SF',
      number: i + 1,
      team1: null,
      team2: null,
      nextMatch: 'FINAL_M1'
    });
  }
  
  knockoutState.matches.FINAL = [{
    id: 'FINAL_M1',
    round: 'FINAL',
    number: 1,
    team1: null,
    team2: null,
    nextMatch: null
  }];
}

function propagateKnockoutBracket() {
  // For each round, fill in teams based on picks from previous round
  const roundOrder = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
  
  for (let r = 0; r < roundOrder.length - 1; r++) {
    const currentRound = roundOrder[r];
    const nextRound = roundOrder[r + 1];
    
    knockoutState.matches[currentRound].forEach((match, idx) => {
      const winner = knockoutState.picks[match.id];
      if (winner) {
        // Find the next match this winner goes to
        const nextMatchId = match.nextMatch;
        const nextMatch = knockoutState.matches[nextRound].find(m => m.id === nextMatchId);
        if (nextMatch) {
          // Even idx fills team1, odd idx fills team2
          if (idx % 2 === 0) {
            nextMatch.team1 = winner;
          } else {
            nextMatch.team2 = winner;
          }
        }
      } else {
        // Clear downstream if no pick
        const nextMatchId = match.nextMatch;
        const nextMatch = knockoutState.matches[nextRound].find(m => m.id === nextMatchId);
        if (nextMatch) {
          if (idx % 2 === 0) {
            nextMatch.team1 = null;
          } else {
            nextMatch.team2 = null;
          }
          // Also clear the pick for this next match (it's no longer valid)
          if (knockoutState.picks[nextMatchId] === winner) {
            delete knockoutState.picks[nextMatchId];
          }
        }
      }
    });
  }
  
  // After propagation, clear any picks for matches with TBD teams
  Object.keys(knockoutState.picks).forEach(matchId => {
    const round = matchId.split('_')[0];
    const match = knockoutState.matches[round]?.find(m => m.id === matchId);
    if (match) {
      const winner = knockoutState.picks[matchId];
      if (match.team1 !== winner && match.team2 !== winner) {
        delete knockoutState.picks[matchId];
      }
    }
  });
}

function findFirstIncompleteRound() {
  const order = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
  for (const round of order) {
    const matches = knockoutState.matches[round];
    const completed = matches.filter(m => knockoutState.picks[m.id]).length;
    if (completed < matches.length) {
      // Check if matches are ready (have both teams)
      const readyMatches = matches.filter(m => m.team1 && m.team2);
      if (readyMatches.length > 0 && readyMatches.filter(m => knockoutState.picks[m.id]).length < readyMatches.length) {
        return round;
      }
    }
  }
  return 'R32';
}

function switchRound(round) {
  knockoutState.currentRound = round;
  renderKnockout();
  window.scrollTo(0, 0);
}

function renderKnockout() {
  const round = knockoutState.currentRound;
  
  // Update title
  document.getElementById('ko-round-title').textContent = t(ROUND_INFO[round].nameKey);
  document.getElementById('ko-round-step').textContent = t('knockoutEx.pointsPerPick', { n: ROUND_INFO[round].points });
  
  // Update tab states + counters
  document.querySelectorAll('.ko-tab').forEach(tab => {
    const tabRound = tab.dataset.round;
    tab.classList.toggle('active', tabRound === round);
    
    const matches = knockoutState.matches[tabRound] || [];
    const completed = matches.filter(m => knockoutState.picks[m.id]).length;
    const total = ROUND_INFO[tabRound].total;
    
    const countEl = document.getElementById(`ko-tab-count-${tabRound}`);
    if (countEl) {
      countEl.textContent = `${completed}/${total}`;
    }
  });
  
  // Render matches
  const matches = knockoutState.matches[round] || [];
  const listEl = document.getElementById('ko-matches-list');
  const emptyEl = document.getElementById('ko-empty-state');
  
  // Check if any matches are ready
  const readyMatches = matches.filter(m => m.team1 && m.team2);
  
  if (readyMatches.length === 0 && round !== 'R32') {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
  } else {
    listEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    listEl.innerHTML = '';
    
    matches.forEach(match => {
      const card = createKnockoutPickCard(match);
      listEl.appendChild(card);
    });
  }
  
  // Update progress
  updateKnockoutProgress();
  
  // Update finish button
  updateKnockoutFinishButton();
}

// Renamed from createMatchCard: a SECOND top-level createMatchCard (the live
// scoreboard card) was defined later in this file and silently shadowed this one,
// so the two-phase knockout view rendered the wrong card. Distinct name fixes it.
function createKnockoutPickCard(match) {
  const card = document.createElement('div');
  card.className = 'ko-match-card';

  const round = match.round;
  const points = ROUND_INFO[round].points;
  const userPick = knockoutState.picks[match.id];
  
  const team1Data = match.team1 ? knockoutState.allTeams[match.team1] : null;
  const team2Data = match.team2 ? knockoutState.allTeams[match.team2] : null;
  
  // Header
  const matchLabel = round === 'FINAL' ? t('knockoutEx.finalLabel') : t('knockoutEx.matchNum', { n: match.number });
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');

  // For final, show champion declaration
  let finalDeclaration = '';
  if (round === 'FINAL') {
    finalDeclaration = `
      <div class="ko-final-declaration">
        <span class="ko-final-icon">🏆</span>
        <span class="ko-final-text">${t('knockoutEx.winnerLine')}</span>
      </div>
    `;
  }

  // Check if real match result is known
  const realResult = userPick ? wasKnockoutPickCorrect(match.id, userPick) : null;

  let resultBadge = '';
  let cardClass = 'ko-match-card';

  if (realResult === true) {
    cardClass += ' result-correct';
    // Points earned = the round's points x the pool multiplier for the picked team.
    // (The per-match user_scores table the old code read is no longer populated by
    // the v2 engine, so it always showed +0; compute it here instead.)
    const koMult = (state.currentPool && state.currentPool.use_multipliers !== false && typeof getPoolTeamMultiplier === 'function')
      ? getPoolTeamMultiplier(state.currentPool, userPick) : 1;
    const correctPoints = Math.round(points * koMult);
    resultBadge = `
      <div class="ko-result-badge correct">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${t('knockoutEx.correctLine', { n: correctPoints })}</span>
      </div>
    `;
  } else if (realResult === false) {
    cardClass += ' result-wrong';
    const winner = state.results.knockoutWinners[match.id];
    const winnerData = winner ? knockoutState.allTeams[winner] : null;
    const winnerName = winnerData ? (lang === 'he' ? (winnerData.name_he || winnerData.name_en) : (winnerData.name_en || winnerData.name_he)) : t('knockoutEx.opponent');
    resultBadge = `
      <div class="ko-result-badge wrong">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span>${t('knockoutEx.wonLine', { name: winnerName })}</span>
      </div>
    `;
  }

  card.className = cardClass;

  card.innerHTML = `
    <div class="ko-match-header">
      <span class="ko-match-number">${matchLabel}</span>
      <span>${t(ROUND_INFO[round].nameKey)}</span>
    </div>
    <div class="ko-match-teams">
      ${createTeamButton(match, team1Data, match.team1, userPick === match.team1)}
      <div class="ko-vs">VS</div>
      ${createTeamButton(match, team2Data, match.team2, userPick === match.team2)}
    </div>
    <div class="ko-match-points">
      <span>${t('knockoutEx.equalizer')}</span>
      <span class="ko-match-points-value">${t('knockoutEx.pointsValue', { n: points })}</span>
      <span>${t('knockoutEx.ifCorrect')}</span>
    </div>
    ${resultBadge}
    ${finalDeclaration}
  `;
  
  // Bind clicks
  const teamButtons = card.querySelectorAll('.ko-team');
  teamButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const teamCode = this.getAttribute('data-team');
      if (!teamCode || teamCode === 'null') return;
      pickKnockoutWinner(match.id, teamCode);
    });
  });
  
  return card;
}

function createTeamButton(match, teamData, teamCode, isSelected) {
  if (!teamData || !teamCode) {
    return `
      <div class="ko-team tbd" data-team="null">
        <div class="ko-team-flag">⏳</div>
        <div class="ko-team-name">${t('knockoutEx.tbdTeam')}</div>
      </div>
    `;
  }

  const flag = getCountryFlag(teamCode);
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  const teamName = lang === 'he' ? (teamData.name_he || teamData.name_en) : (teamData.name_en || teamData.name_he);

  return `
    <div class="ko-team ${isSelected ? 'selected' : ''}" data-team="${teamCode}">
      <div class="ko-team-flag">${flag}</div>
      <div class="ko-team-name">${teamName}</div>
    </div>
  `;
}

function pickKnockoutWinner(matchId, teamCode) {
  // Save pick
  knockoutState.picks[matchId] = teamCode;
  
  // Re-propagate bracket (this team now advances)
  propagateKnockoutBracket();
  
  // Re-render
  renderKnockout();
  
  // Auto-save
  autoSaveKnockoutPicks();
}

function updateKnockoutProgress() {
  let total = 0;
  Object.keys(ROUND_INFO).forEach(round => {
    total += knockoutState.matches[round].filter(m => knockoutState.picks[m.id]).length;
  });
  
  document.getElementById('ko-total-picks').textContent = total;
  document.getElementById('ko-progress-fill').style.width = `${(total / 31) * 100}%`;
}

function updateKnockoutFinishButton() {
  const finishBtn = document.getElementById('ko-finish-btn');
  if (!finishBtn) return;
  
  let total = 0;
  Object.keys(ROUND_INFO).forEach(round => {
    total += knockoutState.matches[round].filter(m => knockoutState.picks[m.id]).length;
  });
  
  finishBtn.style.display = total === 31 ? 'flex' : 'none';
}

// Debounced save
let knockoutSaveTimeout;
function autoSaveKnockoutPicks() {
  _tpCacheSave(); // v2.10.8: mirror locally + durable backup FIRST so a failed/blocked DB save never loses work
  clearTimeout(knockoutSaveTimeout);
  knockoutSaveTimeout = setTimeout(() => saveKnockoutPicksToDb(false), 1000);
}

// v2.10.9: returns a STRUCTURED result { ok, reason? } so finishKnockoutBetting
// can block the "completed" screen when the save didn't land.
async function saveKnockoutPicksToDb(showFeedback = true) {
  if (!state.currentUser || !state.currentPool || !supabaseClient) return { ok: false, reason: 'no-context' };

  // SAFETY GUARD (parity with the single-phase saves): an empty in-memory state
  // would make both the RPC and the legacy path delete-then-insert-nothing and
  // WIPE every saved knockout pick. Skip when there's nothing to save.
  if (Object.keys(knockoutState.picks).length === 0) {
    console.warn('saveKnockoutPicksToDb: in-memory picks empty - skipping DB write to avoid wiping real picks');
    return { ok: true, skipped: 'empty' };
  }

  // v2.10.7: server-side RPC is the ONLY working write path (anon write on
  // knockout_picks is REVOKEd; the legacy direct write below 401s for every real
  // user). Mirror the single-phase v2.9.12 fix: retry a transient PGRST202
  // (schema-cache reload) and NEVER silently fall through to the dead direct
  // write — the silent failure is why two-phase brackets vanished at scale. The
  // RPC replaces only the caller's two-phase knockout rows (bracket_position NULL)
  // and computes multiplier_applied server-side.
  const code = _currentRecoveryCode();
  if (!code) {
    console.error('saveKnockoutPicksToDb: no recovery code in session — cannot save knockout picks');
    showToast(t('bracketSave.noCode'), 'error');
    return { ok: false, reason: 'no-code' };
  }

  const picks = Object.keys(knockoutState.picks).map(matchId => ({
    match_id: matchId,
    round: matchId.split('_')[0],
    predicted_winner: knockoutState.picks[matchId]
  }));
  const res = await _rpcWrite('save_knockout_picks_2p', { p_code: code, p_picks: picks });
  if (res.ok) {
    if (showFeedback) showToast(t('knockoutEx.savedOk'), 'success');
    return { ok: true };
  }
  if (!res.missing) {
    console.error('Knockout save RPC error:', res.error);
    showToast(t('groups.saveError'), 'error');
    return { ok: false, reason: 'rpc-error', error: res.error };
  }
  // Still PGRST202 after all retries: don't attempt the dead anon direct write
  // (it would only 401). Be honest so the user retries instead of losing picks.
  console.error('saveKnockoutPicksToDb: save_knockout_picks_2p unreachable after retries');
  showToast(t('bracketSave.retryLater'), 'error');
  return { ok: false, reason: 'unreachable' };
}

function exitKnockoutBetting() {
  let total = 0;
  Object.keys(ROUND_INFO).forEach(round => {
    total += knockoutState.matches[round].filter(m => knockoutState.picks[m.id]).length;
  });

  if (total > 0 && total < 31) {
    if (!confirm(t('groups.exitConfirm', { n: total + '/31' }))) {
      return;
    }
  }
  goToDashboard();
}

async function finishKnockoutBetting() {
  // v2.10.9: only show "completed" + leave if the save actually landed
  // (saveKnockoutPicksToDb toasts an honest error on failure).
  const res = await saveKnockoutPicksToDb(false);
  if (!res || !res.ok) return;
  showToast(t('knockoutEx.completed'), 'success');
  setTimeout(() => goToDashboard(), 1000);
}

// ============================================================
// SIMULATOR
// ============================================================

function openSimulator() {
  const analysis = analyzeKnockoutStrategy();
  
  // Update display
  document.getElementById('sim-expected-score').textContent = analysis.expected;
  document.getElementById('sim-max-score').textContent = analysis.maxPossible;
  
  // Risk meter (0-100 scale, position from safe end of inline axis)
  const riskPos = Math.min(95, Math.max(5, analysis.riskScore));
  document.getElementById('sim-risk-marker').style.insetInlineStart = `${riskPos}%`;
  document.getElementById('sim-risk-marker').style.right = '';
  document.getElementById('sim-risk-description').textContent = analysis.riskDescription;
  
  // Stages
  renderStagesBreakdown(analysis.stages);
  
  // Recommendation
  document.getElementById('sim-rec-text').textContent = analysis.recommendation;
  
  // Show
  document.getElementById('simulator-overlay').classList.add('active');
  document.getElementById('simulator-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSimulator() {
  document.getElementById('simulator-overlay').classList.remove('active');
  document.getElementById('simulator-modal').classList.remove('active');
  document.body.style.overflow = '';
}

function analyzeKnockoutStrategy() {
  let totalExpected = 0;
  let totalMax = 0;
  let riskSum = 0;
  let riskCount = 0;
  const stages = {};
  
  Object.keys(ROUND_INFO).forEach(round => {
    const points = ROUND_INFO[round].points;
    const matches = knockoutState.matches[round];
    
    let picked = 0;
    let stageExpected = 0;
    let stageMax = 0;
    
    matches.forEach(match => {
      stageMax += points * 2; // max if we bet on the favored team with multiplier 2
      
      const winner = knockoutState.picks[match.id];
      if (winner) {
        picked++;
        const team = knockoutState.allTeams[winner];
        const multiplier = (state.currentPool && state.currentPool.use_multipliers !== false)
          ? getPoolTeamMultiplier(state.currentPool, winner)
          : 1.0;
        const tierProbability = getTeamWinProbability(team);
        
        // Expected = points * multiplier * probability
        const expected = points * multiplier * tierProbability;
        stageExpected += expected;
        
        // Risk: higher when betting underdogs
        riskSum += (1 - tierProbability);
        riskCount++;
      }
    });
    
    stages[round] = {
      name: t(ROUND_INFO[round].nameKey),
      picked: picked,
      total: ROUND_INFO[round].total,
      expected: Math.round(stageExpected),
      max: Math.round(stageMax)
    };
    
    totalExpected += stageExpected;
    totalMax += stageMax;
  });
  
  // Risk score: 0 (all favorites) to 100 (all underdogs)
  const avgRisk = riskCount > 0 ? (riskSum / riskCount) : 0.5;
  const riskScore = Math.round(avgRisk * 100);
  
  // Risk description
  let riskDescription;
  if (riskCount === 0) {
    riskDescription = t('simulatorEx.riskDefault');
  } else if (riskScore < 30) {
    riskDescription = t('simulatorEx.riskDescSafe');
  } else if (riskScore < 55) {
    riskDescription = t('simulatorEx.riskDescBalanced');
  } else if (riskScore < 75) {
    riskDescription = t('simulatorEx.riskDescRisky');
  } else {
    riskDescription = t('simulatorEx.riskDescVery');
  }

  // Recommendation
  let recommendation;
  const totalPicked = Object.values(stages).reduce((s, v) => s + v.picked, 0);
  if (totalPicked === 0) {
    recommendation = t('simulatorEx.recEarly');
  } else if (totalPicked < 10) {
    recommendation = t('simulatorEx.recContinue');
  } else if (riskScore < 30) {
    recommendation = t('simulatorEx.recTooSafe');
  } else if (riskScore > 70) {
    recommendation = t('simulatorEx.recTooRisky');
  } else {
    recommendation = t('simulatorEx.recBalanced');
  }
  
  return {
    expected: Math.round(totalExpected),
    maxPossible: Math.round(totalMax),
    riskScore: riskScore,
    riskDescription: riskDescription,
    stages: stages,
    recommendation: recommendation
  };
}

function getTeamWinProbability(team) {
  if (!team) return 0.5;
  // Probability of advancing based on tier
  switch (team.tier) {
    case 'favorite':  return 0.65;  // Strong teams usually advance
    case 'contender': return 0.45;  // Mid teams - 50/50
    case 'underdog':  return 0.25;  // Weak teams rarely advance
    default: return 0.4;
  }
}

// ============================================================
// BRACKET VIEW - Professional tournament tree with SVG lines
// ============================================================

const bracketViewState = {
  isZoomedIn: false
};

// Layout constants
const BRACKET_LAYOUT = {
  // Mini mode dimensions
  mini: {
    cardWidth: 130,
    cardHeight: 50,
    columnGap: 50,
    r32VerticalGap: 14,
    topPadding: 50,
    sidePadding: 20
  },
  zoom: {
    cardWidth: 180,
    cardHeight: 64,
    columnGap: 60,
    r32VerticalGap: 18,
    topPadding: 60,
    sidePadding: 25
  }
};

function getLayout() {
  return bracketViewState.isZoomedIn ? BRACKET_LAYOUT.zoom : BRACKET_LAYOUT.mini;
}

function openBracketView() {
  renderBracketView();
  showScreen('bracket-screen');
  
  // Center the bracket horizontally and scroll vertically to the middle
  setTimeout(() => {
    const container = document.getElementById('bracket-scroll-container');
    if (container) {
      // Center horizontally - scroll to middle of total width
      const horizontalCenter = (container.scrollWidth - container.clientWidth) / 2;
      container.scrollLeft = Math.max(0, horizontalCenter);
      
      // Also center vertically if the bracket is taller than viewport
      const verticalCenter = (container.scrollHeight - container.clientHeight) / 2;
      container.scrollTop = Math.max(0, verticalCenter);
    }
  }, 100);
}

function closeBracketView() {
  // v2.5.86: return to the modern single-match walkthrough, not the old grid.
  _koOpenTwoPhaseWalkthrough(
    (koSingle.mode === 'two-phase' && koSingle.sequence.length) ? koSingle.idx : _koFirstIncompleteTwoPhaseIdx()
  );
}

function toggleBracketZoom() {
  bracketViewState.isZoomedIn = !bracketViewState.isZoomedIn;
  
  const icon = document.getElementById('bracket-zoom-icon');
  if (icon) {
    if (bracketViewState.isZoomedIn) {
      icon.innerHTML = `
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <line x1="8" y1="11" x2="14" y2="11"></line>
      `;
    } else {
      icon.innerHTML = `
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <line x1="11" y1="8" x2="11" y2="14"></line>
        <line x1="8" y1="11" x2="14" y2="11"></line>
      `;
    }
  }
  
  // Re-render with new layout
  renderBracketView();
}

function renderBracketView() {
  const tree = document.getElementById('bracket-tree');
  if (!tree) return;
  
  tree.innerHTML = '';
  
  // Update progress text
  let totalPicked = 0;
  Object.keys(ROUND_INFO).forEach(round => {
    totalPicked += knockoutState.matches[round].filter(m => knockoutState.picks[m.id]).length;
  });
  const progressEl = document.getElementById('bracket-progress-text');
  if (progressEl) progressEl.textContent = t('knockoutEx.matchesProgress', { n: totalPicked });
  
  // Update jump tabs with status
  document.querySelectorAll('.bracket-jump-tab').forEach(tab => {
    const round = tab.dataset.round;
    const matches = knockoutState.matches[round] || [];
    const picked = matches.filter(m => knockoutState.picks[m.id]).length;
    tab.classList.toggle('has-picks', picked > 0);
  });
  
  const L = getLayout();
  
  // Calculate column X positions
  // Layout (LTR): R32-L | R16-L | QF-L | SF-L | FINAL | SF-R | QF-R | R16-R | R32-R
  // 9 columns total
  
  const colPositions = {};
  let xPos = L.sidePadding;
  
  // Left side (matches 9-16 of R32 logically, but visually on left)
  colPositions.R32_left = xPos; xPos += L.cardWidth + L.columnGap;
  colPositions.R16_left = xPos; xPos += L.cardWidth + L.columnGap;
  colPositions.QF_left  = xPos; xPos += L.cardWidth + L.columnGap;
  colPositions.SF_left  = xPos; xPos += L.cardWidth + L.columnGap;
  colPositions.FINAL    = xPos; xPos += L.cardWidth + L.columnGap;
  colPositions.SF_right = xPos; xPos += L.cardWidth + L.columnGap;
  colPositions.QF_right = xPos; xPos += L.cardWidth + L.columnGap;
  colPositions.R16_right = xPos; xPos += L.cardWidth + L.columnGap;
  colPositions.R32_right = xPos; xPos += L.cardWidth;
  
  const totalWidth = xPos + L.sidePadding;
  
  // Calculate Y positions for R32 (the base of the tree)
  // 8 matches in each half-bracket, vertical layout
  const r32Spacing = L.cardHeight + L.r32VerticalGap;
  const totalR32Height = 8 * r32Spacing;
  
  // Calculate match positions
  // Side mapping:
  //   right side: R32 matches 1-8 -> R16 1-4 -> QF 1-2 -> SF 1
  //   left side: R32 matches 9-16 -> R16 5-8 -> QF 3-4 -> SF 2
  //   Final: SF1 vs SF2
  
  const positions = {}; // match_id -> {x, y, width, height}
  
  // RIGHT SIDE positions
  for (let i = 0; i < 8; i++) {
    const matchId = `R32_M${i + 1}`;
    positions[matchId] = {
      x: colPositions.R32_right,
      y: L.topPadding + (i * r32Spacing),
      side: 'right',
      round: 'R32'
    };
  }
  
  // R16 right: each R16 is centered between two R32 matches
  for (let i = 0; i < 4; i++) {
    const matchId = `R16_M${i + 1}`;
    const r32a = positions[`R32_M${i * 2 + 1}`];
    const r32b = positions[`R32_M${i * 2 + 2}`];
    positions[matchId] = {
      x: colPositions.R16_right,
      y: (r32a.y + r32b.y) / 2,
      side: 'right',
      round: 'R16'
    };
  }
  
  // QF right
  for (let i = 0; i < 2; i++) {
    const matchId = `QF_M${i + 1}`;
    const r16a = positions[`R16_M${i * 2 + 1}`];
    const r16b = positions[`R16_M${i * 2 + 2}`];
    positions[matchId] = {
      x: colPositions.QF_right,
      y: (r16a.y + r16b.y) / 2,
      side: 'right',
      round: 'QF'
    };
  }
  
  // SF right (SF_M1)
  {
    const qfa = positions['QF_M1'];
    const qfb = positions['QF_M2'];
    positions['SF_M1'] = {
      x: colPositions.SF_right,
      y: (qfa.y + qfb.y) / 2,
      side: 'right',
      round: 'SF'
    };
  }
  
  // LEFT SIDE positions (matches 9-16, R16 5-8, QF 3-4, SF 2)
  for (let i = 0; i < 8; i++) {
    const matchId = `R32_M${i + 9}`;
    positions[matchId] = {
      x: colPositions.R32_left,
      y: L.topPadding + (i * r32Spacing),
      side: 'left',
      round: 'R32'
    };
  }
  
  for (let i = 0; i < 4; i++) {
    const matchId = `R16_M${i + 5}`;
    const r32a = positions[`R32_M${(i * 2) + 9}`];
    const r32b = positions[`R32_M${(i * 2) + 10}`];
    positions[matchId] = {
      x: colPositions.R16_left,
      y: (r32a.y + r32b.y) / 2,
      side: 'left',
      round: 'R16'
    };
  }
  
  for (let i = 0; i < 2; i++) {
    const matchId = `QF_M${i + 3}`;
    const r16a = positions[`R16_M${(i * 2) + 5}`];
    const r16b = positions[`R16_M${(i * 2) + 6}`];
    positions[matchId] = {
      x: colPositions.QF_left,
      y: (r16a.y + r16b.y) / 2,
      side: 'left',
      round: 'QF'
    };
  }
  
  {
    const qfa = positions['QF_M3'];
    const qfb = positions['QF_M4'];
    positions['SF_M2'] = {
      x: colPositions.SF_left,
      y: (qfa.y + qfb.y) / 2,
      side: 'left',
      round: 'SF'
    };
  }
  
  // FINAL position (centered between SF1 and SF2)
  {
    const sf1 = positions['SF_M1'];
    const sf2 = positions['SF_M2'];
    positions['FINAL_M1'] = {
      x: colPositions.FINAL,
      y: (sf1.y + sf2.y) / 2,
      side: 'center',
      round: 'FINAL'
    };
  }
  
  // Total height
  const totalHeight = L.topPadding + totalR32Height + 80; // 80px extra for champion display
  
  // Set tree dimensions
  tree.style.width = `${totalWidth}px`;
  tree.style.height = `${totalHeight}px`;
  
  // ====== RENDER SVG LINES LAYER ======
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.classList.add('bracket-svg-layer');
  svg.setAttribute('width', totalWidth);
  svg.setAttribute('height', totalHeight);
  svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
  
  // Draw connectors: from each match to its next match
  // Each pair of matches goes to one next match
  // We draw: horizontal line from card -> midpoint -> next card
  
  function drawConnector(fromMatch, toMatch, isActive) {
    const from = positions[fromMatch];
    const to = positions[toMatch];
    if (!from || !to) return;
    
    const cardW = L.cardWidth;
    const cardH = L.cardHeight;
    
    let fromX, toX;
    // Right side: connectors go right (from right edge of card to left edge of next)
    // Left side: connectors go right too (we read left-to-right visually but tree converges to center)
    
    // Wait - need to think about RTL layout:
    // Left columns connect rightward (toward FINAL)
    // Right columns connect leftward (toward FINAL)
    
    if (from.side === 'left' || (from.round === 'SF' && from.side === 'left')) {
      // Left side: lines go right
      fromX = from.x + cardW;
      toX = to.x;
    } else if (from.side === 'right') {
      // Right side: lines go left  
      fromX = from.x;
      toX = to.x + cardW;
    }
    
    const fromY = from.y + cardH / 2;
    const toY = to.y + cardH / 2;
    
    // Midpoint x (halfway between from and to)
    const midX = (fromX + toX) / 2;
    
    // Path: from -> midX (horizontal) -> midX, toY (vertical) -> toX, toY (horizontal)
    const path = document.createElementNS(svgNS, 'path');
    const d = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
    path.setAttribute('d', d);
    path.classList.add('bracket-connector-line');
    if (isActive) path.classList.add('active');
    path.setAttribute('stroke', isActive ? 'rgba(212, 168, 83, 0.85)' : 'rgba(212, 168, 83, 0.3)');
    path.setAttribute('stroke-width', isActive ? '2' : '1.5');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
  }
  
  // Draw all connectors
  const rounds = ['R32', 'R16', 'QF', 'SF'];
  rounds.forEach(round => {
    knockoutState.matches[round].forEach((match, idx) => {
      if (match.nextMatch) {
        const userPick = knockoutState.picks[match.id];
        const isActive = !!userPick;
        drawConnector(match.id, match.nextMatch, isActive);
      }
    });
  });
  
  tree.appendChild(svg);
  
  // ====== RENDER CARDS LAYER ======
  const cardsLayer = document.createElement('div');
  cardsLayer.className = 'bracket-cards-layer';
  cardsLayer.style.position = 'relative';
  cardsLayer.style.width = `${totalWidth}px`;
  cardsLayer.style.height = `${totalHeight}px`;
  
  // Add round headers
  const headers = [
    { round: 'R32', side: 'left',  labelKey: 'bracketView.r32' },
    { round: 'R16', side: 'left',  labelKey: 'bracketView.r16' },
    { round: 'QF',  side: 'left',  labelKey: 'bracketView.qf' },
    { round: 'SF',  side: 'left',  labelKey: 'bracketView.sf' },
    { round: 'FINAL', side: 'center', labelKey: 'bracketView.final' },
    { round: 'SF',  side: 'right', labelKey: 'bracketView.sf' },
    { round: 'QF',  side: 'right', labelKey: 'bracketView.qf' },
    { round: 'R16', side: 'right', labelKey: 'bracketView.r16' },
    { round: 'R32', side: 'right', labelKey: 'bracketView.r32' }
  ];
  
  headers.forEach(h => {
    const key = h.round === 'FINAL' ? 'FINAL' : `${h.round}_${h.side}`;
    const x = colPositions[key];
    if (x === undefined) return;
    
    const header = document.createElement('div');
    header.className = 'bracket-round-header';
    header.style.left = `${x}px`;
    header.style.top = '10px';
    header.style.width = `${L.cardWidth}px`;
    header.textContent = t(h.labelKey);
    cardsLayer.appendChild(header);
  });
  
  // Trophy decoration for FINAL
  const trophyDeco = document.createElement('div');
  trophyDeco.className = 'bracket-trophy-decoration';
  trophyDeco.style.left = `${colPositions.FINAL + L.cardWidth / 2 - 16}px`;
  trophyDeco.style.top = `${positions.FINAL_M1.y - 50}px`;
  trophyDeco.textContent = '🏆';
  cardsLayer.appendChild(trophyDeco);
  
  // Render all match cards
  Object.keys(positions).forEach(matchId => {
    const pos = positions[matchId];
    const roundKey = matchId.startsWith('FINAL') ? 'FINAL' : matchId.split('_')[0];
    const matchArr = knockoutState.matches[roundKey];
    const match = matchArr.find(m => m.id === matchId);
    if (!match) return;
    
    const card = createBracketCard(match, roundKey === 'FINAL');
    card.style.left = `${pos.x}px`;
    card.style.top = `${pos.y}px`;
    card.style.width = `${L.cardWidth}px`;
    card.style.height = `${L.cardHeight}px`;
    
    cardsLayer.appendChild(card);
  });
  
  // Champion display below final
  const final = knockoutState.matches.FINAL[0];
  const winner = final ? knockoutState.picks[final.id] : null;
  const winnerData = winner ? knockoutState.allTeams[winner] : null;
  
  const champion = document.createElement('div');
  champion.className = 'bracket-champion-display';
  champion.style.left = `${colPositions.FINAL - 10}px`;
  champion.style.top = `${positions.FINAL_M1.y + L.cardHeight + 20}px`;
  champion.style.width = `${L.cardWidth + 20}px`;
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  const winnerName = winnerData ? (lang === 'he' ? (winnerData.name_he || winnerData.name_en) : (winnerData.name_en || winnerData.name_he)) : null;
  champion.innerHTML = `
    <div class="bracket-champion-display-label">${t('bracketView.championLabel')}</div>
    <div class="bracket-champion-display-name ${winnerData ? '' : 'tbd'}">
      ${winnerData ? `${getCountryFlag(winner)} ${winnerName}` : t('bracketView.tbd')}
    </div>
  `;
  cardsLayer.appendChild(champion);
  
  tree.appendChild(cardsLayer);
  
  // Bind clicks
  cardsLayer.querySelectorAll('.bracket-card').forEach(el => {
    el.addEventListener('click', function() {
      const matchId = this.getAttribute('data-match-id');
      if (matchId && !this.classList.contains('tbd')) {
        jumpToMatch(matchId);
      }
    });
  });
}

function createBracketCard(match, isFinal) {
  if (!match) return document.createElement('div');
  
  const userPick = knockoutState.picks[match.id];
  const team1Data = match.team1 ? knockoutState.allTeams[match.team1] : null;
  const team2Data = match.team2 ? knockoutState.allTeams[match.team2] : null;
  
  const team1Flag = match.team1 ? getCountryFlag(match.team1) : '⏳';
  const team2Flag = match.team2 ? getCountryFlag(match.team2) : '⏳';
  
  let team1Class = team1Data ? 'neutral' : 'tbd';
  let team2Class = team2Data ? 'neutral' : 'tbd';
  
  if (userPick) {
    if (userPick === match.team1) {
      team1Class = 'winner';
      team2Class = team2Data ? 'loser' : 'tbd';
    } else if (userPick === match.team2) {
      team2Class = 'winner';
      team1Class = team1Data ? 'loser' : 'tbd';
    }
  }
  
  let statusClass;
  if (userPick) statusClass = 'done';
  else if (team1Data && team2Data) statusClass = 'pending';
  else statusClass = 'tbd';
  
  const card = document.createElement('div');
  card.className = `bracket-card bracket-${statusClass}${isFinal ? ' final-card' : ''}`;
  card.setAttribute('data-match-id', match.id);
  
  const bracketLang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  const team1Name = team1Data ? (bracketLang === 'he' ? (team1Data.name_he || team1Data.name_en) : (team1Data.name_en || team1Data.name_he)) : 'TBD';
  const team2Name = team2Data ? (bracketLang === 'he' ? (team2Data.name_he || team2Data.name_en) : (team2Data.name_en || team2Data.name_he)) : 'TBD';
  
  card.innerHTML = `
    <div class="bracket-card-num">#${match.number}</div>
    <div class="bracket-card-team ${team1Class}">
      <span class="bracket-card-flag">${team1Flag}</span>
      <span class="bracket-card-name">${team1Name}</span>
    </div>
    <div class="bracket-card-team ${team2Class}">
      <span class="bracket-card-flag">${team2Flag}</span>
      <span class="bracket-card-name">${team2Name}</span>
    </div>
  `;
  
  return card;
}

function jumpToRound(round) {
  const container = document.getElementById('bracket-scroll-container');
  if (!container) return;
  
  const L = getLayout();
  
  // Find center of this round in the bracket
  let targetX;
  if (round === 'FINAL') {
    // Center of the layout
    targetX = container.scrollWidth / 2;
  } else if (round === 'R32') {
    // Go to right side
    targetX = container.scrollWidth - container.clientWidth / 2;
  } else if (round === 'R16') {
    targetX = container.scrollWidth * 0.78;
  } else if (round === 'QF') {
    targetX = container.scrollWidth * 0.64;
  } else if (round === 'SF') {
    targetX = container.scrollWidth * 0.56;
  }
  
  container.scrollTo({
    left: targetX - container.clientWidth / 2,
    behavior: 'smooth'
  });
}

function jumpToMatch(matchId) {
  // v2.5.86: open the modern single-match walkthrough at the tapped match
  // instead of the retired all-on-one-page grid.
  const seq = _koTwoPhaseSequence();
  const idx = seq.findIndex(s => s.id === matchId);
  _koOpenTwoPhaseWalkthrough(idx >= 0 ? idx : 0);
}

function renderBracketConnectors() {
  // Re-renders the bracket which redraws connectors
  renderBracketView();
}

function renderStagesBreakdown(stages) {
  const container = document.getElementById('sim-stages-breakdown');
  container.innerHTML = '';
  
  ['R32', 'R16', 'QF', 'SF', 'FINAL'].forEach(round => {
    const stage = stages[round];
    if (!stage) return;
    
    const row = document.createElement('div');
    row.className = 'sim-stage-row';
    
    const progress = stage.total > 0 ? (stage.picked / stage.total) * 100 : 0;
    
    row.innerHTML = `
      <span class="sim-stage-name">${stage.name}</span>
      <div class="sim-stage-progress">
        <div class="sim-stage-progress-fill" style="width: ${progress}%"></div>
      </div>
      <span class="sim-stage-count">${stage.picked}/${stage.total}</span>
    `;
    
    container.appendChild(row);
  });
}

// Update dashboard knockout status
// v2.5.28: real-world group-stage completion check. Knockout opens only
// when every GROUP_STAGE match has finished. Replaces the old "user
// finished their group picks" gate, which let users into the knockout
// flow before the real tournament knockout existed.
async function _isGroupStageOver() {
  if (!supabaseClient) return false;
  try {
    const { data, error } = await supabaseClient
      .from('matches')
      .select('id,status')
      .eq('stage', 'GROUP_STAGE')
      .neq('status', 'FINISHED')
      .limit(1);
    if (error) {
      console.warn('_isGroupStageOver query failed:', error);
      return false;
    }
    // No unfinished group-stage matches = group stage is over
    return Array.isArray(data) && data.length === 0;
  } catch (err) {
    console.warn('_isGroupStageOver err:', err);
    return false;
  }
}

async function updateKnockoutStatusOnDashboard() {
  if (!state.currentUser || !supabaseClient) return;

  // v2.4: knockout/top-scorer cards are hidden in single_phase mode (the user
  // already predicts these in the unified flow), so nothing to update here.
  if (state.currentPool && state.currentPool.betting_mode === 'single_phase') {
    return;
  }

  // v2.5.29: target by ID. The previous querySelectorAll(.bet-status-card)[1]
  // was actually picking the top-scorer card (knockout is index 0), causing
  // both cards to display "knockout" content. Bug shipped since v2.4-ish.
  const koCard = document.getElementById('bet-status-knockout');
  if (!koCard) return;

  // v2.5.28: gate on REAL-WORLD group stage completion, not user's own
  // pick count. Knockout betting is only meaningful once the group stage
  // is over and the actual R16 matchups are known.
  const groupStageDone = await _isGroupStageOver();

  const koLabel = t('dashboard.status.knockout');
  if (!groupStageDone) {
    // Still locked - group stage hasn't finished in the real tournament yet
    koCard.className = 'bet-status-card locked';
    const titleEl = koCard.querySelector('.bet-status-title');
    const subtitleEl = koCard.querySelector('.bet-status-subtitle');
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> ' + koLabel;
    if (subtitleEl) subtitleEl.textContent = t('dashboard.status.afterGroups');

    // Remove any button
    const existingBtn = koCard.querySelector('button');
    if (existingBtn) existingBtn.remove();
    return;
  }
  
  // Group complete - knockout is open
  const { data: koPicks } = await supabaseClient
    .from('knockout_picks')
    .select('id')
    .eq('user_id', state.currentUser.id);
  
  const koCount = koPicks ? koPicks.length : 0;
  
  const titleEl = koCard.querySelector('.bet-status-title');
  const subtitleEl = koCard.querySelector('.bet-status-subtitle');
  
  let existingBtn = koCard.querySelector('button');
  if (!existingBtn) {
    existingBtn = document.createElement('button');
    existingBtn.className = 'btn-small';
    koCard.appendChild(existingBtn);
  }
  
  existingBtn.onclick = () => startKnockoutBetting();
  
  if (koCount === 0) {
    koCard.className = 'bet-status-card pending';
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9b46a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> ' + koLabel;
    if (subtitleEl) subtitleEl.textContent = t('dashboard.status.koReady');
    existingBtn.innerHTML = t('dashboard.action.start') + ' →';
  } else if (koCount < 31) {
    koCard.className = 'bet-status-card pending';
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ecd49a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> ' + koLabel;
    if (subtitleEl) subtitleEl.textContent = t('dashboard.status.partialKo', { n: koCount });
    existingBtn.innerHTML = t('dashboard.action.continue') + ' →';
  } else {
    koCard.className = 'bet-status-card completed';
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ' + koLabel;
    if (subtitleEl) subtitleEl.textContent = t('dashboard.status.completedKo');
    existingBtn.innerHTML = t('dashboard.action.edit') + ' →';
  }
}

async function showLeaderboard() {
  closeMenu();

  if (!state.currentPool || !supabaseClient) {
    showToast(t('toast.loadError'), 'error');
    return;
  }

  showScreen('leaderboard-screen');

  // Update pool info
  document.getElementById('lb-pool-name').textContent = state.currentPool.name;

  // Load all users sorted by score
  const { data: users, error } = await supabaseClient
    .from('users')
    .select(USER_PUBLIC_COLS)
    .eq('pool_id', state.currentPool.id)
    .order('total_score', { ascending: false })
    .order('joined_at', { ascending: true });

  if (error || !users) {
    console.error('Leaderboard load error:', error);
    showToast(t('leaderboard.loadError'), 'error');
    return;
  }

  document.getElementById('lb-members-count').textContent = t('leaderboard.participantsCount', { n: users.length });

  // Check tournament status (for now - always pre-tournament)
  const totalScores = users.reduce((sum, u) => sum + (u.total_score || 0), 0);
  const hasScores = totalScores > 0;

  document.getElementById('lb-tournament-status').textContent =
    hasScores ? t('leaderboard.statusDuring') : t('leaderboard.statusBefore');

  // Render podium (top 3)
  renderPodium(users);

  // Pool Pundit: live banter about what the latest results did to the board
  renderLeaderboardBanter(users);

  // Render full list
  renderFullLeaderboard(users);

  // Empty state
  const emptyEl = document.getElementById('lb-empty');
  if (!hasScores) {
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
  }
}

function renderPodium(users) {
  const podium = document.getElementById('lb-podium');
  podium.innerHTML = '';
  
  if (users.length === 0) return;
  
  // Take top 3 (or fewer)
  const top3 = users.slice(0, 3);
  
  // Always build in order: 2nd, 1st, 3rd (visual order)
  const second = top3[1];
  const first = top3[0];
  const third = top3[2];
  
  if (second) {
    podium.appendChild(createPodiumSpot('second', second, 2));
  } else {
    podium.appendChild(createEmptyPodium('second'));
  }
  
  if (first) {
    podium.appendChild(createPodiumSpot('first', first, 1));
  }
  
  if (third) {
    podium.appendChild(createPodiumSpot('third', third, 3));
  } else {
    podium.appendChild(createEmptyPodium('third'));
  }
}

function createPodiumSpot(rank, user, rankNum) {
  const div = document.createElement('div');
  div.className = `podium-spot ${rank}`;
  
  const medal = rankNum === 1 ? '🥇' : (rankNum === 2 ? '🥈' : '🥉');
  const medalClass = 'podium-medal';
  
  div.innerHTML = `
    <div class="${medalClass}">${medal}</div>
    <div class="podium-name">${escapeHtml(user.nickname || '?')}</div>
    <div class="podium-points">${user.total_score || 0}</div>
    <div class="podium-points-label">${t('leaderboard.points')}</div>
  `;

  return div;
}

function createEmptyPodium(rank) {
  const div = document.createElement('div');
  div.className = `podium-spot ${rank}`;
  div.style.opacity = '0.3';
  div.innerHTML = `
    <div class="podium-medal">—</div>
    <div class="podium-name text-faint">${t('leaderboard.podiumEmpty')}</div>
  `;
  return div;
}

function renderFullLeaderboard(users) {
  const list = document.getElementById('lb-full-list');
  list.innerHTML = '';

  if (users.length === 0) {
    list.innerHTML = `<div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.4);">${t('leaderboard.empty')}</div>`;
    return;
  }

  users.forEach((user, idx) => {
    const row = document.createElement('div');
    row.className = 'lb-row';

    const isMe = state.currentUser && user.id === state.currentUser.id;
    if (isMe) row.classList.add('is-me');

    const rank = idx + 1;

    // v2 breakdown - new columns fall back to legacy ones
    const groupPts = (user.group_points ?? user.groups_score) || 0;
    const knockoutPts = (user.knockout_points ?? user.knockout_score) || 0;
    const bonusPts = (user.bonus_points ?? user.bonus_score) || 0;
    const isSinglePhase = state.currentPool && state.currentPool.betting_mode === 'single_phase';

    row.innerHTML = `
      <div class="lb-rank">#${rank}</div>
      <div class="lb-avatar-small">${escapeHtml((user.nickname || '?').charAt(0).toUpperCase())}</div>
      <div class="lb-info">
        <div class="lb-name">
          ${escapeHtml(user.nickname)}
          ${user.is_admin ? `<span class="admin-badge">${t('common.admin')}</span>` : ''}
          ${isMe ? `<span class="lb-badge">${t('common.you')}</span>` : ''}
        </div>
        <div class="lb-breakdown">
          <span>${t('leaderboard.breakdown.group')}: <span class="lb-bd-gold">${groupPts}</span></span>
          <span>${t('leaderboard.breakdown.knockout')}: <span class="lb-bd-gold">${knockoutPts}</span></span>
          <span>${t('leaderboard.breakdown.bonus')}: <span class="lb-bd-gold">${bonusPts}</span></span>
        </div>
      </div>
      <div>
        <div class="lb-points">${user.total_score || 0}</div>
        <div class="lb-points-label">${t('leaderboard.points')}</div>
      </div>
    `;

    list.appendChild(row);
  });
}

function formatScoreDescription(user) {
  const parts = [];
  if (user.groups_score > 0) parts.push(`${t('leaderboard.groups')}: ${user.groups_score}`);
  if (user.knockout_score > 0) parts.push(`${t('leaderboard.knockout')}: ${user.knockout_score}`);
  if (user.bonus_score > 0) parts.push(`${t('leaderboard.bonus')}: ${user.bonus_score}`);

  if (parts.length === 0) return t('leaderboard.noPointsYet');
  return parts.join(' · ');
}

// ============================================================
// Pool Pundit — leaderboard banter (live commentary below the podium)
// ============================================================
// Reads the per-pool banter file produced by scripts/generate-banter.js (which
// diffs the standings after each match and turns the moves into witty, BILINGUAL
// lines). The client just picks the current language and renders; the share card
// re-uses the headline + podium + a QR pointing to the FEATURED user's bracket.
let _lbBanter = null; // last loaded { headline, items, ... } for the share card

function _banterText(item) {
  if (!item) return '';
  const lang = (typeof currentLanguage !== 'undefined' && currentLanguage) || 'he';
  return (lang === 'en' ? item.en : item.he) || item.he || item.en || '';
}

// Strip a trailing emoji a witty line may already carry, so when we prepend the
// event's category emoji as a bullet the icon isn't doubled (card + in-app).
function _stripTrailingEmoji(s) {
  return String(s || '').replace(/[\s\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}️‍]+$/u, '');
}

async function renderLeaderboardBanter(users) {
  const box = document.getElementById('lb-banter');
  if (!box) return;
  _lbBanter = null;
  box.style.display = 'none';
  try {
    if (!state.currentPool || !state.currentPool.id) return;
    const res = await fetch(`/public-data/banter/${state.currentPool.id}.json`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items.filter(it => it && (it.he || it.en)) : [];
    const headline = data.headline || items[0];
    if (!headline) return;

    // Resolve the featured user (for the share QR) — must be a real member of THIS pool.
    const memberIds = new Set((users || []).map(u => u.id));
    const featId = (headline.featuredUserId && memberIds.has(headline.featuredUserId))
      ? headline.featuredUserId : ((users && users[0] && users[0].id) || null);
    // Stash the top-3 (already score-sorted by the query) for the share card.
    const podium = (users || []).slice(0, 3).map(u => ({
      nickname: u.nickname || '?', total_score: u.total_score || 0,
    }));
    _lbBanter = { headline, items, featuredUserId: featId, podium };

    const headEl = document.getElementById('lb-banter-headline');
    if (headEl) headEl.innerHTML = `<span class="lb-banter-emoji">${headline.emoji || '🎙️'}</span>${escapeHtml(_stripTrailingEmoji(_banterText(headline)))}`;

    // Up to two more lines (skip the headline), as quieter secondary banter.
    const moreEl = document.getElementById('lb-banter-more');
    if (moreEl) {
      const extras = items.filter(it => it.id !== headline.id).slice(0, 2);
      moreEl.innerHTML = extras.map(it =>
        `<div class="lb-banter-line"><span class="lb-banter-emoji">${it.emoji || '•'}</span>${escapeHtml(_stripTrailingEmoji(_banterText(it)))}</div>`
      ).join('');
    }
    box.style.display = 'block';
  } catch (_) { /* never block the leaderboard */ }
}

// Personalized public share URL for ANY pool member's bracket (used by the QR on
// the pool-moment card, so a scan opens the FEATURED user's predictions).
function _userShareUrl(userId, source) {
  const origin = window.location.origin || 'https://friendlybet.live';
  const pid = state.currentPool && state.currentPool.id;
  const lang = (typeof currentLanguage !== 'undefined' && currentLanguage) || 'he';
  const utm = `utm_source=${source}&utm_medium=social&utm_campaign=pool_moment`;
  return (userId && pid)
    ? `${origin}/share?u=${userId}&p=${pid}&lang=${lang}&${utm}`
    : `${origin}/?${utm}`;
}

// Generic QR loader (CORS-safe canvas image) for an arbitrary target URL.
function _loadQrImage(target) {
  const src = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&qzone=1&color=0a0a08&bgcolor=ffffff&data=' + encodeURIComponent(target);
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), 3000);
    img.src = src;
  });
}

// Render the shareable "pool moment" card: pool buzz headline + podium + a QR to
// the featured user's bracket. 1080x1350 portrait, language-aware (he/en).
function _renderLeaderboardCard(cv, qr, opts) {
  const ctx = cv.getContext('2d');
  const W = 1080, H = 1350, GOLD = '#d9b46a', GOLD_LT = '#ecd49a', INK = '#f7f6f2', MUTED = '#9a9c93', PAD = 80;
  const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif';
  const lang = (typeof currentLanguage !== 'undefined' && currentLanguage) || 'he';
  const rtl = (lang === 'he');
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); } else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); } }
  function label(text, y) { ctx.fillStyle = GOLD; ctx.font = '700 26px Rubik,sans-serif'; const ls = 4; let tot = 0; for (const ch of text) tot += ctx.measureText(ch).width + ls; let x = W / 2 - tot / 2; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; for (const ch of text) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + ls; } ctx.textAlign = 'center'; }
  function fitFont(text, maxW, startPx, weight, family) { let px = startPx; ctx.font = weight + ' ' + px + 'px ' + family; while (ctx.measureText(text).width > maxW && px > 13) { px--; ctx.font = weight + ' ' + px + 'px ' + family; } return px; }
  // Word-wrap `text` into <=maxLines lines that each fit maxW at the given font.
  function wrapLines(text, maxW, px, maxLines, weight) {
    ctx.font = (weight || '800') + ' ' + px + 'px Heebo,Sora,sans-serif';
    const words = String(text).split(/\s+/); const lines = []; let cur = '';
    for (const w of words) {
      const tryLine = cur ? cur + ' ' + w : w;
      if (ctx.measureText(tryLine).width <= maxW || !cur) { cur = tryLine; }
      else { lines.push(cur); cur = w; }
      if (lines.length >= maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    return lines.slice(0, maxLines);
  }

  // background
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d0d0a'); g.addColorStop(1, '#080806'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  let rg = ctx.createRadialGradient(W / 2, 430, 80, W / 2, 430, 760); rg.addColorStop(0, 'rgba(217,180,106,0.16)'); rg.addColorStop(1, 'rgba(217,180,106,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(217,180,106,0.30)'; rr(20, 20, W - 40, H - 40, 28); ctx.stroke();

  // header
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.shadowColor = 'rgba(217,180,106,0.7)'; ctx.shadowBlur = 18; ctx.font = '44px ' + EMOJI; ctx.fillText('⚽', PAD, 92); ctx.restore();
  ctx.fillStyle = INK; ctx.font = '800 38px Sora,sans-serif'; ctx.fillText('FriendlyBet', PAD + 62, 93);
  if (opts.pool) { ctx.fillStyle = MUTED; ctx.font = '600 24px Heebo,sans-serif'; ctx.textAlign = 'right'; ctx.fillText(opts.pool, W - PAD, 93); }

  // ---- "Pool Pundit" broadcast panel: a chyron-style card holding the FULL
  // commentary (headline + secondary lines), language-aware. ----
  const items = (opts.items && opts.items.length)
    ? opts.items
    : (opts.headline ? [{ emoji: '', text: opts.headline }] : []);

  const panelX = PAD, panelW = W - 2 * PAD, innerPad = 34;
  const textMaxW = panelW - innerPad * 2;
  const headPx = 40, headLh = 50, secPx = 26, secLh = 35, eyebrowBlock = 54;

  // One clean category icon per line: prepend the event emoji and strip any
  // trailing emoji the witty line already carries (so it isn't doubled).
  const stripEmoji = s => String(s).replace(/[\s\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}️‍]+$/u, '');
  const withIcon = it => (it.emoji ? it.emoji + '  ' : '') + stripEmoji(it.text);
  const headLines = items[0] ? wrapLines(withIcon(items[0]), textMaxW, headPx, 3, '800') : [];
  const secBlocks = items.slice(1, 3).map(it => wrapLines(withIcon(it), textMaxW, secPx, 2, '600'));

  let contentH = eyebrowBlock + headLines.length * headLh;
  secBlocks.forEach(b => { contentH += 14 + b.length * secLh; });
  const panelY = 156, panelH = innerPad + contentH + innerPad - 8;

  // panel background + gold hairline
  const pgr = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  pgr.addColorStop(0, 'rgba(217,180,106,0.11)'); pgr.addColorStop(1, 'rgba(255,255,255,0.028)');
  rr(panelX, panelY, panelW, panelH, 26); ctx.fillStyle = pgr; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(217,180,106,0.42)'; ctx.stroke();

  // eyebrow: 🎙️ POOL PUNDIT (start) .......... [LIVE] pill (end)
  const eyeY = panelY + innerPad + 16;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '30px ' + EMOJI; ctx.fillText('🎙️', panelX + innerPad, eyeY);
  ctx.fillStyle = GOLD; ctx.font = '800 25px Sora,sans-serif';
  { let x = panelX + innerPad + 46; const ls = 2; for (const ch of (opts.punditLabel || 'POOL PUNDIT').toUpperCase()) { ctx.fillText(ch, x, eyeY); x += ctx.measureText(ch).width + ls; } }
  const pill = (opts.live || 'LIVE').toUpperCase();
  ctx.font = '800 19px Sora,sans-serif'; const pw = ctx.measureText(pill).width + 32, ph = 32;
  const pxp = panelX + panelW - innerPad - pw, pyp = eyeY - ph / 2;
  rr(pxp, pyp, pw, ph, 16); ctx.fillStyle = '#e0533b'; ctx.fill();
  ctx.beginPath(); ctx.arc(pxp + 16, eyeY, 4.5, 0, 7); ctx.fillStyle = '#0d0d0a'; ctx.fill();
  ctx.fillStyle = '#0d0d0a'; ctx.textAlign = 'left'; ctx.fillText(pill, pxp + 28, eyeY + 1);

  // banter text (centered, language-aware) inside the panel
  ctx.save();
  if (rtl && ctx.direction !== undefined) ctx.direction = 'rtl';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let ty = panelY + innerPad + eyebrowBlock + 28;
  ctx.fillStyle = GOLD_LT; ctx.font = '800 ' + headPx + 'px Heebo,Sora,sans-serif';
  for (const ln of headLines) { ctx.fillText(ln, W / 2, ty); ty += headLh; }
  ctx.font = '600 ' + secPx + 'px Heebo,Sora,sans-serif';
  for (const b of secBlocks) {
    ty += 14; ctx.fillStyle = 'rgba(247,246,242,0.82)';
    for (const ln of b) { ctx.fillText(ln, W / 2, ty); ty += secLh; }
  }
  ctx.restore();

  // podium (top 3): three non-overlapping columns 2nd | 1st | 3rd, centered as a
  // group. Bottoms share one floor line; the per-place height makes the staircase
  // (1st tallest, then 2nd, then 3rd LOWER than 2nd). Medal sits near each riser's
  // top; name/score/label are pinned to a shared baseline so nothing clips out.
  const podium = (opts.podium || []).slice(0, 3);
  const p1 = podium[0], p2 = podium[1], p3 = podium[2];
  const colW = 196, gap = 16, GROUP = colW * 3 + gap * 2;
  const x0 = (W - GROUP) / 2;
  // Podium sits below the panel, bounded so it never overlaps it nor the footer.
  const baseY = Math.min(Math.max(panelY + panelH + 56, 556), 652);
  const H1 = 300, H2 = 232, H3 = 196;        // riser heights (1st > 2nd > 3rd)
  const floorY = baseY + 50 + H1;            // common bottom edge
  label((opts.podiumLabel || 'STANDINGS').toUpperCase(), baseY);
  const nameY = floorY - 96, scoreY = floorY - 48, ptsY = floorY - 20;
  const cols = [
    { u: p2, rank: 2, h: H2, x: x0, medal: '🥈' },
    { u: p1, rank: 1, h: H1, x: x0 + colW + gap, medal: '🥇' },
    { u: p3, rank: 3, h: H3, x: x0 + 2 * (colW + gap), medal: '🥉' },
  ];
  cols.forEach(c => {
    if (!c.u) return;
    const top = floorY - c.h, cx = c.x + colW / 2;
    rr(c.x, top, colW, c.h, 18);
    ctx.fillStyle = c.rank === 1 ? 'rgba(217,180,106,0.16)' : 'rgba(255,255,255,0.05)';
    ctx.fill(); ctx.lineWidth = c.rank === 1 ? 3 : 2;
    ctx.strokeStyle = c.rank === 1 ? GOLD : 'rgba(217,180,106,0.4)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '50px ' + EMOJI; ctx.fillText(c.medal, cx, top + 46);
    ctx.fillStyle = INK; fitFont(c.u.nickname || '?', colW - 30, 32, '800', 'Heebo,Sora,sans-serif');
    ctx.fillText(c.u.nickname || '?', cx, nameY);
    ctx.fillStyle = GOLD_LT; ctx.font = '800 40px Sora,sans-serif'; ctx.fillText(String(c.u.total_score || 0), cx, scoreY);
    ctx.fillStyle = MUTED; ctx.font = '600 20px Heebo,sans-serif'; ctx.fillText(opts.pts || 'pts', cx, ptsY);
  });

  // footer: QR -> featured user's bracket
  ctx.strokeStyle = 'rgba(217,180,106,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, 1118); ctx.lineTo(W - PAD, 1118); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (qr) {
    const qs = 124, p = 14, tileX = W - PAD - qs - 2 * p, tileY = 1146;
    rr(tileX, tileY, qs + 2 * p, qs + 2 * p, 18); ctx.fillStyle = '#f6f4ee'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke();
    ctx.drawImage(qr, tileX + p, tileY + p, qs, qs);
    ctx.fillStyle = GOLD; ctx.font = '700 22px Rubik,sans-serif'; ctx.fillText((opts.scanLine || 'SCAN FOR THE BRACKET').toUpperCase(), PAD, 1182);
    ctx.fillStyle = GOLD_LT; ctx.font = '800 44px Sora,sans-serif'; ctx.fillText('friendlybet.live', PAD, 1234);
    ctx.fillStyle = MUTED; ctx.font = '600 22px Heebo,sans-serif'; ctx.fillText(opts.tagline || 'Free · no signup · join the pool', PAD, 1272);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD_LT; ctx.font = '800 46px Sora,sans-serif'; ctx.fillText('friendlybet.live', W / 2, 1212);
    ctx.fillStyle = MUTED; ctx.font = '600 24px Heebo,sans-serif'; ctx.fillText(opts.tagline || 'Free · no signup · join the pool', W / 2, 1254);
  }
}

async function _leaderboardCardToBlob() {
  if (!_lbBanter) return null;
  // The podium top-3 and featured user were stashed on _lbBanter at render time.
  const featUrl = _userShareUrl(_lbBanter.featuredUserId, 'pool_moment_qr');
  let qr = null;
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) {}
  try { qr = await _loadQrImage(featUrl); } catch (_) { qr = null; }
  // Full commentary: headline + the same secondary lines shown in-app.
  const head = _lbBanter.headline;
  const extras = (_lbBanter.items || []).filter(i => i.id !== head.id).slice(0, 2);
  const cardItems = [head, ...extras].map(b => ({ emoji: b.emoji || '', text: _banterText(b) }));
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
  _renderLeaderboardCard(cv, qr, {
    pool: (state.currentPool && state.currentPool.name) || '',
    punditLabel: t('leaderboard.banter.title'),
    live: t('leaderboard.banter.live'),
    items: cardItems,
    podium: _lbBanter.podium || [],
    podiumLabel: t('leaderboard.banter.cardStandings'),
    pts: t('leaderboard.points'),
    scanLine: t('leaderboard.banter.cardScan'),
    tagline: t('leaderboard.banter.cardTagline'),
  });
  return new Promise(resolve => cv.toBlob(resolve, 'image/png'));
}

async function shareLeaderboardMoment() {
  if (!_lbBanter) { showToast(t('bracketShare.notReady'), 'info'); return; }
  // Capture the current top-3 for the card from the live leaderboard rows.
  let blob;
  try { blob = await _leaderboardCardToBlob(); }
  catch (e) { console.error('pool moment card failed', e); showToast(t('bracketShare.notReady'), 'info'); return; }
  if (!blob) { showToast(t('bracketShare.notReady'), 'info'); return; }
  const caption = t('leaderboard.banter.caption', { pool: (state.currentPool && state.currentPool.name) || 'FriendlyBet' });
  const url = _userShareUrl(_lbBanter.featuredUserId, 'pool_moment');
  const file = new File([blob], 'friendlybet-pool-moment.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: caption, url }); }
    catch (e) { if (e.name !== 'AbortError') console.error('pool moment share failed', e); }
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'friendlybet-pool-moment.png'; a.click();
    try { await navigator.clipboard.writeText(caption + ' ' + url); } catch (_) {}
    showToast(t('bracketShare.toastDesktop'), 'success');
  }
}
window.shareLeaderboardMoment = shareLeaderboardMoment;

function shareLeaderboard() {
  if (!state.currentPool) return;

  const poolName = state.currentPool.name;
  const url = `${window.location.origin}?code=${state.currentPool.code}`;

  const text = t('leaderboard.shareText', { poolName, url });

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(whatsappUrl, '_blank');
}

function showHelp() {
  closeMenu();
  // v2.5.40: paint the help "risk multipliers" rows from the pool's
  // scoring_rules so the values match what the admin actually configured.
  if (state.currentPool) _fbRenderHelpMultiplierRows(state.currentPool);
  showScreen('help-screen');
}

// v2.5.40: dynamic multiplier values per pool.
function _fbResolveCatMults(pool) {
  const rules = (pool && pool.scoring_rules) || {};
  return rules.multipliers || (typeof DEFAULT_MULTIPLIERS !== 'undefined'
    ? DEFAULT_MULTIPLIERS
    : { favorite: 1, contender: 1.5, underdog: 2 });
}
function _fbFormatMult(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '×1';
  return '×' + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1));
}
function _fbRenderPoolMultipliersDetail(pool) {
  const cat = _fbResolveCatMults(pool);
  const rows = document.querySelectorAll('#multipliers-detail .multiplier-row .mult-value');
  if (rows.length >= 3) {
    rows[0].textContent = _fbFormatMult(cat.favorite);
    rows[1].textContent = _fbFormatMult(cat.contender);
    rows[2].textContent = _fbFormatMult(cat.underdog);
  }
}
function _fbRenderHelpMultiplierRows(pool) {
  const sections = document.querySelectorAll('#help-screen .help-section');
  if (sections.length < 2) return;
  const tierSection = sections[1]; // the "🎲 מכפילי סיכון" section
  // v2.5.54: hide the whole multipliers help block when the admin
  // disabled multipliers for this pool - the explanation would just
  // confuse users who never see ×N numbers anywhere.
  if (pool && pool.use_multipliers === false) {
    tierSection.style.display = 'none';
    return;
  }
  tierSection.style.display = '';
  const cat = _fbResolveCatMults(pool);
  const qs = tierSection.querySelectorAll('.help-q');
  if (qs.length >= 3) {
    qs[0].textContent = `⭐ ${t('helpEx.tierFav')} - ${_fbFormatMult(cat.favorite)}`;
    qs[1].textContent = `⚔️ ${t('helpEx.tierCont')} - ${_fbFormatMult(cat.contender)}`;
    qs[2].textContent = `🐶 ${t('helpEx.tierUnd')} - ${_fbFormatMult(cat.underdog)}`;
  }
}

// ============================================================
// LIVE MATCHES SCREEN
// ============================================================

const matchesState = {
  allMatches: [],
  currentFilter: 'all',
  loading: false,
  lastSync: null,
  // v2.5.37: auto-refresh handles. refreshTimer pulls fresh rows from
  // Supabase every 60s; tickTimer re-renders cards every 20s so the
  // computed live minute updates without a DB round-trip.
  refreshTimer: null,
  tickTimer: null
};

// v2.5.37: compute "live minute" label from match_date. football-data
// updates the DB through smart-sync every 10 min, but minute granularity
// only changes if we tick locally. Cap at 90 + 5 of injury time; beyond
// that fall back to the generic "Live" label until status flips to
// FINISHED on the next sync.
function _liveMinuteLabel(match) {
  if (!match.match_date) return null;
  const start = new Date(match.match_date).getTime();
  const now = Date.now();
  if (isNaN(start)) return null;
  const elapsedMin = Math.floor((now - start) / 60000);
  if (elapsedMin < 1) return t('matchesEx.minute', { n: 1 });
  if (elapsedMin <= 45) return t('matchesEx.minute', { n: elapsedMin });
  if (elapsedMin < 60) return t('matchesEx.halftime');
  // Second half: 60min real → minute 46. Up to ~105min real → 90+ stoppage.
  const secondHalfMin = 45 + (elapsedMin - 60);
  if (secondHalfMin <= 90) return t('matchesEx.minute', { n: secondHalfMin });
  if (secondHalfMin <= 95) return t('matchesEx.minute', { n: secondHalfMin });
  // Past regulation, assume extra time
  const etMin = secondHalfMin - 90;
  if (etMin <= 30) return t('matchesEx.extraTime', { n: 90 + etMin });
  return null;
}

function _stopMatchesAutoRefresh() {
  if (matchesState.refreshTimer) {
    clearInterval(matchesState.refreshTimer);
    matchesState.refreshTimer = null;
  }
  if (matchesState.tickTimer) {
    clearInterval(matchesState.tickTimer);
    matchesState.tickTimer = null;
  }
}

function _startMatchesAutoRefresh() {
  _stopMatchesAutoRefresh();
  // 30s: re-fetch. The live-poller keeps the DB ~60s fresh during play and the
  // client reads live from the DB while a match is on (see _snapshotStaleDuringLive),
  // so a 30s poll surfaces live scores in near-real-time. Skip the spinner on
  // background refreshes; the visibility/screen guards keep this cheap.
  matchesState.refreshTimer = setInterval(() => {
    if (state.currentScreen !== 'matches-screen' || document.hidden) return;
    loadMatches(true).catch(() => {});
  }, 30000);
  // 20s: re-render cards locally so the live minute ticks even when no
  // new DB rows have arrived yet.
  matchesState.tickTimer = setInterval(() => {
    if (state.currentScreen !== 'matches-screen' || document.hidden) return;
    renderMatches();
  }, 20000);
}

async function showMatches() {
  closeMenu();
  showScreen('matches-screen');

  // Show loading
  document.getElementById('matches-loading').style.display = 'block';
  document.getElementById('matches-list').style.display = 'none';
  document.getElementById('matches-empty').style.display = 'none';

  await loadMatches();
  _startMatchesAutoRefresh();
}

async function loadMatches(silent = false) {
  if (!supabaseClient) {
    if (!silent) showToast(t('errors.serverConnectingShort'), 'error');
    return;
  }

  matchesState.loading = true;

  try {
    // Pillar 1: prefer the CDN snapshot (edge) over a live DB read during spikes.
    let matches = await fetchMatchesFromCDN();
    // ...but if the snapshot is lagging while a match is live, read live from DB
    // so a stale CDN copy can never freeze live scores on screen.
    if (matches && _snapshotStaleDuringLive(matches)) {
      console.warn('match snapshot stale during live play - reading live from DB');
      matches = null;
    }
    if (!matches) {
      const { data, error } = await supabaseClient
        .from('matches')
        .select('*')
        .order('match_date', { ascending: true });

      if (error) {
        console.error('Matches load error:', error);
        if (!silent) showToast(t('matchesEx.loadError'), 'error');
        return;
      }
      matches = data || [];
    }

    matchesState.allMatches = matches;
    
    // Find most recent update
    if (matchesState.allMatches.length > 0) {
      const lastUpdates = matchesState.allMatches
        .map(m => m.last_updated)
        .filter(d => d)
        .sort()
        .reverse();
      matchesState.lastSync = lastUpdates[0];
    }
    
    renderMatches();
    
  } catch (err) {
    console.error('Matches error:', err);
    showToast(t('errors.unexpected'), 'error');
  } finally {
    matchesState.loading = false;
    document.getElementById('matches-loading').style.display = 'none';
  }
}

function renderMatches() {
  const list = document.getElementById('matches-list');
  const empty = document.getElementById('matches-empty');
  const updatedText = document.getElementById('matches-last-updated-text');
  
  // Update last sync indicator
  if (matchesState.lastSync) {
    const date = new Date(matchesState.lastSync);
    updatedText.textContent = t('matchesEx.lastUpdated', { time: formatRelativeTime(date) });
  } else {
    updatedText.textContent = t('matchesEx.notSynced');
  }
  
  // Filter matches
  const filtered = matchesState.allMatches.filter(m => {
    if (matchesState.currentFilter === 'all') return true;
    const isLiveStatus = _LIVE_MATCH_STATUSES.includes(m.status);
    const isFinishedStatus = m.status === 'FINISHED' || m.status === 'AWARDED';
    if (matchesState.currentFilter === 'live') return isLiveStatus;
    if (matchesState.currentFilter === 'finished') return isFinishedStatus;
    // upcoming = catch-all so POSTPONED/SUSPENDED/CANCELLED/TBD never vanish from every tab
    if (matchesState.currentFilter === 'upcoming') return !isLiveStatus && !isFinishedStatus;
    return true;
  });
  
  if (matchesState.allMatches.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  
  if (filtered.length === 0) {
    list.style.display = 'flex';
    list.innerHTML = `<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4); font-size: 12px;">${t('matchesEx.noInCategory')}</div>`;
    empty.style.display = 'none';
    return;
  }
  
  empty.style.display = 'none';
  list.style.display = 'flex';
  list.innerHTML = '';
  
  filtered.forEach(match => {
    list.appendChild(createMatchCard(match));
  });
}

function createMatchCard(match) {
  const card = document.createElement('div');
  
  // PAUSED (halftime / breaks) counts as live too - otherwise the score would
  // vanish and the match would show as "upcoming" for ~15 min every half-time.
  const isLive = _LIVE_MATCH_STATUSES.includes(match.status);
  const isFinished = match.status === 'FINISHED';
  const isScheduled = !isLive && !isFinished;
  
  card.className = 'match-card';
  if (match.status === 'PAUSED') card.classList.add('halftime'); // calm break look, not pulsing-live
  else if (isLive) card.classList.add('live');
  if (isFinished) card.classList.add('finished');
  
  // Get team data
  const homeFlag = getCountryFlag(match.home_team_code);
  const awayFlag = getCountryFlag(match.away_team_code);
  const homeName = getTeamName(match.home_team_code);
  const awayName = getTeamName(match.away_team_code);
  
  // Stage label
  const stageLabel = getStageLabel(match.stage, match.group_letter);
  
  // Status text
  // v2.5.37: live matches show the computed minute ("47'") instead of just
  // "Live". Halftime + extra-time accounted for. Client computes from
  // match_date so the label ticks every refresh without an API call.
  let statusText;
  let statusClass;
  if (match.status === 'PAUSED') {
    // Half-time (or any break): show the score with an explicit half-time badge,
    // driven by the real API status - not the elapsed-time guess.
    statusText = t('matchesEx.halftime');
    statusClass = 'halftime';
  } else if (isLive) {
    statusText = _liveMinuteLabel(match) || t('matchesEx.live');
    statusClass = 'live';
  } else if (isFinished) {
    statusText = t('matchesEx.finished');
    statusClass = 'finished';
  } else {
    statusText = formatMatchTime(match.match_date);
    statusClass = 'scheduled';
  }
  
  // Determine winner styling
  let homeClass = '';
  let awayClass = '';
  if (isFinished && match.home_score !== null && match.away_score !== null) {
    if (match.home_score > match.away_score) {
      homeClass = 'match-team-winner';
      awayClass = 'match-team-loser';
    } else if (match.away_score > match.home_score) {
      awayClass = 'match-team-winner';
      homeClass = 'match-team-loser';
    }
  }
  
  // Score display
  let scoreHtml;
  if (isFinished || isLive) {
    scoreHtml = `
      <div class="match-score">
        <span>${match.home_score ?? '?'}</span>
        <span>-</span>
        <span>${match.away_score ?? '?'}</span>
      </div>
    `;
  } else {
    const time = match.match_date ? new Date(match.match_date) : null;
    const tmLang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
    const timeStr = time ? time.toLocaleTimeString(tmLang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: tmLang === 'en' }) : 'TBD';
    scoreHtml = `<div class="match-score no-score">${timeStr}</div>`;
  }
  
  card.innerHTML = `
    <div class="match-header">
      <span class="match-stage-badge">${stageLabel}</span>
      <span class="match-status-badge ${statusClass}">${statusText}</span>
    </div>
    <div class="match-teams">
      <div class="match-team home">
        <span class="match-team-flag">${homeFlag}</span>
        <span class="match-team-name ${homeClass}">${homeName}</span>
      </div>
      ${scoreHtml}
      <div class="match-team away">
        <span class="match-team-flag">${awayFlag}</span>
        <span class="match-team-name ${awayClass}">${awayName}</span>
      </div>
    </div>
    ${match.match_date ? `<div class="match-info">${match.venue ? `<span>${match.venue}</span>` : ''}<span>${formatMatchDate(match.match_date)}</span></div>` : ''}
  `;
  
  return card;
}

function getTeamName(code) {
  if (!code) return typeof t === 'function' ? t('knockout.tbd') : 'TBD';
  
  // First priority: use i18n translation
  if (typeof getCountryName === 'function') {
    const translated = getCountryName(code);
    if (translated && translated !== code) return translated;
  }
  
  // Fallback: try to get from our knockout state cache
  if (knockoutState.allTeams[code]) {
    const team = knockoutState.allTeams[code];
    return typeof getCurrentLanguage === 'function' && getCurrentLanguage() === 'en' 
      ? (team.name_en || team.name_he || code)
      : (team.name_he || team.name_en || code);
  }
  
  // Fallback: try bettingState
  for (const letter in bettingState.groupedTeams) {
    const team = bettingState.groupedTeams[letter]?.find(t => t.code === code);
    if (team) {
      return typeof getCurrentLanguage === 'function' && getCurrentLanguage() === 'en'
        ? (team.name_en || team.name_he || code)
        : (team.name_he || team.name_en || code);
    }
  }
  return code;
}

function getStageLabel(stage, groupLetter) {
  switch (stage) {
    case 'GROUP_STAGE': return t('matchesEx.stageGroup', { letter: groupLetter || '' });
    case 'LAST_16': return t('matchesEx.stageR16');
    case 'QUARTER_FINALS': return t('matchesEx.stageQF');
    case 'SEMI_FINALS': return t('matchesEx.stageSF');
    case 'FINAL': return t('matchesEx.stageFinal');
    case 'THIRD_PLACE': return t('matchesEx.stageThird');
    default: return stage;
  }
}

function _unused_getStageLabel_old(stage, groupLetter) {
  return stage;
}

function formatMatchTime(dateStr) {
  if (!dateStr) return t('matchesEx.dateUnknown');

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');

  if (diffMs < 0) return t('matchesEx.past');
  if (diffHours < 1) return t('matchesEx.inMinutes', { n: Math.round(diffMs / (1000 * 60)) });
  if (diffHours < 24) return t('matchesEx.inHours', { n: Math.round(diffHours) });
  if (diffDays < 7) return t('matchesEx.inDays', { n: Math.round(diffDays) });

  return date.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' });
}

function formatMatchDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  return date.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: lang === 'en'
  });
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');

  if (diffMinutes < 1) return t('common.justNow');
  if (diffMinutes < 60) return t('matchesEx.minutesAgo', { n: diffMinutes });
  if (diffHours < 24) return t('matchesEx.hoursAgo', { n: diffHours });
  if (diffDays < 7) return t('matchesEx.daysAgo', { n: diffDays });
  return date.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US');
}

function filterMatches(filter) {
  matchesState.currentFilter = filter;
  
  // Update active tab
  document.querySelectorAll('.matches-filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  
  renderMatches();
}

async function refreshMatches() {
  // v2.4.2: dropped the back-to-back "syncing..."/"synced" pair; one
  // success toast at the end is enough feedback for a manual refresh.
  await loadMatches();
  showToast(t('matchesEx.synced'), 'success');
}

// ============================================================
// Error Display Helper
// ============================================================

function showError(elementId, message) {
  const div = document.getElementById(elementId);
  if (!div) return;
  div.innerHTML = `<i class="ti ti-alert-circle"></i> ${message}`;
  div.style.display = 'flex';
  setTimeout(() => {
    div.style.display = 'none';
  }, 5000);
}

// ============================================================
// Initialization
// ============================================================

// v2.5.50: belt-and-braces safety net. If init hangs (loading-screen is
// still active well past the splash) or any uncaught error happens during
// boot, force the home-screen on so the user is never trapped on a blank
// or stuck screen.
// v2.5.52: also fires when loading-screen is the *only* active screen.
// The previous check returned early on ANY active screen, which meant a
// hung init left the splash up forever (and on the next showScreen call
// nothing else activated, leaving a blank dark-blue background).
function _fbForceHomeIfBlank(reason) {
  const anyActive = document.querySelector('.screen.active');
  // Only consider real screens; the loading splash counts as "still stuck".
  if (anyActive && anyActive.id !== 'loading-screen') return;
  console.warn('Forcing home-screen — ' + (reason || 'no active screen'));
  // Clear stale local session: if the user was supposed to auto-login but
  // we got stuck on the way, they probably have bad localStorage state.
  // Cheap to wipe; they can reauth with their recovery code from home.
  try { if (typeof clearLocalUser === 'function') clearLocalUser(); } catch (_) {}
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const home = document.getElementById('home-screen');
  if (home) home.classList.add('active');
}
// 6s instead of 8: previous timeout was longer than typical Supabase init,
// so a quick recovery is fine. Still gives the loading splash a reasonable
// dwell time on a slow first paint.
setTimeout(() => _fbForceHomeIfBlank('init timeout'), 6000);
window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e && e.error || e);
  _fbForceHomeIfBlank('global error: ' + (e && e.message));
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED REJECTION]', e && e.reason);
  _fbForceHomeIfBlank('unhandled rejection');
});
// v2.5.52: if the user taps the loading splash after 3 seconds of being
// stuck on it, treat that as an explicit "get me out" request. Belt-and-
// suspenders behavior — useful on devices where the timeout above is for
// some reason inhibited (background tab throttling, etc.).
document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('loading-screen');
  if (!splash) return;
  let stuckSince = Date.now();
  splash.addEventListener('click', () => {
    if (Date.now() - stuckSince > 3000) _fbForceHomeIfBlank('user tap on splash');
  });
});

// ============================================================
// v2.6.0 - Premium marketing landing page (first-time visitors)
// ============================================================
// #fb-landing is a body-level, full-bleed element with two language
// blocks (he/en). Shown to new visitors; CTAs call fbEnterApp() which
// hides the landing and drops the user into the app flow.
function _fbLandingApplyLang() {
  const wrap = document.getElementById('fb-landing');
  if (!wrap) return;
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  wrap.querySelectorAll('.fb-block').forEach(b => {
    b.style.display = (b.getAttribute('data-lang') === lang) ? 'block' : 'none';
  });
  // (Re)arm scroll-reveal for the now-visible block.
  const els = wrap.querySelectorAll('.fb-block:not([style*="display: none"]) .reveal, .fb-block[style*="display: block"] .reveal');
  if (!('IntersectionObserver' in window)) {
    wrap.querySelectorAll('.reveal').forEach(e => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .12 });
  els.forEach(e => { if (!e.classList.contains('in')) io.observe(e); });
}

function showLanding() {
  const app = document.getElementById('app');
  const wrap = document.getElementById('fb-landing');
  if (!wrap) { showScreen('home-screen'); return; }
  if (app) app.style.display = 'none';
  wrap.style.display = 'block';
  document.body.classList.add('on-landing');
  window.scrollTo(0, 0);
  _fbLandingApplyLang();
}
window.showLanding = showLanding;

function fbEnterApp(target) {
  const wrap = document.getElementById('fb-landing');
  const app = document.getElementById('app');
  if (wrap) wrap.style.display = 'none';
  if (app) app.style.display = '';
  document.body.classList.remove('on-landing');
  window.scrollTo(0, 0);
  if (target === 'create') showScreen('create-pool-screen');
  else if (target === 'join') showScreen('join-pool-screen');
  else if (target === 'recovery') showScreen('recovery-login-screen');
  else showScreen('home-screen');
}
window.fbEnterApp = fbEnterApp;

// v2.6.9: "View my picks" — opens the summary (the unified review of every
// completed pick) from the dashboard menu OR any betting screen, without
// disturbing the in-flow state. Single-phase pools use the rich summary; a
// returning user's picks are loaded fresh from the DB first.
async function fbViewMyPicks() {
  if (typeof closeMenu === 'function') closeMenu();
  if (!state.currentPool || !state.currentUser) { showToast(t('errors.reconnect'), 'error'); return; }
  if (state.currentPool.betting_mode === 'single_phase') {
    state.spInFlow = false;
    // v2.9.15: await the fresh DB render before revealing the screen.
    await spShowSummary();
  } else {
    // Two-phase has no unified summary screen — fall back to the dashboard.
    await goToDashboard();
  }
}
window.fbViewMyPicks = fbViewMyPicks;

// Keep the landing language in sync with the app's toggle.
window.addEventListener('languageChanged', () => {
  if (document.body.classList.contains('on-landing')) _fbLandingApplyLang();
});

// v2.6.16: capture where the user came from on first visit. Result is cached in
// sessionStorage so subsequent reads (across the app flow) return the same
// thing — important because by the time the user creates/joins, the referrer
// header is gone and they've navigated within the SPA.
// v2.6.18: detect "missing column" inserts regardless of whether the error
// came from raw Postgres ("column X does not exist") or from PostgREST's
// schema cache ("Could not find the 'X' column ... in the schema cache",
// code PGRST204). Used to trigger the legacy-shape fallback inserts when
// a migration hasn't been applied yet.
function _fbIsMissingColumnError(err) {
  if (!err) return false;
  if (err.code === 'PGRST204') return true;
  const msg = (err.message || '') + ' ' + (err.details || '') + ' ' + (err.hint || '');
  return /column .* does not exist/i.test(msg) ||
         /could not find .* column/i.test(msg) ||
         /schema cache/i.test(msg);
}

function _fbGetCountry() {
  // 2-letter ISO country, captured by i18n's geoDetectCountryAsync (ipapi.co). null if not detected.
  try {
    const c = localStorage.getItem('friendlybet_country');
    return (c && /^[A-Z]{2}$/.test(c)) ? c : null;
  } catch (_) { return null; }
}
async function _fbEnsureCountry() {
  // Sync path: use the cached value if i18n already detected it.
  const cached = _fbGetCountry();
  if (cached) return cached;
  // Race-condition fix (v2.6.22): if a user lands AND signs up before the async
  // ipapi.co fetch from i18n finishes (faster than ~2.5s), the country would be
  // null. Block briefly on our own /api/geo route (same-origin, ~50ms) so the
  // signup insert always carries a country.
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('/api/geo', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const c = (data && data.country || '').toUpperCase();
      if (/^[A-Z]{2}$/.test(c)) {
        try { localStorage.setItem('friendlybet_country', c); } catch (_) {}
        return c;
      }
    }
  } catch (_) {}
  return null;
}
function _fbGetSignupSource() {
  try {
    const cached = sessionStorage.getItem('fb_signup_source');
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  const params = new URLSearchParams(window.location.search);
  const ref = document.referrer || '';
  const utm = (params.get('utm_source') || '').toLowerCase();
  const code = params.get('code');
  let source = 'direct';
  if (utm) source = utm;
  else if (code) source = 'invite';
  else if (ref) {
    let h = '';
    try { h = new URL(ref).hostname.toLowerCase(); } catch (_) {}
    if (/reddit/.test(h)) source = 'reddit';
    else if (/youtube|youtu\.be/.test(h)) source = 'youtube';
    else if (/twitter|x\.com|t\.co/.test(h)) source = 'twitter';
    else if (/facebook|fb\./.test(h)) source = 'facebook';
    else if (/instagram/.test(h)) source = 'instagram';
    else if (/whatsapp|wa\.me/.test(h)) source = 'whatsapp';
    else if (/t\.me|telegram/.test(h)) source = 'telegram';
    else if (/bsky|bluesky/.test(h)) source = 'bluesky';
    else if (/news\.ycombinator/.test(h)) source = 'hackernews';
    else if (/producthunt/.test(h)) source = 'producthunt';
    else if (/google\./.test(h)) source = 'google';
    else if (/bing\./.test(h)) source = 'bing';
    else if (h) source = h.replace(/^www\./, '');
  }
  const detail = {
    source,
    referrer: ref || null,
    utm_source: params.get('utm_source') || null,
    utm_medium: params.get('utm_medium') || null,
    utm_campaign: params.get('utm_campaign') || null
  };
  try { sessionStorage.setItem('fb_signup_source', JSON.stringify(detail)); } catch (_) {}
  return detail;
}

async function initApp() {
  console.log('FriendlyBet v' + CONFIG.APP_VERSION + ' starting...');
  _fbGetSignupSource();
  console.log('Language:', typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'unknown');

  // v2.5.52: emergency escape hatch — visiting /?reset=1 wipes all local
  // storage, unregisters the service worker, and reloads. Lets a user
  // recover from a stuck-on-blank-screen state by typing the URL.
  if (new URLSearchParams(window.location.search).get('reset') === '1') {
    console.warn('[reset=1] wiping local state and SW caches');
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    try { for (const k of _FB_SESSION_KEYS) document.cookie = `${k}=; path=/; max-age=0`; } catch (_) {}
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    } catch (_) {}
    try {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    } catch (_) {}
    // Strip the reset param so reload lands clean
    window.location.replace(window.location.origin + '/');
    return;
  }

  // Pillar 3: heal a webview-wiped localStorage session from the cookie backup BEFORE the
  // app reads the session, then mirror back so an existing localStorage-only session also
  // gains a cookie backup. (Not reached on /?reset=1, which clears those cookies above.)
  fbHealSessionFromCookies();
  fbMirrorSession();

  // Listen for language changes - re-render current screen
  window.addEventListener('languageChanged', () => {
    // Re-render visible dynamic content
    if (state.currentScreen === 'user-dashboard-screen' && state.currentPool) {
      updateBettingStatusOnDashboard();
      updateKnockoutStatusOnDashboard();
    } else if (state.currentScreen === 'leaderboard-screen') {
      showLeaderboard();
    } else if (state.currentScreen === 'members-screen') {
      renderMembers();
    } else if (state.currentScreen === 'admin-members-screen') {
      renderAdminMembers();
    } else if (state.currentScreen === 'matches-screen') {
      renderMatches();
    } else if (state.currentScreen === 'group-betting-screen') {
      renderGroupBetting();
    } else if (state.currentScreen === 'top-scorer-screen') {
      renderTopScorerList();
    }
  });
  
  // Check URL for pool code parameter (?code=XXXXX or ?join=XXXXX)
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code') || urlParams.get('join');
  const poolNameFromUrl = urlParams.get('pool');
  // v2.5.36: admin-shared recovery link (?recovery=XXXX-XXXX-XXXX-XXXX) -
  // prefill the login input and jump straight to the recovery screen so the
  // user only has to confirm. If they're already signed in, this falls
  // through to the regular auto-dashboard route below.
  const recoveryFromUrl = urlParams.get('recovery');
  // ?login=CODE — the QR auto-login link: log in immediately, no typing.
  const loginFromUrl = urlParams.get('login');

  // Security: strip the credential params from the visible URL immediately (we've already
  // captured their values) so the code does not linger in history or get shared.
  if (loginFromUrl || recoveryFromUrl) {
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('login'); u.searchParams.delete('recovery');
      window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
    } catch (_) {}
  }

  // Check if user is logged in
  const localUser = loadLocalUser();

  // v2.5.49: wait for the Supabase client to actually be ready before
  // routing. Previously a fixed 1s delay meant slow networks left
  // supabaseClient null when goToDashboard() ran, throwing inside the
  // unhandled-promise callback and leaving the user on a blank screen
  // after the loading splash. Now we poll up to 12s and fall back to
  // home-screen if it never wakes up.
  const waitForSupabase = (timeoutMs = 12000) => new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      if (supabaseClient) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });

  // Show the loading splash for at least 700ms (visual stability) but no
  // more than waitForSupabase needs. Both promises resolve, then we route.
  const minSplash = new Promise(resolve => setTimeout(resolve, 700));
  await Promise.all([minSplash, waitForSupabase()]);

  // Pillar 3 (preventive): if we're inside an in-app browser, nudge the user into the real
  // browser so their session survives (Android: one-tap to Chrome; iOS: instruction).
  try { maybeShowOpenInBrowserBanner(); } catch (_) {}

  // v2.5.49: every routing branch wrapped in try/catch. If anything
  // throws (network failure, schema mismatch, missing DOM node) we
  // bail out to home-screen instead of leaving the splash up forever
  // or showing a blank dashboard with no error indication.
  try {
    // ?login=CODE (scanned QR) — auto-login immediately. Explicit intent, so it takes
    // precedence even over an existing session.
    if (loginFromUrl) {
      const ok = await loginViaRecoveryCode(loginFromUrl);
      if (ok) return;
      // Failed (expired/typo/garbage). If they already have a local session, do NOT strand
      // them on a login screen — fall through to the normal route (their dashboard). Only
      // show the recovery screen when there's no session to fall back to.
      if (!(localUser && localUser.pool_id)) {
        showScreen('recovery-login-screen');
        const input = document.getElementById('recovery-login-input');
        if (input) input.value = _formatRecoveryCodeForHash(loginFromUrl);
        const errEl = document.getElementById('recovery-login-error');
        if (errEl) { errEl.textContent = t('recoveryLogin.linkInvalid'); errEl.style.display = ''; }
        return;
      }
      // else: fall through to the regular localUser routing below.
    }
    if (recoveryFromUrl && !(localUser && localUser.pool_id)) {
      showScreen('recovery-login-screen');
      const input = document.getElementById('recovery-login-input');
      if (input) {
        input.value = _formatRecoveryCodeForHash(recoveryFromUrl);
      }
      return;
    }
    if (codeFromUrl) {
      // Store invite info in case user already logged in elsewhere
      if (poolNameFromUrl) {
        sessionStorage.setItem('invite_pool_name', decodeURIComponent(poolNameFromUrl));
      }

      // If user already has an account
      if (localUser && localUser.pool_id) {
        // If the link is for the pool they're ALREADY in, just open the dashboard —
        // re-tapping your own invite link should never ask you to "leave another pool".
        let samePool = false;
        try {
          const { data: linkPool } = await supabaseClient
            .from('pools').select('id').eq('code', codeFromUrl.toUpperCase()).maybeSingle();
          if (linkPool && linkPool.id === localUser.pool_id) samePool = true;
        } catch (_) {}
        if (samePool) {
          await goToDashboard();
          return;
        }
        // Different pool — confirm the switch.
        const confirmed = window.confirm(t('errors.alreadyMember'));
        if (confirmed) {
          clearLocalUser();
          // Reload with same URL params
          window.location.reload();
          return;
        } else {
          await goToDashboard();
          return;
        }
      }

      // Direct join via link
      const codeInput = document.getElementById('pool-code-input');
      if (codeInput) codeInput.value = codeFromUrl.toUpperCase();
      showScreen('join-pool-screen');
      setTimeout(() => { try { checkPoolCode(); } catch (e) { console.error(e); } }, 300);
    } else if (localUser && localUser.pool_id && supabaseClient) {
      // User has account AND supabase is online - try to load the dashboard
      await goToDashboard();
    } else if (localUser && localUser.pool_id && !supabaseClient) {
      console.warn('Supabase never came online; falling back to home-screen.');
      showScreen('home-screen');
    } else {
      // v2.6.0: first-time visitor → the premium marketing landing page.
      // CTAs (fbEnterApp) drop them into the app's create/join/recovery flow.
      showLanding();
    }
  } catch (err) {
    console.error('initApp routing failed:', err);
    // Last-resort fallback so users never stare at a blank splash.
    try { showScreen('home-screen'); } catch (_) {}
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// v2.5.28: when the user returns to the tab, refresh the dashboard
// knockout-lock state. Without this, a user who opened the app at 8pm
// while the group stage was still running would never see the
// knockout option unlock unless they navigated away and back. Visibility
// change is the standard hook for "the user is now looking again".
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const dash = document.getElementById('user-dashboard-screen');
  if (!dash || !dash.classList.contains('active')) return;
  if (typeof updateKnockoutStatusOnDashboard === 'function') {
    updateKnockoutStatusOnDashboard();
  }
});

// Auto-uppercase pool code input
document.addEventListener('DOMContentLoaded', () => {
  const poolCodeInput = document.getElementById('pool-code-input');
  if (poolCodeInput) {
    poolCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }
});

// ============================================================
// VIRAL SHARING - Invite Friends
// ============================================================

// v2.10.5: single source of truth for "can a new member still join this pool?".
// The server-side join_pool RPC already rejects both states (is_locked OR
// locked_at) - this mirrors that so the client never offers a dead-end invite
// link once the pool locks at kickoff (locked_at) or is manually locked
// (is_locked). Sharing a bracket / leaderboard / recap is NOT gated by this.
function isPoolJoinClosed() {
  return isPoolWriteLocked();
}

// Guard for invite-link share paths. Returns true (and toasts) when the pool no
// longer accepts members, so callers can early-return. Defense in depth: even a
// direct JS call to a share helper can't leak a locked-pool join link.
function _inviteShareBlocked() {
  if (!isPoolJoinClosed()) return false;
  showToast(t('errors.poolLockedNoJoin'), 'error');
  return true;
}

function showShareModal() {
  if (!state.currentPool) {
    showToast(t('errors.tryAgain'), 'error');
    return;
  }

  // Once the pool locks, joining is impossible - don't open the invite modal
  // (reachable from the menu even after the dashboard banner is hidden).
  if (isPoolJoinClosed()) {
    showToast(t('errors.poolLockedNoJoin'), 'error');
    closeMenu();
    return;
  }

  closeMenu();
  
  // Build invite URL
  const baseUrl = window.location.origin;
  const code = state.currentPool.code;
  const poolName = encodeURIComponent(state.currentPool.name);
  const inviteUrl = `${baseUrl}/?join=${code}&pool=${poolName}`;
  
  // Update modal content
  document.getElementById('share-pool-code').textContent = code;
  document.getElementById('share-invite-url').textContent = inviteUrl;
  document.getElementById('share-invite-url').dataset.url = inviteUrl;

  // v2.4.6: QR code section removed from the modal; skip the generator.

  // Primary button = native OS share sheet (user picks any app). On desktop
  // browsers without navigator.share it falls back to copying, so relabel it
  // so the button promises what it actually does.
  const nativeLabel = document.getElementById('share-native-label');
  if (nativeLabel) {
    nativeLabel.textContent = navigator.share
      ? t('shareModal.shareWithFriends')
      : t('shareModal.copyForDesktop');
  }

  // Show modal
  document.getElementById('share-modal-overlay').classList.add('active');
  document.getElementById('share-modal').classList.add('active');
}

function closeShareModal() {
  document.getElementById('share-modal-overlay').classList.remove('active');
  document.getElementById('share-modal').classList.remove('active');
}

function getInviteUrl(source = 'copy') {
  if (!state.currentPool) return '';
  const baseUrl = window.location.origin;
  const code = state.currentPool.code;
  const poolName = encodeURIComponent(state.currentPool.name);
  // Keep the existing ?join=&pool= structure (the app reads it on '/') and only
  // APPEND analytics UTM params so organic WhatsApp/Telegram shares are tracked.
  const utm = `utm_source=${source}&utm_medium=social&utm_campaign=user_invite`;
  return `${baseUrl}/?join=${code}&pool=${poolName}&${utm}`;
}

function getShareMessage(source = 'copy') {
  if (!state.currentPool) return '';
  const poolName = state.currentPool.name;
  const code = state.currentPool.code;
  const url = getInviteUrl(source);

  return t('sharePool.shareText', { poolName, code, url });
}

// The per-app share helpers below serve two contexts. `mode='invite'` (default)
// shares the pool-join link + invite copy — unchanged behavior. `mode='bracket'`
// shares the user's personalized /share link (whose dynamic OG renders their
// prediction card) + the bracket caption. Web intents carry only text+URL, so
// the actual card IMAGE travels only via shareBracketCard()'s native sheet — the
// chips rely on the per-user OG preview instead.
function _shareLink(mode, source) {
  return mode === 'bracket' ? _bracketShareUrl(source) : getInviteUrl(source);
}
function _shareMsg(mode, source) {
  if (mode === 'bracket') return t('bracketShare.caption') + ' ' + _bracketShareUrl(source);
  return getShareMessage(source);
}
// A bracket chip shares the personalized /share link, whose OG only renders the
// card when the bracket is complete AND the ids resolve. Otherwise the share
// previews the homepage/brand image — "empty of names and flags". So gate every
// bracket chip on this and nudge the user instead of sharing an empty card.
function _bracketShareReady() {
  const champ = spState && (spState.tournamentWinner || (spState.bracketPicks && spState.bracketPicks[31]));
  const ids = !!(state.currentUser && state.currentUser.id && state.currentPool && state.currentPool.id);
  return !!champ && ids;
}
function _bracketChipBlocked(mode) {
  if (mode === 'bracket' && !_bracketShareReady()) { showToast(t('bracketShare.notReady'), 'info'); return true; }
  // Single chokepoint for every bracket chip (mobile native + desktop link intent):
  // a non-blocked bracket chip tap is a 'click'. Completion is recorded separately in
  // _bracketChipImageShared (mobile native only — desktop link shares can't be observed).
  if (mode === 'bracket') _recordShare('bracket_chip', 'click');
  return false;
}
// BRACKET SHARE FLOW (decided after testing every app): the bracket is an
// IMAGE, and the web can only attach a real image to an app through the native
// share sheet (navigator.share + files) — per-app link intents can't carry an
// image, so they break inconsistently (X/email send no picture, Reddit crops
// the OG card, WhatsApp caches a stale link preview, Instagram won't open). So
// on mobile EVERY bracket chip shares the actual card PNG via the native sheet
// (the user then taps the app they tapped the icon for). Desktop has no file
// share, so it falls back to the per-app link intent (OG previews work fine in
// desktop browsers). Returns true when it handled the share (caller stops).
async function _bracketChipImageShared(mode) {
  if (mode !== 'bracket') return false;
  if (!(navigator.canShare && navigator.share)) return false; // desktop -> link intent
  let blob;
  try { blob = await _bracketCardToBlob(); } catch (_) { return false; }
  if (!blob) return false;
  const file = new File([blob], 'friendlybet-bracket.png', { type: 'image/png' });
  if (!navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], text: t('bracketShare.caption'), url: _bracketShareUrl('bracket_chip') });
    _recordShare('bracket_chip', 'completed'); // resolved == the user actually shared
  } catch (e) {
    if (!(e && e.name === 'AbortError')) console.error('bracket chip image share failed', e);
  }
  return true; // handled (shared or user-cancelled) — never fall through to a link on mobile
}

// Desktop image-first share (v2.7.2). For platforms whose LINK previews mishandle
// our card — Facebook CROPS the og:image, Reddit frequently DROPS it, Instagram
// has no link post at all — a link share looks broken. So instead we download the
// pixel-perfect portrait card (never cropped), copy the caption+link to the
// clipboard, and open the app's composer so the user attaches the real image.
// Mobile never reaches here (the native sheet already handled it upstream).
async function _bracketImageFirst(app) {
  try {
    const blob = await _bracketCardToBlob();
    if (blob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'friendlybet-bracket.png'; a.click();
    }
  } catch (e) { console.error('bracket image-first download failed', e); }
  try { await navigator.clipboard.writeText(t('bracketShare.caption') + ' ' + _bracketShareUrl('bracket_' + app)); } catch (_) {}
  const composer = {
    facebook: 'https://www.facebook.com/',
    reddit: 'https://www.reddit.com/submit?type=IMAGE',
    instagram: 'https://www.instagram.com/',
  }[app] || 'https://friendlybet.live';
  showToast(t('bracketShare.imageFirstHint'), 'info');
  window.open(composer, '_blank', 'noopener');
}

async function shareToWhatsApp(mode = 'invite') {
  if (_bracketChipBlocked(mode)) return;
  if (mode === 'invite' && _inviteShareBlocked()) return;
  if (await _bracketChipImageShared(mode)) return;
  if (mode === 'bracket') _prewarmBracketOg();
  const message = _shareMsg(mode, 'whatsapp');
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}

async function shareToTelegram(mode = 'invite') {
  if (_bracketChipBlocked(mode)) return;
  if (mode === 'invite' && _inviteShareBlocked()) return;
  if (await _bracketChipImageShared(mode)) return;
  if (mode === 'bracket') _prewarmBracketOg();
  const inviteUrl = _shareLink(mode, 'telegram');
  const message = mode === 'bracket' ? t('bracketShare.caption') : getShareMessage('telegram');
  const url = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// Direct per-app share shortcuts. The native share sheet (shareNative) is the
// primary path on mobile — these are explicit choices and the main path on
// desktop, where navigator.share isn't available.
async function shareToX(mode = 'invite') {
  if (_bracketChipBlocked(mode)) return;
  if (mode === 'invite' && _inviteShareBlocked()) return;
  if (await _bracketChipImageShared(mode)) return;
  if (mode === 'bracket') _prewarmBracketOg();
  const text = _shareMsg(mode, 'x');
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

async function shareToFacebook(mode = 'invite') {
  if (_bracketChipBlocked(mode)) return;
  if (mode === 'invite' && _inviteShareBlocked()) return;
  if (await _bracketChipImageShared(mode)) return;
  // Desktop: open the FB sharer with the personalized /share link. The OG card
  // (pre-warmed on share so it's never an empty cold render) is the 1200x630
  // landscape image FB shows uncropped. Facebook strips custom text; the OG card
  // carries the message.
  if (mode === 'bracket') _prewarmBracketOg();
  const link = _shareLink(mode, 'facebook');
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
  window.open(url, '_blank', 'noopener');
}

async function shareToInstagram(mode = 'invite') {
  if (_bracketChipBlocked(mode)) return;
  if (mode === 'invite' && _inviteShareBlocked()) return;
  // Bracket on mobile: share the real image via the native sheet (Instagram is
  // one of the targets) — far more reliable than the old download + deep-link
  // hack, which the OS popup-blocker killed because it ran after an await.
  if (await _bracketChipImageShared(mode)) return;
  // Desktop bracket: image-first (download the card + open IG to attach it).
  if (mode === 'bracket') { await _bracketImageFirst('instagram'); return; }
  // INVITE: copy the join link and tell the user to paste it into a story or DM,
  // then open Instagram (app on mobile, web otherwise) so they can paste right away.
  const url = getInviteUrl('instagram');
  try {
    await navigator.clipboard.writeText(url);
  } catch (err) {
    const tmp = document.createElement('input');
    tmp.value = url; document.body.appendChild(tmp); tmp.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(tmp);
  }
  showToast(t('shareModal.igCopied'), 'success');
  setTimeout(() => { window.open('https://www.instagram.com/', '_blank', 'noopener'); }, 500);
}

async function shareToReddit(mode = 'invite') {
  if (_bracketChipBlocked(mode)) return;
  if (mode === 'invite' && _inviteShareBlocked()) return;
  if (await _bracketChipImageShared(mode)) return;
  // Desktop: Reddit's submit page takes a URL + title and shows the OG card as
  // the post thumbnail (pre-warmed so it isn't an empty cold render).
  if (mode === 'bracket') _prewarmBracketOg();
  const link = _shareLink(mode, 'reddit');
  const poolName = state.currentPool?.name || t('dashboard.fallback.poolName');
  const title = mode === 'bracket' ? t('bracketShare.redditTitle') : t('shareModal.joinTitle', { name: poolName });
  const url = `https://www.reddit.com/submit?url=${encodeURIComponent(link)}&title=${encodeURIComponent(title)}`;
  window.open(url, '_blank', 'noopener');
}

async function shareByEmail(mode = 'invite') {
  if (_bracketChipBlocked(mode)) return;
  if (mode === 'invite' && _inviteShareBlocked()) return;
  if (await _bracketChipImageShared(mode)) return;
  const poolName = state.currentPool?.name || t('dashboard.fallback.poolName');
  const subject = mode === 'bracket' ? t('bracketShare.emailSubject') : t('shareModal.emailSubject', { poolName });
  const body = _shareMsg(mode, 'email');
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function shareBySMS(mode = 'invite') {
  if (_bracketChipBlocked(mode)) return;
  if (mode === 'invite' && _inviteShareBlocked()) return;
  if (await _bracketChipImageShared(mode)) return;
  const body = _shareMsg(mode, 'sms');
  // `sms:?&body=` is the most cross-platform form (works on both iOS and Android).
  window.location.href = `sms:?&body=${encodeURIComponent(body)}`;
}

function shareNative() {
  if (_inviteShareBlocked()) return;
  if (!navigator.share) {
    copyInviteLink();
    return;
  }

  const inviteUrl = getInviteUrl('native');
  const poolName = state.currentPool?.name || t('dashboard.fallback.poolName');

  navigator.share({
    title: t('shareModal.joinTitle', { name: poolName }),
    text: getShareMessage('native'),
    url: inviteUrl
  }).catch(err => {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
    }
  });
}

async function copyInviteLink() {
  if (_inviteShareBlocked()) return;
  const url = getInviteUrl('copy');

  try {
    await navigator.clipboard.writeText(url);
    showToast(t('shareModal.copyLinkOk'), 'success');
  } catch (err) {
    // Fallback
    const tempInput = document.createElement('input');
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(t('shareModal.copyLinkOk'), 'success');
  }
}

// ===== Shareable bracket card (Semi-finals -> Final -> Champion) =====
// Renders a portrait image of the user's knockout climax on a canvas and
// shares it via the native share sheet (WhatsApp / Telegram / Instagram /
// Facebook) with a desktop download fallback. A baked-in QR invites scanners
// to the user's personalized share page so the image converts even when a
// platform strips links.

// A short, deterministic hash of the current bracket picks. Appended to the
// share URL as `&v=` so that WHEN THE PICKS CHANGE the shared link is a brand
// new URL — WhatsApp/Facebook key their link-preview cache by URL, so without
// this they keep showing a stale (often empty) card forever. Same picks -> same
// token, so we don't spam the edge cache with infinite distinct OG renders.
function _bracketShareVersion() {
  const bp = (spState && spState.bracketPicks) || {};
  const champ = (spState && spState.tournamentWinner) || bp[31] || '';
  const parts = [25, 26, 27, 28, 29, 30].map(i => bp[i] || '').join('-') + '-' + champ;
  let h = 0;
  for (let i = 0; i < parts.length; i++) { h = (Math.imul(h, 31) + parts.charCodeAt(i)) | 0; }
  // STABLE per-bracket-content token — NO timestamp (v2.7.5). The old timestamp
  // made every share a unique URL, which forced WhatsApp/Facebook to scrape the
  // OG image COLD every single time (~2.3s render) — their scrapers time out and
  // show an EMPTY card. A stable URL is edge-cacheable: we pre-warm it on share
  // (_prewarmBracketOg), so the friend's scraper hits a warm ~0.3s render and
  // sees the full card. The token still changes when the PICKS change (the hash
  // covers positions 25-31), so an edited bracket still busts the preview cache.
  // The trailing CARD-LAYOUT version ('c2') changes the URL once whenever the OG
  // card DESIGN changes, so WhatsApp/Facebook/edge re-scrape the corrected card
  // instead of serving the previously-cached (overlapping) one. Bump on redesign.
  return (h >>> 0).toString(36) + 'c3';
}

// Personalized public share URL for the current user's predictions. Friends
// who open it land on the read-only /share page that renders this exact
// bracket plus a "build your own" CTA — that's the viral loop. Falls back to
// the homepage if we somehow lack the ids.
function _bracketShareUrl(source) {
  const origin = window.location.origin || 'https://friendlybet.live';
  const utm = `utm_source=${source}&utm_medium=social&utm_campaign=prediction_card`;
  const uid = state.currentUser && state.currentUser.id;
  const pid = state.currentPool && state.currentPool.id;
  const lang = (typeof currentLanguage !== 'undefined' && currentLanguage) || 'he';
  return (uid && pid)
    ? `${origin}/share?u=${uid}&p=${pid}&lang=${lang}&v=${_bracketShareVersion()}&${utm}`
    : `${origin}/?${utm}`;
}

// Pre-warm the edge cache for THIS bracket's OG image (v2.7.5). A friend's app
// (WhatsApp/Facebook/Telegram) scrapes the /share link's og:image on first paste;
// a cold render is ~2.3s and those scrapers time out → empty card. Firing this
// fetch the moment the user opens the share UI renders + edge-caches the image,
// so by the time they actually share, the scraper hits a warm ~0.3s response.
// Fire-and-forget, deduped per card URL, never blocks the UI.
let _ogPrewarmed = '';
function _prewarmBracketOg() {
  try {
    if (typeof _bracketShareReady === 'function' && !_bracketShareReady()) return;
    const uid = state.currentUser && state.currentUser.id;
    const pid = state.currentPool && state.currentPool.id;
    if (!uid || !pid) return;
    const lang = (typeof currentLanguage !== 'undefined' && currentLanguage) || 'he';
    const origin = window.location.origin || 'https://friendlybet.live';
    const ogUrl = `${origin}/api/og?u=${uid}&p=${pid}&lang=${lang}&v=${_bracketShareVersion()}`;
    if (_ogPrewarmed === ogUrl) return; // already warmed this exact card
    _ogPrewarmed = ogUrl;
    fetch(ogUrl, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  } catch (_) { /* best-effort */ }
}
window._prewarmBracketOg = _prewarmBracketOg;

let _bracketQrPromise = null;
function _loadBracketQr() {
  if (_bracketQrPromise) return _bracketQrPromise;
  const target = _bracketShareUrl('bracket_qr');
  const src = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&qzone=1&color=0a0a08&bgcolor=ffffff&data=' + encodeURIComponent(target);
  _bracketQrPromise = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // CORS-safe so the canvas stays untainted (toBlob works)
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), 3000);
    img.src = src;
  });
  return _bracketQrPromise;
}

// Flag images for the card (flagcdn, same source as getCountryFlag). CORS-safe
// so the canvas stays untainted; cached; failures fall back to a name-only chip.
const _bracketFlagCache = {}; // code -> Image | false
function _loadBracketFlags(codes) {
  return Promise.all((codes || []).filter(Boolean).map(code => new Promise(resolve => {
    if (_bracketFlagCache[code] !== undefined) { resolve(); return; }
    const iso = (typeof FLAG_ISO !== 'undefined') ? FLAG_ISO[code] : null;
    if (!iso) { _bracketFlagCache[code] = false; resolve(); return; }
    const img = new Image(); img.crossOrigin = 'anonymous';
    let done = false;
    const finish = v => { if (!done) { done = true; _bracketFlagCache[code] = v; resolve(); } };
    img.onload = () => finish(img);
    img.onerror = () => finish(false);
    setTimeout(() => finish(false), 3000);
    img.src = 'https://flagcdn.com/w160/' + iso + '.png';
  })));
}
// Champion hero illustration, served same-origin from /heroes/hero-<CODE>.webp
// so the canvas stays untainted on export. Cached; missing image falls back to
// a plain dark hero (the card still renders).
const _bracketHeroCache = {}; // code -> Image | false
function _loadBracketHero(code) {
  return new Promise(resolve => {
    if (!code) { resolve(null); return; }
    if (_bracketHeroCache[code] !== undefined) { resolve(_bracketHeroCache[code]); return; }
    const img = new Image();
    let done = false;
    const fin = v => { if (!done) { done = true; _bracketHeroCache[code] = v; resolve(v); } };
    img.onload = () => fin(img);
    img.onerror = () => fin(false);
    setTimeout(() => fin(false), 4000);
    img.src = '/heroes/hero-' + code + '.webp';
  });
}

// The champion's road to the title: the team it beat in each round R32..SF plus
// its final opponent. Returns [{stage, beat}] (beat may be null if incomplete).
function spChampionRoad() {
  const bp = (spState && spState.bracketPicks) || {};
  const champ = (spState && spState.tournamentWinner) || bp[31];
  if (!champ) return [];
  let st; try { st = spGetBracketStructure(); } catch (_) { return []; }
  const beatIn = matches => {
    const m = (matches || []).find(x => bp[x.pos] === champ && (x.home === champ || x.away === champ));
    return m ? (m.home === champ ? m.away : m.home) : null;
  };
  const road = [
    { stage: 'R32', beat: beatIn(st.r32) },
    { stage: 'R16', beat: beatIn(st.r16) },
    { stage: 'QF',  beat: beatIn(st.qf) },
    { stage: 'SF',  beat: beatIn(st.sf) },
  ];
  const f = st.final || {};
  road.push({ stage: 'FINAL', beat: f.home === champ ? f.away : (f.away === champ ? f.home : null) });
  return road;
}

function _bracketCardCodes() {
  const bp = (spState && spState.bracketPicks) || {};
  const champ = (spState && spState.tournamentWinner) || bp[31];
  return [champ].concat(spChampionRoad().map(r => r.beat));
}
// Wait for fonts + load QR, flags and the champion hero (in parallel).
async function _prepareBracketAssets() {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) {}
  const bp = (spState && spState.bracketPicks) || {};
  const champ = (spState && spState.tournamentWinner) || bp[31];
  const [qr] = await Promise.all([ _loadBracketQr(), _loadBracketFlags(_bracketCardCodes()), _loadBracketHero(champ) ]);
  return qr;
}

// Champion share card (v2.9): a semi-realistic hero illustration of the user's
// predicted champion lifting the trophy, "MY PREDICTION · <team>", the road to
// the title (team beaten each round R32->FINAL), and a scan-to-play QR. The hero
// is loaded by _prepareBracketAssets from /heroes/hero-<CODE>.webp.
function _renderBracketCard(cv, qr) {
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const W = 1080, H = 1350, GOLD = '#d9b46a', GOLD_LT = '#ecd49a', INK = '#f7f6f2', MUTED = '#9a9c93', PAD = 70;
  const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif';
  function rr(x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect){ctx.roundRect(x,y,w,h,r);} else {ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();} }
  function fitFont(text,maxW,startPx,weight,family){ let px=startPx; ctx.font=weight+' '+px+'px '+family; while(ctx.measureText(text).width>maxW && px>12){ px--; ctx.font=weight+' '+px+'px '+family; } return px; }
  function letter(text,cx,y,px,weight,family,color,ls){ ctx.font=weight+' '+px+'px '+family; ctx.fillStyle=color; let tot=0; for(const ch of text) tot+=ctx.measureText(ch).width+ls; let x=cx-tot/2; ctx.textAlign='left'; ctx.textBaseline='alphabetic'; for(const ch of text){ ctx.fillText(ch,x,y); x+=ctx.measureText(ch).width+ls; } ctx.textAlign='center'; }

  const bp = spState.bracketPicks || {};
  const champ = spState.tournamentWinner || bp[31];
  const hero = champ ? _bracketHeroCache[champ] : null;
  const pool = (state.currentPool && state.currentPool.name) ? state.currentPool.name : '';
  const road = spChampionRoad();

  ctx.fillStyle = '#0b0b08'; ctx.fillRect(0, 0, W, H);

  // ----- HERO: trophy-to-waist crop of the champion illustration; blurred copy
  // fills the side gaps; a soft bottom fade blends into the dark text zone. -----
  const HZ = 860, CROP = 0.86;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, HZ); ctx.clip();
  if (hero && hero.naturalWidth) {
    const cH = hero.naturalHeight * CROP;
    const bs = Math.max(W / hero.naturalWidth, HZ / cH);
    ctx.filter = 'blur(30px) brightness(0.5) saturate(1.1)';
    ctx.drawImage(hero, 0, 0, hero.naturalWidth, cH, (W - hero.naturalWidth * bs) / 2, (HZ - cH * bs) / 2, hero.naturalWidth * bs, cH * bs);
    ctx.filter = 'none';
    const s = Math.min(W / hero.naturalWidth, HZ / cH);
    const dw = hero.naturalWidth * s, dh = cH * s;
    ctx.drawImage(hero, 0, 0, hero.naturalWidth, cH, (W - dw) / 2, 0, dw, dh);
  }
  ctx.restore();
  const g = ctx.createLinearGradient(0, 0, 0, HZ);
  g.addColorStop(0, 'rgba(8,8,6,0.45)'); g.addColorStop(0.10, 'rgba(8,8,6,0)');
  g.addColorStop(0.80, 'rgba(8,8,6,0)'); g.addColorStop(0.93, 'rgba(8,8,6,0.55)');
  g.addColorStop(1, 'rgba(8,8,6,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HZ);

  // gold frame
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(217,180,106,0.45)'; rr(18, 18, W - 36, H - 36, 26); ctx.stroke();

  // header (brand + pool), shadowed for legibility over the photo
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 10;
  ctx.font = '44px ' + EMOJI; ctx.fillText('⚽', PAD, 92);
  ctx.fillStyle = INK; ctx.font = '800 38px Sora,sans-serif'; ctx.fillText('FriendlyBet', PAD + 58, 94);
  ctx.restore();
  if (pool) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 10; ctx.fillStyle = GOLD_LT; ctx.font = '700 26px Heebo,sans-serif'; ctx.textAlign = 'right'; ctx.fillText(pool, W - PAD, 94); ctx.restore(); }

  // ----- champion identity -----
  ctx.textAlign = 'center';
  letter('MY PREDICTION', W / 2, 928, 26, '800', 'Sora,sans-serif', GOLD, 8);
  const cnm = champ ? getTeamName(champ) : '—';
  ctx.textBaseline = 'middle';
  const nmPx = fitFont(cnm, 600, 74, '800', 'Sora,sans-serif'); const nmW = ctx.measureText(cnm).width;
  const cimg = champ ? _bracketFlagCache[champ] : null; const cfw = 84, cfh = 56, gap = 18;
  const hasFlag = cimg && cimg.naturalWidth;
  const total = nmW + (hasFlag ? gap + cfw : 0); let csx = W / 2 - total / 2; const rowY = 988;
  ctx.save(); ctx.shadowColor = 'rgba(217,180,106,0.4)'; ctx.shadowBlur = 28;
  ctx.fillStyle = GOLD_LT; ctx.textAlign = 'left'; ctx.font = '800 ' + nmPx + 'px Sora,sans-serif'; ctx.fillText(cnm, csx, rowY); ctx.restore();
  csx += nmW + gap;
  if (hasFlag) { ctx.save(); rr(csx, rowY - cfh / 2, cfw, cfh, 8); ctx.clip(); ctx.drawImage(cimg, csx, rowY - cfh / 2, cfw, cfh); ctx.restore(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; rr(csx, rowY - cfh / 2, cfw, cfh, 8); ctx.stroke(); }

  // ----- road to the title -----
  letter('ROAD TO THE TITLE', W / 2, 1078, 21, '700', 'Rubik,sans-serif', MUTED, 5);
  const cellW = 150, arrowW = 30, n = road.length || 5;
  const stripW = n * cellW + (n - 1) * arrowW; let rx = W / 2 - stripW / 2; const cellTop = 1104;
  road.forEach((step, i) => {
    const cx = rx + cellW / 2, fin = i === road.length - 1;
    ctx.fillStyle = fin ? GOLD_LT : GOLD; ctx.font = '800 18px Rubik,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(step.stage, cx, cellTop);
    const fw = fin ? 76 : 68, fh = fin ? 50 : 44, fy = cellTop + 12;
    const fimg = step.beat ? _bracketFlagCache[step.beat] : null;
    if (fimg && fimg.naturalWidth) { ctx.save(); rr(cx - fw / 2, fy, fw, fh, 6); ctx.clip(); ctx.drawImage(fimg, cx - fw / 2, fy, fw, fh); ctx.restore(); ctx.lineWidth = fin ? 2.5 : 1.5; ctx.strokeStyle = fin ? GOLD : 'rgba(255,255,255,0.3)'; rr(cx - fw / 2, fy, fw, fh, 6); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.textBaseline = 'middle'; fitFont(step.beat ? getTeamName(step.beat) : '—', cellW - 6, 20, '700', 'Heebo,sans-serif');
    ctx.fillText(step.beat ? getTeamName(step.beat) : '—', cx, fy + fh + 13);
    if (i < road.length - 1) { ctx.fillStyle = GOLD; ctx.font = '26px Rubik,sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('›', rx + cellW + arrowW / 2, fy + fh / 2); }
    rx += cellW + arrowW;
  });

  // ----- footer: brand + QR -----
  const divY = 1208;
  ctx.strokeStyle = 'rgba(217,180,106,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, divY); ctx.lineTo(W - PAD, divY); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD_LT; ctx.font = '800 40px Sora,sans-serif'; ctx.fillText('FriendlyBet.Live', PAD, divY + 48);
  ctx.fillStyle = MUTED; ctx.font = '600 21px Heebo,sans-serif'; ctx.fillText('build your own bracket — free, no signup', PAD, divY + 72);
  if (qr) { const qs = 58, p = 11, tile = qs + 2 * p, tx = W - PAD - tile, ty = divY + 16;
    rr(tx, ty, tile, tile, 12); ctx.fillStyle = '#f6f4ee'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = GOLD; rr(tx, ty, tile, tile, 12); ctx.stroke();
    ctx.drawImage(qr, tx + p, ty + p, qs, qs); }
}

// Render the prediction card to a PNG blob (assets loaded first). Shared by the
// native share sheet and the Instagram chip. Returns null if rendering fails.
async function _bracketCardToBlob() {
  const qr = await _prepareBracketAssets();
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
  _renderBracketCard(cv, qr);
  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}

async function shareBracketCard() {
  const champ = spState && (spState.tournamentWinner || (spState.bracketPicks && spState.bracketPicks[31]));
  if (!champ) { showToast(t('bracketShare.notReady'), 'info'); return; }
  let blob;
  try { blob = await _bracketCardToBlob(); } catch (e) { console.error('bracket card render failed', e); showToast(t('bracketShare.notReady'), 'info'); return; }
  const caption = t('bracketShare.caption');
  const homeUrl = _bracketShareUrl('bracket_card');
  (async () => {
    if (!blob) { showToast(t('bracketShare.toastDesktop'), 'info'); return; }
    const file = new File([blob], 'friendlybet-bracket.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      _recordShare('bracket_card', 'click');
      try { await navigator.share({ files: [file], text: caption, url: homeUrl }); _recordShare('bracket_card', 'completed'); }
      catch (e) { if (e.name !== 'AbortError') console.error('bracket share failed', e); }
    } else {
      _recordShare('bracket_card', 'click'); // desktop: download + copy (completion can't be observed)
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'friendlybet-bracket.png'; a.click();
      try { await navigator.clipboard.writeText(caption + ' ' + homeUrl); } catch (_) {}
      showToast(t('bracketShare.toastDesktop'), 'success');
    }
  })();
}
window.shareBracketCard = shareBracketCard;

// ---- Desktop bracket-share experience (v2.7.0) ----------------------------
// On desktop there is no native FILE share, so the old single button could only
// DOWNLOAD the image — a dead-end that offloaded the upload to the user, and the
// app logos were merely decorative (they downloaded too). Desktop doesn't have
// the mobile file-attach constraint, and our personalized /share link already
// renders THIS bracket as an OG card. So on desktop we swap the experience for:
// real per-app link buttons (one click → WhatsApp Web / X / FB with the card),
// a one-click Copy link, and an explicit Download image (for IG/stories, which
// still need the file). Mobile keeps its exact native-sheet flow, untouched.
function _canNativeFileShare() {
  try {
    if (!(navigator.canShare && navigator.share)) return false;
    const f = new File([new Blob([''], { type: 'image/png' })], 'p.png', { type: 'image/png' });
    return !!navigator.canShare({ files: [f] });
  } catch (_) { return false; }
}

// Copy the personalized bracket /share link to the clipboard (desktop quick win).
async function copyBracketLink() {
  if (!_bracketShareReady()) { showToast(t('bracketShare.notReady'), 'info'); return; }
  _prewarmBracketOg();
  const url = _bracketShareUrl('bracket_copy');
  try {
    await navigator.clipboard.writeText(url);
  } catch (_) {
    const tmp = document.createElement('input');
    tmp.value = url; document.body.appendChild(tmp); tmp.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(tmp);
  }
  showToast(t('bracketShare.linkCopied'), 'success');
}
window.copyBracketLink = copyBracketLink;

// Download the bracket PNG (desktop, or anyone who wants the file for IG/stories).
async function downloadBracketImage() {
  if (!_bracketShareReady()) { showToast(t('bracketShare.notReady'), 'info'); return; }
  let blob;
  try { blob = await _bracketCardToBlob(); }
  catch (e) { console.error('bracket card render failed', e); showToast(t('bracketShare.notReady'), 'info'); return; }
  if (!blob) { showToast(t('bracketShare.notReady'), 'info'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'friendlybet-bracket.png'; a.click();
  try { await navigator.clipboard.writeText(t('bracketShare.caption') + ' ' + _bracketShareUrl('bracket_download')); } catch (_) {}
  showToast(t('bracketShare.toastDesktop'), 'success');
}
window.downloadBracketImage = downloadBracketImage;

// Desktop-only controls markup (v2.7.5). Copy-link is the HERO — the reliable,
// universal, conversion-friendly action (a friend who opens it lands on the full
// /share page regardless of any platform's link-preview quirks). Below it, the
// per-app chips open that app with the same personalized link (its pre-warmed OG
// card renders the bracket). Download image is a quiet secondary for IG/stories.
function _bracketShareControlsHtml() {
  const chip = (cls, fn, label, svg) =>
    `<button class="share-app-chip ${cls}" type="button" onclick="${fn}('bracket')" aria-label="${label}">${svg}<span>${label}</span></button>`;
  const WA = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  const TG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';
  const X  = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  const FB = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
  const RD = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.975 2.163 2.174 2.163 1.198 0 2.172-.97 2.172-2.163s-.975-2.164-2.172-2.164c-.92 0-1.704.574-2.021 1.379l-4.329-1.015c-.189-.046-.381.063-.44.249l-1.654 5.207c-2.838.034-5.409.798-7.3 2.025-.474-.438-1.103-.712-1.799-.712-1.465 0-2.656 1.187-2.656 2.646 0 .97.533 1.811 1.317 2.271-.052.282-.086.567-.086.857 0 3.911 4.808 7.093 10.719 7.093s10.72-3.182 10.72-7.093c0-.288-.033-.571-.084-.852.789-.46 1.325-1.301 1.325-2.276zm-17.954 1.835c0-.834.679-1.513 1.513-1.513.834 0 1.513.679 1.513 1.513 0 .834-.679 1.513-1.513 1.513-.834 0-1.513-.679-1.513-1.513zm9.062 4.992c-.815.815-2.387.876-2.846.876-.46 0-2.033-.061-2.847-.875-.119-.119-.119-.312 0-.431.119-.119.312-.119.431 0 .516.516 1.617.7 2.416.7.798 0 1.899-.184 2.416-.7.119-.119.312-.119.431 0 .117.119.117.312-.001.43zm-.211-3.479c-.834 0-1.513-.679-1.513-1.513 0-.834.679-1.513 1.513-1.513.834 0 1.513.679 1.513 1.513 0 .834-.679 1.513-1.513 1.513z"/></svg>';
  const EM = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"></rect><polyline points="22,6 12,13 2,6"></polyline></svg>';
  const CP = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  const head =
    '<div class="bsd-head">' +
    `<div class="bsd-head-title">${t('bracketShare.desktopTitle')}</div>` +
    `<div class="bsd-head-sub">${t('bracketShare.desktopSub')}</div>` +
    '</div>';
  // HERO: a copy-link row. Clicking anywhere copies the personalized /share link.
  const linkrow =
    '<div class="bsd-linkrow" onclick="copyBracketLink()" role="button" tabindex="0" aria-label="' + t('bracketShare.copyLink') + '">' +
    '<span class="bsd-linkurl">friendlybet.live/share</span>' +
    `<span class="bsd-copybtn">${CP}<span>${t('bracketShare.copyLink')}</span></span>` +
    '</div>';
  // Per-app chips — all link-based; each opens that app with the same /share link.
  const grid =
    '<div class="share-apps-grid bracket-share-grid">' +
    chip('chip-whatsapp', 'shareToWhatsApp', 'WhatsApp', WA) +
    chip('chip-telegram', 'shareToTelegram', 'Telegram', TG) +
    chip('chip-x', 'shareToX', 'X', X) +
    chip('chip-facebook', 'shareToFacebook', 'Facebook', FB) +
    chip('chip-reddit', 'shareToReddit', 'Reddit', RD) +
    chip('chip-email', 'shareByEmail', t('shareModal.email'), EM) +
    '</div>';
  const download =
    `<button class="bsd-download" type="button" onclick="downloadBracketImage()"><i class="ti ti-download"></i><span data-i18n="bracketShare.downloadImage">${t('bracketShare.downloadImage')}</span></button>`;
  return head + linkrow + grid + download;
}

// Toggle native (mobile) vs desktop share affordances within a container.
// Elements tagged [data-share-native] are the mobile native-sheet flow; those
// tagged [data-share-desktop] are the link-chips/copy/download flow.
function _ensureBracketDesktopControls(el) {
  if (el && !el.dataset.bscFilled) {
    el.innerHTML = _bracketShareControlsHtml();
    el.dataset.bscFilled = '1';
  }
}
function _applyBracketShareMode(root) {
  if (!root) return;
  const desktop = !_canNativeFileShare();
  root.querySelectorAll('[data-share-native]').forEach(elm => { elm.style.display = desktop ? 'none' : ''; });
  root.querySelectorAll('[data-share-desktop]').forEach(elm => { elm.style.display = desktop ? '' : 'none'; });
}
window._applyBracketShareMode = _applyBracketShareMode;

// Celebration modal shown right after the first complete save: previews the
// bracket card and offers Share / Done. Routing to the dashboard already
// happened in spSubmitPredictions, so closing just dismisses the modal.
async function openBracketShareCelebration() {
  const modal = document.getElementById('bracket-share-modal');
  const cv = document.getElementById('bracket-share-card-canvas');
  if (!modal || !cv) return;
  const champ = spState && (spState.tournamentWinner || (spState.bracketPicks && spState.bracketPicks[31]));
  if (!champ) return; // nothing to celebrate yet
  modal.style.display = 'flex';
  // Desktop gets functional link chips + copy + download instead of the
  // download-only dead-end; mobile keeps its native-sheet button. (v2.7.0)
  _ensureBracketDesktopControls(document.getElementById('bracket-share-desktop'));
  _applyBracketShareMode(modal);
  _prewarmBracketOg(); // warm the OG edge cache early so link previews aren't empty
  // Instant first paint (names render now; flags + QR fill in once loaded) so the
  // modal never shows a blank canvas while assets load on a slow connection.
  try { _renderBracketCard(cv, null); } catch (_) {}
  const qr = await _prepareBracketAssets();
  try { _renderBracketCard(cv, qr); } catch (e) { console.error('celebration render failed', e); }
}
function closeBracketShareCelebration() {
  const modal = document.getElementById('bracket-share-modal');
  if (modal) modal.style.display = 'none';
}
window.openBracketShareCelebration = openBracketShareCelebration;
window.closeBracketShareCelebration = closeBracketShareCelebration;

async function copyPoolCodeOnly() {
  if (_inviteShareBlocked()) return;
  const code = state.currentPool?.code;
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code);
    showToast(t('shareModal.copyCodeOk'), 'success');
  } catch (err) {
    showToast(t('shareModal.copyError'), 'error');
  }
}

// ============================================================
// QR Code generation - pure JS, no library needed
// ============================================================

function generateQRCode(text) {
  const container = document.getElementById('share-qr-code');
  if (!container) return;
  
  container.innerHTML = `<div class="ts-loading">${t('shareModal.generatingQR')}</div>`;
  
  // Use a free QR API as fallback
  const size = 200;
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a0a08&margin=8&format=svg`;
  
  // Try to fetch and embed
  fetch(apiUrl)
    .then(r => r.text())
    .then(svg => {
      container.innerHTML = svg;
    })
    .catch(err => {
      // Fallback: show image tag
      container.innerHTML = `<img src="${apiUrl}" alt="QR Code" width="${size}" height="${size}" style="border-radius: 8px;">`;
    });
}

// ============================================================
// SHARE MY RECOVERY CODE - For users to share their own code
// ============================================================

function copyMyRecoveryCode() {
  const code = state.pendingRecoveryCode || localStorage.getItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE);
  if (!code) {
    showToast(t('recoveryDisplay.notFound'), 'error');
    return;
  }

  navigator.clipboard.writeText(code).then(() => {
    showToast(t('recoveryDisplay.copiedToast'), 'success');
  }).catch(() => {
    showToast(t('shareModal.copyError'), 'error');
  });
}

// ============================================================
// PWA - Service Worker Registration & Install Prompt
// ============================================================

let deferredInstallPrompt = null;

// ============================================================
// ONLINE/OFFLINE DETECTION
// ============================================================

window.addEventListener('online', () => {
  console.log('🌐 Back online');
  hideOfflineBanner();
  showToast(t('pwa.online'), 'success');
});

window.addEventListener('offline', () => {
  console.log('🔌 Gone offline');
  showOfflineBanner();
});

function showOfflineBanner() {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
      <span>${t('pwa.offline')}</span>
    `;
    document.body.appendChild(banner);
  }
  setTimeout(() => banner.classList.add('visible'), 10);
}

function hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.remove('visible');
}

// Check initial state
if (!navigator.onLine) {
  setTimeout(showOfflineBanner, 2000);
}


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        console.log('✅ Service Worker registered:', reg.scope);
        
        // Check for updates every 30 minutes
        setInterval(() => reg.update(), 30 * 60 * 1000);
        
        // Notify about updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New version available');
                showUpdateAvailable();
              }
            });
          }
        });
      })
      .catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
    
    // Reload on controller change (after SW update)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

// Capture install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 Install prompt available');
  e.preventDefault();
  deferredInstallPrompt = e;
  
  // Show our custom install banner after a short delay
  // (only if user hasn't dismissed it recently)
  const lastDismissed = localStorage.getItem('pwa_install_dismissed');
  const now = Date.now();
  
  if (!lastDismissed || (now - parseInt(lastDismissed)) > 7 * 24 * 60 * 60 * 1000) {
    setTimeout(() => showInstallBanner(), 3000);
  }
});

// Track successful installation
window.addEventListener('appinstalled', () => {
  console.log('✅ App installed');
  deferredInstallPrompt = null;
  hideInstallBanner();
  showToast(t('pwa.installed'), 'success');
});

function showInstallBanner() {
  if (!deferredInstallPrompt) return;
  
  // Don't show if already in standalone mode
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone) return;  // iOS
  
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.classList.add('visible');
  }
}

function hideInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.classList.remove('visible');
  }
}

async function triggerInstall() {
  if (!deferredInstallPrompt) {
    // iOS or unsupported browser
    showIosInstallInstructions();
    return;
  }
  
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log('Install outcome:', outcome);
  
  if (outcome === 'accepted') {
    showToast(t('pwa.installing'), 'success');
  }
  
  deferredInstallPrompt = null;
  hideInstallBanner();
}

function dismissInstallBanner() {
  localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  hideInstallBanner();
}

function showIosInstallInstructions() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    alert(t('pwa.iosInstructions'));
  } else {
    alert(t('pwa.desktopInstructions'));
  }
}

function showUpdateAvailable() {
  const toast = document.createElement('div');
  toast.className = 'pwa-update-toast';
  toast.innerHTML = `
    <span>${t('pwa.updateAvailable')}</span>
    <button onclick="applyUpdate()">${t('pwa.update')}</button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 100);
}

function applyUpdate() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Detect iOS and show special hint
window.addEventListener('load', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  
  if (isIOS && !isStandalone) {
    const lastDismissed = localStorage.getItem('pwa_install_dismissed');
    const now = Date.now();
    
    if (!lastDismissed || (now - parseInt(lastDismissed)) > 7 * 24 * 60 * 60 * 1000) {
      setTimeout(() => showInstallBanner(), 3000);
    }
  }
});

// ============================================================
// v2.0.0 - POOL SETUP WIZARD + SINGLE-PHASE BETTING + NEW SCORING
// ============================================================

// ---- WC 2026 group definitions (mirrors CLAUDE.md) ----
const WC2026_GROUPS = {
  A: ['MEX','RSA','KOR','CZE'],
  B: ['CAN','BIH','QAT','SUI'],
  C: ['BRA','MAR','HAI','SCO'],
  D: ['USA','PAR','AUS','TUR'],
  E: ['GER','CUR','CIV','ECU'],
  F: ['NED','JPN','SWE','TUN'],
  G: ['BEL','EGY','IRN','NZL'],
  H: ['ESP','CPV','SAU','URU'],
  I: ['FRA','SEN','IRQ','NOR'],
  J: ['ARG','ALG','AUT','JOR'],
  K: ['POR','COD','UZB','COL'],
  L: ['ENG','CRO','GHA','PAN']
};
const WC2026_GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// FIFA world ranking snapshot for WC2026 teams (approx. late 2025).
// Lower number = better rank. Unknown codes fall back to 999.
const FIFA_RANKINGS = {
  ARG: 1,  ESP: 2,  FRA: 3,  ENG: 4,  BRA: 5,  POR: 6,  NED: 7,  BEL: 8,
  CRO: 9,  GER: 12, COL: 13, MAR: 14, URU: 15, USA: 16, MEX: 17, JPN: 18, SUI: 19,
  SEN: 20, IRN: 21, KOR: 22, AUT: 23, ECU: 24, SWE: 25, AUS: 26, TUR: 27,
  NOR: 28, TUN: 29, EGY: 30, ALG: 31, CAN: 32, CZE: 33, SCO: 34, CIV: 35,
  PAR: 37, PAN: 38, IRQ: 40, RSA: 42, UZB: 43, JOR: 44, GHA: 47,
  NZL: 55, SAU: 57, COD: 58, BIH: 59, HAI: 60, CPV: 65, QAT: 66, CUR: 85
};
function fifaRankOf(code) { return FIFA_RANKINGS[code] ?? 999; }

// Default scoring rules per mode.
// v2.5.55: rebalanced to a clean doubling progression so each stage's
// max-points-per-pool is roughly equal (~32 pts per stage), and the
// later rounds are clearly more valuable than earlier ones:
//   1 pt × 32 advancing teams      =  32
//   2 pt × 16 R16 advancers        =  32
//   4 pt ×  8 QF advancers         =  32
//   8 pt ×  4 SF advancers         =  32
//  16 pt ×  2 finalists             =  32
//  32 pt ×  1 champion              =  32
const DEFAULT_SCORING_RULES = {
  single_phase: {
    // v2.6.17: doubling progression so each stage caps at ~32 pts and the
    // later rounds reward the harder predictions in line with their odds:
    //   Groups: 1st=4, 2nd=3, 3rd=2, 4th=1 (10 pts/group × 12 = 120).
    //   Knockout (correct winner = team reached NEXT round):
    //     R32=2, R16=4, QF=8, SF=16, Final=32  (32 pts max per stage).
    //   No separate tournament_winner bonus (the Final pick IS the champion).
    group_first: 4,
    group_second: 3,
    group_third: 2,
    group_fourth: 1,
    third_place_advance: 1,
    round_of_32: 2,
    round_of_16: 4,
    quarter_final: 8,
    semi_final: 16,
    final: 32,
    top_scorer: 10
  },
  two_phase: {
    // Two-phase users pick "who qualifies" without ordering, so the same
    // 1pt-per-advancer rule applies. 3rd/4th aren't even a question here.
    group_first: 1,
    group_second: 1,
    group_third: 0,
    group_fourth: 0,
    round_of_32: 2,
    round_of_16: 4,
    quarter_final: 8,
    semi_final: 16,
    final: 32,
    top_scorer: 10
  }
};

// v2.5.34: default category multipliers + per-team tier classification.
// Custom pools can override either or both via scoring_rules.multipliers
// and scoring_rules.team_multipliers.
const DEFAULT_MULTIPLIERS = { favorite: 1.0, contender: 1.5, underdog: 2.0 };

function _defaultTierFromRank(rank) {
  if (rank <= 10) return 'favorite';
  if (rank <= 30) return 'contender';
  return 'underdog';
}
function getTeamDefaultTier(code) { return _defaultTierFromRank(fifaRankOf(code)); }

// Resolve the multiplier for a team for a given pool. Per-team override
// wins; otherwise fall back to the pool's category multiplier; otherwise
// fall back to the global default.
function getPoolTeamMultiplier(pool, teamCode) {
  // v2.5.47: master switch - when the admin turned multipliers off,
  // every team resolves to ×1 regardless of the configured values.
  if (pool && pool.use_multipliers === false) return 1.0;
  const rules = (pool && pool.scoring_rules) || {};
  const teamMap = rules.team_multipliers || {};
  if (teamMap[teamCode] != null) return parseFloat(teamMap[teamCode]) || 1.0;
  const cat = rules.multipliers || DEFAULT_MULTIPLIERS;
  const tier = getTeamDefaultTier(teamCode);
  return parseFloat(cat[tier]) || DEFAULT_MULTIPLIERS[tier];
}
window.getPoolTeamMultiplier = getPoolTeamMultiplier;

// v2.5.48: returns true when the pool uses the out-of-the-box multipliers
// (no per-team overrides AND category values match DEFAULT_MULTIPLIERS).
// Used by UIs that show "⭐ Favorite ×1" full labels only when the values
// haven't been customised - if the admin tweaked anything, those labels
// would be misleading, so we collapse to bare "×N".
function poolUsesDefaultMultipliers(pool) {
  if (!pool || pool.use_multipliers === false) return false;
  const rules = pool.scoring_rules || {};
  const teamMap = rules.team_multipliers || {};
  if (Object.keys(teamMap).length > 0) return false;
  const cat = rules.multipliers;
  if (!cat) return true; // nothing stored → defaults are in effect
  return ['favorite', 'contender', 'underdog'].every(k =>
    Math.abs(parseFloat(cat[k]) - DEFAULT_MULTIPLIERS[k]) < 0.01
  );
}
window.poolUsesDefaultMultipliers = poolUsesDefaultMultipliers;

// ============================================================
// PHASE 1: POOL SETUP WIZARD
// ============================================================

// v2.5.54: per-mode default for the master multipliers toggle. Single-phase
// pools start with multipliers OFF (admin opted-in if they want them);
// two-phase keeps them ON by default, matching the legacy behavior.
function _defaultUseMultsForMode(mode) {
  return mode === 'two_phase';
}

const wizardState = {
  step: 1,
  mode: 'single_phase',      // 'single_phase' | 'two_phase'
  rulesChoice: 'default',     // 'default' | 'custom'
  customRules: null,          // populated when user customizes
  // v2.5.47: master on/off for risk multipliers. v2.5.54: per-mode default.
  useMultipliers: _defaultUseMultsForMode('single_phase')
};

function startPoolWizard() {
  const input = document.getElementById('admin-nickname-input');
  const adminNickname = input.value.trim();

  if (!adminNickname) {
    showError('admin-error', t('adminNickname.errorRequired'));
    return;
  }
  if (adminNickname.length < CONFIG.MIN_NICKNAME_LENGTH) {
    showError('admin-error', t('nickname.errorMin', { n: CONFIG.MIN_NICKNAME_LENGTH }));
    return;
  }

  state.pendingAdminNickname = adminNickname;
  wizardState.step = 1;
  wizardState.mode = 'single_phase';
  wizardState.rulesChoice = 'default';
  wizardState.customRules = null;
  // v2.5.54: reset master toggle per mode default (single_phase = off)
  wizardState.useMultipliers = _defaultUseMultsForMode(wizardState.mode);

  renderWizardStep();
  showScreen('pool-wizard-screen');
}

function renderWizardStep() {
  // v2.5.9: wizard is now 2 steps. Step 3 element is removed; loop iterates
  // only 1..2. Create button shows on step 2 directly (no Review screen).
  const TOTAL = 2;
  for (let i = 1; i <= TOTAL; i++) {
    const el = document.getElementById(`wizard-step-${i}`);
    if (el) el.style.display = (i === wizardState.step) ? '' : 'none';
  }

  const pct = (wizardState.step / TOTAL) * 100;
  const fill = document.getElementById('wizard-progress-fill');
  if (fill) fill.style.width = `${pct}%`;
  const lbl = document.getElementById('wizard-step-label');
  if (lbl) lbl.textContent = t('wizard.stepLabel', { n: wizardState.step, total: TOTAL });

  const backBtn = document.getElementById('wizard-back-btn');
  const nextBtn = document.getElementById('wizard-next-btn');
  const createBtn = document.getElementById('wizard-create-btn');
  if (backBtn) backBtn.style.display = wizardState.step > 1 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = wizardState.step < TOTAL ? '' : 'none';
  if (createBtn) createBtn.style.display = wizardState.step === TOTAL ? '' : 'none';

  if (wizardState.step === 1) {
    document.querySelectorAll('#wizard-step-1 .wizard-option-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.mode === wizardState.mode);
    });
  }
  if (wizardState.step === 2) {
    renderWizardRulesStep();
  }
}

function wizardSelectMode(mode) {
  wizardState.mode = mode;
  wizardState.customRules = null; // reset on mode change
  // v2.5.54: switching modes resets the master multipliers toggle to the
  // new mode's default (single_phase = off, two_phase = on). Anything the
  // admin tweaked on the old mode is dropped along with customRules.
  wizardState.useMultipliers = _defaultUseMultsForMode(mode);
  document.querySelectorAll('#wizard-step-1 .wizard-option-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.mode === mode);
  });
}

function wizardSelectRules(choice) {
  wizardState.rulesChoice = choice;
  // v2.5.7: single render path handles toggle state + list rebuild
  renderWizardRulesStep();
}

function getWizardRuleKeys() {
  // Two_phase doesn't use 3rd/4th place.
  // v2.5.70: round_of_32 restored - each correct R32 winner pick means the
  // team reached R16, which is a meaningful achievement beyond just being
  // top 2 of a group (since 8 of 12 third-place teams also advance to R32).
  // v2.5.72: tournament_winner removed - a correct Final pick already IS the
  // champion prediction, so it's scored once via `final`.
  if (wizardState.mode === 'two_phase') {
    return ['group_first','group_second','round_of_32','round_of_16','quarter_final','semi_final','final','top_scorer'];
  }
  return ['group_first','group_second','group_third','group_fourth','third_place_advance',
          'round_of_32','round_of_16','quarter_final','semi_final','final','top_scorer'];
}

// v2.5.7: read-only render of a pool's scoring_rules into the Pool Settings
// screen for single_phase pools. Mirrors the grouped wizard layout so the
// user sees the same shape they configured in the wizard.
function _renderV2ScoringList(pool) {
  const list = document.getElementById('settings-v2-scoring-list');
  if (!list) return;
  const rules = (pool && pool.scoring_rules) || DEFAULT_SCORING_RULES.single_phase;
  const groups = [
    {
      titleKey: 'wizard.ruleGroup.group',
      rows: ['group_first', 'group_second', 'group_third', 'group_fourth', 'third_place_advance']
    },
    {
      titleKey: 'wizard.ruleGroup.knockout',
      rows: ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final']
    },
    {
      titleKey: 'wizard.ruleGroup.bonus',
      rows: ['top_scorer']
    }
  ];
  list.innerHTML = groups.map(group => `
    <div class="wizard-rules-group">
      <div class="wizard-rules-group-title">${t(group.titleKey)}</div>
      ${group.rows.map(k => `
        <div class="wizard-rules-row">
          <span class="wizard-rules-row-label">${t('wizard.rule.' + k)}</span>
          <span class="wizard-rules-row-pts">${rules[k] != null ? rules[k] : 0} ${t('common.points')}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// v2.5.7: organize the rule keys into 3 semantic groups for the redesigned
// scoring-rules screen (and the step-3 summary). Returns only groups that
// actually have keys in the current mode.
// v2.5.27: in two_phase mode, collapse group_first + group_second into a
// single "Each advancing team" row - in two-phase the user picks who
// advances (binary) regardless of position, so per-position labels are
// misleading. The synthetic key 'advancing_team' is handled specially by
// renderWizardRulesStep (reads from group_first, writes to BOTH).
function _wizardRuleGroups() {
  if (wizardState.mode === 'two_phase') {
    return [
      {
        titleKey: 'wizard.ruleGroup.group',
        rows: ['advancing_team']
      },
      {
        titleKey: 'wizard.ruleGroup.knockout',
        rows: ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final']
      },
      {
        titleKey: 'wizard.ruleGroup.bonus',
        rows: ['top_scorer']
      }
    ];
  }
  const keys = getWizardRuleKeys();
  const inSet = (k) => keys.includes(k);
  return [
    {
      titleKey: 'wizard.ruleGroup.group',
      rows: ['group_first', 'group_second', 'group_third', 'group_fourth', 'third_place_advance'].filter(inSet)
    },
    {
      titleKey: 'wizard.ruleGroup.knockout',
      rows: ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final'].filter(inSet)
    },
    {
      titleKey: 'wizard.ruleGroup.bonus',
      rows: ['top_scorer'].filter(inSet)
    }
  ].filter(g => g.rows.length > 0);
}

function renderWizardRulesStep() {
  // v2.5.84: risk multipliers are an ADVANCED option. For single_phase they're
  // off by default and the whole multipliers section is hidden on the default
  // rules view — it only appears under "custom" (advanced). two_phase keeps
  // them visible (legacy: on by default).
  const multInfo = document.getElementById('wizard-multipliers-info');
  const showMult = (wizardState.rulesChoice === 'custom') || (wizardState.mode === 'two_phase');
  if (multInfo) multInfo.style.display = showMult ? '' : 'none';

  // v2.5.7: pill toggle - active state mirrors rulesChoice
  document.querySelectorAll('#wizard-step-2 .wizard-rules-toggle-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.rules === wizardState.rulesChoice);
  });

  // Seed custom rules from defaults the first time the user enters custom mode
  if (wizardState.rulesChoice === 'custom' && !wizardState.customRules) {
    wizardState.customRules = { ...DEFAULT_SCORING_RULES[wizardState.mode] };
  }
  // v2.5.34: seed multipliers + team-overrides bag the first time we go custom
  if (wizardState.rulesChoice === 'custom' && wizardState.customRules &&
      !wizardState.customRules.multipliers) {
    wizardState.customRules.multipliers = { ...DEFAULT_MULTIPLIERS };
    wizardState.customRules.team_multipliers = {};
  }

  // v2.5.35: multipliers apply to single_phase too now
  renderWizardMultipliers();

  // Build the unified grouped list
  const list = document.getElementById('wizard-rules-list');
  if (!list) return;
  const defaults = DEFAULT_SCORING_RULES[wizardState.mode];
  const values = wizardState.rulesChoice === 'custom' ? wizardState.customRules : defaults;
  const isCustom = wizardState.rulesChoice === 'custom';

  // v2.5.27: synthetic key 'advancing_team' mirrors group_first for two_phase
  const valueFor = (k) => (k === 'advancing_team') ? (values.group_first || 0) : values[k];

  list.innerHTML = _wizardRuleGroups().map(group => `
    <div class="wizard-rules-group">
      <div class="wizard-rules-group-title">${t(group.titleKey)}</div>
      ${group.rows.map(k => `
        <div class="wizard-rules-row">
          <span class="wizard-rules-row-label">${t('wizard.rule.' + k)}</span>
          ${isCustom
            ? `<div class="wizard-rules-stepper">
                 <button type="button" class="wizard-rules-stepper-btn" aria-label="−"
                   onclick="wizardStepRule('${k}', -1)">−</button>
                 <input type="number" min="0" max="100" value="${valueFor(k)}"
                   id="wizard-rule-${k}"
                   class="wizard-rules-row-input"
                   onchange="wizardUpdateCustomRule('${k}', this.value)" />
                 <button type="button" class="wizard-rules-stepper-btn" aria-label="+"
                   onclick="wizardStepRule('${k}', 1)">+</button>
               </div>`
            : `<span class="wizard-rules-row-pts">${valueFor(k)} ${t('common.points')}</span>`}
        </div>
      `).join('')}
    </div>
  `).join('');
}

// v2.5.12: +/- stepper buttons for the Custom scoring inputs.
function wizardStepRule(key, delta) {
  if (!wizardState.customRules) {
    wizardState.customRules = { ...DEFAULT_SCORING_RULES[wizardState.mode] };
  }
  // v2.5.27: synthetic 'advancing_team' key mirrors to both group_first
  //          and group_second for two_phase, since position-based scoring
  //          doesn't apply when the user picks "who advances".
  if (key === 'advancing_team') {
    const current = parseInt(wizardState.customRules.group_first || 0, 10);
    let next = current + delta;
    if (next < 0) next = 0;
    if (next > 100) next = 100;
    wizardState.customRules.group_first = next;
    wizardState.customRules.group_second = next;
    const input = document.getElementById('wizard-rule-advancing_team');
    if (input) input.value = next;
    return;
  }
  const current = parseInt(wizardState.customRules[key] || 0, 10);
  let next = current + delta;
  if (next < 0) next = 0;
  if (next > 100) next = 100;
  wizardState.customRules[key] = next;
  const input = document.getElementById('wizard-rule-' + key);
  if (input) input.value = next;
}
window.wizardStepRule = wizardStepRule;

function wizardUpdateCustomRule(key, value) {
  let v = parseInt(value, 10);
  if (isNaN(v) || v < 0) v = 0;
  if (v > 100) v = 100;
  if (!wizardState.customRules) wizardState.customRules = { ...DEFAULT_SCORING_RULES[wizardState.mode] };
  // v2.5.27: synthetic advancing_team mirrors to both group_first + group_second
  if (key === 'advancing_team') {
    wizardState.customRules.group_first = v;
    wizardState.customRules.group_second = v;
  } else {
    wizardState.customRules[key] = v;
  }
}

// v2.5.34: render the 3 category multipliers (editable when custom, read-only
// otherwise) + the collapsible per-team overrides grid.
function renderWizardMultipliers() {
  const rowsEl = document.getElementById('wizard-multipliers-rows');
  const detailsEl = document.getElementById('wizard-team-mults');
  if (!rowsEl) return;

  // v2.5.47: sync the power toggle + single-phase note + dimmed body state
  const powerToggle = document.getElementById('wizard-mult-power');
  if (powerToggle) powerToggle.checked = wizardState.useMultipliers !== false;
  const body = document.getElementById('wizard-multipliers-body');
  if (body) body.classList.toggle('is-off', wizardState.useMultipliers === false);
  const spNote = document.getElementById('wizard-mult-sp-note');
  if (spNote) spNote.style.display = (wizardState.mode === 'single_phase') ? '' : 'none';

  const isCustom = wizardState.rulesChoice === 'custom';
  const cat = (isCustom && wizardState.customRules && wizardState.customRules.multipliers)
    ? wizardState.customRules.multipliers
    : DEFAULT_MULTIPLIERS;

  const tiers = [
    { key: 'favorite',  emoji: '⭐', nameKey: 'poolSettings.multFav' },
    { key: 'contender', emoji: '⚔️', nameKey: 'poolSettings.multCont' },
    { key: 'underdog',  emoji: '🐶', nameKey: 'poolSettings.multUnd' }
  ];
  rowsEl.innerHTML = tiers.map(tier => {
    const val = (cat[tier.key] != null ? cat[tier.key] : DEFAULT_MULTIPLIERS[tier.key]);
    const valStr = Number(val).toFixed(val % 1 === 0 ? 0 : 1);
    return `
      <div class="multiplier-row">
        <span class="mult-emoji">${tier.emoji}</span>
        <span class="mult-name">${t(tier.nameKey)}</span>
        ${isCustom
          ? `<div class="wizard-rules-stepper mult-stepper">
               <button type="button" class="wizard-rules-stepper-btn" aria-label="−"
                 onclick="wizardStepMultiplier('${tier.key}', -1)">−</button>
               <input type="number" min="0.5" max="5" step="0.1" value="${valStr}"
                 class="wizard-rules-row-input mult-input"
                 onchange="wizardUpdateMultiplier('${tier.key}', this.value)" />
               <button type="button" class="wizard-rules-stepper-btn" aria-label="+"
                 onclick="wizardStepMultiplier('${tier.key}', 1)">+</button>
             </div>`
          : `<span class="mult-value">×${valStr}</span>`}
      </div>
    `;
  }).join('');

  if (detailsEl) {
    detailsEl.style.display = isCustom ? '' : 'none';
    // Populate the per-team grid only when needed; cheap to rebuild on every render.
    if (isCustom) renderWizardTeamMultipliers();
  }
}

function renderWizardTeamMultipliers() {
  const grid = document.getElementById('wizard-team-mults-grid');
  if (!grid || !wizardState.customRules) return;
  const cat = wizardState.customRules.multipliers || DEFAULT_MULTIPLIERS;
  const overrides = wizardState.customRules.team_multipliers || {};

  // Iterate every WC2026 team, sorted by FIFA rank for a sensible reading order.
  const allCodes = WC2026_GROUP_LETTERS.flatMap(L => WC2026_GROUPS[L]);
  const sorted = [...allCodes].sort((a, b) => fifaRankOf(a) - fifaRankOf(b));

  grid.innerHTML = sorted.map(code => {
    const tier = getTeamDefaultTier(code);
    const overridden = overrides[code] != null;
    const val = overridden ? parseFloat(overrides[code]) : parseFloat(cat[tier] || DEFAULT_MULTIPLIERS[tier]);
    const valStr = Number(val).toFixed(val % 1 === 0 ? 0 : 1);
    const flag = (typeof getCountryFlag === 'function') ? getCountryFlag(code) : '';
    const name = (typeof getTeamName === 'function') ? getTeamName(code) : code;
    // v2.5.39: +/- buttons with 0.5 step on each side of the value, so
    // mobile users don\'t need to bring up the numeric keyboard for a
    // common adjustment. The input is still editable directly.
    return `
      <div class="wizard-team-mult-row ${overridden ? 'overridden' : ''}" data-tier="${tier}">
        <span class="wizard-team-mult-flag">${flag}</span>
        <span class="wizard-team-mult-name">${name}</span>
        <div class="wizard-team-mult-stepper">
          <button type="button" class="wizard-team-mult-btn" aria-label="−"
            onclick="wizardStepTeamMultiplier('${code}', -1)">−</button>
          <input type="number" min="0.5" max="5" step="0.5" value="${valStr}"
            class="wizard-team-mult-input"
            onchange="wizardSetTeamMultiplier('${code}', this.value)" />
          <button type="button" class="wizard-team-mult-btn" aria-label="+"
            onclick="wizardStepTeamMultiplier('${code}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

// v2.5.39: +/- step by 0.5 per click. Reuses wizardSetTeamMultiplier so
// the "matches category default → drop override" cleanup still applies.
function wizardStepTeamMultiplier(code, dir) {
  const overrides = (wizardState.customRules && wizardState.customRules.team_multipliers) || {};
  const cat = (wizardState.customRules && wizardState.customRules.multipliers) || DEFAULT_MULTIPLIERS;
  const tier = getTeamDefaultTier(code);
  const current = overrides[code] != null
    ? parseFloat(overrides[code])
    : parseFloat(cat[tier] || DEFAULT_MULTIPLIERS[tier]);
  let next = Math.round((current + dir * 0.5) * 10) / 10;
  if (next < 0.5) next = 0.5;
  if (next > 5) next = 5;
  wizardSetTeamMultiplier(code, next);
}
window.wizardStepTeamMultiplier = wizardStepTeamMultiplier;

function wizardStepMultiplier(key, delta) {
  if (!wizardState.customRules) wizardState.customRules = { ...DEFAULT_SCORING_RULES[wizardState.mode] };
  if (!wizardState.customRules.multipliers) wizardState.customRules.multipliers = { ...DEFAULT_MULTIPLIERS };
  const cur = parseFloat(wizardState.customRules.multipliers[key]) || DEFAULT_MULTIPLIERS[key];
  let next = Math.round((cur + delta * 0.1) * 10) / 10;
  if (next < 0.5) next = 0.5;
  if (next > 5) next = 5;
  wizardState.customRules.multipliers[key] = next;
  renderWizardMultipliers();
}
window.wizardStepMultiplier = wizardStepMultiplier;

function wizardUpdateMultiplier(key, value) {
  let v = parseFloat(value);
  if (isNaN(v) || v < 0.5) v = 0.5;
  if (v > 5) v = 5;
  v = Math.round(v * 10) / 10;
  if (!wizardState.customRules) wizardState.customRules = { ...DEFAULT_SCORING_RULES[wizardState.mode] };
  if (!wizardState.customRules.multipliers) wizardState.customRules.multipliers = { ...DEFAULT_MULTIPLIERS };
  wizardState.customRules.multipliers[key] = v;
  renderWizardMultipliers();
}
window.wizardUpdateMultiplier = wizardUpdateMultiplier;

function wizardSetTeamMultiplier(code, value) {
  let v = parseFloat(value);
  if (isNaN(v) || v < 0.5) v = 0.5;
  if (v > 5) v = 5;
  v = Math.round(v * 10) / 10;
  if (!wizardState.customRules) wizardState.customRules = { ...DEFAULT_SCORING_RULES[wizardState.mode] };
  if (!wizardState.customRules.team_multipliers) wizardState.customRules.team_multipliers = {};
  // If the value matches the category default for this team, drop the override
  // so the row reverts to "inherits category" — keeps the saved JSONB clean.
  const tier = getTeamDefaultTier(code);
  const catVal = parseFloat((wizardState.customRules.multipliers || DEFAULT_MULTIPLIERS)[tier]) || DEFAULT_MULTIPLIERS[tier];
  if (Math.abs(v - catVal) < 0.01) {
    delete wizardState.customRules.team_multipliers[code];
  } else {
    wizardState.customRules.team_multipliers[code] = v;
  }
  renderWizardTeamMultipliers();
}
window.wizardSetTeamMultiplier = wizardSetTeamMultiplier;

function wizardResetTeamMultipliers() {
  if (!wizardState.customRules) return;
  wizardState.customRules.team_multipliers = {};
  renderWizardTeamMultipliers();
}
window.wizardResetTeamMultipliers = wizardResetTeamMultipliers;

// v2.5.47: master on/off for the whole risk-multipliers feature. Stored on
// pool.use_multipliers; when false, getPoolTeamMultiplier(pool, code) falls
// back to ×1 for every team (see app.js).
function wizardToggleUseMultipliers(checked) {
  wizardState.useMultipliers = !!checked;
  renderWizardMultipliers();
}
window.wizardToggleUseMultipliers = wizardToggleUseMultipliers;

function getFinalScoringRules() {
  if (wizardState.rulesChoice === 'custom' && wizardState.customRules) {
    // Make sure all required keys exist (fill unused with 0 for storage)
    const merged = { ...DEFAULT_SCORING_RULES.single_phase };
    Object.keys(merged).forEach(k => merged[k] = 0);
    Object.keys(wizardState.customRules).forEach(k => merged[k] = wizardState.customRules[k]);
    // v2.5.34: ensure multipliers + team_multipliers ride along (deep copy of objects)
    if (wizardState.customRules.multipliers) {
      merged.multipliers = { ...wizardState.customRules.multipliers };
    }
    if (wizardState.customRules.team_multipliers) {
      merged.team_multipliers = { ...wizardState.customRules.team_multipliers };
    }
    return merged;
  }
  // Default for current mode — but always return full shape (zero-fill unused)
  const full = { ...DEFAULT_SCORING_RULES.single_phase };
  Object.keys(full).forEach(k => full[k] = 0);
  const d = DEFAULT_SCORING_RULES[wizardState.mode];
  Object.keys(d).forEach(k => full[k] = d[k]);
  // v2.5.35: always include default multipliers so consumers can read .multipliers blindly
  full.multipliers = { ...DEFAULT_MULTIPLIERS };
  return full;
}

function calcMaxPoints(rules, mode) {
  // v2.5.68: WC 2026 knockout = 16 R32 + 8 R16 + 4 QF + 2 SF + 1 Final
  // v2.5.70: each round's "correct pick" rewards the team reaching the NEXT
  // round, so R32 picks earn round_of_32 points (= reached R16), R16 picks
  // earn round_of_16 points (= reached QF), etc.
  if (mode === 'single_phase') {
    return 12 * ((rules.group_first||0) + (rules.group_second||0) + (rules.group_third||0) + (rules.group_fourth||0)) +
           8 * (rules.third_place_advance || 0) +
           16 * (rules.round_of_32 || 0) +
           8 * (rules.round_of_16 || 0) +
           4 * (rules.quarter_final || 0) +
           2 * (rules.semi_final || 0) +
           1 * (rules.final || 0) +
           (rules.top_scorer || 0);
  }
  // two_phase
  return 12 * ((rules.group_first||0) + (rules.group_second||0)) +
         16 * (rules.round_of_32 || 0) +
         8 * (rules.round_of_16 || 0) +
         4 * (rules.quarter_final || 0) +
         2 * (rules.semi_final || 0) +
         1 * (rules.final || 0) +
         (rules.top_scorer || 0);
}

// v2.5.9: renderWizardSummary removed - step 3 (Review & Create) was deleted.

function wizardNext() {
  // v2.5.9: wizard is now 2 steps. Cap at 2.
  if (wizardState.step < 2) {
    wizardState.step++;
    renderWizardStep();
  }
}

function wizardBack() {
  if (wizardState.step > 1) {
    wizardState.step--;
    renderWizardStep();
  } else {
    showScreen('admin-nickname-screen');
  }
}

async function wizardCreatePool() {
  // Validate basics
  const adminNickname = state.pendingAdminNickname;
  if (!adminNickname || !state.pendingPoolName) {
    showError('wizard-error', t('errors.missingData'));
    return;
  }
  if (!supabaseClient) {
    showError('wizard-error', t('errors.serverConnecting'));
    initSupabase();
    return;
  }

  const finalRules = getFinalScoringRules();

  try {
    showToast(t('errors.creatingPool'), 'info');

    // Generate unique pool code
    let poolCode;
    let attempts = 0;
    while (attempts < 10) {
      poolCode = generateRandomCode(CONFIG.POOL_CODE_LENGTH);
      const { data: existing } = await supabaseClient
        .from('pools').select('id').eq('code', poolCode).maybeSingle();
      if (!existing) break;
      attempts++;
    }
    if (attempts >= 10) {
      showToast(t('errors.uniqueCodeFail'), 'error');
      return;
    }

    // Generate the admin recovery code up-front (the atomic RPC needs it).
    const adminRecoveryCode = generateRecoveryCode();
    const _src = _fbGetSignupSource();
    const _country = await _fbEnsureCountry();

    let pool, adminUser;

    // Preferred: atomic server-side create_pool RPC (pool + admin in one tx,
    // is_admin set server-side, full scoring config, returns both WITHOUT the
    // hash). Falls back to the legacy multi-step insert only when the RPC isn't
    // deployed in this environment.
    const _rpcRes = await supabaseClient.rpc('create_pool', {
      p_code: poolCode,
      p_name: state.pendingPoolName,
      p_language: currentLanguage || 'he',
      p_betting_mode: wizardState.mode,
      p_scoring_rules: finalRules,
      p_use_multipliers: wizardState.useMultipliers !== false,
      p_admin_nickname: adminNickname,
      p_recovery_code: adminRecoveryCode,
      p_signup_source: _src.source,
      p_signup_referrer: _src.referrer,
      p_utm_source: _src.utm_source,
      p_utm_medium: _src.utm_medium,
      p_utm_campaign: _src.utm_campaign,
      p_country: _country
    });
    if (!_rpcRes.error && _rpcRes.data && _rpcRes.data.pool) {
      pool = _rpcRes.data.pool;
      adminUser = _rpcRes.data.user;
    } else if (_rpcRes.error && !_rpcMissing(_rpcRes.error)) {
      console.error('create_pool RPC error:', _rpcRes.error);
      showToast(t('errors.creatingPoolFail', { msg: _rpcRes.error.message }), 'error');
      return;
    } else {
      // RPC absent -> legacy multi-step create with missing-column fallbacks.
      const fullInsert = {
        code: poolCode,
        name: state.pendingPoolName,
        language: currentLanguage || 'he',
        tournament: 'wc2026',
        status: 'open',
        betting_mode: wizardState.mode,
        scoring_rules: finalRules,
        // v2.5.47: persist the master multiplier on/off the admin picked
        use_multipliers: wizardState.useMultipliers !== false
      };
      let poolError;
      ({ data: pool, error: poolError } = await supabaseClient
        .from('pools').insert(fullInsert).select().single());
      if (poolError && _fbIsMissingColumnError(poolError)) {
        // Migration not applied yet - insert legacy shape
        console.warn('v2 columns missing on pools - falling back to legacy insert');
        ({ data: pool, error: poolError } = await supabaseClient
          .from('pools').insert({
            code: poolCode,
            name: state.pendingPoolName,
            language: currentLanguage || 'he',
            tournament: 'wc2026',
            status: 'open'
          }).select().single());
      }
      if (poolError) {
        console.error('Pool creation error:', poolError);
        showToast(t('errors.creatingPoolFail', { msg: poolError.message }), 'error');
        return;
      }
      const adminRecoveryHash = await hashRecoveryCode(adminRecoveryCode);
      const _adminInsert = {
        pool_id: pool.id,
        nickname: adminNickname,
        recovery_code_hash: adminRecoveryHash,
        is_admin: true,
        is_approved: true,
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        signup_source: _src.source,
        signup_referrer: _src.referrer,
        utm_source: _src.utm_source,
        utm_medium: _src.utm_medium,
        utm_campaign: _src.utm_campaign,
        country: _country
      };
      let userError;
      ({ data: adminUser, error: userError } = await supabaseClient
        .from('users').insert(_adminInsert).select().single());
      if (userError && _fbIsMissingColumnError(userError)) {
        console.warn('signup_source columns missing on users - falling back');
        delete _adminInsert.signup_source; delete _adminInsert.signup_referrer;
        delete _adminInsert.utm_source; delete _adminInsert.utm_medium; delete _adminInsert.utm_campaign;
        delete _adminInsert.country;
        ({ data: adminUser, error: userError } = await supabaseClient
          .from('users').insert(_adminInsert).select().single());
      }
      if (userError) {
        console.error('Admin user creation error:', userError);
        showToast(t('errors.creatingAdminFail', { msg: userError.message }), 'error');
        await supabaseClient.from('pools').delete().eq('id', pool.id);
        return;
      }
      await supabaseClient.from('pools')
        .update({ admin_user_id: adminUser.id }).eq('id', pool.id);
    }

    state.currentPool = pool;
    state.currentUser = adminUser;
    state.pendingRecoveryCode = adminRecoveryCode;
    saveLocalUser(adminUser);

    // v2.4.2: removed "Pool created!" toast - the recovery code screen
    // already announces it in its hero title.
    // v2.1: persist code so the menu view can find it later
    localStorage.setItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE, adminRecoveryCode);
    // v2.1.3: show recovery code screen, then go straight to dashboard
    //         (the old share-pool-screen was removed - users share from dashboard).
    if (typeof showRecoveryCode === 'function') {
      showRecoveryCode('created', adminRecoveryCode, pool.name);
    } else {
      goToDashboard();
    }
  } catch (err) {
    console.error('Create pool error:', err);
    showToast(t('errors.unexpected'), 'error');
  }
}

// ============================================================
// PHASE 2: SINGLE-PHASE BETTING FLOW
// ============================================================

const spState = {
  currentGroupIdx: 0,
  // groupPositions: { A: ['BRA','MOR','SCO','HAI'], ... }  index 0=1st, etc.
  groupPositions: {},
  // bracketPicks: { [bracket_position]: 'TEAM_CODE' }
  bracketPicks: {},
  // v2.5.79: group letters whose predicted 3rd-place team advances (pick 8)
  thirdPlaceAdvancers: [],
  tournamentWinner: null,
  topScorerLoaded: false
};

function spIsLocked() {
  // The only hard gate on edits: pool.locked_at is set once the
  // first World Cup match starts (auto-locked by spAutoLockPoolIfNeeded).
  return isPoolWriteLocked();
}

// v2.10: 72h knockout recovery. spReopenActive (declared near the top, above
// showScreen) routes the walkthrough's saves to save_knockout_bracket_reopen and
// bypasses the lock gate. Set ONLY by spReopenKnockout() for an approved user.

// Fetch the caller's recovery-grant status (cached on state). Fire-and-forget safe.
async function _spFetchReopenStatus() {
  try {
    const code = _currentRecoveryCode();
    if (!code || !supabaseClient) { _spReopenStatus = null; return null; }
    const { data, error } = await supabaseClient.rpc('my_knockout_reopen', { p_code: code });
    _spReopenStatus = error ? null : data;
    return _spReopenStatus;
  } catch (_) { _spReopenStatus = null; return null; }
}

// v2.3: informational only - true once the user has "saved" their full
// set of picks at least once. Does NOT block further edits; the user
// can keep editing until the pool itself locks. Used by the dashboard
// to switch the CTA copy to "View / edit your predictions".
function spHasUserSubmitted() {
  return !!(state.currentUser && state.currentUser.predictions_submitted_at);
}
// Back-compat shim
function spIsUserSubmitted() { return false; }

function spTopScorerRequired() {
  if (state.currentPool && state.currentPool.top_scorer_enabled === false) return false;
  try { return localStorage.getItem('fb_squads_released') === 'true'; } catch (_) { return false; }
}

function spBracketComplete() {
  const bp = spState.bracketPicks || {};
  for (let p = 1; p <= 31; p++) if (!bp[p]) return false;
  return true;
}

function spCompletionState(hasTopScorerPick = false) {
  const incompleteGroups = WC2026_GROUP_LETTERS.filter(l =>
    !spState.groupPositions[l] || !spState.groupPositions[l].every(x => x)
  );
  const bracketComplete = spBracketComplete();
  const missingWinner = !(spState.tournamentWinner || (spState.bracketPicks && spState.bracketPicks[31]));
  const missingTopScorer = spTopScorerRequired() && !hasTopScorerPick;
  const allComplete = incompleteGroups.length === 0 && bracketComplete && !missingWinner && !missingTopScorer;
  return { incompleteGroups, bracketComplete, missingWinner, missingTopScorer, allComplete };
}

async function spMarkPredictionsSubmitted(reason = 'complete') {
  if (!state.currentUser || !supabaseClient) return false;
  if (state.currentUser.predictions_submitted_at) return true;

  const submittedAt = new Date().toISOString();
  const code = _currentRecoveryCode();
  if (code) {
    const res = await _rpcWrite('mark_predictions_submitted', { p_code: code });
    if (res.ok) {
      state.currentUser.predictions_submitted_at = submittedAt;
      return true;
    }
    if (!res.missing) {
      console.warn(`[spMarkPredictionsSubmitted] ${reason} RPC warning:`, res.error);
      return false;
    }
  }

  const { error } = await supabaseClient.from('users')
    .update({ predictions_submitted_at: submittedAt })
    .eq('id', state.currentUser.id);
  if (error && !/column .* does not exist/i.test(error.message || '')) {
    console.warn(`[spMarkPredictionsSubmitted] ${reason} update warning:`, error);
    return false;
  }
  state.currentUser.predictions_submitted_at = submittedAt;
  return true;
}

async function startSinglePhaseBetting() {
  // Entry point from dashboard
  if (!state.currentPool || !state.currentUser) {
    showToast(t('errors.reconnect'), 'error');
    return;
  }
  // Pool locked = read-only summary. Only pool.locked_at gates edits.
  if (spIsLocked()) {
    await spShowLockedView();
    return;
  }
  await spLoadExistingPicks();
  // v2.6.3: route to the FIRST incomplete stage so where we land matches the
  // dashboard CTA's promise (groups → bracket → summary). Submitted or fully
  // complete users land on the summary to review + edit.
  const groupsComplete = WC2026_GROUP_LETTERS.every(l => {
    const arr = spState.groupPositions[l];
    return arr && arr.length >= 4 && arr.slice(0, 4).every(x => x);
  });
  // v2.9.3: route on BRACKET completeness, not just "has a champion". Affected
  // users have a saved champion but an empty bracket; treating champion as
  // "knockout done" used to skip the bracket entirely. A full bracket = all 31
  // positions picked (1-16 R32, 17-24 R16, 25-28 QF, 29-30 SF, 31 Final).
  const bracketComplete = (() => {
    const bp = spState.bracketPicks || {};
    for (let p = 1; p <= 31; p++) if (!bp[p]) return false;
    return true;
  })();
  const championDone = bracketComplete;

  // v2.6.10: top-scorer completion (gated on squad release, like the dashboard CTA).
  let tsRequired = false;
  try { tsRequired = localStorage.getItem('fb_squads_released') === 'true'; } catch (e) {}
  let tsChosen = false;
  if (tsRequired) {
    try {
      const { data: tsp } = await supabaseClient.from('top_scorer_picks')
        .select('id').eq('user_id', state.currentUser.id).eq('pool_id', state.currentPool.id);
      tsChosen = (tsp || []).length >= 1;
    } catch (e) {}
  }

  // Route to the FIRST incomplete stage so the dashboard CTA's promise matches.
  if (!groupsComplete) {
    spState.currentGroupIdx = 0;
    spRenderGroups();
    showScreen('sp-groups-screen');
    return;
  }
  if (!championDone) {
    // Knockout is picked in the single-match walkthrough (two teams at a time),
    // not the full grid. Third-place advancers must be chosen first to build R32.
    if ((spState.thirdPlaceAdvancers || []).length !== 8) {
      spStartThirdPlaceStep();
      return;
    }
    koSingle.mode = 'single-phase';
    koSingle.sequence = _koSinglePhaseSequence();
    const firstIncomplete = koSingle.sequence.findIndex(
      s => !(spState.bracketPicks && spState.bracketPicks[s.pos]));
    koSingle.idx = firstIncomplete >= 0 ? firstIncomplete : 0;
    state.spInFlow = true;
    koSingleRender();
    showScreen('ko-single-screen');
    return;
  }
  if (tsRequired && !tsChosen) {
    // Only the top scorer is left → the in-flow top-scorer step (which shows
    // the Continue→summary button), NOT the summary.
    spStartTopScorerStep();
    return;
  }
  // Everything complete (or already submitted) → the summary review.
  await spShowSummary();
}

// v2.9.2: dedicated entry for the "recover bracket" banner. Affected users HAVE
// a champion (tournamentWinner set) but no knockout bracket, so the normal entry
// (which treats a set champion as "knockout done") would skip the bracket. This
// routes straight into the knockout walkthrough, built from their already-saved
// group positions + 8 third-place advancers, landing on the first empty match.
async function spReenterKnockout() {
  if (!state.currentPool || !state.currentUser) { showToast(t('errors.reconnect'), 'error'); return; }
  if (spIsLocked()) { await spShowLockedView(); return; }
  await spLoadExistingPicks();
  // Groups must be complete to build the R32 matchups; if not, finish groups first.
  const groupsComplete = WC2026_GROUP_LETTERS.every(l => {
    const arr = spState.groupPositions[l];
    return arr && arr.length >= 4 && arr.slice(0, 4).every(x => x);
  });
  if (!groupsComplete) { spState.currentGroupIdx = 0; spRenderGroups(); showScreen('sp-groups-screen'); return; }
  // Need the 8 third-place advancers to seed the bracket; otherwise pick them first.
  if ((spState.thirdPlaceAdvancers || []).length !== 8) { spStartThirdPlaceStep(); return; }
  koSingle.sequence = _koSinglePhaseSequence();

  // v2.9.11: if spLoadExistingPicks' auto-heal already RESTORED a complete bracket
  // from a local/server backup, do NOT push the user through the re-entry
  // walkthrough — every match would show its pick pre-selected (green), which is
  // baffling right after the dashboard told them their bracket "wasn't saved".
  // Persist the recovered bracket to the DB now (the heal's re-save is async/
  // best-effort and the DB read behind the banner was stale) and send them to the
  // summary to review their recovered picks instead.
  const bracketComplete = koSingle.sequence.every(s => spState.bracketPicks && spState.bracketPicks[s.pos]);
  if (bracketComplete) {
    if (!spState.tournamentWinner && spState.bracketPicks[31]) {
      spState.tournamentWinner = spState.bracketPicks[31];
      spSaveWinnerToDb(false);
    }
    // v2.9.12: CONFIRM the recovered bracket actually persisted before telling the
    // user it's recovered. If the DB read-back is short (e.g. server briefly
    // unreachable), be honest and keep them on the dashboard so the apology banner
    // (driven by the real DB count) stays up — never a false "recovered".
    let ok = false;
    try { ok = await spSaveBracketVerified(koSingle.sequence.length); } catch (_) {}
    state.spInFlow = false;
    if (!ok) { showToast(t('bracketSave.retryLater'), 'error'); goToDashboard(); return; }
    showToast(t('recoverBracket.recovered'), 'success');
    await spShowSummary();
    return;
  }

  koSingle.mode = 'single-phase';
  const firstIncomplete = koSingle.sequence.findIndex(s => !(spState.bracketPicks && spState.bracketPicks[s.pos]));
  koSingle.idx = firstIncomplete >= 0 ? firstIncomplete : 0;
  state.spInFlow = true;
  koSingleRender();
  showScreen('ko-single-screen');
}
window.spReenterKnockout = spReenterKnockout;

async function spLoadExistingPicks() {
  // v2.2.1 fix: load into TEMPS first; only overwrite spState if we
  // actually got data back. The previous version wiped spState BEFORE
  // any await, so any failed or empty query would erase the picks the
  // user just made in this session (the "summary shows nothing" bug).
  // v2.5.7 fix: ALWAYS filter by pool_id. Without it, users in multiple
  // pools would mix picks across pools, and View Predictions in one pool
  // could load picks for a different pool (or none at all).
  // v2.5.19: but if currentPool is missing for some reason (early init
  // race), still load by user_id alone - empty data is worse than mixed.
  if (!state.currentUser) {
    console.warn('[spLoadExistingPicks] no currentUser - aborting');
    return;
  }
  const userId = state.currentUser.id;
  const poolId = state.currentPool ? state.currentPool.id : null;
  if (!poolId) {
    console.warn('[spLoadExistingPicks] no currentPool.id - will load by user_id only');
  }

  const newGroups = {};
  const newBracket = {};
  let newWinner = null;
  let newThirdPlace = null;
  let anyDataLoaded = false;
  let anyError = false;

  console.log('[spLoadExistingPicks] start | user=' + userId + ' | pool=' + poolId);

  // v2.5.15: load with pool_id filter. If it returns zero rows for a table,
  // retry the same query WITHOUT pool_id - this rescues legacy picks saved
  // before pool_id-aware DELETEs (where existing rows may have a stale or
  // mismatched pool_id) and bare picks that pre-date the migration.
  const loadOrFallback = async (table, baseFilter) => {
    let q = supabaseClient.from(table).select('*').eq('user_id', userId);
    if (poolId) q = q.eq('pool_id', poolId);
    if (baseFilter) q = baseFilter(q);
    let { data, error } = await q;
    // v2.9.12: retry a transient read error once — a single flaky read of
    // knockout_picks must not be allowed to blank a saved bracket on screen.
    if (error) {
      await new Promise(r => setTimeout(r, 500));
      let qr = supabaseClient.from(table).select('*').eq('user_id', userId);
      if (poolId) qr = qr.eq('pool_id', poolId);
      if (baseFilter) qr = baseFilter(qr);
      const retry = await qr;
      data = retry.data; error = retry.error;
    }
    if (error) return { data: null, error };
    if (poolId && data && data.length === 0) {
      // Fallback: same query without pool_id, in case the rows pre-date pool_id
      let q2 = supabaseClient.from(table).select('*').eq('user_id', userId);
      if (baseFilter) q2 = baseFilter(q2);
      const r2 = await q2;
      if (!r2.error && r2.data && r2.data.length > 0) {
        console.warn(`spLoadExistingPicks: ${table} matched ${r2.data.length} legacy rows without pool_id filter`);
        data = r2.data;
      }
    }
    return { data, error: null };
  };

  try {
    const { data: gpp, error: gppErr } = await loadOrFallback('group_position_picks');
    if (gppErr) { console.warn('load group_position_picks err:', gppErr); anyError = true; }
    else if (gpp) {
      gpp.forEach(p => {
        if (!newGroups[p.group_letter]) newGroups[p.group_letter] = [null, null, null, null];
        newGroups[p.group_letter][p.position - 1] = p.team_code;
        anyDataLoaded = true;
      });
    }

    const { data: kp, error: kpErr } = await loadOrFallback('knockout_picks', q => q.not('bracket_position', 'is', null));
    if (kpErr) { console.warn('load knockout_picks err:', kpErr); anyError = true; }
    else (kp || []).forEach(p => {
      // v2.5.22: legacy table uses predicted_winner, not team_code.
      newBracket[p.bracket_position] = p.predicted_winner || p.team_code;
      anyDataLoaded = true;
    });

    const { data: twpArr, error: twpErr } = await loadOrFallback('tournament_winner_picks');
    if (twpErr) { console.warn('load tournament_winner_picks err:', twpErr); anyError = true; }
    else if (twpArr && twpArr.length > 0) { newWinner = twpArr[0].team_code; anyDataLoaded = true; }

    // v2.5.79: chosen 8 third-place advancers (group letters). Table may not
    // exist yet (migration not run) → treated as no-data, seeded on render.
    const { data: tpArr, error: tpErr } = await loadOrFallback('sp_third_place_picks');
    if (tpErr) { console.warn('load sp_third_place_picks err:', tpErr); }
    else if (tpArr && tpArr.length > 0) { newThirdPlace = tpArr.map(r => r.group_letter); anyDataLoaded = true; }

    console.log('[spLoadExistingPicks] result | groups=' + Object.keys(newGroups).length +
      ' bracket=' + Object.keys(newBracket).length +
      ' winner=' + (newWinner || 'none') +
      ' anyDataLoaded=' + anyDataLoaded + ' anyError=' + anyError);

    // Commit policy:
    //   - if we got any data, trust DB
    //   - if no data + no errors, also trust DB (user has no picks yet)
    //   - if errors + no data, keep current in-memory state (don't wipe)
    if (anyDataLoaded || !anyError) {
      // v2.9.12: PER-TABLE commit guard. Only overwrite a slice of spState when
      // THAT table's read actually succeeded. Previously a single transient
      // knockout_picks read error (with groups loading fine) committed an EMPTY
      // bracket over a saved one — the bracket would render as "Not picked" even
      // though 31 rows exist in the DB. Now a flaky read keeps the last-known
      // picks on screen instead of blanking them; auto-heal still fills a
      // genuinely-incomplete bracket from backup below.
      if (!gppErr) spState.groupPositions = newGroups;
      if (!kpErr)  spState.bracketPicks = newBracket;
      if (!twpErr) spState.tournamentWinner = newWinner;
      if (!tpErr)  spState.thirdPlaceAdvancers = newThirdPlace || [];

      // v2.9.17: the champion IS bracket position 31. tournament_winner_picks is
      // saved on a SEPARATE fire-and-forget path, so if that row hasn't landed
      // yet, derive the champion from the already-loaded (and flushed) bracket —
      // otherwise the summary's champion row shows "Not picked" while the final
      // pick exists. Scoring already reads bracket position 31, so this is
      // display/state consistency only (no scoring/bonus change).
      if (!spState.tournamentWinner && spState.bracketPicks && spState.bracketPicks[31]) {
        spState.tournamentWinner = spState.bracketPicks[31];
        // v2.9.17: also re-persist so tournament_winner_picks (read by the
        // share/OG card) isn't left empty if its original fire-and-forget save
        // didn't land. Self-heals once; no-op when the pool is locked (RPC guard).
        try { spSaveWinnerToDb(false); } catch (_) {}
      }

      // AUTO-HEAL: if the live bracket is missing/incomplete, restore from the
      // most-complete backup we can find — first this browser's localStorage
      // (v2.9.2), then the durable server-side backup (v2.9.5, covers a new
      // device or a server-side wipe) — then re-save to the live tables. No user
      // action; recovers the silent-save-failure class and accidental deletions.
      const _applyHeal = (snap, src) => {
        const dbCount = Object.keys(spState.bracketPicks || {}).length;
        const snapCount = snap && snap.bracketPicks ? Object.keys(snap.bracketPicks).length : 0;
        if (!snap || snapCount <= dbCount) return false;
        if (Object.keys(snap.groupPositions || {}).length) spState.groupPositions = snap.groupPositions;
        if ((snap.thirdPlaceAdvancers || []).length) spState.thirdPlaceAdvancers = snap.thirdPlaceAdvancers;
        spState.bracketPicks = snap.bracketPicks;
        spState.tournamentWinner = snap.tournamentWinner || spState.tournamentWinner;
        console.warn('[spLoadExistingPicks] AUTO-HEAL from ' + src + ': live=' + dbCount + ' < backup=' + snapCount + ' — restoring + re-saving');
        setTimeout(() => {
          try {
            if ((spState.thirdPlaceAdvancers || []).length === 8) spSaveThirdPlaceToDb();
            spSaveBracketToDb(false);
          } catch (_) {}
        }, 900);
        return true;
      };
      try {
        let healed = _applyHeal(_spCacheLoad(), 'localStorage');
        // If localStorage didn't help (e.g. a different device) and the live
        // bracket is still incomplete, fall back to the durable server backup.
        if (!healed && Object.keys(spState.bracketPicks || {}).length < 31) {
          const code = _currentRecoveryCode();
          if (code && supabaseClient) {
            try {
              const { data: snap } = await supabaseClient.rpc('get_pick_backup', { p_code: code });
              if (snap) _applyHeal(typeof snap === 'string' ? JSON.parse(snap) : snap, 'server-backup');
            } catch (_) {}
          }
        }
      } catch (_) {}
    } else {
      console.warn('spLoadExistingPicks: DB errors and no data — keeping in-memory state');
    }
  } catch (err) {
    console.warn('Failed to load existing SP picks:', err);
  }
}

// v2.2.0: Pre-populate a group's positions with FIFA-ranked order
//         (best rank = position 1). Only fills if the group is empty.
function spEnsureGroupPrefilled(letter) {
  const arr = spState.groupPositions[letter];
  const hasAny = arr && arr.some(x => x);
  if (hasAny) return false;
  const teams = WC2026_GROUPS[letter].slice();
  teams.sort((a, b) => fifaRankOf(a) - fifaRankOf(b));
  spState.groupPositions[letter] = teams;
  return true;
}

function spRenderGroups() {
  const letter = WC2026_GROUP_LETTERS[spState.currentGroupIdx];
  document.getElementById('sp-current-group-letter').textContent = letter;
  document.getElementById('sp-groups-step').textContent =
    t('betting.groupStep', { n: spState.currentGroupIdx + 1, total: 12 });

  // v2.4.6: populate dynamic points-per-position hint from scoring_rules
  // v2.5.76: hide the per-position pills entirely when every position is
  // worth the same (the default: each correct pick = 1 pt). The bubbles
  // only convey information when positions are scored differently (a custom
  // pool), so for the default they were just noise.
  const ptsHint = document.getElementById('sp-points-hint');
  if (ptsHint) {
    const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
    const pts = {
      1: rules.group_first ?? 4,
      2: rules.group_second ?? 3,
      3: rules.group_third ?? 2,
      4: rules.group_fourth ?? 1
    };
    const present = [1, 2, 3, 4].filter(n => pts[n] > 0);
    const allEqual = present.every(n => pts[n] === pts[present[0]]);
    if (present.length === 0 || allEqual) {
      ptsHint.innerHTML = '';
      ptsHint.style.display = 'none';
    } else {
      ptsHint.style.display = '';
      ptsHint.innerHTML = present
        .map(n => `<span class="pts-pill">${t('groups.pointsForPosition', { pos: n, pts: pts[n] })}</span>`)
        .join('');
    }
  }

  // v2.5.58: hide the "Risk multipliers kick in from knockout" hint when
  // the pool has multipliers turned off entirely - the note would be
  // talking about a feature that simply isn't in use here.
  const multNote = document.getElementById('sp-mult-note');
  if (multNote) {
    const off = state.currentPool && state.currentPool.use_multipliers === false;
    multNote.style.display = off ? 'none' : '';
  }

  // v2.2: pre-populate from FIFA ranking if not yet picked
  const prefilled = spEnsureGroupPrefilled(letter);

  // Progress: how many groups have all 4 slots filled
  const completed = WC2026_GROUP_LETTERS.filter(l =>
    spState.groupPositions[l] && spState.groupPositions[l].every(x => x)
  ).length;
  document.getElementById('sp-groups-progress').style.width = `${(completed / 12) * 100}%`;

  const positions = spState.groupPositions[letter];

  // Render position slots (always filled, draggable)
  // v2.5.67: each slot includes a hidden green check pip. When the user
  // clicks Next, spGroupsNext flips on the .confirmed class with a small
  // stagger so all four slots animate-in their checkmarks before the
  // group advances. Pure visual feedback — no functional change.
  const slotsEl = document.getElementById('sp-positions-list');
  slotsEl.innerHTML = positions.map((teamCode, i) => `
    <div class="sp-position-slot filled sp-draggable" data-pos="${i}">
      <div class="pos-drag-handle" aria-label="drag"><i class="ti ti-grip-vertical"></i></div>
      <div class="pos-rank">${i + 1}</div>
      <div class="pos-flag">${getCountryFlag(teamCode)}</div>
      <div class="pos-name">${teamCode ? getTeamName(teamCode) : ''}</div>
      <div class="pos-check" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    </div>
  `).join('');

  // Wire drag handlers
  slotsEl.querySelectorAll('.sp-position-slot').forEach((slot, idx) => {
    slot.addEventListener('pointerdown', e => spSlotPointerDown(e, idx));
  });

  // v2.6.11: groups persist ONLY when the user taps Next (see _spGroupsAdvance).
  // We no longer auto-save the pre-fill or drags — so an unconfirmed order isn't
  // written to the DB and won't show in the summary until the group is committed.

  // Prev/Next state
  const prev = document.getElementById('sp-groups-prev');
  const next = document.getElementById('sp-groups-next');
  if (prev) prev.disabled = (spState.currentGroupIdx === 0);
  if (next) {
    const isLast = spState.currentGroupIdx === 11;
    next.querySelector('span').textContent = isLast ? t('betting.continueToBracket') : t('groups.saveAndNext');
  }
}

// ----- Drag-to-reorder slots (pointer events: works on touch + mouse) -----
const _spDrag = {
  active: false, el: null, fromIdx: 0, toIdx: 0,
  startY: 0, slotPitch: 0, pointerId: null
};

function spSlotPointerDown(ev, idx) {
  if (spIsLocked()) return;
  const slot = ev.currentTarget;
  // Only respond to primary button / touch
  if (ev.button !== undefined && ev.button !== 0) return;
  ev.preventDefault();
  try { slot.setPointerCapture(ev.pointerId); } catch (e) {}
  _spDrag.active = true;
  _spDrag.el = slot;
  _spDrag.fromIdx = idx;
  _spDrag.toIdx = idx;
  _spDrag.startY = ev.clientY;
  // 10px gap between slots (matches .sp-positions-list gap)
  _spDrag.slotPitch = slot.offsetHeight + 10;
  _spDrag.pointerId = ev.pointerId;
  slot.classList.add('dragging');

  slot.addEventListener('pointermove', spSlotPointerMove);
  slot.addEventListener('pointerup', spSlotPointerUp);
  slot.addEventListener('pointercancel', spSlotPointerUp);
}

function spSlotPointerMove(ev) {
  if (!_spDrag.active || ev.pointerId !== _spDrag.pointerId) return;
  const dy = ev.clientY - _spDrag.startY;
  _spDrag.el.style.transform = `translateY(${dy}px)`;
  const offsetSlots = Math.round(dy / _spDrag.slotPitch);
  const newIdx = Math.max(0, Math.min(3, _spDrag.fromIdx + offsetSlots));
  if (newIdx !== _spDrag.toIdx) {
    _spDrag.toIdx = newIdx;
    // Visually shift the other slots to show the gap
    const all = document.querySelectorAll('#sp-positions-list .sp-position-slot');
    all.forEach((s, i) => {
      if (i === _spDrag.fromIdx) return;
      let shift = 0;
      if (_spDrag.fromIdx < newIdx && i > _spDrag.fromIdx && i <= newIdx) shift = -_spDrag.slotPitch;
      else if (_spDrag.fromIdx > newIdx && i < _spDrag.fromIdx && i >= newIdx) shift = _spDrag.slotPitch;
      s.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }
}

function spSlotPointerUp(ev) {
  if (!_spDrag.active || ev.pointerId !== _spDrag.pointerId) return;
  const { fromIdx, toIdx, el } = _spDrag;
  // Reset visual transforms
  document.querySelectorAll('#sp-positions-list .sp-position-slot').forEach(s => {
    s.style.transform = '';
  });
  el.classList.remove('dragging');
  _spDrag.active = false;
  _spDrag.el = null;

  if (fromIdx !== toIdx) {
    const letter = WC2026_GROUP_LETTERS[spState.currentGroupIdx];
    const arr = spState.groupPositions[letter];
    const item = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, item);
    spRenderGroups();
    // v2.6.11: no auto-save on drag — the order is committed only on Next.
  }
}

// Legacy no-ops (kept in case any old code path calls them)
function spAssignTeam(_teamCode) { /* deprecated in v2.2 */ }
function spRemoveFromSlot(_idx) { /* deprecated in v2.2 */
  const letter = WC2026_GROUP_LETTERS[spState.currentGroupIdx];
  const positions = spState.groupPositions[letter] || [null,null,null,null];
  positions[_idx] = null;
  spState.groupPositions[letter] = positions;
  spRenderGroups();
}

let _spSaveTimer = null;
function spAutoSaveGroups() {
  _spCacheSave(); // v2.9.7: back up every group change too (localStorage + durable server backup)
  if (_spSaveTimer) clearTimeout(_spSaveTimer);
  _spSaveTimer = setTimeout(() => { spSaveGroupsToDb(false); }, 600);
}

// v2.5.22: serialize saves to prevent the DELETE+INSERT race that caused
// duplicate-key violations. Two autosaves firing close together used to
// interleave their DELETEs and INSERTs, with the second INSERT colliding
// on the unique (pool_id, user_id, group_letter, position) constraint.
let _spGroupsSaveChain = Promise.resolve();
async function spSaveGroupsToDb(showFeedback = true) {
  const prev = _spGroupsSaveChain;
  let resolveDone;
  _spGroupsSaveChain = new Promise(r => { resolveDone = r; });
  await prev;
  try {
    return await _spSaveGroupsToDbInner(showFeedback);
  } finally {
    resolveDone();
  }
}

// Returns a result object so callers can await and react: { ok: true } on a
// confirmed save (or a safe skip), { ok: false, reason, error } on a real
// failure. v2.9.15: previously returned undefined everywhere, so the group
// flow advanced screens without knowing whether the write landed (the race
// behind the "I picked teams but the summary shows Not Picked" reports).
async function _spSaveGroupsToDbInner(showFeedback = true) {
  if (!state.currentPool || !state.currentUser) return { ok: false, reason: 'no-session' };
  if (spIsLocked()) return { ok: true, skipped: 'locked' };

  const userId = state.currentUser.id;
  const poolId = state.currentPool.id;

  // Build rows from in-memory state
  const rows = [];
  Object.entries(spState.groupPositions).forEach(([letter, positions]) => {
    positions.forEach((teamCode, i) => {
      if (teamCode) {
        rows.push({
          pool_id: poolId,
          user_id: userId,
          group_letter: letter,
          position: i + 1,
          team_code: teamCode
        });
      }
    });
  });

  // v2.4.6: SAFETY GUARD - if in-memory state is completely empty, do
  // NOT delete from DB. A truly-empty state during a save call means we
  // were called with stale/reset state (e.g., a debounced auto-save firing
  // after spLoadExistingPicks returned empty data). Real "clear all" never
  // happens in this flow - the lowest valid state has at least 1 team
  // picked. Without this guard we were wiping good DB data on edge cases.
  if (rows.length === 0) {
    console.warn('spSaveGroupsToDb: in-memory state is empty - skipping DB write to avoid wiping real picks');
    return { ok: true, skipped: 'empty' };
  }

  // v2.9.16: mirror the latest in-memory state to local (+ debounced server)
  // backup BEFORE attempting the DB write. Group drag-reorders aren't cached
  // until this point (the drag handler intentionally doesn't auto-save), so
  // without this a failed save could lose the latest order on refresh and the
  // "your picks are backed up" retry toast would be untrue. Now the backup is
  // written first, so auto-heal can always recover and the message is honest.
  _spCacheSave();

  // Preferred: server-side RPC (validates the code, replaces only the caller's
  // own rows, blocks when the pool is locked). Falls back to the legacy direct
  // DELETE+INSERT only when the RPC isn't deployed in this environment.
  const code = _currentRecoveryCode();
  if (code) {
    // v2.9.12: retry transient PGRST202 (schema-cache reload) before giving up —
    // the legacy direct write below is REVOKEd for anon and only 401s.
    const res = await _rpcWrite('save_group_position_picks', { p_code: code, p_picks: rows });
    if (res.ok) {
      if (showFeedback) showToast(t('groups.picksSaved'), 'success');
      return { ok: true };
    }
    if (!res.missing) {
      console.error('[spSaveGroupsToDb] RPC error:', res.error);
      showToast(t('bracketSave.retryLater'), 'error');
      return { ok: false, reason: 'rpc', error: res.error };
    }
    // RPC still unreachable after retries -> fall through to the legacy direct write below.
  }

  try {
    // v2.5.7: scope DELETE to this pool too - otherwise saving in pool B
    // wipes the user's picks from pool A.
    const { error: delErr } = await supabaseClient.from('group_position_picks')
      .delete().eq('user_id', userId).eq('pool_id', poolId);
    if (delErr) {
      // Intermediate step — don't toast here; the INSERT result below decides
      // the user-facing outcome (avoids a scary mid-save error message).
      console.error('[spSaveGroupsToDb] DELETE error:', delErr);
    }
    const { error } = await supabaseClient.from('group_position_picks').insert(rows);
    if (error) {
      // v2.5.20: surface save errors loudly. Silent warns were hiding RLS /
      // migration problems - users would pick teams, see them in the UI,
      // then find Not Picked on the summary screen with no clue why.
      console.error('[spSaveGroupsToDb] INSERT error:', error);
      // v2.5.21: special handling for the FK-on-teams violation. The teams
      // table doesn't have all 48 WC2026 codes (the API-driven sync omits
      // playoff qualifiers). The fix is the seed-wc2026-teams.sql migration.
      const msg = (error.message || '') + ' ' + (error.details || '');
      if (/team_code_fkey/.test(msg) || /not present in table.*teams/.test(msg)) {
        showToast('Missing team codes in DB. Run migrations/2026-05-18-seed-wc2026-teams.sql in Supabase.', 'error');
      } else {
        showToast(t('bracketSave.retryLater'), 'error');
      }
      return { ok: false, reason: 'insert', error };
    }
    if (showFeedback) showToast(t('groups.picksSaved'), 'success');
    return { ok: true };
  } catch (err) {
    console.error('[spSaveGroupsToDb] caught:', err);
    showToast(t('bracketSave.retryLater'), 'error');
    return { ok: false, reason: 'exception', error: err };
  }
}

function spGroupsPrev() {
  if (spState.currentGroupIdx > 0) {
    spState.currentGroupIdx--;
    spRenderGroups();
  }
}

// v2.5.67: real advance logic split out so spGroupsNext can play a brief
// confirmation animation on the slot rows first.
async function _spGroupsAdvance() {
  // v2.9.15: AWAIT the save before moving on, so a fast Next tap can't outrun
  // the DB write (the race behind the "summary shows Not Picked" reports).
  // Disable Next/Skip while the save is in flight; on failure stay on this
  // screen with the user's picks intact (the save already showed a friendly
  // retry toast) instead of advancing past an unsaved group.
  const nextBtn = document.getElementById('sp-groups-next');
  const skipBtn = document.getElementById('sp-groups-skip');
  if (nextBtn) nextBtn.disabled = true;
  if (skipBtn) skipBtn.disabled = true;
  try {
    // v2.6.11: this is the single commit point for the groups stage (the
    // duplicate last-group save was removed in v2.9.15 — one awaited save).
    const res = await spSaveGroupsToDb(false);
    if (res && res.ok === false) return; // save failed → don't advance

    if (spState.currentGroupIdx < 11) {
      spState.currentGroupIdx++;
      spRenderGroups();
      return;
    }
    // Last group → bracket transition is permissive (v2.5.62). Users can
    // advance even if some groups aren't complete — the bracket will show
    // TBD slots for missing positions and the summary screen will surface
    // "Not picked" lines for anything skipped. A soft info toast tells the
    // user what they still owe without blocking them.
    const incomplete = WC2026_GROUP_LETTERS.filter(l =>
      !spState.groupPositions[l] || !spState.groupPositions[l].every(x => x)
    );
    if (incomplete.length > 0) {
      showToast(t('betting.groupsIncompleteHint', { letters: incomplete.join(', ') }), 'info');
    }
    // v2.5.81: route through the third-place selection step before the knockout.
    spStartThirdPlaceStep();
  } finally {
    if (nextBtn) nextBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;
  }
}

function spGroupsNext() {
  // v2.5.67: play a quick confirmation animation on the slot rows when the
  // user advances. Only when the current group has all 4 positions filled
  // (otherwise nothing to confirm visually — just advance).
  const letter = WC2026_GROUP_LETTERS[spState.currentGroupIdx];
  const positions = spState.groupPositions[letter];
  const allFilled = positions && positions.every(x => !!x);

  if (!allFilled) {
    _spGroupsAdvance();
    return;
  }

  // Guard against double-clicks while the animation is mid-flight.
  const nextBtn = document.getElementById('sp-groups-next');
  if (nextBtn) nextBtn.disabled = true;
  const slots = document.querySelectorAll('#sp-positions-list .sp-position-slot');
  slots.forEach((s, i) => {
    setTimeout(() => s.classList.add('confirmed'), i * 70);
  });
  // Total animation time = (4-1)*70 + ~250 settle. Then advance.
  setTimeout(() => {
    if (nextBtn) nextBtn.disabled = false;
    _spGroupsAdvance();
  }, 500);
}

async function spGroupsSaveAndExit() {
  // v2.9.15: AWAIT the save before navigating (was a fixed 400ms timer that
  // raced the DB write — the dashboard could reload and show stale progress
  // before the save landed). On success the save toasts "saved"; on failure it
  // shows a friendly retry toast (picks are mirrored locally + auto-heal on
  // next load). Either way the user chose to leave, so we then go home — but
  // only AFTER the write resolves, never before.
  const exitBtn = document.querySelector('[onclick="spGroupsSaveAndExit()"]');
  if (exitBtn) exitBtn.disabled = true;
  try {
    await spSaveGroupsToDb(true);
  } finally {
    if (exitBtn) exitBtn.disabled = false;
  }
  goToDashboard();
}

// v2.5.66: "Skip for now" - clear THIS group's picks and advance. The
// FIFA pre-fill that auto-saves on first entry made it hard to truly
// defer a group ("just look at it but don't commit"). This button gives
// the user an explicit out: drop the row, move on, summary shows "Not
// picked" for that group. Pre-fill still re-suggests on revisit (so the
// skip is "for now", not permanent).
async function spGroupsSkip() {
  if (spIsLocked && spIsLocked()) {
    showToast(t('betting.locked'), 'error');
    return;
  }
  const letter = WC2026_GROUP_LETTERS[spState.currentGroupIdx];
  // Clear in-memory positions so the user sees an immediate "blank" state
  // if they navigate right back. spEnsureGroupPrefilled will re-suggest
  // the FIFA order on next entry — that's by design.
  spState.groupPositions[letter] = [null, null, null, null];
  // Best-effort persist: route through the wired save (RPC save_group_position_picks
  // replaces ALL of the caller's group rows with the current in-memory state, so the
  // just-cleared group's auto-saved FIFA row is dropped). A direct table DELETE here
  // would 401 after the anon-write revoke — go through spSaveGroupsToDb instead so the
  // skip is honoured server-side and the summary shows "Not picked".
  if (state.currentPool && state.currentUser && supabaseClient) {
    try {
      await spSaveGroupsToDb(false);
    } catch (e) {
      console.warn('spGroupsSkip DB save failed (non-fatal):', e);
    }
  }
  // Cancel any pending auto-save so it doesn't re-save the FIFA order
  // we just deleted.
  if (typeof _spSaveTimer !== 'undefined' && _spSaveTimer) {
    clearTimeout(_spSaveTimer);
    _spSaveTimer = null;
  }
  // Advance — last group → third-place selection step (v2.5.81).
  if (spState.currentGroupIdx < 11) {
    spState.currentGroupIdx++;
    spRenderGroups();
  } else {
    spStartThirdPlaceStep();
  }
}
window.spGroupsSkip = spGroupsSkip;

// v2.5.62: pause mid-bracket and return to dashboard. Auto-save already
// runs on each pick (spAutoSaveBracket), so this is mostly a polite
// confirmation that the picks are stored.
function spBracketSaveAndExit() {
  if (typeof spSaveBracketToDb === 'function') {
    spSaveBracketToDb(true);
  }
  setTimeout(() => goToDashboard(), 400);
}
window.spBracketSaveAndExit = spBracketSaveAndExit;

function spExit() {
  goToDashboard();
}

function spBackToGroups() {
  spState.currentGroupIdx = 11;
  spRenderGroups();
  showScreen('sp-groups-screen');
}

// ----- Hypothetical bracket (Official WC 2026 R32 → Final format) -----
//
// The 2026 World Cup expanded the knockout stage to 32 teams: the top 2
// from each of the 12 groups (24 teams) plus the 8 best third-placed
// teams (chosen across 12 groups by FIFA's tie-breaker criteria). The
// bracket published in FIFA's official Competition Regulations defines:
//
//   R32 (positions 1-16)   = 16 matches (M73..M88)
//   R16 (positions 17-24)  = 8  matches (M89..M96)
//   QF  (positions 25-28)  = 4  matches (M97..M100)
//   SF  (positions 29-30)  = 2  matches (M101..M102)
//   Final (position 31)    = 1  match  (M104)
//
// SP_R32_DEF: for each R32 position, defines the two "feeds" that fill
// the slot. A feed is one of:
//   { type: 'gp',    g: 'A', p: 1 }  group position (p=1 winner, 2 runner-up)
//   { type: 'third', allowed: [...] }  best 3rd-place team from this group set
//
// Slots accepting a 3rd-placed team carry the FIFA-defined "allowed groups"
// set (each slot is restricted to 5 of the 12 groups). At runtime we
// auto-assign 8 of the user's 12 predicted 3rd-place teams into these
// slots using a greedy pass (lowest available group letter first). Four
// 3rd-place teams will not be assigned - they're the "didn't advance"
// teams in this prediction.
const SP_R32_DEF = {
  1:  [{type:'gp',g:'A',p:2}, {type:'gp',g:'B',p:2}],                          // M73: 2A vs 2B
  2:  [{type:'gp',g:'E',p:1}, {type:'third',allowed:['A','B','C','D','F']}],   // M74: 1E vs 3(ABCDF)
  3:  [{type:'gp',g:'F',p:1}, {type:'gp',g:'C',p:2}],                          // M75: 1F vs 2C
  4:  [{type:'gp',g:'C',p:1}, {type:'gp',g:'F',p:2}],                          // M76: 1C vs 2F
  5:  [{type:'gp',g:'I',p:1}, {type:'third',allowed:['C','D','F','G','H']}],   // M77: 1I vs 3(CDFGH)
  6:  [{type:'gp',g:'E',p:2}, {type:'gp',g:'I',p:2}],                          // M78: 2E vs 2I
  7:  [{type:'gp',g:'A',p:1}, {type:'third',allowed:['C','E','F','H','I']}],   // M79: 1A vs 3(CEFHI)
  8:  [{type:'gp',g:'L',p:1}, {type:'third',allowed:['E','H','I','J','K']}],   // M80: 1L vs 3(EHIJK)
  9:  [{type:'gp',g:'D',p:1}, {type:'third',allowed:['B','E','F','I','J']}],   // M81: 1D vs 3(BEFIJ)
  10: [{type:'gp',g:'G',p:1}, {type:'third',allowed:['A','E','H','I','J']}],   // M82: 1G vs 3(AEHIJ)
  11: [{type:'gp',g:'K',p:2}, {type:'gp',g:'L',p:2}],                          // M83: 2K vs 2L
  12: [{type:'gp',g:'H',p:1}, {type:'gp',g:'J',p:2}],                          // M84: 1H vs 2J
  13: [{type:'gp',g:'B',p:1}, {type:'third',allowed:['E','F','G','I','J']}],   // M85: 1B vs 3(EFGIJ)
  14: [{type:'gp',g:'J',p:1}, {type:'gp',g:'H',p:2}],                          // M86: 1J vs 2H
  15: [{type:'gp',g:'K',p:1}, {type:'third',allowed:['D','E','I','J','L']}],   // M87: 1K vs 3(DEIJL)
  16: [{type:'gp',g:'D',p:2}, {type:'gp',g:'G',p:2}]                           // M88: 2D vs 2G
};

// R16 (positions 17-24): each match feeds from two R32 winners, per the
// official FIFA bracket (M89=W74 vs W77, etc).
const SP_R16_DEF = {
  17: [2, 5],   // M89: W(M74)=pos2  vs W(M77)=pos5
  18: [1, 3],   // M90: W(M73)=pos1  vs W(M75)=pos3
  19: [4, 6],   // M91: W(M76)=pos4  vs W(M78)=pos6
  20: [7, 8],   // M92: W(M79)=pos7  vs W(M80)=pos8
  21: [11, 12], // M93: W(M83)=pos11 vs W(M84)=pos12
  22: [9, 10],  // M94: W(M81)=pos9  vs W(M82)=pos10
  23: [14, 16], // M95: W(M86)=pos14 vs W(M88)=pos16
  24: [13, 15]  // M96: W(M85)=pos13 vs W(M87)=pos15
};

// QF (25-28), SF (29-30), Final (31)
const SP_QF_DEF = {
  25: [17, 18], // M97
  26: [21, 22], // M98
  27: [19, 20], // M99
  28: [23, 24]  // M100
};
const SP_SF_DEF = {
  29: [25, 26], // M101
  30: [27, 28]  // M102
};
const SP_FINAL_DEF = {
  31: [29, 30]  // M104
};

// Reverse "child of" map (position → next-round position it feeds into).
// Used by spClearDownstream when a pick changes.
const SP_BRACKET_PARENTS = (() => {
  const m = {};
  Object.entries(SP_R16_DEF).forEach(([dst, [a,b]]) => { m[a] = +dst; m[b] = +dst; });
  Object.entries(SP_QF_DEF ).forEach(([dst, [a,b]]) => { m[a] = +dst; m[b] = +dst; });
  Object.entries(SP_SF_DEF ).forEach(([dst, [a,b]]) => { m[a] = +dst; m[b] = +dst; });
  Object.entries(SP_FINAL_DEF).forEach(([dst, [a,b]]) => { m[a] = +dst; m[b] = +dst; });
  return m;
})();

// The 8 R32 slots that take a best-third-place team, each with the FIFA
// "allowed groups" set (a 3rd-place team from one of these groups fills it).
const SP_THIRD_PLACE_SLOTS = [2, 5, 7, 8, 9, 10, 13, 15].map(pos => ({
  pos,
  allowed: SP_R32_DEF[pos].find(f => f.type === 'third').allowed
}));

// v2.5.79: user picks WHICH 8 of the 12 group 3rd-place teams advance
// (spState.thirdPlaceAdvancers = array of group letters). Given those 8
// groups, assign each to exactly one R32 slot respecting the slot's allowed
// set (a bipartite perfect matching). Backtracking; slots ordered by fewest
// options first. Returns { [pos]: letter } or null if no perfect matching
// exists for that combination.
function _spMatchThirdPlace(chosenGroups) {
  const chosen = new Set(chosenGroups);
  const slots = SP_THIRD_PLACE_SLOTS
    .map(s => ({ pos: s.pos, opts: s.allowed.filter(g => chosen.has(g)) }))
    .sort((a, b) => a.opts.length - b.opts.length); // most-constrained first
  const assignment = {};
  const used = new Set();
  const bt = (i) => {
    if (i === slots.length) return true;
    for (const g of slots[i].opts) {
      if (used.has(g)) continue;
      assignment[slots[i].pos] = g; used.add(g);
      if (bt(i + 1)) return true;
      used.delete(g); delete assignment[slots[i].pos];
    }
    return false;
  };
  return bt(0) ? assignment : null;
}

// Greedy fallback: lowest-letter group per slot (used before the user has
// chosen 8, or if a chosen combination can't be matched to the slots).
function _spGreedyThirdPlaceSlots() {
  const used = new Set();
  const assignment = {};
  SP_THIRD_PLACE_SLOTS.forEach(({ pos, allowed }) => {
    const g = allowed.find(x => !used.has(x));
    if (g) { assignment[pos] = g; used.add(g); }
  });
  return assignment;
}

function _spResolveThirdPlaceSlots() {
  const picks = (spState.thirdPlaceAdvancers || []).filter(Boolean);
  if (picks.length === 8) {
    const matched = _spMatchThirdPlace(picks);
    if (matched) return { assignment: matched, used: new Set(Object.values(matched)) };
  }
  // Not enough chosen (or unmatchable) → fall back to a deterministic set.
  const assignment = _spGreedyThirdPlaceSlots();
  return { assignment, used: new Set(Object.values(assignment)) };
}


function _spResolveFeed(feed, thirdSlots, slotPos) {
  if (feed.type === 'gp') {
    const arr = spState.groupPositions[feed.g];
    return arr ? arr[feed.p - 1] : null;
  }
  if (feed.type === 'third') {
    const g = thirdSlots.assignment[slotPos];
    if (!g) return null;
    const arr = spState.groupPositions[g];
    return arr ? arr[2] : null; // index 2 = 3rd place
  }
  return null;
}

function spGetMatchWinner(bracketPos) {
  return spState.bracketPicks[bracketPos] || null;
}

function spGetBracketStructure() {
  const thirdSlots = _spResolveThirdPlaceSlots();

  // R32 (1-16)
  const r32Matches = [];
  for (let pos = 1; pos <= 16; pos++) {
    const [a, b] = SP_R32_DEF[pos];
    r32Matches.push({
      pos, round: 'R32',
      home: _spResolveFeed(a, thirdSlots, pos),
      away: _spResolveFeed(b, thirdSlots, pos)
    });
  }

  // R16 (17-24)
  const r16Matches = Object.entries(SP_R16_DEF).map(([pos, [a, b]]) => ({
    pos: +pos, round: 'R16',
    home: spGetMatchWinner(a),
    away: spGetMatchWinner(b)
  }));

  // QF (25-28)
  const qfMatches = Object.entries(SP_QF_DEF).map(([pos, [a, b]]) => ({
    pos: +pos, round: 'QF',
    home: spGetMatchWinner(a),
    away: spGetMatchWinner(b)
  }));

  // SF (29-30)
  const sfMatches = Object.entries(SP_SF_DEF).map(([pos, [a, b]]) => ({
    pos: +pos, round: 'SF',
    home: spGetMatchWinner(a),
    away: spGetMatchWinner(b)
  }));

  // Final (31)
  const [fa, fb] = SP_FINAL_DEF[31];
  const finalMatch = {
    pos: 31, round: 'FINAL',
    home: spGetMatchWinner(fa),
    away: spGetMatchWinner(fb)
  };

  return {
    r32: r32Matches,
    r16: r16Matches,
    qf: qfMatches,
    sf: sfMatches,
    final: finalMatch,
    thirdSlots // expose so render can show "3rd of X" hints if needed
  };
}

// v2.5.79/82: the "which 8 third-place teams advance" selector. One card per
// group showing that group's predicted 3rd-place team PLUS the other teams in
// the group (rivals) so the user can judge how strong the 3rd-placer is in its
// own group. The user toggles exactly 8 on; a 9th is blocked until one drops.
function _spRenderThirdPlacePanel() {
  const chosen = new Set(spState.thirdPlaceAdvancers || []);
  const cards = WC2026_GROUP_LETTERS.map(letter => {
    const arr = spState.groupPositions[letter] || [];
    const code = arr[2];
    if (!code) return ''; // no 3rd-place predicted for this group yet
    const on = chosen.has(letter);
    // v2.5.86: rivals shown as plain muted codes (no extra flags) to cut the
    // flag clutter — only the 3rd-placer's own flag is shown, prominently.
    const rivals = arr.filter((c, i) => c && i !== 2).map(c => c).join(' · ');
    return `<button class="sp-tp-card ${on ? 'on' : ''}" onclick="spToggleThirdPlace('${letter}')">
      <span class="sp-tp-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
      <span class="sp-tp-flag">${getCountryFlag(code)}</span>
      <span class="sp-tp-info">
        <span class="sp-tp-line1">
          <span class="sp-tp-name">${getTeamName(code)}</span>
          <span class="sp-tp-grp">${t('groups.group')} ${letter}</span>
        </span>
        ${rivals ? `<span class="sp-tp-rivals"><span class="sp-tp-vs">${t('thirdPlace.vs')}</span>${rivals}</span>` : ''}
      </span>
    </button>`;
  }).join('');
  const n = chosen.size;
  const ok = n === 8;
  // v2.5.83: show what each correct pick is worth, read live from this pool's
  // scoring_rules (default 2).
  const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
  const pts = rules.third_place_advance ?? 1;
  const ptsHint = pts > 0
    ? `<div class="sp-tp-pts"><i class="ti ti-coin"></i> ${t('thirdPlace.pointsEach', { pts })}</div>` : '';
  return `
    <div class="sp-tp-panel">
      <div class="sp-tp-head">
        <div class="sp-tp-title">${t('thirdPlace.title')}</div>
        <div class="sp-tp-count ${ok ? 'ok' : ''}">${n} / 8</div>
      </div>
      <div class="sp-tp-sub">${t('thirdPlace.subtitle')}</div>
      ${ptsHint}
      <div class="sp-tp-cards">${cards}</div>
    </div>`;
}

function spToggleThirdPlace(letter) {
  if (spIsLocked && spIsLocked()) return;
  const set = new Set(spState.thirdPlaceAdvancers || []);
  if (set.has(letter)) {
    set.delete(letter);
  } else {
    if (set.size >= 8) { showToast(t('thirdPlace.maxReached'), 'info'); return; }
    set.add(letter);
  }
  spState.thirdPlaceAdvancers = [...set];
  // Re-render whichever screen is hosting the selector. (Scoring is
  // per-team-advanced, so changing the set is safe — no need to wipe picks.)
  if (state.currentScreen === 'sp-third-place-screen') spRenderThirdPlaceStep();
  else spRenderBracket();
  _spCacheSave(); // v2.9.7: back up every third-place change too
  spSaveThirdPlaceToDb();
}
window.spToggleThirdPlace = spToggleThirdPlace;

// v2.5.81: dedicated "pick your 8 third-place advancers" step, shown after
// the groups and BEFORE the knockout (so first-time users who go through the
// single-match walkthrough still get to choose). Reuses _spRenderThirdPlacePanel.
function spRenderThirdPlaceStep() {
  const c = document.getElementById('sp-third-place-container');
  if (c) c.innerHTML = _spRenderThirdPlacePanel();
  const next = document.getElementById('sp-third-place-next');
  if (next) next.disabled = (spState.thirdPlaceAdvancers || []).length !== 8;
}

function spStartThirdPlaceStep() {
  spRenderThirdPlaceStep();
  showScreen('sp-third-place-screen');
}
window.spStartThirdPlaceStep = spStartThirdPlaceStep;

function spThirdPlaceBack() {
  spState.currentGroupIdx = 11;
  spRenderGroups();
  showScreen('sp-groups-screen');
}
window.spThirdPlaceBack = spThirdPlaceBack;

function spThirdPlaceContinue() {
  if ((spState.thirdPlaceAdvancers || []).length !== 8) {
    showToast(t('thirdPlace.selectExactly', { n: (spState.thirdPlaceAdvancers || []).length }), 'error');
    return;
  }
  spSaveThirdPlaceToDb();
  // First time (no bracket picks yet) → single-match walkthrough; otherwise
  // the full grid bracket.
  if (!spState.bracketPicks || Object.keys(spState.bracketPicks).length === 0) {
    koSingle.mode = 'single-phase';
    koSingle.sequence = _koSinglePhaseSequence();
    koSingle.idx = 0;
    state.spInFlow = true;
    koSingleRender();
    showScreen('ko-single-screen');
  } else {
    spRenderBracket();
    showScreen('sp-bracket-screen');
  }
}
window.spThirdPlaceContinue = spThirdPlaceContinue;

function spRenderBracket() {
  const container = document.getElementById('sp-bracket-container');
  const struct = spGetBracketStructure();

  const renderRound = (titleKey, matches, ptsForStage) => `
    <div class="sp-bracket-round">
      <div class="sp-bracket-round-title">
        <span>${t(titleKey)}</span>
        ${ptsForStage != null ? `<span class="sp-bracket-round-pts">+${ptsForStage}</span>` : ''}
      </div>
      ${matches.map(m => spRenderBracketMatch(m)).join('')}
    </div>
  `;

  // v2.5.36: pull per-stage points from scoring_rules so each round title
  // shows what a correct pick is worth on this pool.
  // v2.5.70: every round (R32 included) is scored. Each correct pick rewards
  // the team that reached the NEXT round.
  const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
  // v2.6.6: the third-place selector has its own dedicated step
  // (sp-third-place-screen), so it's no longer rendered atop the bracket —
  // showing it here too was a confusing duplicate above the knockout rounds.
  container.innerHTML =
    renderRound('knockout.r32', struct.r32, rules.round_of_32) +
    renderRound('knockout.r16', struct.r16, rules.round_of_16) +
    renderRound('knockout.qf', struct.qf, rules.quarter_final) +
    renderRound('knockout.sf', struct.sf, rules.semi_final) +
    renderRound('knockout.final', [struct.final], rules.final);

  // v2.5.36: render the points-hint row above the bracket
  const hint = document.getElementById('sp-bracket-points-hint');
  if (hint) {
    // v2.5.72: tournament-winner pill removed - the Final pick IS the champion
    // pick, already represented by the Final stage.
    const stages = [
      { label: t('knockout.r32'), pts: rules.round_of_32 },
      { label: t('knockout.r16'), pts: rules.round_of_16 },
      { label: t('knockout.qf'),  pts: rules.quarter_final },
      { label: t('knockout.sf'),  pts: rules.semi_final },
      { label: t('knockout.final'), pts: rules.final }
    ];
    hint.innerHTML = stages
      .filter(s => s.pts != null && s.pts > 0)
      .map(s => `<span class="pts-pill">${s.label}: ${s.pts}</span>`)
      .join('');
  }

  // Update step counter (31 = 16 R32 + 8 R16 + 4 QF + 2 SF + 1 Final)
  const total = 31;
  const picked = Object.keys(spState.bracketPicks).length;
  document.getElementById('sp-bracket-step').textContent = `${picked}/${total}`;
}

function spRenderBracketMatch(m) {
  const picked = spState.bracketPicks[m.pos];
  const teamBtn = (code, side) => {
    if (!code) {
      return `<button class="sp-bracket-team tbd" disabled>
        <span class="bt-flag">⏳</span>
        <span class="bt-name">${t('knockout.tbd')}</span>
      </button>`;
    }
    const isPicked = picked === code;
    return `<button class="sp-bracket-team ${isPicked ? 'picked' : ''}" onclick="spPickBracket(${m.pos}, '${code}')">
      <span class="bt-flag">${getCountryFlag(code)}</span>
      <span class="bt-name">${getTeamName(code)}</span>
      <span class="bt-check"><i class="ti ti-check"></i></span>
    </button>`;
  };

  // v2.5.72: the FINAL match (pos 31) winner is the tournament champion. A
  // correct pick is rewarded once via the `final` points (no separate
  // champion bonus). Show that value inline, read live from scoring_rules.
  let finalNote = '';
  if (m.round === 'FINAL') {
    const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
    const finalPts = rules.final ?? 0;
    if (finalPts > 0) {
      finalNote = `<div class="sp-bracket-final-note">${t('betting.bracket.finalPoints', { n: finalPts })}</div>`;
    }
  }

  return `
    <div class="sp-bracket-match">
      ${teamBtn(m.home, 'home')}
      <div class="sp-bracket-vs">VS</div>
      ${teamBtn(m.away, 'away')}
      ${finalNote}
    </div>
  `;
}

// v2.9.10: count downstream picks (later rounds) that currently depend on this
// position — used to WARN before a change cascades them away, so a returning
// user editing an early pick never loses later-round picks without consenting.
function _spCountDownstream(bracketPos) {
  let p = SP_BRACKET_PARENTS[parseInt(bracketPos, 10)];
  let n = 0;
  while (p) { if (spState.bracketPicks[p]) n++; p = SP_BRACKET_PARENTS[p]; }
  return n;
}

function spPickBracket(bracketPos, teamCode) {
  if (spIsLocked()) return;
  const prev = spState.bracketPicks[bracketPos];

  // v2.9.10: warn before a change clears later-round picks that depend on it.
  if (prev && prev !== teamCode) {
    const n = _spCountDownstream(bracketPos);
    if (n > 0 && !confirm(t('betting.cascadeWarn', { n }))) { spRenderBracket(); return; }
  }

  spState.bracketPicks[bracketPos] = teamCode;

  // If the user changes a pick, clear downstream picks that depended on it
  if (prev && prev !== teamCode) {
    spClearDownstream(bracketPos);
  }

  // v2.5.68: the winner of the FINAL match (bracket position 31) IS the
  // tournament winner - sync automatically and persist. This removes
  // the duplicate sp-winner-screen step from the flow.
  if (parseInt(bracketPos, 10) === 31) {
    spState.tournamentWinner = teamCode;
    spSaveWinnerToDb(false);
  }

  spRenderBracket();
  spAutoSaveBracket();
}

function spClearDownstream(bracketPos) {
  // v2.5.68: parents map is derived from SP_BRACKET_PARENTS (built off the
  // official R32 → R16 → QF → SF → Final pairings). Walks up the tree from
  // the changed position, clearing any downstream picks that were derived
  // from it.
  const startPos = parseInt(bracketPos, 10);
  let p = SP_BRACKET_PARENTS[startPos];
  while (p) {
    delete spState.bracketPicks[p];
    // The Final (pos 31) winner mirrors as tournament champion. If we
    // invalidated that pick, also clear the mirrored tournamentWinner
    // value (and the row in tournament_winner_picks).
    if (p === 31) {
      spState.tournamentWinner = null;
      try {
        if (supabaseClient && state.currentUser) {
          // Preferred: clear via RPC (empty team => deletes the caller's pick);
          // legacy direct delete only if the RPC isn't deployed.
          const rc = _currentRecoveryCode();
          if (rc) {
            supabaseClient.rpc('save_tournament_winner', { p_code: rc, p_team_code: '' })
              .then(({ error }) => {
                if (error && _rpcMissing(error)) {
                  supabaseClient.from('tournament_winner_picks')
                    .delete().eq('user_id', state.currentUser.id).eq('pool_id', state.currentPool.id);
                }
              });
          } else {
            supabaseClient.from('tournament_winner_picks')
              .delete().eq('user_id', state.currentUser.id).eq('pool_id', state.currentPool.id);
          }
        }
      } catch (e) { /* ignore */ }
    }
    p = SP_BRACKET_PARENTS[p];
  }
}

// v2.9.2: LOCAL SAFETY-NET CACHE of the single-phase picks.
// The bracket save goes through an RPC that needs a recovery code; if the
// debounced save was interrupted (fast navigation / app backgrounded on mobile)
// or the RPC was momentarily unavailable, the bracket could fail to persist
// SILENTLY while the champion (saved immediately, with an allowed fallback
// table) survived — the exact "only champion/top-scorer saved" report. We now
// mirror every pick to localStorage and, on the next load, re-save to the DB if
// the server copy is missing/incomplete. This makes pick loss self-healing.
function _spCacheKey() {
  const u = state.currentUser && state.currentUser.id;
  const p = state.currentPool && state.currentPool.id;
  return (u && p) ? ('fb_sp_picks_' + u + '_' + p) : null;
}
let _spServerBackupTimer = null;
function _spCacheSnapshot() {
  return {
    groupPositions: spState.groupPositions || {},
    thirdPlaceAdvancers: spState.thirdPlaceAdvancers || [],
    bracketPicks: spState.bracketPicks || {},
    tournamentWinner: spState.tournamentWinner || null,
    topScorer: spState.topScorer || null,
    ts: Date.now()
  };
}
function _spCacheSave() {
  const k = _spCacheKey(); if (!k) return;
  const snapshot = _spCacheSnapshot();
  try { localStorage.setItem(k, JSON.stringify(snapshot)); } catch (_) {}
  // v2.9.5: DURABLE server-side append-only backup (fire-and-forget, debounced).
  // Independent of the live pick tables, so a future bug/migration that wipes
  // them is always recoverable. No UX impact: never awaited, errors swallowed,
  // no-op until the migration adds the RPC.
  if (_spServerBackupTimer) clearTimeout(_spServerBackupTimer);
  _spServerBackupTimer = setTimeout(() => _spBackupToServer(snapshot), 1500);
}
// Returns a promise so callers that want a GUARANTEED backup (e.g. submit) can
// await it; the debounced auto-save path just ignores the return (fire-and-forget).
// v2.9.12: retry transient PGRST202 so a schema-cache reload can't drop the only
// durable copy of the picks.
async function _spBackupToServer(snapshot) {
  try {
    const code = _currentRecoveryCode();
    if (!code || !supabaseClient) return;
    await _rpcWrite('backup_picks', { p_code: code, p_payload: snapshot }, { retries: 3, baseDelayMs: 600 });
  } catch (_) {}
}
function _spCacheLoad() {
  const k = _spCacheKey(); if (!k) return null;
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; }
}

// ============================================================
// v2.10.8: TWO-PHASE durable backup (parity with single-phase).
// Two-phase pools had NO backup, so when group_picks/knockout_picks were lost
// (silent save failure + a destructive sync job) the data was unrecoverable.
// These helpers give two-phase the same bulletproof safety net: an IMMEDIATE
// localStorage mirror (synchronous — can't fail) PLUS an append-only, undeletable
// server backup (pick_backups, REVOKEd from every external role), written through
// the PGRST202-retrying _rpcWrite so a schema reload can't silently drop it.
// The payload reuses the `groupPositions`/`bracketPicks` keys so the existing
// backup_picks() content-guard accepts it and get_pick_backup() reads it back.
function _tpCacheKey() {
  const u = state.currentUser && state.currentUser.id;
  const p = state.currentPool && state.currentPool.id;
  return (u && p) ? ('fb_2p_picks_' + u + '_' + p) : null;
}
function _tpSnapshot() {
  // v2.10.9: NEVER regress a slice to empty. When saving from the knockout flow
  // `bettingState.picks` (groups) may be empty (not loaded), and from the group
  // flow `knockoutState.picks` may be empty. Carrying the empty slice into the
  // snapshot would let a sparse backup become the "latest" and crowd out the good
  // one (the 12-row cap). So each slice falls back to the last cached value when
  // the live one has no content — every snapshot holds the UNION of known picks.
  const liveGroups = (typeof bettingState !== 'undefined' && bettingState.picks) || {};
  const liveBracket = (typeof knockoutState !== 'undefined' && knockoutState.picks) || {};
  const prev = _tpCacheLoad() || {};
  const groupsHaveContent = Object.values(liveGroups).some(a => Array.isArray(a) && a.length > 0);
  const bracketHasContent = liveBracket && Object.keys(liveBracket).length > 0;
  return {
    mode: 'two_phase',
    groupPositions: groupsHaveContent ? liveGroups : (prev.groupPositions || liveGroups),
    bracketPicks: bracketHasContent ? liveBracket : (prev.bracketPicks || liveBracket),
    ts: Date.now()
  };
}
let _tpServerBackupTimer = null;
function _tpCacheSave() {
  const k = _tpCacheKey(); if (!k) return;
  const snapshot = _tpSnapshot();
  try { localStorage.setItem(k, JSON.stringify(snapshot)); } catch (_) {}
  if (_tpServerBackupTimer) clearTimeout(_tpServerBackupTimer);
  _tpServerBackupTimer = setTimeout(() => _tpBackupToServer(snapshot), 1200);
}
async function _tpBackupToServer(snapshot) {
  try {
    const code = _currentRecoveryCode();
    if (!code || !supabaseClient) return;
    await _rpcWrite('backup_picks', { p_code: code, p_payload: snapshot }, { retries: 3, baseDelayMs: 600 });
  } catch (_) {}
}
function _tpCacheLoad() {
  const k = _tpCacheKey(); if (!k) return null;
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; }
}
// v2.10.8: restore missing two-phase group picks from the most complete backup
// (local cache or durable server backup). Per-group fill only — never clobbers a
// group already loaded from the DB. Re-persists what it heals so it's durable.
async function _tpSelfHealGroups() {
  try {
    if (typeof bettingState === 'undefined' || !bettingState.groupOrder) return;
    let backupGroups = null, bestCount = -1;
    const pick = (groups) => {
      if (!groups || typeof groups !== 'object') return;
      const n = Object.values(groups).reduce((s, a) => s + ((a || []).length), 0);
      if (n > bestCount) { bestCount = n; backupGroups = groups; }
    };
    const local = _tpCacheLoad();
    if (local && local.groupPositions) pick(local.groupPositions);
    const code = _currentRecoveryCode();
    if (code && supabaseClient) {
      try {
        const { data } = await supabaseClient.rpc('get_pick_backup', { p_code: code });
        if (data && data.groupPositions) pick(data.groupPositions);
      } catch (_) {}
    }
    if (!backupGroups || bestCount <= 0) return;
    let healed = 0;
    bettingState.groupOrder.forEach(letter => {
      const cur = bettingState.picks[letter] || [];
      const bk = Array.isArray(backupGroups[letter]) ? backupGroups[letter] : [];
      if (cur.length === 0 && bk.length > 0) {
        bettingState.picks[letter] = bk.slice(0, 3);
        healed += bettingState.picks[letter].length;
      }
    });
    if (healed > 0) {
      console.log('[_tpSelfHealGroups] restored ' + healed + ' group picks from backup');
      try { savePicksToDb(false); } catch (_) {}
    }
  } catch (_) {}
}

let _spBracketSaveTimer = null;
function spAutoSaveBracket() {
  _spCacheSave(); // mirror locally FIRST so a missed/failed DB save never loses work
  if (_spBracketSaveTimer) clearTimeout(_spBracketSaveTimer);
  _spBracketSaveTimer = setTimeout(() => spSaveBracketToDb(false), 600);
}

// v2.5.79: persist the 8 chosen third-place advancer group letters.
let _spTpSaveTimer = null;
let _spTpSavePromise = Promise.resolve();
function spSaveThirdPlaceToDb() {
  if (_spTpSaveTimer) clearTimeout(_spTpSaveTimer);
  // v2.9.18: null the handle when it fires (so the summary flush won't redundantly
  // re-run this save — third-place has no serialized chain), and track the in-flight
  // save in _spTpSavePromise so the flush can still await it.
  _spTpSaveTimer = setTimeout(() => { _spTpSaveTimer = null; _spTpSavePromise = _spSaveThirdPlaceInner(); }, 600);
}
async function _spSaveThirdPlaceInner() {
  if (!state.currentPool || !state.currentUser || !supabaseClient) return;
  if (spIsLocked()) return;
  const userId = state.currentUser.id;
  const poolId = state.currentPool.id;
  const letters = (spState.thirdPlaceAdvancers || []).filter(Boolean);
  if (letters.length === 0) return; // never wipe to empty
  // Preferred: server-side RPC; legacy direct write only if the RPC is absent.
  const code = _currentRecoveryCode();
  if (code) {
    const res = await _rpcWrite('save_sp_third_place', { p_code: code, p_letters: letters }); // v2.9.12: PGRST202 retry
    if (res.ok) return;
    if (!res.missing) { console.warn('[spSaveThirdPlace] RPC error:', res.error); return; }
    // RPC still unreachable after retries -> fall through to the legacy direct write below.
  }
  try {
    await supabaseClient.from('sp_third_place_picks')
      .delete().eq('user_id', userId).eq('pool_id', poolId);
    const rows = letters.map(l => ({ pool_id: poolId, user_id: userId, group_letter: l }));
    const { error } = await supabaseClient.from('sp_third_place_picks').insert(rows);
    if (error) console.warn('[spSaveThirdPlace] insert error:', error);
  } catch (e) { console.warn('[spSaveThirdPlace] caught:', e); }
}

// v2.5.22: serialize bracket saves to prevent the DELETE+INSERT race.
let _spBracketSaveChain = Promise.resolve();
async function spSaveBracketToDb(showFeedback = true) {
  const prev = _spBracketSaveChain;
  let resolveDone;
  _spBracketSaveChain = new Promise(r => { resolveDone = r; });
  await prev;
  try {
    return await _spSaveBracketToDbInner(showFeedback);
  } finally {
    resolveDone();
  }
}

async function _spSaveBracketToDbInner(showFeedback = true) {
  if (!state.currentPool || !state.currentUser) return;
  // v2.10: treat this as a recovery save ONLY when the flag is set AND we're
  // actually on the recovery walkthrough screen — so a stale flag (e.g. the user
  // left recovery via back/menu) can never route a later/normal save through the
  // recovery RPC or bypass the lock. A locked pool blocks every other save.
  const inRecoverySave = spReopenActive && state.currentScreen === 'ko-single-screen';
  if (spIsLocked() && !inRecoverySave) return;
  const userId = state.currentUser.id;
  const poolId = state.currentPool.id;

  // v2.5.22: knockout_picks is a LEGACY table from two-phase mode. Its
  // schema uses `predicted_winner` (text) + `match_id` + `round`, not
  // `team_code`. v2 single-phase uses the same table with bracket_position
  // (added in the 2026-05-17 migration). We synthesise match_id/round for
  // v2 rows so the legacy NOT NULL constraints (if any) are satisfied.
  // v2.5.68: position numbering now follows the official WC 2026 bracket:
  //   1-16 = R32, 17-24 = R16, 25-28 = QF, 29-30 = SF, 31 = Final
  const bracketRoundLabel = (pos) => {
    const p = parseInt(pos, 10);
    if (p >= 1 && p <= 16) return 'r32';
    if (p >= 17 && p <= 24) return 'r16';
    if (p >= 25 && p <= 28) return 'qf';
    if (p >= 29 && p <= 30) return 'sf';
    if (p === 31) return 'final';
    return 'unknown';
  };
  const rows = Object.entries(spState.bracketPicks).map(([pos, code]) => ({
    pool_id: poolId,
    user_id: userId,
    predicted_winner: code,
    match_id: `sp_${pos}`,
    round: bracketRoundLabel(pos),
    bracket_position: parseInt(pos, 10)
  }));

  // v2.4.6: SAFETY GUARD - same logic as spSaveGroupsToDb. Don't wipe DB
  // when in-memory bracket state is empty (stale auto-save / page reset).
  if (rows.length === 0) {
    console.warn('spSaveBracketToDb: in-memory state is empty - skipping DB write to avoid wiping real picks');
    return;
  }

  // v2.9.12: the ONLY working write path is the SECURITY DEFINER RPC — anon
  // INSERT/DELETE on knockout_picks is REVOKEd (every direct write 401s). So we
  // call it with PGRST202 retries (rides out a PostgREST schema-cache reload),
  // and NEVER pretend a failed save succeeded. The local + durable server backup
  // (written by _spCacheSave before this runs) plus the on-load auto-heal are the
  // safety net if the server is briefly unreachable.
  const code = _currentRecoveryCode();
  if (!code) {
    // No recovery code in this session → the RPC can't authenticate the writer
    // and the direct write is REVOKEd. Don't silently drop: the localStorage
    // cache holds the picks; tell the user how to make the save stick.
    console.error('[spSaveBracketToDb] no recovery code in session — cannot save bracket to server');
    showToast(t('bracketSave.noCode'), 'error');
    return;
  }

  // v2.10: in the 72h recovery flow, the pool is locked, so the normal RPC would
  // reject — route to the dedicated, grant-gated recovery RPC instead.
  const rpcName = inRecoverySave ? 'save_knockout_bracket_reopen' : 'save_knockout_bracket';
  const res = await _rpcWrite(rpcName, { p_code: code, p_picks: rows });
  if (res.ok) {
    if (showFeedback) showToast(t('groups.picksSaved'), 'success');
    return;
  }
  if (!res.missing) {
    // A genuine business error from the deployed RPC (e.g. invalid payload).
    console.error('[spSaveBracketToDb] RPC error:', res.error);
    showToast('DB error (bracket): ' + (res.error && res.error.message || 'unknown'), 'error');
    return;
  }

  // Still PGRST202 after all retries. The RPC is (transiently) unreachable and
  // the direct write is dead for anon — so DON'T attempt it (it would only 401
  // and read as a scary DB error). Force a durable server backup now so the
  // next app open auto-heals, and tell the user honestly.
  console.error('[spSaveBracketToDb] save_knockout_bracket unreachable after retries — relying on backup + auto-heal');
  try { _spBackupToServer(_spCacheSnapshot()); } catch (_) {}
  showToast(t('bracketSave.retryLater'), 'error');
}

// v2.9.12: read back the live bracket row count straight from the DB (anon has
// SELECT). Used to CONFIRM a save actually persisted before we tell the user it
// did — the guarantee that re-entering picks after the earlier bug can't silently
// fail a second time. Returns -1 if the read itself failed (treat as unconfirmed).
async function _spBracketDbCount() {
  try {
    if (!supabaseClient || !state.currentUser || !state.currentPool) return -1;
    const { data, error } = await supabaseClient.from('knockout_picks')
      .select('bracket_position')
      .eq('user_id', state.currentUser.id)
      .eq('pool_id', state.currentPool.id)
      .not('bracket_position', 'is', null);
    if (error) return -1;
    return (data || []).length;
  } catch (_) { return -1; }
}

// Save the bracket and VERIFY it landed in the DB, retrying the save if the
// read-back is short. Returns true only when the DB genuinely holds the expected
// rows. Callers use this at the commit checkpoints (submit / re-entry) so the UI
// never claims success on a save that silently didn't persist.
async function spSaveBracketVerified(expected) {
  const want = expected || Object.keys(spState.bracketPicks || {}).length;
  if (!want) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    await spSaveBracketToDb(false);
    const n = await _spBracketDbCount();
    if (n >= want) return true;          // confirmed in the DB
    if (n < 0) return false;             // couldn't read back (offline) — don't claim success
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  return false;
}

function spBracketNext() {
  // v2.5.62: also permissive. Users can advance past the bracket even
  // without picking position 15 / the tournament winner — the summary
  // will simply show "Not picked" for the champion. A soft info toast
  // surfaces what's missing without trapping the user on this screen.
  if (!spState.tournamentWinner) {
    showToast(t('betting.finalMissingHint'), 'info');
  }
  state.spInFlow = true;
  spStartTopScorerStep();
}

// v2.4.7: bilateral horizontal bracket view modal. Renders the SP
// (single-phase) bracket with both sides flanking a central FINAL +
// CHAMPION card. Each side: R16(4) -> QF(2) -> SF(1) -> FINAL <- SF(1)
// <- QF(2) <- R16(4). Connector lines drawn via CSS pseudo-elements.

// Match-card renderer used by every column.
function _spBvRenderMatch(match) {
  const winner = spState.bracketPicks[match.pos];
  const cell = (code) => {
    if (!code) {
      return `<div class="sp-bv-team tbd"><span class="sp-bv-team-flag">·</span><span class="sp-bv-team-name">${t('knockoutEx.tbdTeam')}</span></div>`;
    }
    const isPicked = winner === code;
    return `
      <div class="sp-bv-team ${isPicked ? 'picked' : ''}">
        <span class="sp-bv-team-flag">${getCountryFlag(code)}</span>
        <span class="sp-bv-team-name">${getTeamName(code)}</span>
        <svg class="sp-bv-team-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>`;
  };
  return `
    <div class="sp-bv-match">
      ${cell(match.home)}
      <div class="sp-bv-match-vs">vs</div>
      ${cell(match.away)}
    </div>`;
}

// Helper: wrap N pairs of matches in pair-wrappers so the CSS vertical
// connector line spans each feeder pair correctly. side = 'left' | 'right'.
function _spBvPairColumn(matches, side, perPair = 2) {
  const out = [];
  for (let i = 0; i < matches.length; i += perPair) {
    const slice = matches.slice(i, i + perPair);
    out.push(
      `<div class="sp-bv-pair-wrap ${side}">${slice.map(_spBvRenderMatch).join('')}</div>`
    );
  }
  return out.join('');
}

// v2.5.75: build the 9-column bilateral bracket-tree inner HTML. Shared by
// the bracket-view modal (openSpBracketView) and the summary screen
// (spRenderSummary) so both render the identical horizontal tree.
//
// WC 2026 format: R32 → R16 → QF → SF → FINAL ← SF ← QF ← R16 ← R32.
// The "left half" feeds SF #29 (M101); the "right half" feeds SF #30 (M102).
// We walk SP_BRACKET_PARENTS to find which R32 positions reach each SF side.
function _spBuildBracketTreeHtml() {
  const struct = spGetBracketStructure();
  const leftR16  = [17, 18, 21, 22];           // feeds QF 25, 26 → SF 29
  const rightR16 = [19, 20, 23, 24];           // feeds QF 27, 28 → SF 30
  const leftR32 = []; const rightR32 = [];
  for (let p = 1; p <= 16; p++) {
    const parent = SP_BRACKET_PARENTS[p];
    if (leftR16.includes(parent)) leftR32.push(p);
    else if (rightR16.includes(parent)) rightR32.push(p);
  }

  const r32Left  = struct.r32.filter(m => leftR32.includes(m.pos));
  const r32Right = struct.r32.filter(m => rightR32.includes(m.pos));
  const r16Left  = struct.r16.filter(m => leftR16.includes(m.pos));
  const r16Right = struct.r16.filter(m => rightR16.includes(m.pos));
  const qfLeft   = struct.qf.filter(m => [25, 26].includes(m.pos));
  const qfRight  = struct.qf.filter(m => [27, 28].includes(m.pos));
  const sfLeft   = struct.sf.filter(m => m.pos === 29);
  const sfRight  = struct.sf.filter(m => m.pos === 30);
  const finalMatch = struct.final;

  const champion = spState.bracketPicks[31];
  const championHtml = champion
    ? `<div class="sp-bv-champion">
         <div class="sp-bv-champion-trophy">🏆</div>
         <div class="sp-bv-champion-label">${t('betting.summary.winner')}</div>
         <div class="sp-bv-champion-flag">${getCountryFlag(champion)}</div>
         <div class="sp-bv-champion-name">${getTeamName(champion)}</div>
       </div>`
    : `<div class="sp-bv-champion tbd">
         <div class="sp-bv-champion-trophy">🏆</div>
         <div class="sp-bv-champion-label">${t('betting.summary.winner')}</div>
         <div class="sp-bv-champion-name">${t('betting.notPicked')}</div>
       </div>`;

  return `
    <div class="sp-bv-col sp-bv-col-r32l">
      <div class="sp-bv-col-title">${t('knockout.r32')}</div>
      <div class="sp-bv-col-stack">${_spBvPairColumn(r32Left, 'left')}</div>
    </div>
    <div class="sp-bv-col sp-bv-col-r16l">
      <div class="sp-bv-col-title">${t('knockout.r16')}</div>
      <div class="sp-bv-col-stack">${_spBvPairColumn(r16Left, 'left')}</div>
    </div>
    <div class="sp-bv-col sp-bv-col-qfl">
      <div class="sp-bv-col-title">${t('knockout.qf')}</div>
      <div class="sp-bv-col-stack">${_spBvPairColumn(qfLeft, 'left')}</div>
    </div>
    <div class="sp-bv-col sp-bv-col-sfl">
      <div class="sp-bv-col-title">${t('knockout.sf')}</div>
      <div class="sp-bv-col-stack">${sfLeft.map(_spBvRenderMatch).join('')}</div>
    </div>
    <div class="sp-bv-col sp-bv-col-fin">
      <div class="sp-bv-col-title">${t('knockout.final')}</div>
      ${_spBvRenderMatch(finalMatch)}
      ${championHtml}
    </div>
    <div class="sp-bv-col sp-bv-col-sfr">
      <div class="sp-bv-col-title">${t('knockout.sf')}</div>
      <div class="sp-bv-col-stack">${sfRight.map(_spBvRenderMatch).join('')}</div>
    </div>
    <div class="sp-bv-col sp-bv-col-qfr">
      <div class="sp-bv-col-title">${t('knockout.qf')}</div>
      <div class="sp-bv-col-stack">${_spBvPairColumn(qfRight, 'right')}</div>
    </div>
    <div class="sp-bv-col sp-bv-col-r16r">
      <div class="sp-bv-col-title">${t('knockout.r16')}</div>
      <div class="sp-bv-col-stack">${_spBvPairColumn(r16Right, 'right')}</div>
    </div>
    <div class="sp-bv-col sp-bv-col-r32r">
      <div class="sp-bv-col-title">${t('knockout.r32')}</div>
      <div class="sp-bv-col-stack">${_spBvPairColumn(r32Right, 'right')}</div>
    </div>
  `;
}

function openSpBracketView() {
  const tree = document.getElementById('sp-bracket-tree');
  if (!tree) return;
  tree.innerHTML = _spBuildBracketTreeHtml();

  // Reset side filter (Full view by default each time the modal opens)
  setSpBracketViewSide('full');

  const modal = document.getElementById('sp-bracket-view-modal');
  if (modal) modal.style.display = 'flex';
}

// Side-tab switcher for narrow screens: focuses on left/right half or
// shows both. Sets `data-side` on the tree which CSS uses to hide the
// opposite half.
function setSpBracketViewSide(side) {
  const tree = document.getElementById('sp-bracket-tree');
  if (tree) tree.setAttribute('data-side', side);
  document.querySelectorAll('.sp-bv-side-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.side === side);
  });
  // Scroll the modal back to start when switching sides so the user
  // doesn't end up looking at a blank gap.
  const scroller = document.getElementById('sp-bracket-view-scroll');
  if (scroller) scroller.scrollLeft = 0;
}

function closeSpBracketView() {
  const modal = document.getElementById('sp-bracket-view-modal');
  if (modal) modal.style.display = 'none';
}

// v2.5.75: side-tab switcher for the bracket tree embedded in the summary
// screen (separate DOM ids from the modal so both can coexist).
function setSpSummaryBracketSide(side) {
  const tree = document.getElementById('sp-summary-bracket-tree');
  if (tree) tree.setAttribute('data-side', side);
  document.querySelectorAll('.sp-summary-bv-tabs .sp-bv-side-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.side === side);
  });
  const scroller = document.getElementById('sp-summary-bracket-scroll');
  if (scroller) scroller.scrollLeft = 0;
}

window.openSpBracketView = openSpBracketView;
window.closeSpBracketView = closeSpBracketView;
window.setSpBracketViewSide = setSpBracketViewSide;
window.setSpSummaryBracketSide = setSpSummaryBracketSide;

function spRenderWinnerScreen() {
  // Options: SF winners if user picked any; else fallback to QF-picked teams
  const struct = spGetBracketStructure();
  let candidates = [];
  // v2.5.68: SF positions are now 29, 30 (was 13, 14 in the pre-R32 layout).
  [29, 30].forEach(pos => {
    const w = spGetMatchWinner(pos);
    if (w) candidates.push(w);
  });
  if (candidates.length < 2) {
    // Fallback: QF winners (positions 25-28)
    [25, 26, 27, 28].forEach(pos => {
      const w = spGetMatchWinner(pos);
      if (w && !candidates.includes(w)) candidates.push(w);
    });
  }
  if (candidates.length === 0) {
    // Pure fallback: all teams from groups
    candidates = Object.values(WC2026_GROUPS).flat();
  }

  const container = document.getElementById('sp-winner-options');
  container.innerHTML = candidates.map(code => `
    <button class="sp-winner-option ${spState.tournamentWinner === code ? 'selected' : ''}" onclick="spPickWinner('${code}')">
      <span class="wo-flag">${getCountryFlag(code)}</span>
      <span class="wo-name">${getTeamName(code)}</span>
    </button>
  `).join('');
}

function spPickWinner(code) {
  if (spIsLocked()) return;
  spState.tournamentWinner = code;
  _spCacheSave();
  spRenderWinnerScreen();
  spSaveWinnerToDb(false);
}

async function spSaveWinnerToDb(showFeedback = true) {
  if (!state.currentPool || !state.currentUser || !spState.tournamentWinner) return;
  // v2.10: in recovery, the champion is LOCKED (the bracket's final must equal the
  // already-saved tournament winner, enforced server-side). Never re-write it here.
  if (spReopenActive) return;
  const userId = state.currentUser.id;
  const poolId = state.currentPool.id;
  // Preferred: server-side RPC; legacy direct write only if the RPC is absent.
  const code = _currentRecoveryCode();
  if (code) {
    const res = await _rpcWrite('save_tournament_winner', { p_code: code, p_team_code: spState.tournamentWinner }); // v2.9.12: PGRST202 retry
    if (res.ok) {
      if (showFeedback) showToast(t('groups.picksSaved'), 'success');
      return;
    }
    if (!res.missing) { console.warn('Save tournament winner RPC error:', res.error); return; }
    // RPC still unreachable after retries -> fall through to the legacy direct write below.
  }
  try {
    // v2.5.7: scope DELETE to this pool. Without pool_id, picking the
    // winner in pool B would clear pool A's winner pick.
    await supabaseClient.from('tournament_winner_picks')
      .delete().eq('user_id', userId).eq('pool_id', poolId);
    const { error } = await supabaseClient.from('tournament_winner_picks').insert({
      pool_id: poolId,
      user_id: userId,
      team_code: spState.tournamentWinner
    });
    if (error) console.warn('Save tournament winner error:', error);
    if (showFeedback) showToast(t('groups.picksSaved'), 'success');
  } catch (err) {
    console.warn('spSaveWinnerToDb err:', err);
  }
}

function spWinnerNext() {
  if (!spState.tournamentWinner) {
    showToast(t('betting.winnerRequired'), 'error');
    return;
  }
  // v2.3: detour through top scorer before reaching summary
  spStartTopScorerStep();
}

// v2.3: Top scorer step inside the SP flow.
//       Reuses the existing #top-scorer-screen but enables the
//       inline back/next nav and routes the topbar back button
//       to the winner screen instead of the dashboard.
function spStartTopScorerStep() {
  // v2.4.5: if the top-scorer feature is locked (squads not yet released),
  // skip this step entirely - jump straight to the summary. Without this
  // the user was getting a flash of the locked-view hero before being
  // stuck on it (the in-flow nav was hidden inside the unlocked view).
  // The cache was warmed when the dashboard loaded.
  const released = (localStorage.getItem('fb_squads_released') === 'true');
  if (!released) {
    state.spInFlow = false;
    spShowSummary(); // self-awaits the render, then reveals the screen
    return;
  }

  state.spInFlow = true;
  showTopScorer();  // existing function handles the screen-level logic
  // Defer until after showTopScorer's async DOM updates
  setTimeout(() => {
    const nav = document.getElementById('ts-sp-flow-nav');
    if (nav) nav.style.display = 'flex';
  }, 0);
}

function spTopScorerBack() {
  state.spInFlow = false;
  const nav = document.getElementById('ts-sp-flow-nav');
  if (nav) nav.style.display = 'none';
  // v2.4.3: back from top-scorer in the SP flow goes to the bracket
  // (the standalone winner screen is no longer in the flow).
  spRenderBracket();
  showScreen('sp-bracket-screen');
}

async function spTopScorerNext() {
  state.spInFlow = false;
  const nav = document.getElementById('ts-sp-flow-nav');
  if (nav) nav.style.display = 'none';
  // v2.9.17: if the user tapped a scorer and immediately tapped Continue, wait
  // for that save to land before the summary reloads from the DB (else the
  // summary could show the top scorer as "Not picked").
  try { if (topScorerState.savingPromise) await topScorerState.savingPromise; } catch (_) {}
  spShowSummary(); // self-awaits the render, then reveals the screen
}

// Smart back handler for the standalone top-scorer screen.
// v2.5.62: the topbar back arrow now ALWAYS goes to the dashboard so the
// behavior matches every other SP-flow screen (sp-groups, sp-bracket,
// sp-summary all already do this). Stepping back through the flow itself
// is available via the in-flow bottom nav bar's "back to bracket" button.
function topScorerBack() {
  // Make sure we clean up the in-flow nav and flag so the next entry
  // into the standalone top-scorer screen starts clean.
  state.spInFlow = false;
  const nav = document.getElementById('ts-sp-flow-nav');
  if (nav) nav.style.display = 'none';
  goToDashboard();
}
window.topScorerBack = topScorerBack;
window.spTopScorerBack = spTopScorerBack;
window.spTopScorerNext = spTopScorerNext;

// v2.9.16: flush BOTH the group and bracket pending saves before the summary
// reloads from the DB. Groups and the knockout bracket each have their own
// debounced timer + serialized save chain; if either is still in flight when
// spRenderSummary reloads, the summary flashes "Not Picked" for picks the user
// JUST made. v2.9.15 awaited only the group chain — this extends it to the
// bracket (the final-match → summary path was still racing). Never throws.
async function spFlushPendingSavesBeforeSummary() {
  // Group: fire any pending debounced save now, then drain the chain.
  if (_spSaveTimer) {
    clearTimeout(_spSaveTimer); _spSaveTimer = null;
    try { await spSaveGroupsToDb(false); } catch (_) {}
  }
  try { await _spGroupsSaveChain; } catch (_) {}
  // Bracket: same — clear the 600ms debounce and flush before reload.
  if (_spBracketSaveTimer) {
    clearTimeout(_spBracketSaveTimer); _spBracketSaveTimer = null;
    try { await spSaveBracketToDb(false); } catch (_) {}
  }
  try { await _spBracketSaveChain; } catch (_) {}
  // v2.9.17/18: third-place advancers (debounced, no chain). Fire any still-pending
  // save now; either way await the latest in-flight third-place save (tracked in
  // _spTpSavePromise) before the summary reloads — works whether the debounce timer
  // is still pending or already fired.
  if (typeof _spTpSaveTimer !== 'undefined' && _spTpSaveTimer) {
    clearTimeout(_spTpSaveTimer); _spTpSaveTimer = null;
    _spTpSavePromise = _spSaveThirdPlaceInner();
  }
  try { await _spTpSavePromise; } catch (_) {}
}

// v2.9.15: the ONE entry into the summary screen. Flushes any in-flight group +
// bracket save (v2.9.16), then reloads + renders the summary from the DB, and
// only THEN reveals the screen — so it never flashes stale "Not Picked" rows
// while the async reload/save is still pending (the race behind several "my
// picks vanished" reports). On render error it logs and still shows the screen
// with whatever rendered (never blanks existing picks). Safe to call without
// await; async callers await.
async function spShowSummary() {
  try { await spFlushPendingSavesBeforeSummary(); } catch (_) {}
  try {
    if (typeof spRenderSummary === 'function') await spRenderSummary();
  } catch (e) {
    console.error('[spShowSummary] render failed:', e);
  }
  showScreen('sp-summary-screen');
}
window.spShowSummary = spShowSummary;

async function spRenderSummary() {
  // v2.5.19: ALWAYS reload from DB at the top of summary render. The
  //          previous "trust in-memory state" approach kept showing
  //          Not Picked for users because in some flows spState got
  //          reset between load and render. A fresh DB read on every
  //          render is the source of truth - one extra round-trip
  //          isn't a real cost for a screen the user lands on rarely.
  //          spLoadExistingPicks already has the pool_id fallback
  //          (v2.5.15) so legacy data still surfaces.
  console.log('[spRenderSummary] forcing fresh DB load | user=' +
    (state.currentUser && state.currentUser.id) +
    ' | pool=' + (state.currentPool && state.currentPool.id));
  await spLoadExistingPicks();
  const groupCount = Object.values(spState.groupPositions || {})
    .reduce((n, arr) => n + (arr || []).filter(Boolean).length, 0);
  console.log('[spRenderSummary] after load: groups=' + groupCount +
    ' bracket=' + Object.keys(spState.bracketPicks || {}).length +
    ' winner=' + (spState.tournamentWinner || 'none'));

  let summaryTopScorerPick = null;
  try {
    const { data: ts } = await supabaseClient.from('top_scorer_picks')
      .select('*').eq('user_id', state.currentUser.id).eq('pool_id', state.currentPool.id).maybeSingle();
    summaryTopScorerPick = ts || null;
  } catch (e) { /* ignore */ }

  const completion = spCompletionState(!!summaryTopScorerPick);
  if (completion.allComplete && !spHasUserSubmitted()) {
    await spMarkPredictionsSubmitted('summary-complete');
  }

  // v2.5.15: always reset the Save button to its clean state when entering
  // the summary screen. Previously the button was left in "Saving..." +
  // disabled after a successful submit (spSubmitPredictions transitioned
  // to dashboard without restoring it), so returning here via "View your
  // predictions" found a dead button.
  const submitBtn = document.getElementById('sp-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="ti ti-rocket"></i><span data-i18n="betting.summary.submit">${t('betting.summary.submit')}</span>`;
  }

  // Context-aware CTA hierarchy (v2.6.99). Two distinct intents land on this
  // screen, and the primary CTA must match each:
  //   • First-time / pre-submit  → "Save my predictions" is the primary CTA
  //     (the commit that sets predictions_submitted_at). Share is hidden — an
  //     incomplete bracket would share an empty OG card (see _bracketShareReady).
  //   • Returning (already submitted a FULL bracket, here via "View your
  //     predictions") → "Share my bracket" becomes the primary CTA: this is the
  //     viral moment. Save is DEMOTED to a secondary "Save changes" — picks
  //     auto-save on every edit (spAutoSaveGroups / autoSaveKnockoutPicks) and
  //     the submit flag is already set, so Save is reassurance, not the action.
  //     Back-to-dashboard already lives in the topbar (home icon), so no extra
  //     button is needed.
  const summaryShareBtn = document.getElementById('sp-summary-share-btn');
  const summaryShareApps = document.getElementById('sp-summary-share-apps');
  const summaryShareDesktop = document.getElementById('sp-summary-share-desktop');
  const summarySaveBtn = document.getElementById('sp-submit-btn');
  if (summaryShareBtn && summarySaveBtn) {
    const submitted = typeof spHasUserSubmitted === 'function' && spHasUserSubmitted();
    const hasChamp = !!(spState.tournamentWinner || (spState.bracketPicks && spState.bracketPicks[31]));
    const shareIsPrimary = (submitted && hasChamp);

    const saveLabel = summarySaveBtn.querySelector('span');
    const saveIcon = summarySaveBtn.querySelector('i');
    if (shareIsPrimary) {
      // Promote Share, demote Save.
      summaryShareBtn.className = 'btn-primary btn-large';
      summarySaveBtn.className = 'btn-secondary';
      if (saveIcon) saveIcon.className = 'ti ti-device-floppy';
      if (saveLabel) {
        saveLabel.setAttribute('data-i18n', 'betting.summary.saveChanges');
        saveLabel.textContent = t('betting.summary.saveChanges');
      }
      // Reorder so the share controls render above Save.
      const parent = summarySaveBtn.parentNode;
      if (parent) {
        parent.insertBefore(summaryShareBtn, summarySaveBtn);
        if (summaryShareApps) parent.insertBefore(summaryShareApps, summarySaveBtn);
        if (summaryShareDesktop) parent.insertBefore(summaryShareDesktop, summarySaveBtn);
      }
      // Populate desktop link chips, then let _applyBracketShareMode pick the
      // right affordance: mobile keeps the native-sheet button + logo hint;
      // desktop swaps in real per-app link chips + copy + download (v2.7.0).
      if (typeof _ensureBracketDesktopControls === 'function') _ensureBracketDesktopControls(summaryShareDesktop);
      summaryShareBtn.style.display = '';
      if (summaryShareApps) summaryShareApps.style.display = '';
      if (summaryShareDesktop) summaryShareDesktop.style.display = '';
      if (parent && typeof _applyBracketShareMode === 'function') _applyBracketShareMode(parent);
      if (typeof _prewarmBracketOg === 'function') _prewarmBracketOg(); // warm OG before any share click
    } else {
      // First-time: Save is the large primary, all share controls hidden.
      summaryShareBtn.style.display = 'none';
      if (summaryShareApps) summaryShareApps.style.display = 'none';
      if (summaryShareDesktop) summaryShareDesktop.style.display = 'none';
      summaryShareBtn.className = 'btn-secondary';
      summarySaveBtn.className = 'btn-primary btn-large';
      if (saveIcon) saveIcon.className = 'ti ti-rocket';
      if (saveLabel) {
        saveLabel.setAttribute('data-i18n', 'betting.summary.submit');
        saveLabel.textContent = t('betting.summary.submit');
      }
    }
  }

  // Groups summary
  const groupsEl = document.getElementById('sp-summary-groups');
  groupsEl.innerHTML = WC2026_GROUP_LETTERS.map(letter => {
    const positions = spState.groupPositions[letter] || [];
    return `
      <div style="margin-bottom:10px;">
        <div style="font-weight:600;color:#d9b46a;font-size:12px;letter-spacing:.5px;margin-bottom:4px;">
          ${t('groups.group')} ${letter}
        </div>
        ${[0,1,2,3].map(i => {
          const code = positions[i];
          return `
            <div class="sp-summary-row">
              <span class="sr-pos">${i + 1}.</span>
              <span class="sr-flag">${code ? getCountryFlag(code) : '—'}</span>
              <span class="sr-value">${code ? getTeamName(code) : t('betting.notPicked')}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');

  // v2.5.75: bracket summary is now the horizontal bracket tree (same widget
  // as the bracket-view modal) instead of a flat per-round list. Reads far
  // more naturally with 5 knockout rounds. Side-tabs (Full/Left/Right) let
  // the user focus on one half on narrow screens.
  const bracketEl = document.getElementById('sp-summary-bracket');
  bracketEl.innerHTML = `
    <div class="sp-bv-side-tabs sp-summary-bv-tabs">
      <button class="sp-bv-side-tab active" data-side="full" onclick="setSpSummaryBracketSide('full')" data-i18n="bracketView.full">${t('bracketView.full')}</button>
      <button class="sp-bv-side-tab" data-side="left" onclick="setSpSummaryBracketSide('left')" data-i18n="bracketView.leftSide">${t('bracketView.leftSide')}</button>
      <button class="sp-bv-side-tab" data-side="right" onclick="setSpSummaryBracketSide('right')" data-i18n="bracketView.rightSide">${t('bracketView.rightSide')}</button>
    </div>
    <div class="sp-bracket-view-scroll" id="sp-summary-bracket-scroll">
      <div class="sp-bracket-tree" id="sp-summary-bracket-tree" data-side="full">${_spBuildBracketTreeHtml()}</div>
    </div>
  `;

  // Winner
  const w = spState.tournamentWinner;
  document.getElementById('sp-summary-winner').innerHTML = w
    ? `<div class="sp-summary-row">
         <span class="sr-flag" style="font-size:28px;">${getCountryFlag(w)}</span>
         <span class="sr-value" style="font-size:18px;">${getTeamName(w)}</span>
       </div>`
    : `<div class="sp-summary-row"><span class="sr-label">${t('betting.notPicked')}</span></div>`;

  // Top scorer
  try {
    const { data: ts } = await supabaseClient.from('top_scorer_picks')
      .select('*').eq('user_id', state.currentUser.id).maybeSingle();
    const tsEl = document.getElementById('sp-summary-topscorer');
    if (ts) {
      tsEl.innerHTML = `<div class="sp-summary-row">
        <span class="sr-flag">${getCountryFlag(ts.team_code)}</span>
        <span class="sr-value">${escapeHtml(ts.player_name || '—')}</span>
        <span class="sr-label">${ts.team_code || ''}</span>
      </div>`;
    } else {
      tsEl.innerHTML = `<div class="sp-summary-row"><span class="sr-label">${t('betting.notPicked')}</span></div>`;
    }
  } catch (e) { /* ignore */ }
}

// v2.5.15: Back from the summary screen now goes to the dashboard. The
// user most often arrives here via the "View your predictions" CTA, so the
// natural back target is the dashboard, not the middle of the flow.
// Users who want to edit picks have an explicit "Edit groups & bracket"
// button below the Save button (spSummaryEditPicks).
function spSummaryBack() {
  goToDashboard();
}
window.spSummaryBack = spSummaryBack;

// v2.4.6: explicit "edit my groups & bracket" entry point from the
// summary screen. Routes the user back into the flow so they can fix
// missing picks (the recovery path for the v2.4.5 wipe bug).
function spSummaryEditPicks() {
  spState.currentGroupIdx = 0;
  spRenderGroups();
  showScreen('sp-groups-screen');
}
window.spSummaryEditPicks = spSummaryEditPicks;

function spEditTopScorer() {
  // v2.6.10: edit from summary now uses the in-flow top-scorer step so the
  // "Continue" button (→ back to summary) is present after picking. Previously
  // it opened the screen with no nav, leaving the user with no way forward.
  spStartTopScorerStep();
}

async function spSubmitPredictions() {
  // v2.5.64: save+exit from summary is permissive — the rest of the flow
  // is permissive end-to-end (v2.5.62), so the final landing screen had
  // to follow. Behavior:
  //   • All picks complete → set predictions_submitted_at so the dashboard
  //     flips to "ALL SET" and the user gets the View-predictions CTA.
  //   • Anything missing → skip the predictions_submitted_at update so the
  //     dashboard correctly stays on the "partial" state. The user lands
  //     on the dashboard either way. A soft info toast tells them what's
  //     still open. Auto-save has already persisted the partial picks.
  let hasTopScorerPick = false;
  if (spTopScorerRequired()) {
    try {
      const { data: ts } = await supabaseClient.from('top_scorer_picks')
        .select('id').eq('user_id', state.currentUser.id).eq('pool_id', state.currentPool.id);
      hasTopScorerPick = (ts || []).length >= 1;
    } catch (_) {}
  }
  const completion = spCompletionState(hasTopScorerPick);
  const incompleteGroups = completion.incompleteGroups;
  const missingWinner = completion.missingWinner;
  const allComplete = completion.allComplete;
  // Show the share-celebration only on the FIRST full completion, not on re-saves.
  const firstComplete = allComplete && !(state.currentUser && state.currentUser.predictions_submitted_at);

  const btn = document.getElementById('sp-submit-btn');
  const originalBtnHtml = btn ? btn.innerHTML : null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ti ti-loader-2" style="animation: spin 0.8s linear infinite;"></i><span>${t('groups.savingPicks')}</span>`;
  }

  try {
    // v2.9.2: GUARANTEED save on submit. Don't rely solely on the debounced
    // auto-save (a 600ms timer that can be interrupted by fast navigation or the
    // app being backgrounded on mobile) — explicitly persist the third-place
    // advancers + the full bracket here so picks can never be lost just because
    // the timer didn't fire. _spCacheSave keeps a local backup for auto-heal.
    _spCacheSave();
    // v2.9.12: also write the durable SERVER backup SYNCHRONOUSLY on submit (the
    // _spCacheSave timer is 1.5s and fast navigation can cancel it). This is the
    // guarantee that the on-load auto-heal can always recover the bracket even if
    // the live save below hits a transient PGRST202 window.
    try { await _spBackupToServer(_spCacheSnapshot()); } catch (_) {}
    // v2.9.12: VERIFY the bracket actually persisted (read-back from the DB) when
    // the user has bracket picks. This is the guarantee that re-entering after the
    // earlier bug can't silently fail again — if we can't confirm it landed, we
    // tell the user honestly instead of showing a false "saved/ALL SET".
    let bracketPersisted = true;
    try {
      if ((spState.thirdPlaceAdvancers || []).length === 8) await _spSaveThirdPlaceInner();
      const inMem = Object.keys(spState.bracketPicks || {}).length;
      if (inMem) bracketPersisted = await spSaveBracketVerified(inMem);
    } catch (e) { console.warn('[spSubmitPredictions] explicit save warning:', e); bracketPersisted = false; }
    if (!bracketPersisted) {
      // Restore the button and stop — do NOT mark submitted / show success on an
      // unconfirmed bracket. Picks are backed up (local + server) so nothing is
      // lost; the user just retries when the server is reachable again.
      if (btn && originalBtnHtml != null) { btn.disabled = false; btn.innerHTML = originalBtnHtml; }
      showToast(t('bracketSave.retryLater'), 'error');
      return;
    }

    if (allComplete) {
      await spMarkPredictionsSubmitted('summary-save');
    } else {
      // Partial save - don't set predictions_submitted_at so the dashboard
      // stays in "partial" mode with the Continue CTA. Surface what's left.
      const bits = [];
      if (incompleteGroups.length > 0) bits.push(t('betting.groupsIncomplete', { letters: incompleteGroups.join(', ') }));
      if (!completion.bracketComplete) bits.push(t('dashboard.continueCta.bracket'));
      if (missingWinner) bits.push(t('betting.winnerRequired'));
      if (completion.missingTopScorer) bits.push(t('dashboard.continueCta.topScorer'));
      showToast(t('betting.partialSaveHint', { details: bits.join(' · ') }), 'info');
    }

    goToDashboard();
    if (firstComplete) openBracketShareCelebration();
  } catch (err) {
    console.error('spSubmitPredictions err:', err);
    showToast(t('errors.unexpected'), 'error');
    if (btn && originalBtnHtml !== null) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
  }
}

async function spShowLockedView() {
  await spLoadExistingPicks();
  const el = document.getElementById('sp-locked-content');
  // Build a read-only render
  let html = '';
  // Groups
  html += `<div class="sp-summary-card">
    <div class="sp-summary-section-title">${t('betting.summary.groups')}</div>`;
  WC2026_GROUP_LETTERS.forEach(letter => {
    const positions = spState.groupPositions[letter] || [];
    html += `<div style="margin-bottom:8px;">
      <div style="font-weight:600;color:#d9b46a;font-size:12px;">${t('groups.group')} ${letter}</div>
      ${[0,1,2,3].map(i => {
        const code = positions[i];
        return `<div class="sp-summary-row">
          <span class="sr-pos">${i+1}.</span>
          <span class="sr-flag">${code ? getCountryFlag(code) : '—'}</span>
          <span class="sr-value">${code ? getTeamName(code) : '—'}</span>
        </div>`;
      }).join('')}
    </div>`;
  });
  html += '</div>';

  // Bracket - v2.5.75: read-only horizontal tree (same widget as the summary
  // + bracket-view modal) instead of a flat per-round list.
  html += `<div class="sp-summary-card">
    <div class="sp-summary-section-title sp-summary-title-row">
      <span>${t('betting.summary.bracket')}</span>
      <span class="sp-scroll-chip">${t('bracketView.scrollChip')}</span>
    </div>
    <div class="sp-bv-side-tabs sp-summary-bv-tabs">
      <button class="sp-bv-side-tab active" data-side="full" onclick="setSpSummaryBracketSide('full')">${t('bracketView.full')}</button>
      <button class="sp-bv-side-tab" data-side="left" onclick="setSpSummaryBracketSide('left')">${t('bracketView.leftSide')}</button>
      <button class="sp-bv-side-tab" data-side="right" onclick="setSpSummaryBracketSide('right')">${t('bracketView.rightSide')}</button>
    </div>
    <div class="sp-bracket-view-scroll" id="sp-summary-bracket-scroll">
      <div class="sp-bracket-tree" id="sp-summary-bracket-tree" data-side="full">${_spBuildBracketTreeHtml()}</div>
    </div>
  </div>`;

  // Winner
  const w = spState.tournamentWinner;
  html += `<div class="sp-summary-card">
    <div class="sp-summary-section-title">${t('betting.summary.winner')}</div>
    <div class="sp-summary-row">
      <span class="sr-flag" style="font-size:28px;">${w ? getCountryFlag(w) : '—'}</span>
      <span class="sr-value" style="font-size:17px;">${w ? getTeamName(w) : '—'}</span>
    </div>
  </div>`;
  el.innerHTML = html;
  showScreen('sp-locked-screen');
}

// ============================================================
// AUTO-LOCK POOL when first match has started
// ============================================================
async function spAutoLockPoolIfNeeded() {
  // v2.4: applies to BOTH single_phase and two_phase pools - the soft lock
  // (block all edits once the tournament starts) is mode-agnostic. For
  // two_phase pools this only affects group editing; the knockout-stage
  // flow remains gated by its own legacy admin lock.
  if (!state.currentPool || _poolGraceActive(state.currentPool) || isPoolWriteLocked()) return;
  if (!supabaseClient) return;

  try {
    // Preferred: server-side autolock_pool_if_started RPC (it re-verifies a real
    // match has actually kicked off, so it can't lock arbitrarily). Falls back to
    // the legacy client-side check + direct update only when the RPC isn't deployed.
    const code = _currentRecoveryCode();
    if (code) {
      const { data: res, error: rpcErr } = await supabaseClient.rpc('autolock_pool_if_started', { p_code: code });
      if (!rpcErr) {
        if (res && res.locked) state.currentPool.locked_at = state.currentPool.locked_at || new Date().toISOString();
        return;
      }
      if (!_rpcMissing(rpcErr)) { return; }  // deployed but errored -> don't double-write
      // RPC absent -> fall through to the legacy direct write below.
    }

    const { data: anyStarted } = await supabaseClient.from('matches')
      .select('id, status')
      .in('status', ['IN_PLAY', 'PAUSED', 'FINISHED', 'LIVE', 'started', 'finished'])
      .limit(1);
    if (anyStarted && anyStarted.length > 0) {
      const lockTs = new Date().toISOString();
      const { error } = await supabaseClient.from('pools')
        .update({ locked_at: lockTs })
        .eq('id', state.currentPool.id);
      if (!error) {
        state.currentPool.locked_at = lockTs;
      }
    }
  } catch (e) { /* migration may not be applied yet */ }
}

// ============================================================
// PHASE 3: LEADERBOARD - hypothetical bracket viewer
// ============================================================
async function showUserHypotheticalBracket(userId, userName) {
  if (!supabaseClient) return;
  try {
    // Load groups + bracket + winner + top scorer + chosen 3rd-place advancers
    const [gpp, kp, twp, tsp, tpp] = await Promise.all([
      supabaseClient.from('group_position_picks').select('*').eq('user_id', userId),
      supabaseClient.from('knockout_picks').select('*').eq('user_id', userId).not('bracket_position', 'is', null),
      supabaseClient.from('tournament_winner_picks').select('*').eq('user_id', userId).maybeSingle(),
      supabaseClient.from('top_scorer_picks').select('*').eq('user_id', userId).maybeSingle(),
      supabaseClient.from('sp_third_place_picks').select('group_letter').eq('user_id', userId)
    ]);
    const chosenThird = (tpp && tpp.data ? tpp.data.map(r => r.group_letter) : []);

    const positions = {};
    (gpp.data || []).forEach(p => {
      if (!positions[p.group_letter]) positions[p.group_letter] = [null,null,null,null];
      positions[p.group_letter][p.position - 1] = p.team_code;
    });
    const bracket = {};
    // knockout_picks stores the team in predicted_winner (no team_code column);
    // keep team_code as a defensive fallback for any legacy row.
    (kp.data || []).forEach(p => { bracket[p.bracket_position] = p.predicted_winner || p.team_code; });
    const winner = twp.data ? twp.data.team_code : null;
    const topScorer = tsp.data ? tsp.data : null;

    document.getElementById('hypo-bracket-title').textContent =
      t('leaderboard.bracketOfTitle', { name: userName || '' });

    // Render content
    let html = '';
    if (Object.keys(positions).length > 0) {
      html += `<div class="sp-summary-card"><div class="sp-summary-section-title">${t('betting.summary.groups')}</div>`;
      WC2026_GROUP_LETTERS.forEach(letter => {
        if (!positions[letter]) return;
        html += `<div style="margin-bottom:8px;">
          <div style="font-weight:600;color:#d9b46a;font-size:12px;">${t('groups.group')} ${letter}</div>`;
        positions[letter].forEach((code, i) => {
          html += `<div class="sp-summary-row">
            <span class="sr-pos">${i+1}.</span>
            <span class="sr-flag">${code ? getCountryFlag(code) : '—'}</span>
            <span class="sr-value">${code ? getTeamName(code) : '—'}</span>
          </div>`;
        });
        html += '</div>';
      });
      html += '</div>';
    }

    if (Object.keys(bracket).length > 0) {
      // v2.5.68: build the bracket from the official WC 2026 R32 structure
      // using this user's predicted group positions + bracket picks. Mirrors
      // spGetBracketStructure() but parameterised on the loaded `positions`
      // and `bracket` instead of the live spState.
      const getMatchWinner = (pos) => bracket[pos];
      const resolveFeed = (feed, thirdSlots, slotPos) => {
        if (feed.type === 'gp') {
          const arr = positions[feed.g];
          return arr ? arr[feed.p - 1] : null;
        }
        if (feed.type === 'third') {
          const g = thirdSlots.assignment[slotPos];
          if (!g) return null;
          const arr = positions[g];
          return arr ? arr[2] : null;
        }
        return null;
      };
      // v2.5.80: use THIS user's chosen 8 third-place advancers (matched to
      // the R32 slots), exactly like the live flow. Fall back to the greedy
      // default only if they haven't chosen 8 / the set can't be matched.
      const matched = chosenThird.length === 8 ? _spMatchThirdPlace(chosenThird) : null;
      const assignment = matched || _spGreedyThirdPlaceSlots();
      const thirdSlots = { assignment };

      const r32 = [];
      for (let pos = 1; pos <= 16; pos++) {
        const [a, b] = SP_R32_DEF[pos];
        r32.push({ pos, home: resolveFeed(a, thirdSlots, pos), away: resolveFeed(b, thirdSlots, pos) });
      }
      const r16 = Object.entries(SP_R16_DEF).map(([pos, [a, b]]) => ({
        pos: +pos, home: getMatchWinner(a), away: getMatchWinner(b)
      }));
      const qf = Object.entries(SP_QF_DEF).map(([pos, [a, b]]) => ({
        pos: +pos, home: getMatchWinner(a), away: getMatchWinner(b)
      }));
      const sf = Object.entries(SP_SF_DEF).map(([pos, [a, b]]) => ({
        pos: +pos, home: getMatchWinner(a), away: getMatchWinner(b)
      }));
      const [fa, fb] = SP_FINAL_DEF[31];
      const fin = { pos: 31, home: getMatchWinner(fa), away: getMatchWinner(fb) };

      html += `<div class="sp-summary-card"><div class="sp-summary-section-title">${t('betting.summary.bracket')}</div>`;
      [['knockout.r32', r32], ['knockout.r16', r16], ['knockout.qf', qf], ['knockout.sf', sf], ['knockout.final', [fin]]].forEach(([key, matches]) => {
        html += `<div style="font-weight:600;color:#d9b46a;font-size:12px;margin:6px 0 3px;">${t(key)}</div>`;
        matches.forEach(m => {
          const w = getMatchWinner(m.pos);
          html += `<div class="sp-summary-row">
            <span class="sr-flag">${w ? getCountryFlag(w) : '—'}</span>
            <span class="sr-value">${w ? getTeamName(w) : '—'}</span>
          </div>`;
        });
      });
      html += '</div>';
    }

    if (winner) {
      html += `<div class="sp-summary-card">
        <div class="sp-summary-section-title">${t('betting.summary.winner')}</div>
        <div class="sp-summary-row">
          <span class="sr-flag" style="font-size:28px;">${getCountryFlag(winner)}</span>
          <span class="sr-value" style="font-size:17px;">${getTeamName(winner)}</span>
        </div>
      </div>`;
    }

    if (topScorer) {
      html += `<div class="sp-summary-card">
        <div class="sp-summary-section-title">${t('betting.summary.topScorer')}</div>
        <div class="sp-summary-row">
          <span class="sr-flag">${getCountryFlag(topScorer.team_code)}</span>
          <span class="sr-value">${escapeHtml(topScorer.player_name || '—')}</span>
        </div>
      </div>`;
    }

    if (!html) {
      html = `<div style="text-align:center;color:rgba(255,255,255,0.5);padding:24px;">${t('leaderboard.noPicks')}</div>`;
    }

    document.getElementById('hypo-bracket-content').innerHTML = html;
    document.getElementById('hypo-bracket-modal').style.display = 'flex';
  } catch (err) {
    console.error('Hypothetical bracket load error:', err);
    showToast(t('errors.unexpected'), 'error');
  }
}

function closeHypoBracket() {
  document.getElementById('hypo-bracket-modal').style.display = 'none';
}

// ============================================================
// Patch dashboard betting entry to route by mode
// ============================================================
const _origStartGroupBetting = typeof startGroupBetting === 'function' ? startGroupBetting : null;
window.startBettingFromDashboard = function() {
  if (state.currentPool && state.currentPool.betting_mode === 'single_phase') {
    startSinglePhaseBetting();
  } else if (_origStartGroupBetting) {
    _origStartGroupBetting();
  }
};

// Make the wizard the entry point: keep original createPool() exported as
// adminCreatePoolLegacy for safety; new flow uses startPoolWizard.
window.adminCreatePoolLegacy = createPool;

// ============================================================
// v2.1.0 - DRAMATIC RECOVERY CODE SCREEN
// ============================================================

const rcState = {
  mode: 'created',          // 'created' | 'joined' | 'view'
  code: null,
  poolName: '',
  saved: false,             // user copied/emailed/downloaded?
  savedScreenshot: false,   // v2.5.13: definitive save - skips warning modal
  confettiTimer: null
};

function rcFormatCode(raw) {
  if (!raw) return '';
  const clean = raw.replace(/-/g, '');
  return clean.match(/.{1,4}/g)?.join('-') || raw;
}

function rcRawCode(raw) {
  return (raw || '').replace(/-/g, '');
}

// Public entry point
function showRecoveryCode(mode, recoveryCode, poolName) {
  rcState.mode = mode || 'created';
  rcState.code = recoveryCode;
  rcState.poolName = poolName || (state.currentPool && state.currentPool.name) || 'FriendlyBet';
  rcState.saved = (mode === 'view'); // view-mode: don't gate continue
  rcState.savedScreenshot = false;   // v2.5.13: reset definitive-save flag

  // Set title/subtitle by mode
  const titleEl = document.getElementById('rc-hero-title');
  const subEl = document.getElementById('rc-hero-subtitle');
  const continueBtn = document.getElementById('rc-continue-btn');
  const codeCard = document.getElementById('rc-cred-card');

  if (mode === 'view') {
    titleEl.textContent = t('recovery.viewMode.title');
    subEl.style.display = 'none';
    continueBtn.querySelector('span').textContent = t('recovery.button.close');
    continueBtn.dataset.rcAction = 'continue';
    // Reduce animation for view mode
    if (codeCard) codeCard.style.animation = 'none';
  } else {
    subEl.style.display = '';
    if (mode === 'joined') {
      titleEl.textContent = t('recovery.joined.title');
      subEl.textContent = t('recovery.joined.subtitle');
    } else {
      titleEl.textContent = t('recovery.poolCreated.title');
      subEl.textContent = t('recovery.poolCreated.subtitle');
    }
    // v2.4.4: green button is always "Continue to pool". Clicking it opens
    // the "Did you save the code?" modal so the save step is explicit.
    continueBtn.querySelector('span').textContent = t('recovery.button.continue');
    continueBtn.dataset.rcAction = 'continueWithConfirm';
    if (codeCard) codeCard.style.animation = '';
  }

  // Set code (with reveal animation in non-view modes)
  const codeEl = document.getElementById('rc-code-text');
  const formatted = rcFormatCode(rcState.code);
  if (mode === 'view') {
    codeEl.textContent = formatted;
  } else {
    rcAnimateCodeReveal(codeEl, formatted);
  }

  // Reset action button states
  ['rc-btn-screenshot', 'rc-btn-copy', 'rc-btn-email', 'rc-btn-download'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('rc-success');
  });
  const copyLabel = document.querySelector('#rc-btn-copy .rc-action-label');
  if (copyLabel) copyLabel.textContent = t('recovery.button.copy');

  // Confetti only in celebration modes
  rcClearConfetti();
  if (mode !== 'view') {
    setTimeout(() => rcCreateConfetti(), 250);
  }

  // v2.5.37: show the admin-help note only for regular members (joined a
  // pool). Admins/view-mode already know they can self-serve everything.
  const adminHelpNote = document.getElementById('rc-admin-help-note');
  if (adminHelpNote) adminHelpNote.style.display = (mode === 'joined') ? '' : 'none';

  // Render the scannable login QR (encodes ?login=CODE). Async: fill the on-screen img
  // and cache the data URL so the downloadable image can embed it too.
  rcState.qrDataUrl = null;
  const qrImg = document.getElementById('rc-qr-img');
  if (qrImg) { qrImg.removeAttribute('src'); }
  const qrCard = document.getElementById('rc-qr-card');
  if (qrCard) qrCard.style.display = '';
  _qrDataUrl(_rcLoginUrl(rcState.code)).then((durl) => {
    rcState.qrDataUrl = durl;
    const el = document.getElementById('rc-qr-img');
    if (el) el.src = durl;
  }).catch((e) => {
    // CDN lib unavailable (offline/blocked) — hide the card so there's no broken image;
    // the code text + save buttons below still work as the floor.
    console.warn('login QR render failed:', e);
    const card = document.getElementById('rc-qr-card');
    if (card) card.style.display = 'none';
  });

  showScreen('screen-recovery-code');
}

function rcAnimateCodeReveal(el, finalText) {
  // Cycle through random A-Z characters for ~700ms, then settle
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const positions = finalText.length;
  el.classList.add('rc-reveal');
  const start = performance.now();
  const duration = 700;

  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Once a position's "settle threshold" has passed, show the real char
    let out = '';
    for (let i = 0; i < positions; i++) {
      const real = finalText[i];
      // Dashes and known separators settle immediately
      if (real === '-' || real === ' ') { out += real; continue; }
      const settleAt = (i / positions) * 0.85;
      if (progress >= settleAt) {
        out += real;
      } else {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    el.textContent = out;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = finalText;
      el.classList.remove('rc-reveal');
    }
  };
  requestAnimationFrame(tick);
}

function rcCreateConfetti() {
  // v2.1.2: confetti removed - the slide-in + pulse on the code card is
  // already the celebration cue. No particles.
  rcClearConfetti();
}

function rcClearConfetti() {
  const layer = document.getElementById('rc-confetti-layer');
  if (layer) layer.innerHTML = '';
  if (rcState.confettiTimer) {
    clearTimeout(rcState.confettiTimer);
    rcState.confettiTimer = null;
  }
}

function rcCopy() {
  const raw = rcRawCode(rcState.code);
  const btn = document.getElementById('rc-btn-copy');
  const label = btn.querySelector('.rc-action-label');
  const originalLabel = t('recovery.button.copy');

  const finish = () => {
    rcState.saved = true;
    btn.classList.add('rc-success');
    label.textContent = t('recovery.button.copied');
    showToast(t('recovery.toast.copied'), 'success');
    setTimeout(() => {
      btn.classList.remove('rc-success');
      label.textContent = originalLabel;
    }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(raw).then(finish).catch(() => rcCopyFallback(raw, finish));
  } else {
    rcCopyFallback(raw, finish);
  }
}

function rcCopyFallback(text, onSuccess) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onSuccess && onSuccess();
  } catch (e) {
    showToast(t('shareModal.copyError') || 'Copy failed', 'error');
  }
}

function rcEmail() {
  const code = rcFormatCode(rcState.code);
  const poolName = rcState.poolName;
  const subject = t('recovery.email.subject');
  const body = t('recovery.email.body', { code, poolName });
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const fullText = `${subject}\n\n${body}`;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  // v2.5.35: always copy the full content to clipboard as a backup so even
  // if the OS has no mailto handler the user has the message ready to paste.
  let clipboardOk = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText);
      clipboardOk = true;
    } else {
      rcCopyFallback(fullText, () => { clipboardOk = true; });
    }
  } catch (e) { /* fall through */ }

  // v2.5.35: device-aware open path.
  //   Mobile - navigate the current page to the mailto: URL. The phone's OS
  //   intercepts and opens the native mail app; nothing visible changes in
  //   the browser (no blank tab to clean up).
  //   Desktop - synthesize an <a target="_blank"> click. If a mailto handler
  //   is registered (or the user has Gmail set as default), a new tab opens
  //   the compose window with subject + body prefilled. If not, the new tab
  //   is blank, but the clipboard already has the full message.
  if (isMobile) {
    window.location.href = mailtoUrl;
  } else {
    const a = document.createElement('a');
    a.href = mailtoUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  showToast(t(clipboardOk ? 'recovery.toast.emailOpenedWithBackup' : 'recovery.toast.emailOpened'), 'success');

  rcState.saved = true;
  const btn = document.getElementById('rc-btn-email');
  if (btn) {
    btn.classList.add('rc-success');
    setTimeout(() => btn.classList.remove('rc-success'), 2000);
  }
}

function rcDownload() {
  const code = rcFormatCode(rcState.code);
  const poolName = rcState.poolName || 'FriendlyBet';
  const now = new Date();
  const created = now.toLocaleString(currentLanguage === 'he' ? 'he-IL' : 'en-US');

  const header = t('recovery.txt.header');
  const codeLabel = t('recovery.txt.codeLabel');
  const poolLabel = t('recovery.txt.poolLabel');
  const createdLabel = t('recovery.txt.createdLabel');
  const important = t('recovery.txt.important');
  const w1 = t('recovery.txt.warning1');
  const w2 = t('recovery.txt.warning2');
  const w3 = t('recovery.txt.warning3');
  const loginAt = t('recovery.txt.loginAt');

  const lines = [
    '====================================',
    '   ' + header,
    '====================================',
    '',
    codeLabel,
    '',
    '   ' + code,
    '',
    poolLabel + ' ' + poolName,
    createdLabel + ' ' + created,
    '',
    '! ' + important,
    '   - ' + w1,
    '   - ' + w2,
    '   - ' + w3,
    '   - ' + loginAt + ' https://friendlybet.live',
    '',
    '===================================='
  ];
  const content = lines.join('\n');

  const safePool = (poolName || 'pool').replace(/[^a-zA-Z0-9֐-׿_-]+/g, '_').slice(0, 40);
  const filename = `friendlybet-recovery-${safePool}.txt`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  rcState.saved = true;
  const btn = document.getElementById('rc-btn-download');
  btn.classList.add('rc-success');
  setTimeout(() => btn.classList.remove('rc-success'), 2000);
  showToast(t('recovery.toast.downloaded'), 'success');
}

function rcContinue() {
  if (rcState.mode === 'view') {
    rcClearConfetti();
    goToDashboard();
    return;
  }

  // v2.5.13: if the user successfully downloaded the screenshot PNG, skip
  // the "Did you save?" confirmation modal - the download is an unambiguous
  // save action. Other paths (Email myself, legacy copy) remain uncertain
  // and still trigger the confirmation.
  if (rcState.savedScreenshot) {
    rcProceedToNext();
    return;
  }

  // v2.4.4: open the "Did you save the code?" confirmation modal so the save
  // step is explicit. The user can answer Yes (continue) or No (close, save).
  const modal = document.getElementById('rc-warning-modal');
  if (modal) modal.style.display = 'flex';
}

function rcCloseModal() {
  const modal = document.getElementById('rc-warning-modal');
  if (modal) modal.style.display = 'none';
  // Focus the credential card so it's visually obvious where to act
  const card = document.getElementById('rc-cred-card');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.animation = 'none';
    // Force reflow to restart the pulse animation
    void card.offsetWidth;
    card.style.animation = '';
  }
}

function rcContinueAnyway() {
  const modal = document.getElementById('rc-warning-modal');
  if (modal) modal.style.display = 'none';
  rcProceedToNext();
}

async function rcProceedToNext() {
  rcClearConfetti();
  // Joiner: finalize registration in DB, then go to dashboard
  if (rcState.mode === 'joined' && state.pendingNickname && state.currentPool) {
    await completeRegistration();
    return;
  }
  // Admin ('created') and view mode: straight to dashboard (no share screen)
  goToDashboard();
}

function rcViewFromMenu() {
  closeMenu && closeMenu();
  const code = state.pendingRecoveryCode || localStorage.getItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE);
  if (!code) {
    showToast(t('recoveryDisplay.notFound'), 'error');
    return;
  }
  showRecoveryCode('view', code, state.currentPool && state.currentPool.name);
}

// ----- Hooks into existing flows -----

// v2.1.1: Admin already saw the recovery screen BEFORE share-pool;
//         this button now goes straight to the dashboard.
function continueFromSharePool() {
  goToDashboard();
}

// 2. Joiner flow: override the old completeRegistration trigger.
//    The OLD recovery-code-screen had a "I saved, continue" button calling
//    completeRegistration() directly. We re-route via the NEW screen.
const _origSubmitNickname = typeof submitNickname === 'function' ? submitNickname : null;
async function submitNicknameAndShowRecovery() {
  // Wrapper preserved for any future hook; the OLD function still drives.
  if (_origSubmitNickname) return _origSubmitNickname();
}

// v2.4: device detection for screenshot instructions
function _fbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/Android/i.test(ua)) {
    if (/SAMSUNG|SM-/i.test(ua)) return 'android-samsung';
    return 'android';
  }
  if (/Macintosh/i.test(ua)) return 'mac';
  if (/Windows/i.test(ua)) return 'windows';
  return 'desktop';
}

// v2.5.6: dynamically load html2canvas from CDN on first use so we don't
// block initial page load. Cached promise so concurrent calls share one load.
function _ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (window._h2cPromise) return window._h2cPromise;
  window._h2cPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve();
    s.onerror = () => {
      window._h2cPromise = null;
      reject(new Error('Failed to load html2canvas'));
    };
    document.head.appendChild(s);
  });
  return window._h2cPromise;
}

// v2.5.6: build the offscreen "recovery card" that html2canvas captures.
// Inline styles only - html2canvas reads computed styles from the live DOM,
// so a self-contained element with all rules inlined renders predictably.
function _rcBuildCardElement() {
  // Outer wrapper: a SOLID dark background that fills the entire exported image,
  // so the rounded card's corners never render as transparent (white) edges.
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position: fixed',
    'left: -9999px',
    'top: 0',
    'width: 640px',
    'padding: 30px',
    'box-sizing: border-box',
    'background: #07080c'
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'width: 100%',
    'padding: 40px 40px 36px',
    'background: linear-gradient(135deg, #0f0e0b 0%, #16140f 58%, #1d2b44 100%)',
    'color: #fff',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'border: 1px solid rgba(217,180,106,0.35)',
    'border-radius: 24px',
    'box-sizing: border-box',
    'text-align: center'
  ].join(';');

  const code = rcFormatCode(rcState.code);
  const pool = rcState.poolName || '—';
  // The QR slot is left empty here — html2canvas renders the white tile but does
  // NOT rasterise <img> data-URIs or live <canvas> content (both came out blank).
  // rcScreenshot measures this slot and composites the QR bitmap straight onto the
  // rendered output canvas afterwards.
  const qr = rcState.qrDataUrl
    ? `<div style="margin: 0 auto;">
         <div style="display:inline-block; background:#fff; padding:14px; border-radius:16px;">
           <div id="rc-export-qr" style="width:220px; height:220px; display:block;"></div>
         </div>
         <div style="margin-top:12px; font-size:13px; color:rgba(255,255,255,0.62);">${t('recovery.qr.scanToLogin')}</div>
       </div>`
    : '';
  card.innerHTML = `
    <div style="font-size: 28px; font-weight: 800; color: #d9b46a; letter-spacing: 0.5px; margin-bottom: 26px;">
      ⚽ FriendlyBet
    </div>
    ${qr}
    <div style="margin-top: 30px; font-size: 12px; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 2px;">
      ${t('recovery.screenshot.codeLabel')}
    </div>
    <div style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 34px; font-weight: 700; letter-spacing: 3px; color: #d9b46a; margin-top: 10px; word-break: break-all;">
      ${code}
    </div>
    <div style="margin-top: 26px; font-size: 12px; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 2px;">
      Pool
    </div>
    <div style="font-size: 22px; font-weight: 600; margin-top: 6px;">
      ${pool}
    </div>
    <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; color: rgba(255,255,255,0.45);">
      ${t('recovery.txt.loginAt')} friendlybet.live
    </div>
  `;
  wrap.appendChild(card);
  return wrap;
}

function _fbScreenshotInstructionsHtml(device) {
  const k = (txt) => `<span class="rc-key-combo">${txt}</span>`;
  const list = [];
  switch (device) {
    case 'ios':
      list.push(t('recovery.screenshot.ios1', { k1: k('Side button'), k2: k('Volume Up') }));
      list.push(t('recovery.screenshot.ios2'));
      list.push(t('recovery.screenshot.ios3'));
      break;
    case 'android-samsung':
      list.push(t('recovery.screenshot.samsung1', { k1: k('Power'), k2: k('Volume Down') }));
      list.push(t('recovery.screenshot.android2'));
      list.push(t('recovery.screenshot.android3'));
      break;
    case 'android':
      list.push(t('recovery.screenshot.android1', { k1: k('Power'), k2: k('Volume Down') }));
      list.push(t('recovery.screenshot.android2'));
      list.push(t('recovery.screenshot.android3'));
      break;
    case 'mac':
      list.push(t('recovery.screenshot.mac1', { k1: k('Cmd'), k2: k('Shift'), k3: k('4') }));
      list.push(t('recovery.screenshot.mac2'));
      break;
    case 'windows':
      list.push(t('recovery.screenshot.win1', { k1: k('Win'), k2: k('Shift'), k3: k('S') }));
      list.push(t('recovery.screenshot.win2'));
      break;
    default:
      list.push(t('recovery.screenshot.generic1'));
      list.push(t('recovery.screenshot.generic2'));
  }
  return '<ol>' + list.map(li => `<li>${li}</li>`).join('') + '</ol>';
}

// v2.5.35: rcScreenshot now bypasses the preview modal entirely. The
// previous flow (modal → preview → "Save" button) was friction the user
// didn't want. Now: click → generate PNG → download → toast. Done.
async function rcScreenshot() {
  const btn = document.getElementById('rc-btn-screenshot');
  try {
    await _ensureHtml2Canvas();
    // Make sure the login QR is ready so the saved image includes it.
    if (!rcState.qrDataUrl) {
      try { rcState.qrDataUrl = await _qrDataUrl(_rcLoginUrl(rcState.code)); } catch (_) {}
    }
    const SCALE = 2;
    const card = _rcBuildCardElement();
    document.body.appendChild(card);
    // Measure the QR slot's position within the card (CSS px, relative to the card),
    // so we can composite the QR bitmap onto the rendered canvas at the exact spot.
    let qrRect = null;
    const qrSlot = card.querySelector('#rc-export-qr');
    if (qrSlot && rcState.qrDataUrl) {
      const cardRect = card.getBoundingClientRect();
      const slotRect = qrSlot.getBoundingClientRect();
      qrRect = { x: slotRect.left - cardRect.left, y: slotRect.top - cardRect.top, w: slotRect.width, h: slotRect.height };
    }
    let canvas;
    try {
      canvas = await window.html2canvas(card, {
        backgroundColor: '#07080c',
        scale: SCALE,
        logging: false,
        useCORS: true
      });
    } finally {
      if (card.parentNode) card.parentNode.removeChild(card);
    }
    // Composite the QR straight onto the output canvas (html2canvas renders neither
    // <img> data-URIs nor live <canvas> reliably, so we paint it ourselves).
    if (qrRect && rcState.qrDataUrl) {
      await new Promise((resolve) => {
        const im = new Image();
        im.onload = () => {
          try {
            const cx = canvas.getContext('2d');
            cx.setTransform(1, 0, 0, 1, 0, 0); // clear any residual transform html2canvas left
            cx.imageSmoothingEnabled = false;  // keep QR modules crisp
            cx.drawImage(im, qrRect.x * SCALE, qrRect.y * SCALE, qrRect.w * SCALE, qrRect.h * SCALE);
          } catch (_) {}
          resolve();
        };
        im.onerror = resolve;
        setTimeout(resolve, 1500);
        im.src = rcState.qrDataUrl;
      });
    }

    await new Promise((resolve) => {
      canvas.toBlob(blob => {
        if (!blob) { resolve(); return; }
        const filename = `friendlybet-recovery-${(rcState.code || 'code').replace(/-/g, '')}.png`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        resolve();
      }, 'image/png');
    });

    // Saved → skip the "Did you save?" gate when the user hits Continue.
    rcState.saved = true;
    rcState.savedScreenshot = true;
    if (btn) {
      btn.classList.add('rc-success');
      setTimeout(() => btn.classList.remove('rc-success'), 2000);
    }
    showToast(t('recovery.toast.screenshotDone'), 'success');
  } catch (err) {
    console.error('rcScreenshot failed:', err);
    showToast(t('errors.generic'), 'error');
  }
}

// Expose
window.showRecoveryCode = showRecoveryCode;
window.rcCopy = rcCopy;
window.rcEmail = rcEmail;
window.rcDownload = rcDownload;
window.rcScreenshot = rcScreenshot;
window.rcContinue = rcContinue;
// v2.5.39: topbar back arrow on screen-recovery-code. Goes straight to
// the dashboard without showing the "Did you save?" gate - if the user
// hits back, they presumably know what they\'re doing (they can always
// re-open the code from the menu).
function rcBackToDashboard() {
  rcClearConfetti();
  if (state.currentPool && state.currentUser) {
    goToDashboard();
  } else {
    showScreen('home-screen');
  }
}
window.rcBackToDashboard = rcBackToDashboard;
window.rcCloseModal = rcCloseModal;
window.rcContinueAnyway = rcContinueAnyway;
window.rcViewFromMenu = rcViewFromMenu;
window.continueFromSharePool = continueFromSharePool;

// ============================================================
// v2.4: KNOCKOUT FIRST-TIME WALKTHROUGH (one match at a time)
// ============================================================
// Active only on a user's first pass through the knockout stage. After that
// the regular bracket grid takes over. Used in BOTH single_phase (bracket
// positions 1..15) and two_phase (R32..F, 31 matches).

const koSingle = {
  mode: null,           // 'two-phase' | 'single-phase'
  idx: 0,               // current position in sequence
  sequence: [],         // ordered list of step descriptors
  advanceTimer: null
};

function _koTwoPhaseSequence() {
  const out = [];
  for (let i = 1; i <= 16; i++) out.push({ round: 'R32', id: `R32_M${i}` });
  for (let i = 1; i <= 8;  i++) out.push({ round: 'R16', id: `R16_M${i}` });
  for (let i = 1; i <= 4;  i++) out.push({ round: 'QF',  id: `QF_M${i}`  });
  for (let i = 1; i <= 2;  i++) out.push({ round: 'SF',  id: `SF_M${i}`  });
  out.push({ round: 'FINAL', id: 'FINAL_M1' });
  return out;
}

function _koSinglePhaseSequence() {
  // v2.5.68: WC 2026 official format - 31 picks total
  // (16 R32 + 8 R16 + 4 QF + 2 SF + 1 Final).
  const out = [];
  for (let i = 1;  i <= 16; i++) out.push({ round: 'R32',   pos: i });
  for (let i = 17; i <= 24; i++) out.push({ round: 'R16',   pos: i });
  for (let i = 25; i <= 28; i++) out.push({ round: 'QF',    pos: i });
  for (let i = 29; i <= 30; i++) out.push({ round: 'SF',    pos: i });
  out.push({ round: 'FINAL', pos: 31 });
  return out;
}

function _koSingleRoundLabel(round) {
  return t('knockoutEx.' + ({
    R32: 'r32Full', R16: 'r16Full', QF: 'qfFull', SF: 'sfFull', FINAL: 'finalFull'
  }[round] || 'r32Full'));
}

function _koSinglePoints(round) {
  if (koSingle.mode === 'two-phase') {
    return (ROUND_INFO && ROUND_INFO[round] && ROUND_INFO[round].points) || 1;
  }
  // single-phase scoring rules — return the stage value from the pool's
  // scoring_rules. v2.5.72: the FINAL value is the full champion reward
  // (there is no separate tournament_winner bonus anymore).
  const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
  // v2.6.17: doubling-progression defaults mirror DEFAULT_SCORING_RULES.single_phase
  // (R32=2, R16=4, QF=8, SF=16, Final=32).
  return ({
    R32: rules.round_of_32 ?? 2,
    R16: rules.round_of_16 ?? 4,
    QF:  rules.quarter_final ?? 8,
    SF:  rules.semi_final ?? 16,
    FINAL: rules.final ?? 32
  })[round] ?? 0;
}

function _koSingleCurrentTeams() {
  const step = koSingle.sequence[koSingle.idx];
  if (!step) return { home: null, away: null, label: '' };

  if (koSingle.mode === 'two-phase') {
    const match = (knockoutState.matches[step.round] || []).find(m => m.id === step.id);
    if (!match) return { home: null, away: null, label: t('knockoutEx.matchNum', { n: koSingle.idx + 1 }) };
    return {
      home: match.team1,
      away: match.team2,
      label: step.round === 'FINAL' ? t('knockoutEx.finalLabel') : t('knockoutEx.matchNum', { n: match.number })
    };
  }

  // single-phase: walk the bracket structure
  const struct = spGetBracketStructure();
  const all = [...struct.r32, ...struct.r16, ...struct.qf, ...struct.sf, struct.final];
  const m = all.find(x => x.pos === step.pos);
  if (!m) return { home: null, away: null, label: '' };
  return {
    home: m.home,
    away: m.away,
    label: step.round === 'FINAL' ? t('knockoutEx.finalLabel') : t('knockoutEx.matchNum', { n: step.pos })
  };
}

function _koSingleCurrentPick() {
  const step = koSingle.sequence[koSingle.idx];
  if (!step) return null;
  if (koSingle.mode === 'two-phase') return knockoutState.picks[step.id] || null;
  return spState.bracketPicks[step.pos] || null;
}

function _koSingleSetPick(teamCode) {
  const step = koSingle.sequence[koSingle.idx];
  if (!step) return;
  if (koSingle.mode === 'two-phase') {
    knockoutState.picks[step.id] = teamCode;
    propagateKnockoutBracket();
    autoSaveKnockoutPicks();
  } else {
    // v2.10: in recovery the champion is LOCKED — the FINAL winner (pos 31) must be
    // the user's already-saved champion (also enforced server-side). Block other picks.
    if (spReopenActive && step.pos === 31 && spState.tournamentWinner && teamCode !== spState.tournamentWinner) {
      showToast(t('reopen.championLocked', { team: (typeof teamName === 'function' ? teamName(spState.tournamentWinner) : spState.tournamentWinner) }), 'error');
      koSingleRender();
      return;
    }
    const prev = spState.bracketPicks[step.pos];
    // v2.9.10: warn before a change cascades away later-round picks.
    if (prev && prev !== teamCode) {
      const n = _spCountDownstream(step.pos);
      if (n > 0 && !confirm(t('betting.cascadeWarn', { n }))) { koSingleRender(); return; }
    }
    spState.bracketPicks[step.pos] = teamCode;
    if (prev && prev !== teamCode) spClearDownstream(step.pos);
    spAutoSaveBracket();
  }
}

function koSingleRender() {
  const step = koSingle.sequence[koSingle.idx];
  if (!step) return;

  // v2.10: persistent recovery note — the champion is locked; the final must lead to them.
  try {
    const note = document.getElementById('ko-reopen-note');
    if (note) {
      if (spReopenActive && spState.tournamentWinner) {
        const tn = (typeof teamName === 'function' ? teamName(spState.tournamentWinner) : spState.tournamentWinner);
        note.textContent = t('reopen.walkthroughNote', { team: tn });
        note.style.display = 'block';
      } else { note.style.display = 'none'; }
    }
  } catch (_) {}

  const { home, away, label } = _koSingleCurrentTeams();
  const pick = _koSingleCurrentPick();
  const total = koSingle.sequence.length;
  const pos = koSingle.idx + 1;

  document.getElementById('ko-single-round-label').textContent = _koSingleRoundLabel(step.round);
  document.getElementById('ko-single-progress-label').textContent = `${pos} / ${total}`;
  document.getElementById('ko-single-progress-fill').style.width = `${(pos / total) * 100}%`;

  // v2.5.0: the "view full bracket" floating button is always visible from
  // the first match - users want to see the full bracket layout before
  // committing to any pick. The button is declared visible in HTML.

  const points = _koSinglePoints(step.round);
  // v2.5.44: pool-aware multiplier (per-team override → category → default).
  // v2.5.48: when the pool uses default multipliers AND has no per-team
  // overrides, show the tier emoji + name + ×N. Once the admin customizes
  // anything, those labels would lie about which tier a number belongs to,
  // so we collapse to just ×N.
  const useMult = state.currentPool && state.currentPool.use_multipliers !== false;
  const showTierLabels = useMult && poolUsesDefaultMultipliers(state.currentPool);
  const formatMult = (m) => '×' + ((m % 1 === 0) ? m.toFixed(0) : m.toFixed(1));
  const tierMeta = (t) => t === 'favorite'  ? { emoji: '⭐', nameKey: 'poolSettings.multFav', cls: 'fav'  }
                       : t === 'contender' ? { emoji: '⚔️', nameKey: 'poolSettings.multCont', cls: 'cont' }
                       :                      { emoji: '🐶', nameKey: 'poolSettings.multUnd', cls: 'und'  };

  // v2.5.60: header label now reflects the multiplier when the pool uses
  // multipliers. With both teams having (potentially) different multipliers,
  // a correct pick earns a different total depending on which team you bet
  // on. We surface that as "X or Y points" if the totals differ, or fall
  // back to the flat "N points" label when they happen to match (or
  // multipliers are off).
  let headerPointsLabel;
  if (useMult && home && away) {
    const hMult = getPoolTeamMultiplier(state.currentPool, home);
    const aMult = getPoolTeamMultiplier(state.currentPool, away);
    const hPts = Math.round(points * hMult);
    const aPts = Math.round(points * aMult);
    if (hPts === aPts) {
      headerPointsLabel = t('knockoutFirst.pointsLabel', { n: hPts });
    } else {
      const lo = Math.min(hPts, aPts);
      const hi = Math.max(hPts, aPts);
      headerPointsLabel = t('knockoutFirst.pointsLabelRange', { min: lo, max: hi });
    }
  } else {
    headerPointsLabel = t('knockoutFirst.pointsLabel', { n: points });
  }

  const card = document.getElementById('ko-single-card');
  const teamHtml = (code, side) => {
    if (!code) {
      return `
        <button class="ko-single-team tbd" disabled>
          <span class="ko-single-flag">⏳</span>
          <span class="ko-single-info">
            <span class="ko-single-name">${t('knockoutEx.tbdTeam')}</span>
          </span>
          <span class="ko-single-check"><i class="ti ti-check"></i></span>
        </button>`;
    }
    const selected = pick === code ? ' selected' : '';
    let multBadge = '';
    if (useMult) {
      const mult = getPoolTeamMultiplier(state.currentPool, code);
      if (showTierLabels) {
        const tier = getTeamDefaultTier(code);
        const meta = tierMeta(tier);
        multBadge = `<span class="ko-single-mult ko-single-mult-${meta.cls}">
            <span class="ko-single-mult-emoji">${meta.emoji}</span>
            <span class="ko-single-mult-name">${t(meta.nameKey)}</span>
            <span class="ko-single-mult-x">${formatMult(mult)}</span>
          </span>`;
      } else {
        multBadge = `<span class="ko-single-mult">${formatMult(mult)}</span>`;
      }
    }
    // v2.5.59: name + badge wrapped in a flex-column info block so the
    // badge sits BELOW the name. Previously the badge sat to the right of
    // the name competing with the checkmark, which pushed the check
    // around depending on badge width (favorite/contender/underdog labels
    // are different lengths). Now the row stays stable: flag · info · check.
    return `
      <button class="ko-single-team${selected}" data-team="${code}">
        <span class="ko-single-flag">${getCountryFlag(code)}</span>
        <span class="ko-single-info">
          <span class="ko-single-name">${getTeamName(code)}</span>
          ${multBadge}
        </span>
        <span class="ko-single-check"><i class="ti ti-check"></i></span>
      </button>`;
  };

  // v2.5.72: on the FINAL match, clarify that the winner is the champion -
  // the points are awarded once (no separate champion bonus).
  let finalBonusLabel = '';
  if (step.round === 'FINAL') {
    finalBonusLabel = `<div class="ko-single-bonus">${t('knockoutFirst.finalIsChampion')}</div>`;
  }

  card.innerHTML = `
    <div class="ko-single-match-header">${label}</div>
    <div class="ko-single-points">${headerPointsLabel}</div>
    ${finalBonusLabel}
    <div class="ko-single-teams">
      ${teamHtml(home, 'home')}
      <div class="ko-single-vs">VS</div>
      ${teamHtml(away, 'away')}
    </div>
  `;

  // Bind clicks
  card.querySelectorAll('.ko-single-team').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-team');
      if (!code) return;
      _koSingleSetPick(code);
      koSingleRender(); // immediately show checkmark
      if (koSingle.advanceTimer) clearTimeout(koSingle.advanceTimer);
      koSingle.advanceTimer = setTimeout(() => {
        koSingleAdvance();
      }, 300);
    });
  });

  // Back button
  const backBtn = document.getElementById('ko-single-back-btn');
  if (backBtn) backBtn.disabled = koSingle.idx === 0;
}

function koSinglePrev() {
  if (koSingle.advanceTimer) { clearTimeout(koSingle.advanceTimer); koSingle.advanceTimer = null; }
  if (koSingle.idx > 0) {
    koSingle.idx--;
    koSingleRender();
  } else {
    koSingleExit();
  }
}

function koSingleSkip() {
  if (koSingle.advanceTimer) { clearTimeout(koSingle.advanceTimer); koSingle.advanceTimer = null; }
  koSingleAdvance();
}

function koSingleAdvance() {
  if (koSingle.idx < koSingle.sequence.length - 1) {
    koSingle.idx++;
    koSingleRender();
    return;
  }
  // End of sequence - exit single mode
  koSingleFinish();
}

function koSingleExit() {
  if (koSingle.advanceTimer) { clearTimeout(koSingle.advanceTimer); koSingle.advanceTimer = null; }
  koSingle.mode = null;
  goToDashboard();
}

// v2.4.5: floating "view bracket" button on the single-match KO screen.
// Mode-aware: for single-phase it opens the new sp-bracket-view modal;
// for two-phase it opens the existing full bracket-screen view.
function koSingleOpenBracketView() {
  if (koSingle.mode === 'two-phase') {
    if (typeof openBracketView === 'function') openBracketView();
  } else {
    openSpBracketView();
  }
}
window.koSingleOpenBracketView = koSingleOpenBracketView;

function koSingleFinish() {
  if (koSingle.advanceTimer) { clearTimeout(koSingle.advanceTimer); koSingle.advanceTimer = null; }
  const wasMode = koSingle.mode;
  koSingle.mode = null;

  if (wasMode === 'two-phase') {
    // v2.5.86: the old grid review screen is retired. Return to the dashboard;
    // the user can re-enter the walkthrough (or the bracket view) to edit.
    showToast(t('knockoutFirst.completedToast'), 'success');
    goToDashboard();
  } else if (spReopenActive) {
    // v2.10: recovery is BRACKET-ONLY — champion/top-scorer stay locked. Flush the
    // final save through the reopen RPC, confirm, then exit (no top-scorer detour).
    spReopenFinish();
  } else {
    // v2.4.3: single-phase - the FINAL match (bracket position 15) is
    // the tournament winner, so we go straight to top scorer; no
    // separate "pick the winner" detour.
    if (!spState.tournamentWinner && spState.bracketPicks && spState.bracketPicks[31]) {
      spState.tournamentWinner = spState.bracketPicks[31];
      spSaveWinnerToDb(false);
    }
    state.spInFlow = true;
    spStartTopScorerStep();
  }
}

// v2.10: enter the bracket-only recovery walkthrough for an admin-approved affected
// user (pool is locked). Saves route to save_knockout_bracket_reopen; groups/
// third-place/champion stay locked (loaded as fixed context); champion is enforced.
async function spReopenKnockout() {
  if (!state.currentPool || !state.currentUser) { showToast(t('errors.reconnect'), 'error'); return; }
  const st = await _spFetchReopenStatus();
  if (!st || !st.can_reenter) { showToast(t('reopen.notAvailable'), 'error'); await spShowLockedView(); return; }
  spReopenActive = true;
  try {
    await spLoadExistingPicks();  // loads groups, third-place, champion, any partial bracket
    // Eligibility guards (the grant required these; re-check defensively).
    const groupsComplete = WC2026_GROUP_LETTERS.every(l => {
      const arr = spState.groupPositions[l]; return arr && arr.length >= 4 && arr.slice(0, 4).every(x => x);
    });
    if (!groupsComplete || (spState.thirdPlaceAdvancers || []).length !== 8 || !spState.tournamentWinner) {
      spReopenActive = false; showToast(t('reopen.notAvailable'), 'error'); await spShowLockedView(); return;
    }
    koSingle.sequence = _koSinglePhaseSequence();
    koSingle.mode = 'single-phase';
    const firstIncomplete = koSingle.sequence.findIndex(s => !(spState.bracketPicks && spState.bracketPicks[s.pos]));
    koSingle.idx = firstIncomplete >= 0 ? firstIncomplete : 0;
    state.spInFlow = true;
    koSingleRender();
    showScreen('ko-single-screen');
  } catch (e) {
    spReopenActive = false; console.error('[spReopenKnockout]', e); showToast(t('reopen.notAvailable'), 'error'); await spShowLockedView();
  }
}
window.spReopenKnockout = spReopenKnockout;

// Finish the recovery flow: flush the bracket via the reopen RPC, confirm 31, exit.
async function spReopenFinish() {
  if (koSingle.advanceTimer) { clearTimeout(koSingle.advanceTimer); koSingle.advanceTimer = null; }
  koSingle.mode = null;
  try {
    if (_spBracketSaveTimer) { clearTimeout(_spBracketSaveTimer); _spBracketSaveTimer = null; }
    await spSaveBracketToDb(false);   // routes to save_knockout_bracket_reopen (spReopenActive still true)
  } catch (_) {}
  const complete = koSingle.sequence && koSingle.sequence.every(s => spState.bracketPicks && spState.bracketPicks[s.pos]);
  state.spInFlow = false;
  spReopenActive = false;
  _spReopenStatus = null;
  showToast(complete ? t('reopen.done') : t('bracketSave.retryLater'), complete ? 'success' : 'error');
  goToDashboard();
}

function _fmtReopenExpiry(iso) {
  try {
    const d = new Date(iso);
    const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
    return d.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
}

// v2.10: the post-lock recovery banner on the user's dashboard. Shown ONLY when
// the pool is locked AND the user is affected (mutually exclusive with the
// pre-lock #bracket-recover-banner). Green = approved (tap to fill); amber = not
// yet approved (ask the admin).
async function _updateReopenBanner(active) {
  const el = document.getElementById('knockout-reopen-banner');
  if (!el) return;
  const hide = () => { el.style.display = 'none'; };
  if (!active) return hide();
  const st = await _spFetchReopenStatus();
  if (st && st.used) return hide();   // already completed via recovery
  const titleEl = document.getElementById('kr-title');
  const subEl = document.getElementById('kr-sub');
  const ctaEl = document.getElementById('kr-cta');
  const expEl = document.getElementById('kr-exp');
  if (st && st.can_reenter) {
    el.className = 'knockout-reopen-banner approved';
    if (titleEl) titleEl.textContent = t('reopen.user.approvedTitle');
    if (subEl) subEl.textContent = t('reopen.user.approvedSub');
    if (ctaEl) { ctaEl.style.display = ''; ctaEl.textContent = t('reopen.user.cta'); ctaEl.onclick = () => spReopenKnockout(); }
    if (expEl) expEl.textContent = st.expires_at ? t('reopen.user.expires', { time: _fmtReopenExpiry(st.expires_at) }) : '';
  } else {
    el.className = 'knockout-reopen-banner pending';
    if (titleEl) titleEl.textContent = t('reopen.user.pendingTitle');
    if (subEl) subEl.textContent = t('reopen.user.pendingSub');
    if (ctaEl) ctaEl.style.display = 'none';
    if (expEl) expEl.textContent = '';
  }
  el.style.display = 'flex';
}

// Entry-point overrides ----------------------------------------------------

// Open the modern two-phase single-match walkthrough at a given step.
function _koOpenTwoPhaseWalkthrough(startIdx) {
  koSingle.mode = 'two-phase';
  koSingle.sequence = _koTwoPhaseSequence();
  const len = koSingle.sequence.length;
  koSingle.idx = (typeof startIdx === 'number' && startIdx >= 0 && startIdx < len) ? startIdx : 0;
  koSingleRender();
  showScreen('ko-single-screen');
}

// First match in the two-phase sequence the user hasn't picked yet (else 0).
function _koFirstIncompleteTwoPhaseIdx() {
  const seq = _koTwoPhaseSequence();
  for (let i = 0; i < seq.length; i++) {
    if (!(knockoutState.picks && knockoutState.picks[seq[i].id])) return i;
  }
  return 0;
}

// Wrap startKnockoutBetting so EVERY entry uses the modern single-match
// walkthrough (ko-single-screen) instead of the old all-on-one-page grid
// (knockout-screen). The grid is no longer part of the flow.
const _origStartKnockoutBetting = startKnockoutBetting;
startKnockoutBetting = async function() {
  if (!state.currentUser || !state.currentPool || !supabaseClient) {
    return _origStartKnockoutBetting();
  }
  // Run the original loader to set up matches & load existing picks. It only
  // switches to knockout-screen on success; if it bailed (e.g. groups
  // incomplete) leave the user where they are.
  await _origStartKnockoutBetting();
  if (state.currentScreen !== 'knockout-screen') return;
  // Override the grid: start at the first match still missing a pick.
  _koOpenTwoPhaseWalkthrough(_koFirstIncompleteTwoPhaseIdx());
};

// Wrap spGroupsNext to route to single-match bracket walkthrough on first pass
const _origSpGroupsNext = spGroupsNext;
spGroupsNext = async function() {
  // Let the original handle "not at last group" (it animates + awaits the save
  // via the async _spGroupsAdvance).
  if (spState.currentGroupIdx < 11) {
    return _origSpGroupsNext();
  }
  // Last group: validate (mirrors original logic)
  const incomplete = WC2026_GROUP_LETTERS.filter(l =>
    !spState.groupPositions[l] || !spState.groupPositions[l].every(x => x)
  );
  if (incomplete.length > 0) {
    showToast(t('betting.groupsIncomplete', { letters: incomplete.join(', ') }), 'error');
    return;
  }
  // v2.9.16: AWAIT the final-group save and block on failure. This path
  // previously fire-and-forgot spSaveGroupsToDb() and advanced regardless,
  // bypassing the v2.9.15 awaited fix for the single most important transition
  // (final group → bracket). Disable the buttons so a fast tap can't double-fire.
  const nextBtn = document.getElementById('sp-groups-next');
  const skipBtn = document.getElementById('sp-groups-skip');
  if (nextBtn) nextBtn.disabled = true;
  if (skipBtn) skipBtn.disabled = true;
  try {
    const res = await spSaveGroupsToDb(false);
    if (res && res.ok === false) return; // save failed → stay on groups, picks intact
    // v2.5.81: always go through the "pick your 8 third-place advancers" step
    // first (it routes onward to the walkthrough or the grid bracket).
    spStartThirdPlaceStep();
  } finally {
    if (nextBtn) nextBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;
  }
};

window.koSinglePrev = koSinglePrev;
window.koSingleSkip = koSingleSkip;
window.koSingleExit = koSingleExit;

// ============================================================
// v2.4: BACK-BUTTON HIJACK + EXIT-APP MODAL
// ============================================================
// On mobile, the browser/system back button used to navigate the user out
// of the app entirely. We now intercept it, walk back through the in-app
// screen history, and only ask "leave the app?" when there's no in-app
// destination to return to.

const _fbScreenBackMap = {
  // Source screen -> where Back should go. Root screens map to __exit__.
  'home-screen': '__exit__',
  'user-dashboard-screen': '__exit__',
  'screen-recovery-code': 'user-dashboard-screen',
  'leaderboard-screen': 'user-dashboard-screen',
  'matches-screen': 'user-dashboard-screen',
  'admin-members-screen': 'user-dashboard-screen',
  'pool-settings-screen': 'user-dashboard-screen',
  'members-screen': 'user-dashboard-screen',
  'top-scorer-screen': '__topScorerBack__',
  'help-screen': 'user-dashboard-screen',
  'group-betting-screen': 'user-dashboard-screen',
  'knockout-screen': 'user-dashboard-screen',
  'bracket-screen': 'knockout-screen',
  'betting-complete-screen': 'user-dashboard-screen',
  'pool-wizard-screen': 'create-pool-screen',
  'create-pool-screen': 'home-screen',
  'join-pool-screen': 'home-screen',
  'login-screen': 'home-screen',
  'recovery-login-screen': 'home-screen',
  'create-nickname-screen': 'create-pool-screen',
  'join-nickname-screen': 'join-pool-screen',
  // Single-phase flow
  'sp-groups-screen': 'user-dashboard-screen',
  'sp-third-place-screen': 'sp-groups-screen',
  'sp-bracket-screen': 'sp-groups-screen',
  'sp-winner-screen': 'sp-bracket-screen',
  'sp-summary-screen': 'user-dashboard-screen',
  'sp-locked-screen': 'user-dashboard-screen',
  // Single-match KO walkthrough handles its own back via koSinglePrev
  'ko-single-screen': '__koSinglePrev__'
};

let _fbBackHooked = false;
function setupBackButtonHijack() {
  if (_fbBackHooked) return;
  _fbBackHooked = true;

  // Seed history with a state we own so first Back press triggers popstate
  try { history.pushState({ fb: true, screen: state.currentScreen }, '', ''); } catch (e) {}

  window.addEventListener('popstate', _fbHandleBack);
}

function _fbHandleBack() {
  // Immediately re-push a state so we keep "owning" the back gesture
  try { history.pushState({ fb: true, screen: state.currentScreen }, '', ''); } catch (e) {}

  // If an open modal is up, close it first
  const openModals = [
    'rc-warning-modal',
    'rc-screenshot-modal',
    'exit-app-modal',
    'hypo-bracket-modal',
    'sp-bracket-view-modal',
    'feedback-modal'
  ];
  for (const id of openModals) {
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none' && el.style.display !== '') {
      el.style.display = 'none';
      return;
    }
  }

  const current = state.currentScreen;
  const target = _fbScreenBackMap[current];

  if (!target) {
    // Unknown screen -> default to dashboard if logged in, else home
    if (state.currentUser && state.currentPool) goToDashboard();
    else showScreen('home-screen');
    return;
  }

  if (target === '__exit__') {
    showExitAppModal();
    return;
  }

  if (target === '__koSinglePrev__') {
    koSinglePrev();
    return;
  }

  if (target === '__topScorerBack__') {
    if (typeof topScorerBack === 'function') topScorerBack();
    else goToDashboard();
    return;
  }

  if (target === '__spSummaryBack__') {
    // From summary: go back to top scorer (in flow) or dashboard
    if (state.spInFlow) {
      showScreen('top-scorer-screen');
    } else {
      goToDashboard();
    }
    return;
  }

  showScreen(target);
}

function showExitAppModal() {
  const m = document.getElementById('exit-app-modal');
  if (m) m.style.display = 'flex';
}
function closeExitAppModal() {
  const m = document.getElementById('exit-app-modal');
  if (m) m.style.display = 'none';
}
function confirmExitApp() {
  closeExitAppModal();
  // PWA / mobile: try to close the window. If denied (most cases), navigate to
  // a blank page so the back gesture next time exits cleanly.
  try {
    window.close();
  } catch (e) { /* ignore */ }
  // Most browsers block window.close() for pages they didn't open. Fall back
  // to navigating to about:blank, which effectively "exits" the app context.
  setTimeout(() => {
    if (!window.closed) {
      try { window.location.href = 'about:blank'; } catch (e) {}
    }
  }, 100);
}

window.showExitAppModal = showExitAppModal;
window.closeExitAppModal = closeExitAppModal;
window.confirmExitApp = confirmExitApp;

// ============================================================
// Feedback / Contact-us modal
// ============================================================
let _fbFeedbackCat = 'idea';   // default selected category
let _fbFeedbackSource = '';    // where it was opened from (menu | footer)
let _fbFeedbackSending = false;

function openFeedbackModal(source) {
  _fbFeedbackSource = source || '';
  if (typeof closeMenu === 'function') closeMenu();   // dismiss the side menu if open

  // Reset to a clean form each time
  _fbFeedbackCat = 'idea';
  const body = document.getElementById('fb-feedback-body');
  const thanks = document.getElementById('fb-feedback-thanks');
  if (body) body.style.display = '';
  if (thanks) thanks.style.display = 'none';
  const msg = document.getElementById('fb-feedback-message');
  const email = document.getElementById('fb-feedback-email');
  if (msg) msg.value = '';
  if (email) email.value = '';
  selectFeedbackCategory('idea');

  const m = document.getElementById('feedback-modal');
  if (m) m.style.display = 'flex';
}

function closeFeedbackModal() {
  const m = document.getElementById('feedback-modal');
  if (m) m.style.display = 'none';
}

function selectFeedbackCategory(cat) {
  _fbFeedbackCat = cat;
  document.querySelectorAll('#fb-feedback-cats .fb-cat-chip').forEach(chip => {
    chip.classList.toggle('selected', chip.dataset.cat === cat);
  });
}

async function submitFeedback() {
  if (_fbFeedbackSending) return;
  const msgEl = document.getElementById('fb-feedback-message');
  const emailEl = document.getElementById('fb-feedback-email');
  const message = (msgEl && msgEl.value || '').trim();

  if (!message) {
    showToast(t('feedback.emptyError'), 'error');
    if (msgEl) msgEl.focus();
    return;
  }

  if (!supabaseClient) { initSupabase(); }
  if (!supabaseClient) { showToast(t('errors.serverConnecting'), 'error'); return; }

  _fbFeedbackSending = true;
  const submitBtn = document.getElementById('fb-feedback-submit');
  if (submitBtn) submitBtn.classList.add('loading');

  const payload = {
    user_id: (state.currentUser && state.currentUser.id) || null,
    pool_code: (state.currentPool && state.currentPool.code) || null,
    category: _fbFeedbackCat || 'other',
    message: message.slice(0, 4000),
    reply_email: (emailEl && emailEl.value || '').trim() || null,
    app_version: (typeof CONFIG !== 'undefined' && CONFIG.APP_VERSION) || null,
    language: (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : null,
    screen: _fbFeedbackSource ? (_fbFeedbackSource + ':' + (state.currentScreen || '')) : (state.currentScreen || null),
    user_agent: (navigator && navigator.userAgent || '').slice(0, 400)
  };

  try {
    const { error } = await supabaseClient.from('feedback').insert(payload);
    if (error) {
      console.warn('submitFeedback error:', error);
      showToast(t('feedback.sendError'), 'error');
      _fbFeedbackSending = false;
      if (submitBtn) submitBtn.classList.remove('loading');
      return;
    }
    // Success: flip to the thank-you panel
    const body = document.getElementById('fb-feedback-body');
    const thanks = document.getElementById('fb-feedback-thanks');
    if (body) body.style.display = 'none';
    if (thanks) thanks.style.display = '';
  } catch (err) {
    console.warn('submitFeedback exception:', err);
    showToast(t('feedback.sendError'), 'error');
  } finally {
    _fbFeedbackSending = false;
    if (submitBtn) submitBtn.classList.remove('loading');
  }
}

window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.selectFeedbackCategory = selectFeedbackCategory;
window.submitFeedback = submitFeedback;

// Wire up the hijack as soon as the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBackButtonHijack);
} else {
  setupBackButtonHijack();
}
