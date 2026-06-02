// ============================================================
// FriendlyBet - Configuration
// ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://kovhuahdoluxyqqwqohw.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU',
  
  APP_NAME: 'FriendlyBet',
  APP_VERSION: '2.6.54',
  
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

// Supabase client
var supabaseClient = null;
var initAttempts = 0;
const MAX_INIT_ATTEMPTS = 100; // 10 seconds total

function initSupabase() {
  initAttempts++;
  
  if (initAttempts > MAX_INIT_ATTEMPTS) {
    console.error('❌ Failed to load Supabase after 10 seconds');
    return;
  }
  
  // Check if the ESM-loaded createClient is available
  if (typeof window.supabaseCreateClient === 'undefined') {
    setTimeout(initSupabase, 100);
    return;
  }
  
  if (!supabaseClient) {
    try {
      supabaseClient = window.supabaseCreateClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );
      console.log('✅ Supabase client ready! Version: ' + CONFIG.APP_VERSION);
    } catch (err) {
      console.error('❌ Error initializing Supabase:', err);
    }
  }
}

// Start trying immediately
initSupabase();
