// ============================================================
// FriendlyBet - Configuration
// ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://kovhuahdoluxyqqwqohw.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU',
  
  APP_NAME: 'FriendlyBet',
  APP_VERSION: '0.1.1',
  
  STORAGE_KEYS: {
    USER_ID: 'fb_user_id',
    POOL_ID: 'fb_pool_id',
    RECOVERY_CODE: 'fb_recovery_code',
    NICKNAME: 'fb_nickname',
    IS_ADMIN: 'fb_is_admin',
    LANGUAGE: 'fb_language'
  },
  
  DEFAULT_LANGUAGE: 'he',
  POOL_CODE_LENGTH: 5,
  RECOVERY_CODE_LENGTH: 16,
  
  MIN_NICKNAME_LENGTH: 2,
  MAX_NICKNAME_LENGTH: 30,
  MIN_POOL_NAME_LENGTH: 3,
  MAX_POOL_NAME_LENGTH: 100,
};

// Supabase client - initialized after the SDK loads
var supabaseClient = null;

function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase SDK not loaded yet, retrying in 100ms...');
    setTimeout(initSupabase, 100);
    return;
  }
  
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    console.log('✅ Supabase client initialized successfully');
  }
}

// Initialize immediately
initSupabase();
