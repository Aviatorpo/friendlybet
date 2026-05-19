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

function showScreen(screenId) {
  // v2.5.37: stop any auto-refresh that was running on the previous screen.
  // Currently only matches-screen registers timers; this hook keeps it
  // simple to add others later.
  if (state.currentScreen === 'matches-screen' && screenId !== 'matches-screen') {
    if (typeof _stopMatchesAutoRefresh === 'function') _stopMatchesAutoRefresh();
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
  
  toast.innerHTML = `<i class="ti ${icon}"></i><span>${message}</span>`;
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

async function submitRecoveryLogin() {
  const input = document.getElementById('recovery-login-input');
  const errEl = document.getElementById('recovery-login-error');
  if (errEl) errEl.style.display = 'none';
  if (!input) return;

  const bareChars = String(input.value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (bareChars.length < 12) {
    if (errEl) {
      errEl.textContent = t('recoveryLogin.errorShort');
      errEl.style.display = '';
    }
    return;
  }

  if (!supabaseClient) {
    initSupabase();
    if (errEl) {
      errEl.textContent = t('errors.serverConnecting');
      errEl.style.display = '';
    }
    return;
  }

  try {
    // Try the canonical hyphenated format first, then bare-chars as a
    // fallback. Stored hashes are normally of the hyphenated string.
    const hyphenated = _formatRecoveryCodeForHash(bareChars);
    const candidates = [hyphenated, bareChars];

    let user = null;
    for (const candidate of candidates) {
      const hash = await hashRecoveryCode(candidate);
      const { data: users, error: userErr } = await supabaseClient
        .from('users').select('*').eq('recovery_code_hash', hash).limit(1);
      if (userErr) throw userErr;
      if (users && users.length > 0) {
        user = users[0];
        break;
      }
    }

    if (!user) {
      if (errEl) {
        errEl.textContent = t('recoveryLogin.errorNotFound');
        errEl.style.display = '';
      }
      return;
    }
    const { data: pool, error: poolErr } = await supabaseClient
      .from('pools').select('*').eq('id', user.pool_id).maybeSingle();
    if (poolErr) throw poolErr;
    if (!pool) {
      if (errEl) {
        errEl.textContent = t('recoveryLogin.errorNoPool');
        errEl.style.display = '';
      }
      return;
    }

    state.currentUser = user;
    state.currentPool = pool;
    saveLocalUser(user);
    localStorage.setItem(CONFIG.STORAGE_KEYS.RECOVERY_CODE, hyphenated);

    showToast(t('recoveryLogin.success', { nickname: user.nickname }), 'success');
    await goToDashboard();
  } catch (err) {
    console.error('submitRecoveryLogin err:', err);
    if (errEl) {
      errEl.textContent = t('errors.unexpected');
      errEl.style.display = '';
    }
  }
}
window.submitRecoveryLogin = submitRecoveryLogin;

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

// שמירת מצב משתמש מקומית
function saveLocalUser(userData) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ID, userData.id);
  localStorage.setItem(CONFIG.STORAGE_KEYS.POOL_ID, userData.pool_id);
  localStorage.setItem(CONFIG.STORAGE_KEYS.NICKNAME, userData.nickname);
  localStorage.setItem(CONFIG.STORAGE_KEYS.IS_ADMIN, userData.is_admin ? '1' : '0');
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

    // Check if pool is locked
    if (data.is_locked === true) {
      showError('join-error', t('errors.poolLockedNoJoin'));
      return;
    }
    
    // Count members
    const { count: memberCount } = await supabaseClient
      .from('users')
      .select('*', { count: 'exact', head: true })
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

    // Hash recovery code
    const recoveryHash = await hashRecoveryCode(state.pendingRecoveryCode);

    // Create user - joins immediately, admin can approve/remove later
    const { data: user, error } = await supabaseClient
      .from('users')
      .insert({
        pool_id: state.currentPool.id,
        nickname: state.pendingNickname,
        recovery_code_hash: recoveryHash,
        is_admin: false,
        is_approved: true, // Legacy field - keep true
        approval_status: 'pending' // New: admin can approve later
      })
      .select()
      .single();

    if (error) {
      console.error('User creation error:', error);
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
    
    // Create the pool
    const { data: pool, error: poolError } = await supabaseClient
      .from('pools')
      .insert({
        code: poolCode,
        name: state.pendingPoolName,
        language: 'he',
        tournament: 'wc2026',
        status: 'open'
      })
      .select()
      .single();
    
    if (poolError) {
      console.error('Pool creation error:', poolError);
      showToast(t('errors.creatingPoolFail', { msg: poolError.message }), 'error');
      return;
    }
    
    // Generate recovery code for admin
    const adminRecoveryCode = generateRecoveryCode();
    const adminRecoveryHash = await hashRecoveryCode(adminRecoveryCode);
    
    // Create admin user - auto-approved
    const { data: adminUser, error: userError } = await supabaseClient
      .from('users')
      .insert({
        pool_id: pool.id,
        nickname: adminNickname,
        recovery_code_hash: adminRecoveryHash,
        is_admin: true,
        is_approved: true,
        approval_status: 'approved',
        approved_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (userError) {
      console.error('Admin user creation error:', userError);
      showToast(t('errors.creatingAdminFail', { msg: userError.message }), 'error');
      // Rollback pool
      await supabaseClient.from('pools').delete().eq('id', pool.id);
      return;
    }
    
    // Update pool with admin_user_id
    await supabaseClient
      .from('pools')
      .update({ admin_user_id: adminUser.id })
      .eq('id', pool.id);
    
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

async function goToDashboard() {
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
        .from('users').select('*').eq('id', local.id).maybeSingle());
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

  const preEl = document.getElementById('dashboard-pre-tournament');
  const statsEl = document.getElementById('dashboard-stats');
  if (preEl && statsEl) {
    if (tournamentStarted) {
      preEl.style.display = 'none';
      statsEl.style.display = '';
      const pointsEl = document.getElementById('user-points');
      if (pointsEl) pointsEl.textContent = state.currentUser.total_score || 0;
      if (allUsers) {
        const rank = allUsers.findIndex(u => u.id === state.currentUser.id) + 1;
        const rankEl = document.getElementById('user-rank');
        if (rankEl) rankEl.textContent = rank;
      }
    } else {
      preEl.style.display = '';
      statsEl.style.display = 'none';
    }
  }
  
  // v2.5.38: only admins see the "invite friends" CTA on the dashboard.
  // Regular members joined via a link or pool code - they don't need to
  // recruit. The menu still has a share entry for admins to find anytime.
  const inviteBtn = document.querySelector('#user-dashboard-screen .invite-friends-btn');
  if (inviteBtn) {
    inviteBtn.style.display = (state.currentUser && state.currentUser.is_admin) ? '' : 'none';
  }

  // Update betting status based on actual picks
  updateBettingStatusOnDashboard();
  updateKnockoutStatusOnDashboard();

  showScreen('user-dashboard-screen');
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

async function loadResultsData() {
  if (!supabaseClient || !state.currentUser) return;
  
  // Cache for 60 seconds to avoid spam
  if (state.results.lastLoaded && (Date.now() - state.results.lastLoaded) < 60000) {
    return;
  }
  
  try {
    // Load finished matches
    const { data: matches } = await supabaseClient
      .from('matches')
      .select('*')
      .eq('status', 'FINISHED');
    
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
      if (m.stage && m.stage !== 'GROUP_STAGE' && m.home_score !== null && m.away_score !== null) {
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
      .select('*', { count: 'exact', head: true })
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
    .select('*')
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
  const [groupRes, koRes] = await Promise.all([
    supabaseClient.from(picksTable).select('user_id').eq('pool_id', state.currentPool.id),
    supabaseClient.from('knockout_picks').select('user_id').eq('pool_id', state.currentPool.id)
  ]);

  // Count group + knockout picks per user
  const picksPerUser = {};
  const koPerUser = {};
  (groupRes.data || []).forEach(p => {
    picksPerUser[p.user_id] = (picksPerUser[p.user_id] || 0) + 1;
  });
  (koRes.data || []).forEach(p => {
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
  const groupComplete = isV2 ? (picksCount >= 48) : (picksCount >= 24);
  const koComplete = isV2 ? (koPicksCount >= 15) : (koPicksCount >= 16);
  const submitted = !!member.predictions_submitted_at;
  const allDone = isV2 ? (submitted || (groupComplete && koComplete)) : (groupComplete && koComplete);

  let statusClass, statusText;
  if (picksCount === 0 && koPicksCount === 0) {
    statusClass = 'not-started';
    statusText = t('membersList.noBets');
  } else if (allDone) {
    statusClass = 'completed';
    statusText = t('membersList.allDone');
  } else {
    statusClass = 'partial';
    statusText = t('membersList.inProgress');
  }

  // Joined date
  const joinedDate = new Date(member.joined_at);
  const today = new Date();
  const daysAgo = Math.floor((today - joinedDate) / (1000 * 60 * 60 * 24));
  const lang = (typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en');
  let joinedText;
  if (daysAgo === 0) joinedText = t('membersList.joinedToday');
  else if (daysAgo === 1) joinedText = t('membersList.joinedYesterday');
  else if (daysAgo < 7) joinedText = t('membersList.joinedDaysAgo', { n: daysAgo });
  else joinedText = t('membersList.joinedOn', { date: joinedDate.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' }) });

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
      .select('*')
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

    const [groupPicksRes, knockoutPicksRes] = await Promise.all([
      supabaseClient
        .from(groupTable)
        .select('user_id')
        .in('user_id', userIds),
      supabaseClient
        .from('knockout_picks')
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

    // Enrich users with stats
    adminState.members = users.map(u => ({
      ...u,
      groupPicksCount: groupPicksByUser[u.id] || 0,
      knockoutPicksCount: knockoutPicksByUser[u.id] || 0,
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

function renderAdminMembers() {
  const list = document.getElementById('admin-members-list');
  
  // Stats
  const total = adminState.members.length;
  const pending = adminState.members.filter(m => m.approval_status === 'pending' && !m.isAdmin).length;
  // v2.5.24: completion threshold differs per mode.
  //  - two_phase legacy: 24 group picks (2 per group × 12) + 16 knockout
  //  - single_phase: 48 group-position picks (4 × 12) + 15 bracket picks
  const groupThreshold = adminState.isV2 ? 48 : 24;
  const knockoutThreshold = adminState.isV2 ? 15 : 16;
  const withGroups = adminState.members.filter(m => m.groupPicksCount >= groupThreshold).length;
  const withKnockout = adminState.members.filter(m => m.knockoutPicksCount >= knockoutThreshold).length;
  
  document.getElementById('admin-stat-total').textContent = total;
  document.getElementById('admin-stat-groups').textContent = withGroups;
  document.getElementById('admin-stat-knockout').textContent = withKnockout;
  
  // Show pending banner if any
  const pendingBanner = document.getElementById('admin-pending-banner');
  if (pendingBanner) {
    if (pending > 0) {
      pendingBanner.style.display = 'flex';
      const countEl = document.getElementById('admin-pending-count');
      if (countEl) countEl.textContent = pending;
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

    // Progress dots
    const groupsDone = member.groupPicksCount >= 24;
    const knockoutDone = member.knockoutPicksCount >= 16;

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
          <span class="admin-member-progress-dot ${groupsDone ? 'done' : ''}">
            ${t('adminMembersEx.groupsPicks', { n: member.groupPicksCount, check: groupsDone ? '✓' : '' })}
          </span>
          <span class="admin-member-progress-dot ${knockoutDone ? 'done' : ''}">
            ${t('adminMembersEx.koPicks', { n: member.knockoutPicksCount, check: knockoutDone ? '✓' : '' })}
          </span>
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
  });
}

// Quick approve - one click
async function quickApproveMember(member) {
  try {
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
  const joinedDate = new Date(member.joined_at).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US');
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
    // Generate new recovery code (16 chars)
    const newCode = generateRecoveryCode();
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
  // rule, not a hardcoded "+25". Falls back to 25 if the rule is missing
  // (e.g. legacy pools that predate scoring_rules).
  const tsBonus = (state.currentPool && state.currentPool.scoring_rules &&
                   state.currentPool.scoring_rules.top_scorer) || 25;
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
  'JPN', 'KOR', 'SEN', 'IRN'
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
  document.getElementById('ts-current-flag').textContent = getCountryFlag(pick.team_code);
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
    // Search directly in DB with ILIKE - bypasses all limits
    const lowerQuery = query.toLowerCase();
    
    const { data, error } = await supabaseClient
      .from('players')
      .select('*')
      .or(`name_en.ilike.%${query}%,name_he.ilike.%${query}%,team_code.ilike.%${query}%`)
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
        player_name: player.name_he || player.name_en || t('tsUnlocked.fallbackPlayer'),
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
}

async function clearTopScorerPick() {
  if (!topScorerState.currentPick) return;

  const confirmed = window.confirm(t('tsUnlocked.confirmClear'));
  if (!confirmed) return;

  try {
    const { error } = await supabaseClient
      .from('top_scorer_picks')
      .delete()
      .eq('user_id', state.currentUser.id);

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
    .select('*', { count: 'exact', head: true })
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
  group.querySelectorAll('.toggle-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
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
    const { error } = await supabaseClient
      .from('pools')
      .update(newSettings)
      .eq('id', state.currentPool.id);

    if (error) {
      console.error('Settings save error:', error);
      showToast(t('poolSettings.saveError', { msg: error.message }), 'error');
      return;
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
    const { error } = await supabaseClient
      .from('pools')
      .delete()
      .eq('id', state.currentPool.id);

    if (error) {
      console.error('Delete pool error:', error);
      showToast(t('poolSettings.deleteError', { msg: error.message }), 'error');
      return;
    }

    clearLocalUser();
    state.currentPool = null;
    state.currentUser = null;

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

function getCountryFlag(code) {
  // Map country codes to flag emojis using regional indicator characters
  // ISO codes to flag emoji mapping
  const flagMap = {
    // Tier 1 - Favorites
    'ARG': '🇦🇷', 'FRA': '🇫🇷', 'BRA': '🇧🇷', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'ESP': '🇪🇸', 'POR': '🇵🇹', 'NED': '🇳🇱', 'GER': '🇩🇪',
    
    // Tier 2 - Contenders
    'BEL': '🇧🇪', 'CRO': '🇭🇷', 'URU': '🇺🇾',
    'USA': '🇺🇸', 'MEX': '🇲🇽', 'SUI': '🇨🇭',
    'AUT': '🇦🇹', 'SWE': '🇸🇪', 'SEN': '🇸🇳', 'MAR': '🇲🇦',
    'JPN': '🇯🇵', 'KOR': '🇰🇷', 'AUS': '🇦🇺', 'CAN': '🇨🇦',
    'UKR': '🇺🇦', 'TUR': '🇹🇷', 'NOR': '🇳🇴',
    'IRN': '🇮🇷',
    'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'CZE': '🇨🇿', 'ALG': '🇩🇿', 'CIV': '🇨🇮',
    
    // Tier 3 - Underdogs
    'TUN': '🇹🇳', 'EGY': '🇪🇬', 'CMR': '🇨🇲', 'GHA': '🇬🇭',
    'PAN': '🇵🇦', 'JAM': '🇯🇲',
    'PAR': '🇵🇾', 'NZL': '🇳🇿',
    'UZB': '🇺🇿', 'IRQ': '🇮🇶', 'SAU': '🇸🇦', 'JOR': '🇯🇴',
    'RSA': '🇿🇦', 'HAI': '🇭🇹', 'BIH': '🇧🇦', 'CPV': '🇨🇻',
    'COD': '🇨🇩', 'QAT': '🇶🇦', 'CUR': '🇨🇼',
  };
  return flagMap[code] || '⚽';
}

function toggleTeamSelection(teamCode) {
  // v2.4: soft lock - groups freeze automatically once the tournament starts
  // (pool.locked_at set by spAutoLockPoolIfNeeded). Admins can still see them
  // read-only via the leaderboard.
  if (state.currentPool && state.currentPool.locked_at) {
    showToast(t('groups.lockedTournamentStarted'), 'error');
    return;
  }

  const currentLetter = getCurrentGroupLetter();
  const picks = bettingState.picks[currentLetter] || [];

  if (picks.includes(teamCode)) {
    // Remove
    bettingState.picks[currentLetter] = picks.filter(c => c !== teamCode);
  } else {
    // Add - but max 3
    if (picks.length >= 3) {
      showToast(t('groups.maxReachedToast'), 'error');
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
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-left: 4px;">
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
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => savePicksToDb(false), 1000);
}

async function savePicksToDb(showFeedback = true) {
  if (!state.currentUser || !state.currentPool) return;
  if (!supabaseClient) return;

  // v2.4: soft lock - block writes once the tournament has started.
  if (state.currentPool.locked_at) {
    if (showFeedback) showToast(t('groups.lockedTournamentStarted'), 'error');
    return;
  }

  if (bettingState.loading) return;
  bettingState.loading = true;
  
  try {
    // First, delete all existing picks for this user
    await supabaseClient
      .from('group_picks')
      .delete()
      .eq('user_id', state.currentUser.id);
    
    // Build new picks array
    const newPicks = [];
    bettingState.groupOrder.forEach(letter => {
      const teams = bettingState.picks[letter] || [];
      teams.forEach(teamCode => {
        // v2.5.35: persist the pool-resolved multiplier (per-team override →
        // category → default). Server-side scoring reads this value directly,
        // so a snapshot at save time is the authoritative number per pick.
        const multiplier = (state.currentPool.use_multipliers !== false)
          ? getPoolTeamMultiplier(state.currentPool, teamCode)
          : 1.0;

        newPicks.push({
          user_id: state.currentUser.id,
          pool_id: state.currentPool.id,
          group_letter: letter,
          team_code: teamCode,
          multiplier_applied: multiplier
        });
      });
    });
    
    // Insert new picks
    if (newPicks.length > 0) {
      const { error } = await supabaseClient
        .from('group_picks')
        .insert(newPicks);
      
      if (error) {
        console.error('Save picks error:', error);
        if (showFeedback) {
          showToast(t('groups.saveError'), 'error');
        }
        bettingState.loading = false;
        return;
      }
    }

    if (showFeedback) {
      showToast(t('groups.savedOk'), 'success');
    }

  } catch (err) {
    console.error('Save picks error:', err);
    if (showFeedback) {
      showToast(t('groups.saveError'), 'error');
    }
  } finally {
    bettingState.loading = false;
  }
}

async function saveProgressAndExit() {
  // Force save and exit
  await savePicksToDb(true);
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

  // v2.4.2: removed "Saving..." toast - the completion screen we're about
  // to show is itself the success confirmation.
  await savePicksToDb(false);
  
  // v2.5.35: use pool-aware multiplier resolver (scoring_rules.team_multipliers
  // override → scoring_rules.multipliers[tier] → global default). Falls back
  // to legacy tier-only lookup when the pool has no custom multipliers config.
  let maxPoints = 0;
  const scoringGroupStage = state.currentPool.scoring_group_stage || 1;
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
    // Once the user has done a full pass, the CTA becomes "View your predictions"
    if (state.currentUser.predictions_submitted_at) {
      titleEl.textContent = t('dashboard.viewCta.title');
      subtitleEl.textContent = t('dashboard.viewCta.subtitle');
      ctaEl.classList.add('done');
      // v2.4.7: hide the progress bar entirely once submitted. The previous
      // "1 / 1" indicator was confusing - the title + green check icon are
      // already the unambiguous "all done" signal. Showing a counter implied
      // there was something left to fill.
      const row = document.getElementById('bet-cta-progress-row');
      if (row) row.style.display = 'none';
      const iconWrap = document.getElementById('bet-cta-icon-simple');
      if (iconWrap) iconWrap.innerHTML = _fbCtaSvgCheck();
      _fbSetDashboardProgressCard('allSet');
      return;
    }
    // Otherwise count v2 group_position_picks to show progress
    const { data: gpp } = await supabaseClient
      .from('group_position_picks')
      .select('id')
      .eq('user_id', state.currentUser.id);
    const rows = (gpp || []).length;          // 4 per group, max 48
    const groupsFilled = Math.floor(rows / 4);  // 0..12
    if (rows === 0) {
      titleEl.textContent = t('dashboard.startCta.title');
      subtitleEl.textContent = t('dashboard.startCta.subtitle');
      ctaEl.classList.remove('done');
      _fbSetDashboardProgressCard('notStarted');
    } else if (groupsFilled < 12) {
      titleEl.textContent = t('dashboard.continueCta.title');
      subtitleEl.textContent = t('dashboard.continueCta.partialGroups', { n: groupsFilled, total: 12 });
      ctaEl.classList.remove('done');
      _fbSetDashboardProgressCard('partial');
    } else {
      titleEl.textContent = t('dashboard.continueCta.title');
      subtitleEl.textContent = t('dashboard.continueCta.almostDone');
      ctaEl.classList.remove('done');
      _fbSetDashboardProgressCard('partial');
    }
    _fbSetCtaProgress(groupsFilled, 12);
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
      const card = createMatchCard(match);
      listEl.appendChild(card);
    });
  }
  
  // Update progress
  updateKnockoutProgress();
  
  // Update finish button
  updateKnockoutFinishButton();
}

function createMatchCard(match) {
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
  const myScore = userPick ? getMyMatchScore(match.id, 'KNOCKOUT') : null;

  let resultBadge = '';
  let cardClass = 'ko-match-card';

  if (realResult === true) {
    cardClass += ' result-correct';
    const correctPoints = myScore?.points_earned || 0;
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
  clearTimeout(knockoutSaveTimeout);
  knockoutSaveTimeout = setTimeout(() => saveKnockoutPicksToDb(false), 1000);
}

async function saveKnockoutPicksToDb(showFeedback = true) {
  if (!state.currentUser || !state.currentPool || !supabaseClient) return;
  
  try {
    // Delete existing
    await supabaseClient
      .from('knockout_picks')
      .delete()
      .eq('user_id', state.currentUser.id);
    
    // Build new picks
    const newPicks = [];
    Object.keys(knockoutState.picks).forEach(matchId => {
      const round = matchId.split('_')[0];
      const winnerCode = knockoutState.picks[matchId];
      // v2.5.35: pool-aware multiplier (per-team override → category → default)
      const multiplier = (state.currentPool.use_multipliers !== false)
        ? getPoolTeamMultiplier(state.currentPool, winnerCode)
        : 1.0;
      
      newPicks.push({
        user_id: state.currentUser.id,
        pool_id: state.currentPool.id,
        match_id: matchId,
        round: round,
        predicted_winner: winnerCode,
        multiplier_applied: multiplier
      });
    });
    
    if (newPicks.length > 0) {
      const { error } = await supabaseClient
        .from('knockout_picks')
        .insert(newPicks);
      
      if (error) {
        console.error('Knockout save error:', error);
        if (showFeedback) showToast(t('groups.saveError'), 'error');
        return;
      }
    }

    if (showFeedback) showToast(t('knockoutEx.savedOk'), 'success');

  } catch (err) {
    console.error('Knockout save error:', err);
    if (showFeedback) showToast(t('groups.saveError'), 'error');
  }
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
  await saveKnockoutPicksToDb(false);
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
  showScreen('knockout-screen');
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
  const round = matchId.split('_')[0];
  
  knockoutState.currentRound = round;
  renderKnockout();
  showScreen('knockout-screen');
  
  setTimeout(() => {
    const matchEls = document.querySelectorAll('.ko-match-card');
    const matchIndex = knockoutState.matches[round].findIndex(m => m.id === matchId);
    if (matchEls[matchIndex]) {
      matchEls[matchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      matchEls[matchIndex].style.transition = 'box-shadow 0.3s';
      matchEls[matchIndex].style.boxShadow = '0 0 0 2px #d4a853';
      setTimeout(() => {
        matchEls[matchIndex].style.boxShadow = '';
      }, 1500);
    }
  }, 100);
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
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> ' + koLabel;
    if (subtitleEl) subtitleEl.textContent = t('dashboard.status.koReady');
    existingBtn.innerHTML = t('dashboard.action.start') + ' →';
  } else if (koCount < 31) {
    koCard.className = 'bet-status-card pending';
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> ' + koLabel;
    if (subtitleEl) subtitleEl.textContent = t('dashboard.status.partialKo', { n: koCount });
    existingBtn.innerHTML = t('dashboard.action.continue') + ' →';
  } else {
    koCard.className = 'bet-status-card completed';
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ' + koLabel;
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
    .select('*')
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
    <div class="podium-name">${user.nickname}</div>
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
      <div class="lb-avatar-small">${user.nickname.charAt(0)}</div>
      <div class="lb-info">
        <div class="lb-name">
          ${escapeHtml(user.nickname)}
          ${user.is_admin ? `<span class="admin-badge">${t('common.admin')}</span>` : ''}
          ${isMe ? `<span class="lb-badge">${t('common.you')}</span>` : ''}
          ${isSinglePhase ? `<button class="lb-view-bracket-btn" onclick="showUserHypotheticalBracket(${user.id}, '${escapeHtml(user.nickname).replace(/'/g, "\\'")}')">${t('leaderboard.viewBracket')}</button>` : ''}
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
  // 60s: re-fetch from Supabase. The smart-sync GitHub Action writes
  // every 10 min, so 60s is enough to surface changes promptly without
  // hammering the DB. Skip the loading spinner on background refreshes.
  matchesState.refreshTimer = setInterval(() => {
    if (state.currentScreen !== 'matches-screen' || document.hidden) return;
    loadMatches(true).catch(() => {});
  }, 60000);
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
    const { data: matches, error } = await supabaseClient
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true });

    if (error) {
      console.error('Matches load error:', error);
      if (!silent) showToast(t('matchesEx.loadError'), 'error');
      return;
    }
    
    matchesState.allMatches = matches || [];
    
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
    if (matchesState.currentFilter === 'live') return m.status === 'LIVE' || m.status === 'IN_PLAY';
    if (matchesState.currentFilter === 'upcoming') return m.status === 'SCHEDULED' || m.status === 'TIMED';
    if (matchesState.currentFilter === 'finished') return m.status === 'FINISHED';
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
  
  const isLive = match.status === 'LIVE' || match.status === 'IN_PLAY';
  const isFinished = match.status === 'FINISHED';
  const isScheduled = !isLive && !isFinished;
  
  card.className = 'match-card';
  if (isLive) card.classList.add('live');
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
  if (isLive) {
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
    ${match.venue ? `<div class="match-info"><span>${match.venue}</span><span>${formatMatchDate(match.match_date)}</span></div>` : ''}
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

async function initApp() {
  console.log('FriendlyBet v' + CONFIG.APP_VERSION + ' starting...');
  console.log('Language:', typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'unknown');

  // v2.5.52: emergency escape hatch — visiting /?reset=1 wipes all local
  // storage, unregisters the service worker, and reloads. Lets a user
  // recover from a stuck-on-blank-screen state by typing the URL.
  if (new URLSearchParams(window.location.search).get('reset') === '1') {
    console.warn('[reset=1] wiping local state and SW caches');
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
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

  // v2.5.49: every routing branch wrapped in try/catch. If anything
  // throws (network failure, schema mismatch, missing DOM node) we
  // bail out to home-screen instead of leaving the splash up forever
  // or showing a blank dashboard with no error indication.
  try {
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
    } else {
      // First visit (or no working supabase) - show home
      if (localUser && localUser.pool_id && !supabaseClient) {
        console.warn('Supabase never came online; falling back to home-screen.');
      }
      showScreen('home-screen');
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

function showShareModal() {
  if (!state.currentPool) {
    showToast(t('errors.tryAgain'), 'error');
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

  // Show modal
  document.getElementById('share-modal-overlay').classList.add('active');
  document.getElementById('share-modal').classList.add('active');
}

function closeShareModal() {
  document.getElementById('share-modal-overlay').classList.remove('active');
  document.getElementById('share-modal').classList.remove('active');
}

function getInviteUrl() {
  if (!state.currentPool) return '';
  const baseUrl = window.location.origin;
  const code = state.currentPool.code;
  const poolName = encodeURIComponent(state.currentPool.name);
  return `${baseUrl}/?join=${code}&pool=${poolName}`;
}

function getShareMessage() {
  if (!state.currentPool) return '';
  const poolName = state.currentPool.name;
  const code = state.currentPool.code;
  const url = getInviteUrl();

  return t('sharePool.shareText', { poolName, code, url });
}

function shareToWhatsApp() {
  const message = getShareMessage();
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}

function shareToTelegram() {
  const inviteUrl = getInviteUrl();
  const message = getShareMessage();
  const url = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

function shareNative() {
  if (!navigator.share) {
    copyInviteLink();
    return;
  }
  
  const inviteUrl = getInviteUrl();
  const poolName = state.currentPool?.name || t('dashboard.fallback.poolName');

  navigator.share({
    title: t('shareModal.joinTitle', { name: poolName }),
    text: getShareMessage(),
    url: inviteUrl
  }).catch(err => {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
    }
  });
}

async function copyInviteLink() {
  const url = getInviteUrl();
  
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

async function copyPoolCodeOnly() {
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
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a1628&margin=8&format=svg`;
  
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
  B: ['CAN','SUI','QAT','BIH'],
  C: ['BRA','MAR','HAI','SCO'],
  D: ['USA','PAR','AUS','TUR'],
  E: ['ESP','UKR','IRN','CPV'],
  F: ['ARG','TUN','IRQ','ALG'],
  G: ['GER','CUR','BEL','SAU'],
  H: ['POR','AUT','EGY','SWE'],
  I: ['FRA','SEN','NOR','NZL'],
  J: ['NED','CMR','UZB','JOR'],
  K: ['URU','JPN','JAM','CIV'],
  L: ['ENG','CRO','GHA','PAN']
};
const WC2026_GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// FIFA world ranking snapshot for WC2026 teams (approx. late 2025).
// Lower number = better rank. Unknown codes fall back to 999.
const FIFA_RANKINGS = {
  ARG: 1,  ESP: 2,  FRA: 3,  ENG: 4,  BRA: 5,  POR: 6,  NED: 7,  BEL: 8,
  CRO: 9,  GER: 12, MAR: 13, URU: 15, USA: 16, MEX: 17, JPN: 18, SUI: 19,
  SEN: 20, IRN: 21, KOR: 22, AUT: 23, UKR: 24, SWE: 25, AUS: 26, TUR: 27,
  NOR: 28, TUN: 29, EGY: 30, ALG: 31, CAN: 32, CZE: 33, SCO: 34, CIV: 35,
  CMR: 36, PAR: 37, PAN: 38, IRQ: 40, RSA: 42, UZB: 43, JOR: 44, GHA: 47,
  JAM: 50, NZL: 55, SAU: 57, BIH: 59, HAI: 60, CPV: 65, QAT: 66, CUR: 85
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
    // v2.5.57: every correctly-predicted group position earns 1 point -
    // single_phase asks for the full 1st-4th ordering, so 3rd/4th picks
    // are real predictions and deserve a reward when they land.
    group_first: 1,
    group_second: 1,
    group_third: 1,
    group_fourth: 1,
    round_of_16: 2,
    quarter_final: 4,
    semi_final: 8,
    final: 16,
    tournament_winner: 32,
    top_scorer: 20
  },
  two_phase: {
    // Two-phase users pick "who qualifies" without ordering, so the same
    // 1pt-per-advancer rule applies. 3rd/4th aren't even a question here.
    group_first: 1,
    group_second: 1,
    group_third: 0,
    group_fourth: 0,
    round_of_16: 2,
    quarter_final: 4,
    semi_final: 8,
    final: 16,
    // v2.5.34: bonus on top of the final-correct pick for predicting the
    // tournament champion (the team that wins position 15).
    tournament_winner: 32,
    top_scorer: 20
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
  // Two_phase doesn't use 3rd/4th place or tournament_winner
  if (wizardState.mode === 'two_phase') {
    return ['group_first','group_second','round_of_16','quarter_final','semi_final','final','tournament_winner','top_scorer'];
  }
  return ['group_first','group_second','group_third','group_fourth',
          'round_of_16','quarter_final','semi_final','final','tournament_winner','top_scorer'];
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
      rows: ['group_first', 'group_second', 'group_third', 'group_fourth']
    },
    {
      titleKey: 'wizard.ruleGroup.knockout',
      rows: ['round_of_16', 'quarter_final', 'semi_final', 'final']
    },
    {
      titleKey: 'wizard.ruleGroup.winner',
      rows: ['tournament_winner']
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
        rows: ['round_of_16', 'quarter_final', 'semi_final', 'final']
      },
      {
        titleKey: 'wizard.ruleGroup.winner',
        // v2.5.36: tournament_winner is a prediction in its own right, not a
        // bonus on top of something else. Promoted to its own section so the
        // user sees it as a first-class scoring row.
        rows: ['tournament_winner']
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
      rows: ['group_first', 'group_second', 'group_third', 'group_fourth'].filter(inSet)
    },
    {
      titleKey: 'wizard.ruleGroup.knockout',
      rows: ['round_of_16', 'quarter_final', 'semi_final', 'final'].filter(inSet)
    },
    {
      titleKey: 'wizard.ruleGroup.winner',
      rows: ['tournament_winner'].filter(inSet)
    },
    {
      titleKey: 'wizard.ruleGroup.bonus',
      rows: ['top_scorer'].filter(inSet)
    }
  ].filter(g => g.rows.length > 0);
}

function renderWizardRulesStep() {
  // v2.5.35: multipliers now apply to single_phase too. Admins can configure
  // the three category values and per-team overrides in both modes.
  const multInfo = document.getElementById('wizard-multipliers-info');
  if (multInfo) multInfo.style.display = '';

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
  if (mode === 'single_phase') {
    // 12 groups × (1st+2nd+3rd+4th) + 8 R16 + 4 QF + 2 SF + 1 Final + winner + top scorer
    return 12 * (rules.group_first + rules.group_second + rules.group_third + rules.group_fourth) +
           8 * rules.round_of_16 +
           4 * rules.quarter_final +
           2 * rules.semi_final +
           1 * rules.final +
           rules.tournament_winner +
           rules.top_scorer;
  }
  // two_phase: 16 advancing per stage (2 per group * 12 groups) but simpler approximation
  return 12 * (rules.group_first + rules.group_second) +
         8 * rules.round_of_16 +
         4 * rules.quarter_final +
         2 * rules.semi_final +
         1 * rules.final +
         rules.top_scorer;
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

    // Build insert payload. If columns don't exist (migration not yet run),
    // we'll fall back to the legacy minimal payload.
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

    let pool, poolError;
    ({ data: pool, error: poolError } = await supabaseClient
      .from('pools').insert(fullInsert).select().single());

    if (poolError && /column .* does not exist/i.test(poolError.message || '')) {
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

    // Admin user
    const adminRecoveryCode = generateRecoveryCode();
    const adminRecoveryHash = await hashRecoveryCode(adminRecoveryCode);
    const { data: adminUser, error: userError } = await supabaseClient
      .from('users').insert({
        pool_id: pool.id,
        nickname: adminNickname,
        recovery_code_hash: adminRecoveryHash,
        is_admin: true,
        is_approved: true,
        approval_status: 'approved',
        approved_at: new Date().toISOString()
      }).select().single();

    if (userError) {
      console.error('Admin user creation error:', userError);
      showToast(t('errors.creatingAdminFail', { msg: userError.message }), 'error');
      await supabaseClient.from('pools').delete().eq('id', pool.id);
      return;
    }

    await supabaseClient.from('pools')
      .update({ admin_user_id: adminUser.id }).eq('id', pool.id);

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
  tournamentWinner: null,
  topScorerLoaded: false
};

function spIsLocked() {
  // The only hard gate on edits: pool.locked_at is set once the
  // first World Cup match starts (auto-locked by spAutoLockPoolIfNeeded).
  return !!(state.currentPool && state.currentPool.locked_at);
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
  // v2.3: if the user has already gone through the full flow once,
  //       land them on the summary so they can review + edit.
  if (spHasUserSubmitted()) {
    spRenderSummary();
    showScreen('sp-summary-screen');
    return;
  }
  spState.currentGroupIdx = 0;
  spRenderGroups();
  showScreen('sp-groups-screen');
}

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

    console.log('[spLoadExistingPicks] result | groups=' + Object.keys(newGroups).length +
      ' bracket=' + Object.keys(newBracket).length +
      ' winner=' + (newWinner || 'none') +
      ' anyDataLoaded=' + anyDataLoaded + ' anyError=' + anyError);

    // Commit policy:
    //   - if we got any data, trust DB
    //   - if no data + no errors, also trust DB (user has no picks yet)
    //   - if errors + no data, keep current in-memory state (don't wipe)
    if (anyDataLoaded || !anyError) {
      spState.groupPositions = newGroups;
      spState.bracketPicks = newBracket;
      spState.tournamentWinner = newWinner;
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
  const ptsHint = document.getElementById('sp-points-hint');
  if (ptsHint) {
    const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
    const pts = {
      1: rules.group_first ?? 1,
      2: rules.group_second ?? 1,
      3: rules.group_third ?? 1,
      4: rules.group_fourth ?? 1
    };
    ptsHint.innerHTML = [1, 2, 3, 4].map(n =>
      `<span class="pts-pill">${t('groups.pointsForPosition', { pos: n, pts: pts[n] })}</span>`
    ).join('');
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
  const slotsEl = document.getElementById('sp-positions-list');
  slotsEl.innerHTML = positions.map((teamCode, i) => `
    <div class="sp-position-slot filled sp-draggable" data-pos="${i}">
      <div class="pos-drag-handle" aria-label="drag"><i class="ti ti-grip-vertical"></i></div>
      <div class="pos-rank">${i + 1}</div>
      <div class="pos-flag">${getCountryFlag(teamCode)}</div>
      <div class="pos-name">${getTeamName(teamCode)}</div>
    </div>
  `).join('');

  // Wire drag handlers
  slotsEl.querySelectorAll('.sp-position-slot').forEach((slot, idx) => {
    slot.addEventListener('pointerdown', e => spSlotPointerDown(e, idx));
  });

  // If we just pre-filled, persist immediately (so navigating back/forward
  // doesn't keep "re-suggesting" the same defaults).
  if (prefilled) spAutoSaveGroups();

  // Prev/Next state
  const prev = document.getElementById('sp-groups-prev');
  const next = document.getElementById('sp-groups-next');
  if (prev) prev.disabled = (spState.currentGroupIdx === 0);
  if (next) {
    const isLast = spState.currentGroupIdx === 11;
    next.querySelector('span').textContent = isLast ? t('betting.continueToBracket') : t('wizard.next');
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
    spAutoSaveGroups();
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
  spAutoSaveGroups();
}

let _spSaveTimer = null;
function spAutoSaveGroups() {
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

async function _spSaveGroupsToDbInner(showFeedback = true) {
  if (!state.currentPool || !state.currentUser) return;
  if (spIsLocked()) return;

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
    return;
  }

  try {
    // v2.5.7: scope DELETE to this pool too - otherwise saving in pool B
    // wipes the user's picks from pool A.
    const { error: delErr } = await supabaseClient.from('group_position_picks')
      .delete().eq('user_id', userId).eq('pool_id', poolId);
    if (delErr) {
      console.error('[spSaveGroupsToDb] DELETE error:', delErr);
      showToast('DB error (groups DELETE): ' + (delErr.message || 'unknown'), 'error');
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
        showToast('DB error (groups): ' + (error.message || 'unknown') + ' - ' + (error.hint || error.details || ''), 'error');
      }
      return;
    }
    if (showFeedback) showToast(t('groups.picksSaved'), 'success');
  } catch (err) {
    console.error('[spSaveGroupsToDb] caught:', err);
    showToast('DB error (groups): ' + (err.message || err), 'error');
  }
}

function spGroupsPrev() {
  if (spState.currentGroupIdx > 0) {
    spState.currentGroupIdx--;
    spRenderGroups();
  }
}

function spGroupsNext() {
  if (spState.currentGroupIdx < 11) {
    spState.currentGroupIdx++;
    spRenderGroups();
    return;
  }
  // Last group: validate all groups have all 4 filled before advancing to bracket
  const incomplete = WC2026_GROUP_LETTERS.filter(l =>
    !spState.groupPositions[l] || !spState.groupPositions[l].every(x => x)
  );
  if (incomplete.length > 0) {
    showToast(t('betting.groupsIncomplete', { letters: incomplete.join(', ') }), 'error');
    return;
  }
  spSaveGroupsToDb(false);
  spRenderBracket();
  showScreen('sp-bracket-screen');
}

function spGroupsSaveAndExit() {
  spSaveGroupsToDb(true);
  setTimeout(() => goToDashboard(), 400);
}

function spExit() {
  goToDashboard();
}

function spBackToGroups() {
  spState.currentGroupIdx = 11;
  spRenderGroups();
  showScreen('sp-groups-screen');
}

// ----- Hypothetical bracket -----
// Real WC bracket pairings (R16, by position):
//   1: A1 vs B2
//   2: C1 vs D2
//   3: E1 vs F2
//   4: G1 vs H2
//   5: I1 vs J2
//   6: K1 vs L2
//   7: B1 vs A2   (cross)
//   8: D1 vs C2
// Wait - need 8 R16 matches but 12 groups. The real WC2026 has 32 advancing
// (top 2 + best 8 third-placed). For simplicity in MVP, we'll use top 2
// from each group = 24 teams, then need 32 for R16... Actually the real
// format is: top 2 from each of 12 groups = 24 teams, plus 8 best
// third-placed teams. To keep this simple and deterministic, we use a
// canonical mapping that pairs winners of one group with runners-up of
// another - producing 16 advancing teams from top 2 only is too few.
// We follow the official WC2026 R16 bracket: 12 group winners + 12 runners-up
// + 8 best 3rd places = 32, then knockout starts at Round-of-32 (R32).
// To match the existing app's structure (R16 = 8 matches) we'll compute
// R16 from 16 teams: the 12 group winners + the top 4 runners-up.
// Simpler approach: pair adjacent groups' winners vs runners-up.
//   R16 #1: A1 vs B2
//   R16 #2: C1 vs D2
//   ...continuing the pattern across 12 groups produces 12 matches which
// is too many for R16. We need to switch to R16-as-8 by reducing.
//
// For this v2 hypothetical bracket, we simulate R16 = 8 matches by taking
// only the 8 "favorite" group winners + 8 second-best. But to keep it
// truly user-driven from their predictions, we use the simpler convention:
//   Slot S (1..8) is determined by groups paired in WC2026 order:
//     1: A1 vs B2
//     2: C1 vs D2
//     3: E1 vs F2
//     4: G1 vs H2
//     5: I1 vs J2
//     6: K1 vs L2
//     7: B1 vs A2
//     8: D1 vs C2
// This yields 8 R16 matches sourced from each of the 12 groups' top 2.
// (Groups E,F,G,H,I,J,K,L runners-up not yet used; in real WC 2026 the
// third-place teams fill remaining slots. For an MVP hypothetical bracket
// this convention is acceptable and intuitive.)

const SP_R16_PAIRS = [
  ['A',1,'B',2], ['C',1,'D',2], ['E',1,'F',2], ['G',1,'H',2],
  ['I',1,'J',2], ['K',1,'L',2], ['B',1,'A',2], ['D',1,'C',2]
];

function spGetR16Teams() {
  // Returns 8 pairs of {home, away} team codes (or null if user hasn't picked yet)
  return SP_R16_PAIRS.map(([g1, p1, g2, p2]) => ({
    home: spState.groupPositions[g1] ? spState.groupPositions[g1][p1 - 1] : null,
    away: spState.groupPositions[g2] ? spState.groupPositions[g2][p2 - 1] : null
  }));
}

function spGetMatchWinner(bracketPos) {
  return spState.bracketPicks[bracketPos] || null;
}

function spGetBracketStructure() {
  // R16 (1-8), QF (9-12), SF (13-14), Final (15)
  const r16Teams = spGetR16Teams();
  const r16Matches = r16Teams.map((m, i) => ({
    pos: i + 1,
    round: 'R16',
    home: m.home,
    away: m.away
  }));

  const qfMatches = [
    { pos: 9,  round: 'QF', home: spGetMatchWinner(1), away: spGetMatchWinner(2) },
    { pos: 10, round: 'QF', home: spGetMatchWinner(3), away: spGetMatchWinner(4) },
    { pos: 11, round: 'QF', home: spGetMatchWinner(5), away: spGetMatchWinner(6) },
    { pos: 12, round: 'QF', home: spGetMatchWinner(7), away: spGetMatchWinner(8) }
  ];

  const sfMatches = [
    { pos: 13, round: 'SF', home: spGetMatchWinner(9),  away: spGetMatchWinner(10) },
    { pos: 14, round: 'SF', home: spGetMatchWinner(11), away: spGetMatchWinner(12) }
  ];

  const finalMatch = {
    pos: 15, round: 'FINAL',
    home: spGetMatchWinner(13), away: spGetMatchWinner(14)
  };

  return { r16: r16Matches, qf: qfMatches, sf: sfMatches, final: finalMatch };
}

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
  const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
  container.innerHTML =
    renderRound('knockout.r16', struct.r16, rules.round_of_16) +
    renderRound('knockout.qf', struct.qf, rules.quarter_final) +
    renderRound('knockout.sf', struct.sf, rules.semi_final) +
    renderRound('knockout.final', [struct.final], rules.final);

  // v2.5.36: render the points-hint row above the bracket
  const hint = document.getElementById('sp-bracket-points-hint');
  if (hint) {
    const stages = [
      { label: t('knockout.r16'), pts: rules.round_of_16 },
      { label: t('knockout.qf'),  pts: rules.quarter_final },
      { label: t('knockout.sf'),  pts: rules.semi_final },
      { label: t('knockout.final'), pts: rules.final },
      { label: t('betting.tournamentWinner.title'), pts: rules.tournament_winner, winner: true }
    ];
    hint.innerHTML = stages
      .filter(s => s.pts != null && s.pts > 0)
      .map(s => `<span class="pts-pill${s.winner ? ' pts-pill-winner' : ''}">${s.label}: ${s.pts}</span>`)
      .join('');
  }

  // Update step counter
  const total = 15;
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
  return `
    <div class="sp-bracket-match">
      ${teamBtn(m.home, 'home')}
      <div class="sp-bracket-vs">VS</div>
      ${teamBtn(m.away, 'away')}
    </div>
  `;
}

function spPickBracket(bracketPos, teamCode) {
  if (spIsLocked()) return;
  const prev = spState.bracketPicks[bracketPos];
  spState.bracketPicks[bracketPos] = teamCode;

  // If the user changes a pick, clear downstream picks that depended on it
  if (prev && prev !== teamCode) {
    spClearDownstream(bracketPos);
  }

  // v2.4.3: the winner of the FINAL match (bracket position 15) IS the
  // tournament winner - so sync it automatically and persist. This removes
  // the duplicate sp-winner-screen step from the flow.
  if (parseInt(bracketPos, 10) === 15) {
    spState.tournamentWinner = teamCode;
    spSaveWinnerToDb(false);
  }

  spRenderBracket();
  spAutoSaveBracket();
}

function spClearDownstream(bracketPos) {
  // R16 (1-8) feeds QF: 1,2->9; 3,4->10; 5,6->11; 7,8->12
  // QF (9-12) feeds SF: 9,10->13; 11,12->14
  // SF (13,14) feeds Final: 15
  const parents = {
    1: 9, 2: 9, 3: 10, 4: 10, 5: 11, 6: 11, 7: 12, 8: 12,
    9: 13, 10: 13, 11: 14, 12: 14,
    13: 15, 14: 15
  };
  let p = parents[bracketPos];
  while (p) {
    delete spState.bracketPicks[p];
    // v2.4.3: bracket position 15 IS the tournament winner. If we just
    // invalidated that pick, also clear the mirrored tournamentWinner
    // value (and the row in tournament_winner_picks).
    if (p === 15) {
      spState.tournamentWinner = null;
      try {
        if (supabaseClient && state.currentUser) {
          supabaseClient.from('tournament_winner_picks')
            .delete().eq('user_id', state.currentUser.id);
        }
      } catch (e) { /* ignore */ }
    }
    p = parents[p];
  }
}

let _spBracketSaveTimer = null;
function spAutoSaveBracket() {
  if (_spBracketSaveTimer) clearTimeout(_spBracketSaveTimer);
  _spBracketSaveTimer = setTimeout(() => spSaveBracketToDb(false), 600);
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
  if (spIsLocked()) return;
  const userId = state.currentUser.id;
  const poolId = state.currentPool.id;

  // v2.5.22: knockout_picks is a LEGACY table from two-phase mode. Its
  // schema uses `predicted_winner` (text) + `match_id` + `round`, not
  // `team_code`. v2 single-phase uses the same table with bracket_position
  // (added in the 2026-05-17 migration). We synthesise match_id/round for
  // v2 rows so the legacy NOT NULL constraints (if any) are satisfied.
  const bracketRoundLabel = (pos) => {
    const p = parseInt(pos, 10);
    if (p >= 1 && p <= 8) return 'r16';
    if (p >= 9 && p <= 12) return 'qf';
    if (p >= 13 && p <= 14) return 'sf';
    if (p === 15) return 'final';
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

  try {
    // v2.5.7: scope DELETE to this pool. Without pool_id, saving bracket
    // picks in pool B would wipe pool A's bracket.
    const { error: delErr } = await supabaseClient.from('knockout_picks')
      .delete()
      .eq('user_id', userId)
      .eq('pool_id', poolId)
      .not('bracket_position', 'is', null);
    if (delErr) {
      console.error('[spSaveBracketToDb] DELETE error:', delErr);
      showToast('DB error (bracket DELETE): ' + (delErr.message || 'unknown'), 'error');
    }

    const { error } = await supabaseClient.from('knockout_picks').insert(rows);
    if (error) {
      // v2.5.20: surface save errors loudly (same as spSaveGroupsToDb).
      console.error('[spSaveBracketToDb] INSERT error:', error);
      // v2.5.21: friendly hint for the missing-teams FK case.
      const msg = (error.message || '') + ' ' + (error.details || '');
      if (/team_code_fkey/.test(msg) || /not present in table.*teams/.test(msg)) {
        showToast('Missing team codes in DB. Run migrations/2026-05-18-seed-wc2026-teams.sql in Supabase.', 'error');
      } else {
        showToast('DB error (bracket): ' + (error.message || 'unknown') + ' - ' + (error.hint || error.details || ''), 'error');
      }
      return;
    }

    if (showFeedback) showToast(t('groups.picksSaved'), 'success');
  } catch (err) {
    console.error('[spSaveBracketToDb] caught:', err);
    showToast('DB error (bracket): ' + (err.message || err), 'error');
  }
}

function spBracketNext() {
  // v2.4.3: skip the (now redundant) sp-winner-screen. The user already
  // picked the tournament winner when they chose the final match's
  // winner at bracket position 15. Go straight to the top-scorer step.
  if (!spState.tournamentWinner) {
    // Edge case: user advanced without picking the final. Surface a
    // helpful message rather than silently sending them onward.
    showToast(t('betting.finalRequired'), 'error');
    return;
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

function openSpBracketView() {
  const struct = spGetBracketStructure();
  const tree = document.getElementById('sp-bracket-tree');
  if (!tree) return;

  // Split positions into the two halves of the bracket
  // LEFT:  R16 #1-4 → QF #9,10 → SF #13
  // RIGHT: R16 #5-8 → QF #11,12 → SF #14
  // FINAL #15 in the middle
  const r16Left  = struct.r16.filter(m => [1, 2, 3, 4].includes(m.pos));
  const r16Right = struct.r16.filter(m => [5, 6, 7, 8].includes(m.pos));
  const qfLeft   = struct.qf.filter(m => [9, 10].includes(m.pos));
  const qfRight  = struct.qf.filter(m => [11, 12].includes(m.pos));
  const sfLeft   = struct.sf.filter(m => m.pos === 13);
  const sfRight  = struct.sf.filter(m => m.pos === 14);
  const finalMatch = struct.final;

  const champion = spState.bracketPicks[15];
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

  tree.innerHTML = `
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
  `;

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

window.openSpBracketView = openSpBracketView;
window.closeSpBracketView = closeSpBracketView;
window.setSpBracketViewSide = setSpBracketViewSide;

function spRenderWinnerScreen() {
  // Options: SF winners if user picked any; else fallback to all R16-picked teams
  const struct = spGetBracketStructure();
  let candidates = [];
  // Prefer the two SF winners (positions 13, 14)
  [13, 14].forEach(pos => {
    const w = spGetMatchWinner(pos);
    if (w) candidates.push(w);
  });
  if (candidates.length < 2) {
    // Fallback: include QF winners (9-12)
    [9,10,11,12].forEach(pos => {
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
  spRenderWinnerScreen();
  spSaveWinnerToDb(false);
}

async function spSaveWinnerToDb(showFeedback = true) {
  if (!state.currentPool || !state.currentUser || !spState.tournamentWinner) return;
  const userId = state.currentUser.id;
  const poolId = state.currentPool.id;
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
    if (typeof spRenderSummary === 'function') spRenderSummary();
    showScreen('sp-summary-screen');
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

function spTopScorerNext() {
  state.spInFlow = false;
  const nav = document.getElementById('ts-sp-flow-nav');
  if (nav) nav.style.display = 'none';
  spRenderSummary();
  showScreen('sp-summary-screen');
}

// Smart back handler for the standalone top-scorer screen
function topScorerBack() {
  if (state.spInFlow) {
    spTopScorerBack();
  } else {
    goToDashboard();
  }
}
window.topScorerBack = topScorerBack;
window.spTopScorerBack = spTopScorerBack;
window.spTopScorerNext = spTopScorerNext;

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

  // Groups summary
  const groupsEl = document.getElementById('sp-summary-groups');
  groupsEl.innerHTML = WC2026_GROUP_LETTERS.map(letter => {
    const positions = spState.groupPositions[letter] || [];
    return `
      <div style="margin-bottom:10px;">
        <div style="font-weight:600;color:#d4a853;font-size:12px;letter-spacing:.5px;margin-bottom:4px;">
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

  // Bracket summary
  const struct = spGetBracketStructure();
  const bracketEl = document.getElementById('sp-summary-bracket');
  const renderBracketRound = (label, matches) => {
    return `
      <div style="font-weight:600;color:#d4a853;font-size:12px;letter-spacing:.5px;margin:8px 0 4px;">
        ${label}
      </div>
      ${matches.map(m => {
        const winner = spGetMatchWinner(m.pos);
        return `
          <div class="sp-summary-row">
            <span class="sr-flag">${winner ? getCountryFlag(winner) : '—'}</span>
            <span class="sr-value">${winner ? getTeamName(winner) : t('betting.notPicked')}</span>
            <span class="sr-label">(${m.home ? getTeamName(m.home) : '?'} vs ${m.away ? getTeamName(m.away) : '?'})</span>
          </div>
        `;
      }).join('')}
    `;
  };
  bracketEl.innerHTML =
    renderBracketRound(t('knockout.r16'), struct.r16) +
    renderBracketRound(t('knockout.qf'), struct.qf) +
    renderBracketRound(t('knockout.sf'), struct.sf) +
    renderBracketRound(t('knockout.final'), [struct.final]);

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
        <span class="sr-value">${ts.player_name}</span>
        <span class="sr-label">${ts.team_code}</span>
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
  // Edit from summary: use the standalone top-scorer screen.
  // (No SP-flow nav - the user goes back to dashboard via the topbar.)
  state.spInFlow = false;
  const nav = document.getElementById('ts-sp-flow-nav');
  if (nav) nav.style.display = 'none';
  if (typeof showTopScorer === 'function') showTopScorer();
}

async function spSubmitPredictions() {
  // Final validation - must have winner + all groups filled
  if (!spState.tournamentWinner) {
    showToast(t('betting.winnerRequired'), 'error');
    return;
  }
  const incompleteGroups = WC2026_GROUP_LETTERS.filter(l =>
    !spState.groupPositions[l] || !spState.groupPositions[l].every(x => x)
  );
  if (incompleteGroups.length > 0) {
    showToast(t('betting.groupsIncomplete', { letters: incompleteGroups.join(', ') }), 'error');
    return;
  }

  // v2.5.2: groups/bracket/winner are auto-saved on every change throughout
  //         the flow, so the DB is already current by the time we land here.
  //         Only the predictions_submitted_at update is actually needed -
  //         1 round-trip instead of 4, and a button spinner so the user
  //         sees immediate feedback during that single round-trip.
  const btn = document.getElementById('sp-submit-btn');
  const originalBtnHtml = btn ? btn.innerHTML : null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ti ti-loader-2" style="animation: spin 0.8s linear infinite;"></i><span>${t('groups.savingPicks')}</span>`;
  }

  try {
    const submittedAt = new Date().toISOString();
    const { error } = await supabaseClient.from('users')
      .update({ predictions_submitted_at: submittedAt })
      .eq('id', state.currentUser.id);
    if (error && !/column .* does not exist/i.test(error.message || '')) {
      console.warn('predictions_submitted_at update warning:', error);
    }
    state.currentUser.predictions_submitted_at = submittedAt;

    goToDashboard();
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
      <div style="font-weight:600;color:#d4a853;font-size:12px;">${t('groups.group')} ${letter}</div>
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

  // Bracket
  const struct = spGetBracketStructure();
  html += `<div class="sp-summary-card">
    <div class="sp-summary-section-title">${t('betting.summary.bracket')}</div>`;
  [['knockout.r16', struct.r16], ['knockout.qf', struct.qf],
   ['knockout.sf', struct.sf], ['knockout.final', [struct.final]]].forEach(([key, matches]) => {
    html += `<div style="font-weight:600;color:#d4a853;font-size:12px;margin:6px 0 3px;">${t(key)}</div>`;
    matches.forEach(m => {
      const w = spGetMatchWinner(m.pos);
      html += `<div class="sp-summary-row">
        <span class="sr-flag">${w ? getCountryFlag(w) : '—'}</span>
        <span class="sr-value">${w ? getTeamName(w) : '—'}</span>
      </div>`;
    });
  });
  html += '</div>';

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
  if (!state.currentPool || state.currentPool.locked_at) return;
  if (!supabaseClient) return;

  try {
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
    // Load groups + bracket + winner + top scorer for that user
    const [gpp, kp, twp, tsp] = await Promise.all([
      supabaseClient.from('group_position_picks').select('*').eq('user_id', userId),
      supabaseClient.from('knockout_picks').select('*').eq('user_id', userId).not('bracket_position', 'is', null),
      supabaseClient.from('tournament_winner_picks').select('*').eq('user_id', userId).maybeSingle(),
      supabaseClient.from('top_scorer_picks').select('*').eq('user_id', userId).maybeSingle()
    ]);

    const positions = {};
    (gpp.data || []).forEach(p => {
      if (!positions[p.group_letter]) positions[p.group_letter] = [null,null,null,null];
      positions[p.group_letter][p.position - 1] = p.team_code;
    });
    const bracket = {};
    (kp.data || []).forEach(p => { bracket[p.bracket_position] = p.team_code; });
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
          <div style="font-weight:600;color:#d4a853;font-size:12px;">${t('groups.group')} ${letter}</div>`;
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
      // Build matches list with home/away from positions
      const getMatchWinner = (pos) => bracket[pos];
      const r16 = SP_R16_PAIRS.map(([g1,p1,g2,p2], i) => ({
        pos: i+1,
        home: positions[g1] ? positions[g1][p1-1] : null,
        away: positions[g2] ? positions[g2][p2-1] : null
      }));
      const qf = [
        { pos: 9,  home: getMatchWinner(1), away: getMatchWinner(2) },
        { pos: 10, home: getMatchWinner(3), away: getMatchWinner(4) },
        { pos: 11, home: getMatchWinner(5), away: getMatchWinner(6) },
        { pos: 12, home: getMatchWinner(7), away: getMatchWinner(8) }
      ];
      const sf = [
        { pos: 13, home: getMatchWinner(9),  away: getMatchWinner(10) },
        { pos: 14, home: getMatchWinner(11), away: getMatchWinner(12) }
      ];
      const fin = { pos: 15, home: getMatchWinner(13), away: getMatchWinner(14) };

      html += `<div class="sp-summary-card"><div class="sp-summary-section-title">${t('betting.summary.bracket')}</div>`;
      [['knockout.r16', r16], ['knockout.qf', qf], ['knockout.sf', sf], ['knockout.final', [fin]]].forEach(([key, matches]) => {
        html += `<div style="font-weight:600;color:#d4a853;font-size:12px;margin:6px 0 3px;">${t(key)}</div>`;
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
          <span class="sr-value">${topScorer.player_name}</span>
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
  const codeCard = document.getElementById('rc-code-card');

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
  // Focus the code card so it's visually obvious where to act
  const card = document.getElementById('rc-code-card');
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
  const card = document.createElement('div');
  card.style.cssText = [
    'position: fixed',
    'left: -9999px',
    'top: 0',
    'width: 600px',
    'padding: 48px 44px',
    'background: linear-gradient(135deg, #0a1628 0%, #1a2942 60%, #243a5a 100%)',
    'color: #fff',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'border-radius: 28px',
    'box-sizing: border-box'
  ].join(';');
  const code = rcFormatCode(rcState.code);
  const pool = rcState.poolName || '—';
  card.innerHTML = `
    <div style="font-size: 30px; font-weight: 800; color: #d4a853; letter-spacing: 0.5px;">
      ⚽ FriendlyBet
    </div>
    <div style="margin-top: 34px; font-size: 12px; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 2px;">
      ${t('recovery.screenshot.codeLabel')}
    </div>
    <div style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 36px; font-weight: 700; letter-spacing: 3px; color: #d4a853; margin-top: 10px; word-break: break-all;">
      ${code}
    </div>
    <div style="margin-top: 28px; font-size: 12px; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 2px;">
      Pool
    </div>
    <div style="font-size: 22px; font-weight: 600; margin-top: 6px;">
      ${pool}
    </div>
    <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; color: rgba(255,255,255,0.45);">
      ${t('recovery.txt.loginAt')} friendlybet.live
    </div>
  `;
  return card;
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
    const card = _rcBuildCardElement();
    document.body.appendChild(card);
    let canvas;
    try {
      canvas = await window.html2canvas(card, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true
      });
    } finally {
      if (card.parentNode) card.parentNode.removeChild(card);
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
  const out = [];
  for (let i = 1; i <= 8;  i++) out.push({ round: 'R16', pos: i });
  for (let i = 9; i <= 12; i++) out.push({ round: 'QF',  pos: i });
  for (let i = 13; i <= 14; i++) out.push({ round: 'SF', pos: i });
  out.push({ round: 'FINAL', pos: 15 });
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
  // single-phase scoring rules
  const rules = (state.currentPool && state.currentPool.scoring_rules) || {};
  // v2.5.44: the FINAL match in single_phase rewards BOTH the final-correct
  // pick and the tournament_winner bonus (the winner of the final IS the
  // tournament champion). Show the combined total so the displayed number
  // matches what a correct pick actually earns.
  if (round === 'FINAL') {
    return (rules.final ?? 16) + (rules.tournament_winner ?? 0);
  }
  return ({
    R16: rules.round_of_16 ?? 2,
    QF:  rules.quarter_final ?? 4,
    SF:  rules.semi_final ?? 8
  })[round] || 2;
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
  const all = [...struct.r16, ...struct.qf, ...struct.sf, struct.final];
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
    const prev = spState.bracketPicks[step.pos];
    spState.bracketPicks[step.pos] = teamCode;
    if (prev && prev !== teamCode) spClearDownstream(step.pos);
    spAutoSaveBracket();
  }
}

function koSingleRender() {
  const step = koSingle.sequence[koSingle.idx];
  if (!step) return;

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

  card.innerHTML = `
    <div class="ko-single-match-header">${label}</div>
    <div class="ko-single-points">${headerPointsLabel}</div>
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
    // Hand off to the existing grid view so user can review/edit
    knockoutState.currentRound = 'R32';
    renderKnockout();
    showScreen('knockout-screen');
    showToast(t('knockoutFirst.completedToast'), 'success');
  } else {
    // v2.4.3: single-phase - the FINAL match (bracket position 15) is
    // the tournament winner, so we go straight to top scorer; no
    // separate "pick the winner" detour.
    if (!spState.tournamentWinner && spState.bracketPicks && spState.bracketPicks[15]) {
      spState.tournamentWinner = spState.bracketPicks[15];
      spSaveWinnerToDb(false);
    }
    state.spInFlow = true;
    spStartTopScorerStep();
  }
}

// Entry-point overrides ----------------------------------------------------

// Wrap startKnockoutBetting so first-time users see single-match walkthrough.
const _origStartKnockoutBetting = startKnockoutBetting;
startKnockoutBetting = async function() {
  if (!state.currentUser || !state.currentPool || !supabaseClient) {
    return _origStartKnockoutBetting();
  }
  // Check if the user has any existing knockout picks (=> NOT first time)
  let hasPicks = false;
  try {
    const { data } = await supabaseClient
      .from('knockout_picks')
      .select('id')
      .eq('user_id', state.currentUser.id)
      .limit(1);
    hasPicks = !!(data && data.length);
  } catch (e) { /* fall through */ }

  if (hasPicks) {
    return _origStartKnockoutBetting();
  }

  // First time - run the original loader to set up matches, then route to single mode
  await _origStartKnockoutBetting();
  // _origStartKnockoutBetting will have switched to knockout-screen. Override.
  if (Object.keys(knockoutState.picks || {}).length === 0) {
    koSingle.mode = 'two-phase';
    koSingle.sequence = _koTwoPhaseSequence();
    koSingle.idx = 0;
    koSingleRender();
    showScreen('ko-single-screen');
  }
};

// Wrap spGroupsNext to route to single-match bracket walkthrough on first pass
const _origSpGroupsNext = spGroupsNext;
spGroupsNext = function() {
  // Let the original handle "not at last group" and validation
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
  spSaveGroupsToDb(false);

  // First time = no bracket picks yet. Use single-match walkthrough.
  if (!spState.bracketPicks || Object.keys(spState.bracketPicks).length === 0) {
    koSingle.mode = 'single-phase';
    koSingle.sequence = _koSinglePhaseSequence();
    koSingle.idx = 0;
    state.spInFlow = true;
    koSingleRender();
    showScreen('ko-single-screen');
    return;
  }
  spRenderBracket();
  showScreen('sp-bracket-screen');
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
    'sp-bracket-view-modal'
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

// Wire up the hijack as soon as the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBackButtonHijack);
} else {
  setupBackButtonHijack();
}
