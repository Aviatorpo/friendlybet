const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const app = read('app.js');
const config = read('config.js');
const html = read('index.html');
const css = read('styles.css');
const i18n = read('i18n.js');

assert.match(
  config,
  /initAttempts\s*>\s*MAX_INIT_ATTEMPTS\s*&&\s*typeof\s+window\.supabaseCreateClient\s*===\s*'undefined'/,
  'Supabase init must still recover if the ESM factory appears after the startup retry window'
);

assert.match(app, /async function _waitForSupabaseClient\(timeoutMs = 10000\)/, 'recovery login needs a shared Supabase wait helper');
assert.match(app, /const ready = await _waitForSupabaseClient\(\);[\s\S]*if \(!ready\) return \{ error: 'server' \};/, 'manual recovery login must wait before reporting server unavailable');
assert.match(app, /function _setRecoveryLoginBusy\(busy\)/, 'manual recovery login needs a visible busy-state helper');
assert.match(app, /btn\.disabled = !!busy;/, 'manual recovery login must prevent double submits');
assert.match(app, /btn\.setAttribute\('aria-busy', busy \? 'true' : 'false'\);/, 'manual recovery login must expose busy state accessibly');
assert.match(app, /if \(state\.currentScreen === 'recovery-login-screen'\) _setRecoveryLoginBusy\(false\);/, 'manual recovery login must restore the button on handled failure');
assert.match(app, /const FB_BOOT_SUPABASE_WAIT_MS = 12000;/, 'startup Supabase wait should have one shared timeout constant');
assert.match(app, /const FB_BOOT_FORCE_HOME_MS = FB_BOOT_SUPABASE_WAIT_MS \+ 3000;/, 'startup force-home fallback must outlast Supabase wait');
assert.match(app, /setTimeout\(\(\) => _fbForceHomeIfBlank\('init timeout'\), FB_BOOT_FORCE_HOME_MS\);/, 'startup fallback should use the safe timeout constant');
assert.match(app, /const waitForSupabase = \(timeoutMs = FB_BOOT_SUPABASE_WAIT_MS\)/, 'initial route wait should use the shared Supabase timeout');

const forceStart = app.indexOf('function _fbForceHomeIfBlank');
const forceEnd = app.indexOf('// The startup fallback must outlast', forceStart);
const forceBody = app.slice(forceStart, forceEnd);
assert.ok(forceStart >= 0 && forceEnd > forceStart, 'startup fallback body is extractable');
assert.ok(!forceBody.includes('clearLocalUser()'), 'startup visual fallback must not wipe recovery-login session state');

assert.match(
  html,
  /<button class="btn-secondary btn-large" id="recovery-login-submit" type="button" onclick="submitRecoveryLogin\(\)">/,
  'recovery login submit button needs a stable id and explicit button type'
);

assert.match(css, /\.btn-primary:disabled,[\s\S]*\.btn-secondary:disabled,[\s\S]*cursor: wait;/, 'disabled buttons need visible loading affordance');

const signingInKeyCount = (i18n.match(/'recoveryLogin\.signingIn'/g) || []).length;
assert.strictEqual(signingInKeyCount, 2, 'signing-in copy must exist in Hebrew and English');
assert.ok(i18n.includes("'recoveryLogin.signingIn': 'Signing in...'"), 'English signing-in copy is missing');

console.log('recovery login resilience ok');
