const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('app.js');
const html = read('index.html');
const css = read('styles.css');
const i18n = read('i18n.js');
const config = read('config.js');
const serviceWorker = read('service-worker.js');

function extractFunction(source, name) {
  let start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is missing`);
  const asyncStart = source.lastIndexOf('async ', start);
  if (asyncStart >= 0 && asyncStart + 'async '.length === start) start = asyncStart;
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const checkPoolCode = extractFunction(app, 'checkPoolCode');
const openRecovery = extractFunction(app, 'openClosedPoolRecoveryLogin');
assert.match(
  checkPoolCode,
  /if \(isPoolJoinClosed\(data\)\) \{\s*_showClosedPoolReturnCard\(data\);\s*return;/,
  'locked pools must route to the returning-member recovery card'
);
const lockedBranch = /if \(isPoolJoinClosed\(data\)\) \{([^}]+)\}/.exec(checkPoolCode)?.[1] || '';
assert.ok(!lockedBranch.includes("showError('join-error'"), 'locked invites must not end at the old transient error');
assert.ok(!/_lookupUserByRecoveryCode|_applyRecoveryLogin|supabaseClient|state\.currentUser/.test(openRecovery), 'shared invite code must never authenticate a member');

assert.ok(html.includes('id="closed-pool-return-card"'), 'locked invite recovery card is missing');
assert.ok(html.includes('onclick="openClosedPoolRecoveryLogin()"'), 'locked invite recovery CTA is missing');
assert.ok(html.includes('id="recovery-login-invite-context"'), 'recovery login context is missing');
assert.ok(css.includes('.closed-pool-return-card'), 'locked invite recovery card styles are missing');
assert.ok(css.includes('.recovery-login-invite-context'), 'recovery context styles are missing');

for (const key of [
  'join.closedPoolKicker',
  'join.closedPoolFallback',
  'join.closedReturning',
  'join.closedLoginCta',
  'join.closedLostCode',
  'join.closedNewUser',
  'recoveryLogin.inviteContext'
]) {
  assert.strictEqual((i18n.match(new RegExp(`'${key.replace('.', '\\.')}'`, 'g')) || []).length, 2, `${key} must exist in Hebrew and English`);
}

const elements = new Map([
  ['pool-code-input', { value: '63YPH' }],
  ['closed-pool-return-card', { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }],
  ['closed-pool-return-name', { textContent: '' }],
  ['join-pool-submit', { style: {} }],
  ['join-existing-hint', { style: {} }],
  ['join-error', { style: { display: 'flex' } }],
  ['recovery-login-invite-context', { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }]
]);
const screenCalls = [];
const sandbox = {
  document: { getElementById: id => elements.get(id) || null },
  t: key => `translated:${key}`,
  String,
  closedPool: {
    id: 'pool-1',
    code: '63YPH',
    name: 'My neighbor looks just like Ronaldo',
    locked_at: '2026-06-11T19:00:00.000Z'
  },
  showScreen(id) { screenCalls.push(id); }
};
vm.createContext(sandbox);
vm.runInContext(
  `let _closedInvitePool = null;
   ${extractFunction(app, '_setRecoveryLoginInviteContext')}
   ${extractFunction(app, '_resetClosedPoolReturnCard')}
   ${extractFunction(app, '_showClosedPoolReturnCard')}
   ${openRecovery}
   let supabaseClient = {
     from(table) {
       if (table !== 'pools') throw new Error('locked pool flow must stop before querying another table');
       return {
         select() {
           return {
             eq() {
               return {
                 async maybeSingle() {
                   return { data: closedPool, error: null };
                 }
               };
             }
           };
         }
       };
     }
   };
   function isPoolJoinClosed(pool) { return Boolean(pool && pool.locked_at); }
   function showError(id, message) { throw new Error(\`unexpected \${id} error: \${message}\`); }
   function initSupabase() { throw new Error('Supabase should already be ready'); }
   ${checkPoolCode}
   this.showClosed = _showClosedPoolReturnCard;
   this.openRecovery = openClosedPoolRecoveryLogin;
   this.resetClosed = _resetClosedPoolReturnCard;
   this.checkClosed = checkPoolCode;`,
  sandbox
);

const version = /APP_VERSION:\s*'([^']+)'/.exec(config)?.[1];
const cacheVersion = /CACHE_VERSION\s*=\s*'friendlybet-v([^']+)'/.exec(serviceWorker)?.[1];
const footerVersion = /<span class="menu-version">v([^<]+)<\/span>/.exec(html)?.[1];
assert.strictEqual(version, '2.10.146', 'app version must be 2.10.146');
assert.strictEqual(cacheVersion, version, 'service-worker cache version must match app version');
assert.strictEqual(footerVersion, version, 'footer version must match app version');

(async () => {
  await sandbox.checkClosed();
  assert.strictEqual(elements.get('closed-pool-return-name').textContent, 'My neighbor looks just like Ronaldo');
  assert.strictEqual(elements.get('closed-pool-return-card').style.display, '');
  assert.strictEqual(elements.get('closed-pool-return-card').attrs['aria-hidden'], 'false');
  assert.strictEqual(elements.get('join-pool-submit').style.display, 'none');
  assert.strictEqual(elements.get('join-existing-hint').style.display, 'none');
  assert.strictEqual(elements.get('join-error').style.display, 'none');

  sandbox.openRecovery();
  assert.deepStrictEqual(screenCalls, ['recovery-login-screen']);
  assert.strictEqual(elements.get('recovery-login-invite-context').style.display, '');
  assert.strictEqual(elements.get('recovery-login-invite-context').attrs['aria-hidden'], 'false');

  sandbox.resetClosed();
  assert.strictEqual(elements.get('closed-pool-return-card').style.display, 'none');
  assert.strictEqual(elements.get('join-pool-submit').style.display, '');
  assert.strictEqual(elements.get('join-existing-hint').style.display, '');

  console.log('locked invite recovery flow ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
