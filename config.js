// ============================================================
// FriendlyBet - Configuration
// ============================================================

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://kovhuahdoluxyqqwqohw.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU',
  
  // App
  APP_NAME: 'FriendlyBet',
  APP_VERSION: '0.1.0',
  
  // Storage keys (localStorage)
  STORAGE_KEYS: {
    USER_ID: 'fb_user_id',
    POOL_ID: 'fb_pool_id',
    RECOVERY_CODE: 'fb_recovery_code',
    NICKNAME: 'fb_nickname',
    IS_ADMIN: 'fb_is_admin',
    LANGUAGE: 'fb_language'
  },
  
  // Defaults
  DEFAULT_LANGUAGE: 'he',
  POOL_CODE_LENGTH: 5,
  RECOVERY_CODE_LENGTH: 16, // 4 groups of 4 chars
  
  // Validation
  MIN_NICKNAME_LENGTH: 2,
  MAX_NICKNAME_LENGTH: 30,
  MIN_POOL_NAME_LENGTH: 3,
  MAX_POOL_NAME_LENGTH: 100,
};

// Initialize Supabase client
const supabaseClient = supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
