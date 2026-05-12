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
  document.getElementById('dashboard-pool-code').textContent = state.currentPool.code;
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
  
  // Update betting status based on actual picks
  updateBettingStatusOnDashboard();
  updateKnockoutStatusOnDashboard();
  
  showScreen('user-dashboard-screen');
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
  document.getElementById('menu-user-initial').textContent = user.nickname.charAt(0);
  document.getElementById('menu-user-name').textContent = user.nickname;
  document.getElementById('menu-user-role').textContent = user.is_admin ? 'מארגן ומשתתף' : 'משתתף';
  document.getElementById('menu-pool-name').textContent = pool.name;
  document.getElementById('menu-pool-code').textContent = pool.code;
  
  // Show admin section if admin
  const adminSection = document.getElementById('menu-admin-section');
  if (adminSection) {
    adminSection.style.display = user.is_admin ? 'block' : 'none';
  }
  
  // Open the sheet
  document.getElementById('menu-overlay').classList.add('active');
  document.getElementById('menu-sheet').classList.add('active');
  document.body.style.overflow = 'hidden';
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
  // Show a quick action sheet or just trigger WhatsApp share
  shareWhatsApp();
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
    showToast('שגיאה בטעינה', 'error');
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
    showToast('שגיאה בטעינת המשתתפים', 'error');
    return;
  }
  
  // For each member, check if they've placed bets
  const { data: allPicks } = await supabaseClient
    .from('group_picks')
    .select('user_id')
    .eq('pool_id', state.currentPool.id);
  
  // Count picks per user
  const picksPerUser = {};
  if (allPicks) {
    allPicks.forEach(p => {
      picksPerUser[p.user_id] = (picksPerUser[p.user_id] || 0) + 1;
    });
  }
  
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
    const card = createMemberCard(member, picks);
    list.appendChild(card);
  });
}

function createMemberCard(member, picksCount) {
  const card = document.createElement('div');
  card.className = 'member-card';
  
  const isMe = state.currentUser && member.id === state.currentUser.id;
  if (isMe) card.classList.add('is-me');
  if (member.is_admin) card.classList.add('is-admin');
  
  // Status
  let statusClass, statusText, statusEmoji;
  if (picksCount === 0) {
    statusClass = 'not-started';
    statusText = 'עדיין לא הימר';
  } else if (picksCount < 32) {
    statusClass = 'partial';
    statusText = `הימר ${picksCount}/32`;
  } else {
    statusClass = 'completed';
    statusText = 'הימר על כל הבתים';
  }
  
  // Joined date
  const joinedDate = new Date(member.joined_at);
  const today = new Date();
  const daysAgo = Math.floor((today - joinedDate) / (1000 * 60 * 60 * 24));
  let joinedText;
  if (daysAgo === 0) joinedText = 'הצטרף היום';
  else if (daysAgo === 1) joinedText = 'הצטרף אתמול';
  else if (daysAgo < 7) joinedText = `הצטרף לפני ${daysAgo} ימים`;
  else joinedText = `הצטרף ב-${joinedDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}`;
  
  card.innerHTML = `
    <div class="lb-avatar-small">${member.nickname.charAt(0)}</div>
    <div class="member-info">
      <div class="member-name">
        ${member.nickname}
        ${member.is_admin ? '<span class="admin-badge">מארגן</span>' : ''}
        ${isMe ? '<span class="lb-badge">אתה</span>' : ''}
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

function showAdminMembers() {
  closeMenu();
  showToast('🚧 ניהול חברים - בשיחה הבאה', 'info');
}

function showApprovals() {
  closeMenu();
  showToast('🚧 אישור משתמשים - בשיחה הבאה', 'info');
}

// ============================================================
// POOL SETTINGS - Full settings screen
// ============================================================

// In-memory copy of settings being edited
let editingSettings = null;

async function showPoolSettings() {
  closeMenu();
  
  if (!state.currentPool) {
    showToast('לא נמצא הימור', 'error');
    return;
  }
  
  // Re-fetch latest pool data
  const { data: pool, error } = await supabaseClient
    .from('pools')
    .select('*')
    .eq('id', state.currentPool.id)
    .single();
  
  if (error || !pool) {
    showToast('שגיאה בטעינת ההגדרות', 'error');
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
  
  document.getElementById('settings-approve-before').checked = pool.approve_before_betting;
  
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
  showToast('הוחזר לחוקי Golazo המקוריים', 'success');
}

function setTopScorerBonus(value, showFeedback = true) {
  document.querySelectorAll('.bonus-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.bonus) === value);
  });
  if (showFeedback) {
    showToast(`בונוס מלך השערים: ${value} נקודות`, 'success');
  }
}

async function savePoolSettings() {
  if (!state.currentPool || !state.currentUser) {
    showToast('שגיאה - חסרים נתונים', 'error');
    return;
  }
  
  if (!state.currentUser.is_admin) {
    showToast('רק המארגן יכול לערוך הגדרות', 'error');
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
    approve_before_betting: document.getElementById('settings-approve-before').checked,
  };
  
  // Max participants
  if (document.getElementById('settings-limit-members').checked) {
    newSettings.max_participants = parseInt(document.getElementById('settings-max-members').value) || null;
  } else {
    newSettings.max_participants = null;
  }
  
  // Validate name
  if (!newSettings.name || newSettings.name.length < CONFIG.MIN_POOL_NAME_LENGTH) {
    showToast('שם ההימור קצר מדי', 'error');
    return;
  }
  
  try {
    showToast('שומר הגדרות...', 'info');
    
    const { error } = await supabaseClient
      .from('pools')
      .update(newSettings)
      .eq('id', state.currentPool.id);
    
    if (error) {
      console.error('Settings save error:', error);
      showToast('שגיאה בשמירה: ' + error.message, 'error');
      return;
    }
    
    // Update local state
    Object.assign(state.currentPool, newSettings);
    
    showToast('ההגדרות נשמרו בהצלחה! ✅', 'success');
    
    // Return to dashboard after short delay
    setTimeout(() => {
      goToDashboard();
    }, 800);
    
  } catch (err) {
    console.error('Save settings error:', err);
    showToast('שגיאה לא צפויה', 'error');
  }
}

async function confirmDeletePool() {
  if (!state.currentPool || !state.currentUser?.is_admin) return;
  
  const poolName = state.currentPool.name;
  const confirmed = confirm(
    `⚠️ אזהרה!\n\nאתה עומד למחוק את ההימור "${poolName}".\n\nכל הנתונים, ההימורים והניקוד יימחקו לצמיתות.\n\nפעולה זו לא ניתנת לביטול.\n\nהאם להמשיך?`
  );
  
  if (!confirmed) return;
  
  // Second confirmation
  const finalConfirm = prompt(`כדי לאשר, הקלד את שם ההימור:\n"${poolName}"`);
  
  if (finalConfirm !== poolName) {
    showToast('המחיקה בוטלה', 'info');
    return;
  }
  
  try {
    const { error } = await supabaseClient
      .from('pools')
      .delete()
      .eq('id', state.currentPool.id);
    
    if (error) {
      console.error('Delete pool error:', error);
      showToast('שגיאה במחיקה: ' + error.message, 'error');
      return;
    }
    
    clearLocalUser();
    state.currentPool = null;
    state.currentUser = null;
    
    showToast('ההימור נמחק', 'info');
    setTimeout(() => {
      showScreen('home-screen');
    }, 1000);
    
  } catch (err) {
    console.error('Delete pool error:', err);
    showToast('שגיאה לא צפויה', 'error');
  }
}

function toggleLanguage() {
  closeMenu();
  showToast('🚧 שינוי שפה - בשיחה הבאה', 'info');
}

function logoutConfirm() {
  closeMenu();
  setTimeout(() => {
    if (confirm('האם להתנתק מההימור?\n\nהקוד שלך עדיין יעבוד - תוכל להתחבר שוב עם קוד השחזור.')) {
      clearLocalUser();
      state.currentUser = null;
      state.currentPool = null;
      showScreen('home-screen');
      showToast('התנתקת מההימור', 'info');
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
    showToast('שגיאה - אנא התחבר מחדש', 'error');
    return;
  }
  
  if (!supabaseClient) {
    showToast('מתחבר לשרת... נסה שוב', 'error');
    initSupabase();
    return;
  }
  
  showToast('טוען את הקבוצות...', 'info');
  
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
      showToast('שגיאה בטעינת הקבוצות', 'error');
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
    showToast('שגיאה לא צפויה', 'error');
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
  if (currentGroupStepEl) currentGroupStepEl.textContent = `בית ${bettingState.currentGroupIndex + 1} מתוך 12`;
  
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
    <span>בית ${prevLetter}</span>
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
      <span class="next-btn-warning-text">בחר עוד ${need} קבוצ${need > 1 ? 'ות' : 'ה'} כדי להמשיך</span>
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
        <span>סיים את ההימור</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    } else {
      // Normal next
      nextBtn.innerHTML = `
        <span>בית ${nextLetter}</span>
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
  
  // Tier badge text
  const usesMultipliers = state.currentPool.use_multipliers;
  let tierBadge = '';
  if (usesMultipliers) {
    if (team.tier === 'favorite') {
      tierBadge = '<span class="team-tier-badge team-tier-favorite">⭐ פייבוריטית ×1</span>';
    } else if (team.tier === 'contender') {
      tierBadge = '<span class="team-tier-badge team-tier-contender">⚔️ מתמודדת ×1.5</span>';
    } else {
      tierBadge = '<span class="team-tier-badge team-tier-underdog">🐴 אנדרדוג ×2</span>';
    }
  }
  
  // Flag emoji from country code
  const flagEmoji = getCountryFlag(team.code);
  
  card.innerHTML = `
    <div class="team-flag">${flagEmoji}</div>
    <div class="team-info">
      <div class="team-name">${team.name_he}</div>
      ${tierBadge}
    </div>
    <div class="team-checkbox"></div>
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
    'ARG': '🇦🇷', 'FRA': '🇫🇷', 'BRA': '🇧🇷', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'ESP': '🇪🇸', 'POR': '🇵🇹', 'NED': '🇳🇱', 'GER': '🇩🇪',
    'BEL': '🇧🇪', 'CRO': '🇭🇷', 'ITA': '🇮🇹', 'URU': '🇺🇾',
    'USA': '🇺🇸', 'MEX': '🇲🇽', 'SUI': '🇨🇭', 'DEN': '🇩🇰',
    'AUT': '🇦🇹', 'SWE': '🇸🇪', 'SEN': '🇸🇳', 'MAR': '🇲🇦',
    'JPN': '🇯🇵', 'KOR': '🇰🇷', 'AUS': '🇦🇺', 'CAN': '🇨🇦',
    'POL': '🇵🇱', 'UKR': '🇺🇦', 'TUR': '🇹🇷', 'NOR': '🇳🇴',
    'SRB': '🇷🇸', 'GRE': '🇬🇷', 'IRN': '🇮🇷', 'TUN': '🇹🇳',
    'EGY': '🇪🇬', 'NGA': '🇳🇬', 'CMR': '🇨🇲', 'GHA': '🇬🇭',
    'CRC': '🇨🇷', 'PAN': '🇵🇦', 'JAM': '🇯🇲', 'PER': '🇵🇪',
    'CHI': '🇨🇱', 'PAR': '🇵🇾', 'ECU': '🇪🇨', 'NZL': '🇳🇿',
    'UZB': '🇺🇿', 'IRQ': '🇮🇶', 'SAU': '🇸🇦', 'JOR': '🇯🇴'
  };
  return flagMap[code] || '⚽';
}

function toggleTeamSelection(teamCode) {
  const currentLetter = getCurrentGroupLetter();
  const picks = bettingState.picks[currentLetter] || [];
  
  if (picks.includes(teamCode)) {
    // Remove
    bettingState.picks[currentLetter] = picks.filter(c => c !== teamCode);
  } else {
    // Add - but max 3
    if (picks.length >= 3) {
      showToast('כבר בחרת 3 קבוצות. הסר אחת לפני שתוסיף עוד', 'error');
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
    info.innerHTML = '<span class="text-faint">בחר 2 או 3 קבוצות מהבית הזה</span>';
  } else if (picks.length === 1) {
    info.className = 'group-picks-info invalid';
    info.innerHTML = `⚠️ בחרת רק קבוצה אחת - צריך 2 או 3`;
  } else if (picks.length === 2) {
    info.className = 'group-picks-info valid';
    info.innerHTML = `✓ בחרת 2 קבוצות בבית הזה`;
  } else if (picks.length === 3) {
    info.className = 'group-picks-info valid';
    info.innerHTML = `✓ בחרת 3 קבוצות בבית הזה`;
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
    validationText.textContent = `נשאר עוד ${32 - total} קבוצות לבחור`;
    finishBtn.style.display = 'none';
  } else if (total === 32) {
    // Check that every group has valid picks (2 or 3)
    const allValid = bettingState.groupOrder.every(letter => {
      const count = (bettingState.picks[letter] || []).length;
      return count >= 2 && count <= 3;
    });
    
    if (allValid) {
      validation.className = 'picks-validation success';
      validationText.textContent = '🎉 הושלם! 32 קבוצות נבחרו';
      finishBtn.style.display = 'flex';
    } else {
      validation.className = 'picks-validation error';
      validationText.textContent = 'בעיה: לפחות בית אחד עם 0 או 1 קבוצות בלבד';
      finishBtn.style.display = 'none';
    }
  } else {
    validation.className = 'picks-validation error';
    validationText.textContent = `יותר מדי! ${total - 32} קבוצות מעל המקסימום`;
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
    document.getElementById('status-modal-title').textContent = 'כמעט סיימת!';
    document.getElementById('status-modal-subtitle').textContent = 
      `חסר${missing > 1 ? 'ות' : 'ה'} עוד ${missing} עול${missing > 1 ? 'ות' : 'ה'}`;
  } else {
    document.getElementById('status-modal-title').textContent = 'מצוין! 🎉';
    document.getElementById('status-modal-subtitle').textContent = 'בחרת את כל ה-32 העולות';
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
    container.innerHTML = '<div style="grid-column: 1 / -1; padding: 12px; color: rgba(255,255,255,0.5); text-align: center; font-size: 12px;">לא נמצאו בתים עם 2 עולות.<br/>תוכל להוסיף בכל בית.</div>';
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
        ${expandableGroups.length} בתים עם 2 עולות - לחץ כדי להוסיף שלישית:
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
    showToast(`חייב לבחור לפחות 2 קבוצות בבית ${currentLetter} כדי להמשיך`, 'error');
    
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
        // Find team data for multiplier
        const team = bettingState.groupedTeams[letter]?.find(t => t.code === teamCode);
        const multiplier = (team && state.currentPool.use_multipliers) ? team.multiplier : 1.0;
        
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
          showToast('שגיאה בשמירת ההימור', 'error');
        }
        bettingState.loading = false;
        return;
      }
    }
    
    if (showFeedback) {
      showToast('ההימור נשמר ✓', 'success');
    }
    
  } catch (err) {
    console.error('Save picks error:', err);
    if (showFeedback) {
      showToast('שגיאה בשמירה', 'error');
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
    if (!confirm(`יש לך ${total} הימורים שמורים. צא מבלי לסיים?`)) {
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
    showToast(`צריך בדיוק 32 קבוצות (יש ${total})`, 'error');
    return;
  }
  
  if (!allValid) {
    showToast('בכל בית חייבים להיות 2 או 3 קבוצות', 'error');
    return;
  }
  
  // Save final state
  showToast('שומר הימור...', 'info');
  await savePicksToDb(false);
  
  // Calculate max possible points
  let maxPoints = 0;
  const scoringGroupStage = state.currentPool.scoring_group_stage || 1;
  
  bettingState.groupOrder.forEach(letter => {
    const picks = bettingState.picks[letter] || [];
    picks.forEach(teamCode => {
      const team = bettingState.groupedTeams[letter]?.find(t => t.code === teamCode);
      if (team && state.currentPool.use_multipliers) {
        maxPoints += scoringGroupStage * parseFloat(team.multiplier || 1);
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

// Update dashboard to show actual betting status
async function updateBettingStatusOnDashboard() {
  if (!state.currentUser || !supabaseClient) return;
  
  const { data: picks } = await supabaseClient
    .from('group_picks')
    .select('id', { count: 'exact' })
    .eq('user_id', state.currentUser.id);
  
  const picksCount = picks ? picks.length : 0;
  const statusEl = document.getElementById('bet-status-groups');
  if (!statusEl) return;
  
  const titleEl = statusEl.querySelector('.bet-status-title');
  const subtitleEl = statusEl.querySelector('.bet-status-subtitle');
  const buttonEl = statusEl.querySelector('button');
  
  if (picksCount === 0) {
    titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg> שלב הבתים';
    subtitleEl.textContent = 'עדיין לא הימרת';
    statusEl.className = 'bet-status-card pending';
    if (buttonEl) buttonEl.innerHTML = 'התחל →';
  } else if (picksCount < 32) {
    titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> שלב הבתים';
    subtitleEl.textContent = `הימרת על ${picksCount} מתוך 32`;
    statusEl.className = 'bet-status-card pending';
    if (buttonEl) buttonEl.innerHTML = 'המשך →';
  } else {
    titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> שלב הבתים';
    subtitleEl.textContent = 'הושלם · 32 קבוצות';
    statusEl.className = 'bet-status-card completed';
    if (buttonEl) buttonEl.innerHTML = 'ערוך →';
  }
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
  R32: { name: 'סבב 32', total: 16, points: 1, order: 1 },
  R16: { name: 'שמינית הגמר', total: 8, points: 2, order: 2 },
  QF:  { name: 'רבע הגמר',   total: 4, points: 3, order: 3 },
  SF:  { name: 'חצי הגמר',   total: 2, points: 4, order: 4 },
  FINAL: { name: 'הגמר',     total: 1, points: 8, order: 5 }
};

async function startKnockoutBetting() {
  if (!state.currentUser || !state.currentPool) {
    showToast('שגיאה - אנא התחבר מחדש', 'error');
    return;
  }
  
  if (!supabaseClient) {
    showToast('מתחבר לשרת...', 'error');
    return;
  }
  
  // First: check if group betting is complete (need 32 picks)
  const { data: groupPicks } = await supabaseClient
    .from('group_picks')
    .select('team_code, group_letter')
    .eq('user_id', state.currentUser.id);
  
  if (!groupPicks || groupPicks.length < 32) {
    showToast('צריך לסיים קודם את שלב הבתים (32 קבוצות)', 'error');
    return;
  }
  
  showToast('טוען את שלב הנוקאאוט...', 'info');
  
  // Load all teams
  const { data: teams } = await supabaseClient
    .from('teams')
    .select('*');
  
  if (!teams) {
    showToast('שגיאה בטעינת הקבוצות', 'error');
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
  document.getElementById('ko-round-title').textContent = ROUND_INFO[round].name;
  document.getElementById('ko-round-step').textContent = `${ROUND_INFO[round].points} נקודות לכל ניחוש נכון`;
  
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
  const matchLabel = round === 'FINAL' ? 'הגמר 🏆' : `משחק ${match.number}`;
  
  // For final, show champion declaration
  let finalDeclaration = '';
  if (round === 'FINAL') {
    finalDeclaration = `
      <div class="ko-final-declaration">
        <span class="ko-final-icon">🏆</span>
        <span class="ko-final-text">המנצח: <strong>אלוף המונדיאל!</strong></span>
      </div>
    `;
  }
  
  card.innerHTML = `
    <div class="ko-match-header">
      <span class="ko-match-number">${matchLabel}</span>
      <span>${ROUND_INFO[round].name}</span>
    </div>
    <div class="ko-match-teams">
      ${createTeamButton(match, team1Data, match.team1, userPick === match.team1)}
      <div class="ko-vs">VS</div>
      ${createTeamButton(match, team2Data, match.team2, userPick === match.team2)}
    </div>
    <div class="ko-match-points">
      <span>משווה</span>
      <span class="ko-match-points-value">${points} נק'</span>
      <span>אם תנחש נכון</span>
    </div>
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
        <div class="ko-team-name">להיקבע</div>
      </div>
    `;
  }
  
  const flag = getCountryFlag(teamCode);
  
  return `
    <div class="ko-team ${isSelected ? 'selected' : ''}" data-team="${teamCode}">
      <div class="ko-team-flag">${flag}</div>
      <div class="ko-team-name">${teamData.name_he}</div>
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
      const team = knockoutState.allTeams[winnerCode];
      const multiplier = team && state.currentPool.use_multipliers ? team.multiplier : 1.0;
      
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
        if (showFeedback) showToast('שגיאה בשמירה', 'error');
        return;
      }
    }
    
    if (showFeedback) showToast('הימור הנוקאאוט נשמר ✓', 'success');
    
  } catch (err) {
    console.error('Knockout save error:', err);
    if (showFeedback) showToast('שגיאה בשמירה', 'error');
  }
}

function exitKnockoutBetting() {
  let total = 0;
  Object.keys(ROUND_INFO).forEach(round => {
    total += knockoutState.matches[round].filter(m => knockoutState.picks[m.id]).length;
  });
  
  if (total > 0 && total < 31) {
    if (!confirm(`יש לך ${total}/31 הימורים שמורים. צא מבלי לסיים?`)) {
      return;
    }
  }
  goToDashboard();
}

async function finishKnockoutBetting() {
  await saveKnockoutPicksToDb(false);
  showToast('הימור הנוקאאוט הושלם! 🏆', 'success');
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
  
  // Risk meter (0-100 scale, position from right)
  const riskPos = Math.min(95, Math.max(5, analysis.riskScore));
  document.getElementById('sim-risk-marker').style.right = `${riskPos}%`;
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
        const multiplier = team && state.currentPool?.use_multipliers ? parseFloat(team.multiplier) : 1.0;
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
      name: ROUND_INFO[round].name,
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
    riskDescription = 'בחר משחקים כדי לראות ניתוח';
  } else if (riskScore < 30) {
    riskDescription = '🛡️ אסטרטגיה בטוחה - אתה מהמר על הפייבוריטיות';
  } else if (riskScore < 55) {
    riskDescription = '⚡ אסטרטגיה מאוזנת - שילוב של בטוח ויצירתי';
  } else if (riskScore < 75) {
    riskDescription = '🎲 אסטרטגיה אגרסיבית - הרבה הימורים מסוכנים';
  } else {
    riskDescription = '🔥 אסטרטגיה ספורטיבית - הולך על הכל!';
  }
  
  // Recommendation
  let recommendation;
  const totalPicked = Object.values(stages).reduce((s, v) => s + v.picked, 0);
  if (totalPicked === 0) {
    recommendation = 'התחל לבחור משחקים והסימולטור ינתח את האסטרטגיה שלך';
  } else if (totalPicked < 10) {
    recommendation = 'המשך לבחור כדי לראות תמונה מלאה של הסיכויים שלך';
  } else if (riskScore < 30) {
    recommendation = 'אסטרטגיה בטוחה תיתן צפי ניקוד יציב, אבל קשה לעקוף יריבים שיסתכנו ויצליחו. נסה להוסיף 1-2 הימורים נועזים יותר.';
  } else if (riskScore > 70) {
    recommendation = 'אסטרטגיה מסוכנת מאוד! פוטנציאל ענק לניקוד גבוה, אבל סיכוי גבוה לטעויות. שקול לחזור לבטוח ב-1-2 שלבים מאוחרים.';
  } else {
    recommendation = 'איזון מצוין! יש לך פוטנציאל לניקוד גבוה עם סיכון מתון. זאת אסטרטגיה חכמה.';
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
  
  // Scroll to a useful position - the final in the center
  setTimeout(() => {
    const container = document.getElementById('bracket-scroll-container');
    if (container) {
      // Scroll to middle
      container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
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
  if (progressEl) progressEl.textContent = `${totalPicked}/31 משחקים`;
  
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
    { round: 'R32', side: 'left',  label: 'סבב 32' },
    { round: 'R16', side: 'left',  label: 'שמינית' },
    { round: 'QF',  side: 'left',  label: 'רבע' },
    { round: 'SF',  side: 'left',  label: 'חצי' },
    { round: 'FINAL', side: 'center', label: '🏆 גמר' },
    { round: 'SF',  side: 'right', label: 'חצי' },
    { round: 'QF',  side: 'right', label: 'רבע' },
    { round: 'R16', side: 'right', label: 'שמינית' },
    { round: 'R32', side: 'right', label: 'סבב 32' }
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
    header.textContent = h.label;
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
  champion.innerHTML = `
    <div class="bracket-champion-display-label">🏆 אלוף 🏆</div>
    <div class="bracket-champion-display-name ${winnerData ? '' : 'tbd'}">
      ${winnerData ? `${getCountryFlag(winner)} ${winnerData.name_he}` : 'להיקבע'}
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
  
  const team1Name = team1Data ? team1Data.name_he : 'TBD';
  const team2Name = team2Data ? team2Data.name_he : 'TBD';
  
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
async function updateKnockoutStatusOnDashboard() {
  if (!state.currentUser || !supabaseClient) return;
  
  // Find the knockout status card (second bet-status-card.locked)
  const cards = document.querySelectorAll('.bet-status-card');
  if (cards.length < 2) return;
  
  const koCard = cards[1]; // The second one is knockout
  
  // Check if group betting is complete first
  const { data: groupPicks } = await supabaseClient
    .from('group_picks')
    .select('id')
    .eq('user_id', state.currentUser.id);
  
  const groupComplete = groupPicks && groupPicks.length >= 32;
  
  if (!groupComplete) {
    // Still locked
    koCard.className = 'bet-status-card locked';
    const titleEl = koCard.querySelector('.bet-status-title');
    const subtitleEl = koCard.querySelector('.bet-status-subtitle');
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> שלב הנוקאאוט';
    if (subtitleEl) subtitleEl.textContent = 'נפתח אחרי שלב הבתים';
    
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
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> שלב הנוקאאוט';
    if (subtitleEl) subtitleEl.textContent = 'מוכן להמר על 31 משחקים';
    existingBtn.innerHTML = 'התחל →';
  } else if (koCount < 31) {
    koCard.className = 'bet-status-card pending';
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> שלב הנוקאאוט';
    if (subtitleEl) subtitleEl.textContent = `הימרת על ${koCount} מתוך 31`;
    existingBtn.innerHTML = 'המשך →';
  } else {
    koCard.className = 'bet-status-card completed';
    if (titleEl) titleEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> שלב הנוקאאוט';
    if (subtitleEl) subtitleEl.textContent = 'הושלם · 31 משחקים';
    existingBtn.innerHTML = 'ערוך →';
  }
}

async function showLeaderboard() {
  closeMenu();
  
  if (!state.currentPool || !supabaseClient) {
    showToast('שגיאה בטעינה', 'error');
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
    showToast('שגיאה בטעינת הדירוג', 'error');
    return;
  }
  
  document.getElementById('lb-members-count').textContent = `${users.length} משתתפ${users.length === 1 ? '' : 'ים'}`;
  
  // Check tournament status (for now - always pre-tournament)
  const totalScores = users.reduce((sum, u) => sum + (u.total_score || 0), 0);
  const hasScores = totalScores > 0;
  
  document.getElementById('lb-tournament-status').textContent = 
    hasScores ? 'במהלך הטורניר' : 'לפני התחלת הטורניר';
  
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
    <div class="podium-points-label">נקודות</div>
  `;
  
  return div;
}

function createEmptyPodium(rank) {
  const div = document.createElement('div');
  div.className = `podium-spot ${rank}`;
  div.style.opacity = '0.3';
  div.innerHTML = `
    <div class="podium-medal">—</div>
    <div class="podium-name text-faint">ריק</div>
  `;
  return div;
}

function renderFullLeaderboard(users) {
  const list = document.getElementById('lb-full-list');
  list.innerHTML = '';
  
  if (users.length === 0) {
    list.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.4);">אין משתתפים</div>';
    return;
  }
  
  users.forEach((user, idx) => {
    const row = document.createElement('div');
    row.className = 'lb-row';
    
    const isMe = state.currentUser && user.id === state.currentUser.id;
    if (isMe) row.classList.add('is-me');
    
    const rank = idx + 1;
    
    row.innerHTML = `
      <div class="lb-rank">#${rank}</div>
      <div class="lb-avatar-small">${user.nickname.charAt(0)}</div>
      <div class="lb-info">
        <div class="lb-name">
          ${user.nickname}
          ${user.is_admin ? '<span class="admin-badge">מארגן</span>' : ''}
          ${isMe ? '<span class="lb-badge">אתה</span>' : ''}
        </div>
        <div class="lb-meta">${formatScoreDescription(user)}</div>
      </div>
      <div>
        <div class="lb-points">${user.total_score || 0}</div>
        <div class="lb-points-label">נקודות</div>
      </div>
    `;
    
    list.appendChild(row);
  });
}

function formatScoreDescription(user) {
  const parts = [];
  if (user.group_score > 0) parts.push(`בתים: ${user.group_score}`);
  if (user.knockout_score > 0) parts.push(`נוקאאוט: ${user.knockout_score}`);
  if (user.top_scorer_score > 0) parts.push(`מלך השערים: ${user.top_scorer_score}`);
  
  if (parts.length === 0) return 'עדיין בלי נקודות';
  return parts.join(' · ');
}

function shareLeaderboard() {
  if (!state.currentPool) return;
  
  const poolName = state.currentPool.name;
  const url = `${window.location.origin}?code=${state.currentPool.code}`;
  
  const text = `🏆 לוח הדירוגים של ${poolName}!\n\nהצטרף ל-FriendlyBet והתחרה איתנו על מונדיאל 2026:\n${url}`;
  
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(whatsappUrl, '_blank');
}

function showHelp() {
  closeMenu();
  showScreen('help-screen');
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
