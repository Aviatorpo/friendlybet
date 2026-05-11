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
    showError('join-error', 'נא להזין קוד הימור');
    return;
  }
  
  if (code.length !== 5) {
    showError('join-error', 'קוד הימור הוא 5 תווים');
    return;
  }
  
  // Make sure supabase is ready
  if (!supabaseClient) {
    showError('join-error', 'מתחבר לשרת... נסה שוב בעוד רגע');
    initSupabase();
    return;
  }
  
  // Search pool
  try {
    showToast('מחפש את ההימור...', 'info');
    
    const { data, error } = await supabaseClient
      .from('pools')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    
    if (error) {
      console.error('Pool search error:', error);
      showError('join-error', 'שגיאה בחיפוש ההימור. נסה שוב.');
      return;
    }
    
    if (!data) {
      showError('join-error', `לא נמצא הימור עם הקוד ${code}`);
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
      'open': 'פתוח להצטרפות',
      'group_locked': 'שלב הבתים סגור',
      'knockout_active': 'בשלב הנוקאאוט',
      'finished': 'הסתיים'
    };
    document.getElementById('found-pool-status').textContent = statusMap[data.status] || data.status;
    
    showScreen('pool-found-screen');
    
  } catch (err) {
    console.error('Unexpected error:', err);
    showError('join-error', 'שגיאה לא צפויה. נסה שוב.');
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
      
      statusDiv.innerHTML = '<span class="status-checking">בודק זמינות...</span>';
      
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
      statusDiv.innerHTML = '<span class="status-taken"><i class="ti ti-x"></i> הכינוי תפוס, נסה אחר</span>';
    } else {
      statusDiv.innerHTML = '<span class="status-available"><i class="ti ti-check"></i> הכינוי פנוי!</span>';
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
    showError('nickname-error', 'נא להזין כינוי');
    return;
  }
  
  if (nickname.length < CONFIG.MIN_NICKNAME_LENGTH) {
    showError('nickname-error', `הכינוי חייב להיות לפחות ${CONFIG.MIN_NICKNAME_LENGTH} תווים`);
    return;
  }
  
  if (nickname.length > CONFIG.MAX_NICKNAME_LENGTH) {
    showError('nickname-error', `הכינוי לא יכול לחרוג מ-${CONFIG.MAX_NICKNAME_LENGTH} תווים`);
    return;
  }
  
  // Make sure supabase is ready
  if (!supabaseClient) {
    showError('nickname-error', 'מתחבר לשרת... נסה שוב בעוד רגע');
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
      showError('nickname-error', 'הכינוי כבר תפוס בהימור הזה');
      return;
    }
    
    // Save nickname for next step
    state.pendingNickname = nickname;
    
    // Generate recovery code
    state.pendingRecoveryCode = generateRecoveryCode();
    document.getElementById('recovery-code-value').textContent = state.pendingRecoveryCode;
    
    showScreen('recovery-code-screen');
    
  } catch (err) {
    console.error('Submit nickname error:', err);
    showError('nickname-error', 'שגיאה לא צפויה. נסה שוב.');
  }
}

// ============================================================
// RECOVERY CODE FLOW
// ============================================================

function copyRecoveryCode() {
  const code = state.pendingRecoveryCode;
  if (!code) return;
  
  navigator.clipboard.writeText(code).then(() => {
    showToast('קוד השחזור הועתק! שמור אותו במקום בטוח', 'success');
  }).catch(() => {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = code;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('קוד השחזור הועתק!', 'success');
  });
}

function shareRecoveryToWhatsApp() {
  const code = state.pendingRecoveryCode;
  const poolName = state.currentPool?.name || 'FriendlyBet';
  
  const text = `🔑 קוד השחזור שלי ל-${poolName}:\n\n${code}\n\n⚠️ שמור הודעה זו - תזדקק לקוד אם תרצה להתחבר מחדש!\n\n${window.location.origin}`;
  
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

async function completeRegistration() {
  if (!state.pendingNickname || !state.pendingRecoveryCode || !state.currentPool) {
    showToast('שגיאה - חסרים נתונים', 'error');
    return;
  }
  
  // Make sure supabase is ready
  if (!supabaseClient) {
    showToast('מתחבר לשרת... נסה שוב בעוד רגע', 'error');
    initSupabase();
    return;
  }
  
  try {
    showToast('יוצר משתמש...', 'info');
    
    // Hash recovery code
    const recoveryHash = await hashRecoveryCode(state.pendingRecoveryCode);
    
    // Create user
    const { data: user, error } = await supabaseClient
      .from('users')
      .insert({
        pool_id: state.currentPool.id,
        nickname: state.pendingNickname,
        recovery_code_hash: recoveryHash,
        is_admin: false,
        is_approved: true // No approval needed by default
      })
      .select()
      .single();
    
    if (error) {
      console.error('User creation error:', error);
      showToast('שגיאה ביצירת המשתמש: ' + error.message, 'error');
      return;
    }
    
    // Save locally
    saveLocalUser(user);
    state.currentUser = user;
    
    // Clear pending data
    state.pendingNickname = null;
    state.pendingRecoveryCode = null;
    
    showToast('ברוך הבא ל-' + state.currentPool.name + '!', 'success');
    
    // Go to dashboard
    setTimeout(() => {
      goToDashboard();
    }, 1000);
    
  } catch (err) {
    console.error('Complete registration error:', err);
    showToast('שגיאה לא צפויה', 'error');
  }
}

// ============================================================
// CREATE POOL FLOW
// ============================================================

function useSuggestion(name) {
  document.getElementById('pool-name-input').value = name;
}

function submitPoolName() {
  const input = document.getElementById('pool-name-input');
  const name = input.value.trim();
  
  if (!name) {
    showError('create-error', 'נא להזין שם להימור');
    return;
  }
  
  if (name.length < CONFIG.MIN_POOL_NAME_LENGTH) {
    showError('create-error', `השם חייב להיות לפחות ${CONFIG.MIN_POOL_NAME_LENGTH} תווים`);
    return;
  }
  
  state.pendingPoolName = name;
  showScreen('admin-nickname-screen');
}

async function createPool() {
  const input = document.getElementById('admin-nickname-input');
  const adminNickname = input.value.trim();
  
  if (!adminNickname) {
    showError('admin-error', 'נא להזין את הכינוי שלך');
    return;
  }
  
  if (adminNickname.length < CONFIG.MIN_NICKNAME_LENGTH) {
    showError('admin-error', `הכינוי חייב להיות לפחות ${CONFIG.MIN_NICKNAME_LENGTH} תווים`);
    return;
  }
  
  // Make sure supabase is ready
  if (!supabaseClient) {
    showError('admin-error', 'מתחבר לשרת... נסה שוב בעוד רגע');
    initSupabase();
    return;
  }
  
  try {
    showToast('יוצר את ההימור...', 'info');
    
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
      showToast('שגיאה ביצירת קוד ייחודי', 'error');
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
      showToast('שגיאה ביצירת ההימור: ' + poolError.message, 'error');
      return;
    }
    
    // Generate recovery code for admin
    const adminRecoveryCode = generateRecoveryCode();
    const adminRecoveryHash = await hashRecoveryCode(adminRecoveryCode);
    
    // Create admin user
    const { data: adminUser, error: userError } = await supabaseClient
      .from('users')
      .insert({
        pool_id: pool.id,
        nickname: adminNickname,
        recovery_code_hash: adminRecoveryHash,
        is_admin: true,
        is_approved: true
      })
      .select()
      .single();
    
    if (userError) {
      console.error('Admin user creation error:', userError);
      showToast('שגיאה ביצירת מנהל ההימור: ' + userError.message, 'error');
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
    
    // Show share screen
    document.getElementById('created-pool-code').textContent = poolCode;
    
    showToast('ההימור נוצר בהצלחה! 🎉', 'success');
    showScreen('share-pool-screen');
    
    // Show recovery code modal (admin can save it later from settings)
    setTimeout(() => {
      alert(`🔑 קוד השחזור שלך כמארגן:\n\n${adminRecoveryCode}\n\nשמור אותו במקום בטוח! בלעדיו לא תוכל להתחבר חזרה.`);
    }, 500);
    
  } catch (err) {
    console.error('Create pool error:', err);
    showToast('שגיאה לא צפויה', 'error');
  }
}

// ============================================================
// SHARE FUNCTIONS
// ============================================================

function getShareMessage() {
  const pool = state.currentPool;
  if (!pool) return '';
  
  const url = `${window.location.origin}?code=${pool.code}`;
  return `🏆 הוזמנת להימור על מונדיאל 2026!\n\nשם ההימור: ${pool.name}\nקוד הצטרפות: ${pool.code}\n\nלהצטרפות:\n${url}\n\n_FriendlyBet - חינמי, ללא פרסומות_`;
}

function shareWhatsApp() {
  const url = `https://wa.me/?text=${encodeURIComponent(getShareMessage())}`;
  window.open(url, '_blank');
}

function shareTelegram() {
  const text = getShareMessage();
  const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function copyShareLink() {
  const text = getShareMessage();
  navigator.clipboard.writeText(text).then(() => {
    showToast('הודעת השיתוף הועתקה!', 'success');
  });
}

// ============================================================
// DASHBOARD
// ============================================================

async function goToDashboard() {
  if (!state.currentUser || !state.currentPool) {
    const local = loadLocalUser();
    if (!local) {
      showScreen('home-screen');
      return;
    }
    
    // Reload from DB
    const { data: pool } = await supabaseClient
      .from('pools')
      .select('*')
      .eq('id', local.pool_id)
      .maybeSingle();
    
    const { data: user } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', local.id)
      .maybeSingle();
    
    if (!pool || !user) {
      clearLocalUser();
      showScreen('home-screen');
      return;
    }
    
    state.currentPool = pool;
    state.currentUser = user;
  }
  
  // Update dashboard display
  document.getElementById('dashboard-pool-name').textContent = state.currentPool.name;
  document.getElementById('dashboard-user-name').textContent = state.currentUser.nickname;
  document.getElementById('user-points').textContent = state.currentUser.total_score || 0;
  
  // Compute rank
  const { data: allUsers } = await supabaseClient
    .from('users')
    .select('id, total_score')
    .eq('pool_id', state.currentPool.id)
    .order('total_score', { ascending: false });
  
  if (allUsers) {
    const rank = allUsers.findIndex(u => u.id === state.currentUser.id) + 1;
    document.getElementById('user-rank').textContent = rank;
  }
  
  showScreen('user-dashboard-screen');
}

// Placeholder functions for future screens
function startGroupBetting() {
  showToast('שלב הבתים יבנה בשיחה הבאה 🚧', 'info');
}

function showLeaderboard() {
  showToast('לוח דירוגים יבנה בשיחה הבאה 🚧', 'info');
}

function showHelp() {
  showToast('מסך עזרה יבנה בשיחה הבאה 🚧', 'info');
}

function openMenu() {
  if (confirm('האם להתנתק מההימור?\n(הקוד שלך עדיין יעבוד)')) {
    clearLocalUser();
    state.currentUser = null;
    state.currentPool = null;
    showScreen('home-screen');
    showToast('התנתקת מההימור', 'info');
  }
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

async function initApp() {
  console.log('FriendlyBet v' + CONFIG.APP_VERSION + ' starting...');
  
  // Check URL for pool code parameter (?code=XXXXX)
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code');
  
  // Check if user is logged in
  const localUser = loadLocalUser();
  
  // Small delay for loading screen aesthetics
  setTimeout(async () => {
    if (codeFromUrl) {
      // Direct join via link
      document.getElementById('pool-code-input').value = codeFromUrl.toUpperCase();
      showScreen('join-pool-screen');
      // Auto-check
      setTimeout(() => checkPoolCode(), 300);
    } else if (localUser && localUser.pool_id) {
      // User has account - go to dashboard
      await goToDashboard();
    } else {
      // First visit - show home
      showScreen('home-screen');
    }
  }, 1000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Auto-uppercase pool code input
document.addEventListener('DOMContentLoaded', () => {
  const poolCodeInput = document.getElementById('pool-code-input');
  if (poolCodeInput) {
    poolCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }
});
