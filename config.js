// ============================================================
// FriendlyBet - Configuration
// ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://kovhuahdoluxyqqwqohw.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU',
  
  APP_NAME: 'FriendlyBet',
  APP_VERSION: '0.1.2',
  
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
const MAX_INIT_ATTEMPTS = 50; // 5 seconds total

function initSupabase() {
  initAttempts++;
  
  // Check if we've tried too many times
  if (initAttempts > MAX_INIT_ATTEMPTS) {
    console.error('❌ Failed to load Supabase after 5 seconds. Network issue?');
    return;
  }
  
  // Check if Supabase is available
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    setTimeout(initSupabase, 100);
    return;
  }
  
  // Initialize
  if (!supabaseClient) {
    try {
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
      console.log('✅ Supabase client initialized successfully (attempt ' + initAttempts + ')');
      console.log('App version: ' + CONFIG.APP_VERSION);
    } catch (err) {
      console.error('❌ Error initializing Supabase:', err);
    }
  }
}

// Try to initialize as soon as possible
initSupabase();

// Also try when the page is fully loaded
window.addEventListener('load', function() {
  if (!supabaseClient) {
    console.log('Page loaded, retrying Supabase init...');
    initAttempts = 0; // reset counter
    initSupabase();
  }
});
