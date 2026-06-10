// ============================================================
// FriendlyBet - encrypted critical-data backup after finished games
// ============================================================
// Creates an encrypted, versioned JSON backup whenever at least one match newly
// reaches a final status. Intended to run from GitHub Actions after match syncs
// and score recalculation, and manually on the owner's machine for local copies.
//
// Required in CI:
//   SUPABASE_SECRET_KEY        service-role key
//   BACKUP_ENCRYPTION_KEY      strong secret/passphrase used for AES-256-GCM
//
// Optional:
//   SUPABASE_URL               defaults to FriendlyBet prod
//   BACKUP_OUT_DIR             defaults to private-backups
//   BACKUP_FORCE=1             write a backup even if no new/final match
//   BACKUP_ALLOW_PLAINTEXT=1   local-only escape hatch; never use in CI
// ============================================================

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(process.env.BACKUP_OUT_DIR || path.join(ROOT, 'private-backups'));

const FINAL_STATUSES = new Set(['FINISHED', 'AWARDED']);
const CRITICAL_TABLES = [
  'pools',
  'users',
  'group_picks',
  'knockout_picks',
  'group_position_picks',
  'tournament_winner_picks',
  'top_scorer_picks',
  'sp_third_place_picks',
  'pick_backups',
  'knockout_reopen_grants',
  'matches',
  'teams',
  'players',
];

const TABLE_ORDER = {
  pools: 'id.asc',
  users: 'id.asc',
  group_picks: 'pool_id.asc,user_id.asc,group_letter.asc,team_code.asc',
  knockout_picks: 'pool_id.asc,user_id.asc,match_id.asc,bracket_position.asc.nullslast',
  group_position_picks: 'pool_id.asc,user_id.asc,group_letter.asc,position.asc',
  tournament_winner_picks: 'pool_id.asc,user_id.asc',
  top_scorer_picks: 'pool_id.asc,user_id.asc',
  sp_third_place_picks: 'pool_id.asc,user_id.asc,group_letter.asc',
  pick_backups: 'pool_id.asc,user_id.asc,created_at.asc',
  knockout_reopen_grants: 'pool_id.asc,user_id.asc',
  matches: 'match_date.asc,id.asc',
  teams: 'code.asc',
  players: 'team_code.asc,name_en.asc,id.asc',
};

function argValue(name) {
  const ix = process.argv.indexOf(name);
  return ix >= 0 ? process.argv[ix + 1] : null;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
}

function slug(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'snapshot';
}

async function sb(table, query = '', range = null) {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
  if (range) headers.Range = `${range.from}-${range.to}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, { headers });
  if (!res.ok) throw new Error(`Supabase GET ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function fetchAll(table) {
  const order = TABLE_ORDER[table];
  const q = `?select=*${order ? `&order=${encodeURIComponent(order)}` : ''}`;
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const page = await sb(table, q, { from, to: from + pageSize - 1 });
    if (!Array.isArray(page)) throw new Error(`Unexpected ${table} response`);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function terminalMatches() {
  const rows = await sb('matches', '?select=id,external_id,status,match_date,home_team_code,away_team_code&order=match_date.asc,id.asc');
  return (rows || []).filter(m => FINAL_STATUSES.has(String(m.status || '').toUpperCase()));
}

function deriveKey(secret, salt) {
  const raw = Buffer.from(secret, 'base64');
  if (raw.length === 32) return raw;
  return crypto.scryptSync(secret, salt, 32);
}

function encryptPayload(payload, secret) {
  if (!secret && process.env.BACKUP_ALLOW_PLAINTEXT === '1') {
    return {
      ext: '.json',
      body: JSON.stringify(payload, null, 2) + '\n',
      encrypted: false,
    };
  }
  if (!secret) throw new Error('Missing BACKUP_ENCRYPTION_KEY');

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret, salt);
  const plain = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const envelope = {
    schema: 1,
    alg: 'AES-256-GCM',
    kdf: Buffer.from(secret, 'base64').length === 32 ? 'base64-raw-32' : 'scrypt',
    compression: 'gzip',
    createdAt: payload.createdAt,
    trigger: payload.trigger,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return {
    ext: '.json.enc',
    body: JSON.stringify(envelope, null, 2) + '\n',
    encrypted: true,
  };
}

function decryptEnvelope(envelope, secret) {
  const salt = Buffer.from(envelope.salt, 'base64');
  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const compressed = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
}

async function createBackup(opts = {}) {
  const outDir = path.resolve(opts.outDir || argValue('--out') || OUT_DIR);
  const force = opts.force || process.argv.includes('--force') || process.env.BACKUP_FORCE === '1';
  const manifestFile = path.join(outDir, 'manifest.json');
  const manifest = readJson(manifestFile, { schema: 1, completedMatchIds: [], backups: [] });
  const seen = new Set(manifest.completedMatchIds || []);

  const finals = await terminalMatches();
  const newlyFinal = finals.filter(m => !seen.has(String(m.external_id || m.id)));
  if (!force && newlyFinal.length === 0) {
    console.log(`[backup] no newly-final matches (${finals.length} already tracked)`);
    return { wrote: false, reason: 'no-new-final', finalCount: finals.length };
  }

  const triggerMatches = force ? finals.slice(-3) : newlyFinal;
  if (!force && triggerMatches.length === 0) {
    console.log('[backup] no final matches yet; skipping');
    return { wrote: false, reason: 'no-final-matches', finalCount: 0 };
  }

  const createdAt = new Date().toISOString();
  const tables = {};
  for (const table of CRITICAL_TABLES) {
    tables[table] = await fetchAll(table);
    console.log(`[backup] ${table}: ${tables[table].length} row(s)`);
  }

  const tableCounts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  const payload = {
    schema: 1,
    app: 'friendlybet',
    createdAt,
    source: SUPABASE_URL,
    trigger: {
      reason: force ? (triggerMatches.length ? 'force' : 'force-baseline') : 'new-final-match',
      matches: triggerMatches.map(m => ({
        id: m.id,
        external_id: m.external_id,
        status: m.status,
        match_date: m.match_date,
        home_team_code: m.home_team_code,
        away_team_code: m.away_team_code,
      })),
    },
    tableCounts,
    tables,
  };

  const encoded = encryptPayload(payload, opts.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY);
  const matchSlug = triggerMatches.length
    ? slug(triggerMatches.map(m => `${m.external_id || m.id}-${m.home_team_code || 'TBD'}-${m.away_team_code || 'TBD'}`).join('__'))
    : 'baseline';
  const stamp = createdAt.replace(/[:.]/g, '-');
  const file = path.join(outDir, `${stamp}__${matchSlug}${encoded.ext}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(file, encoded.body);

  const completedMatchIds = [...new Set([...seen, ...finals.map(m => String(m.external_id || m.id))])].sort();
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  manifest.schema = 1;
  manifest.updatedAt = createdAt;
  manifest.completedMatchIds = completedMatchIds;
  manifest.backups = [
    ...(manifest.backups || []),
    {
      createdAt,
      file: rel,
      encrypted: encoded.encrypted,
      reason: payload.trigger.reason,
      triggerMatchIds: triggerMatches.map(m => String(m.external_id || m.id)),
      tableCounts,
    },
  ];
  writeJson(manifestFile, manifest);

  console.log(`[backup] wrote ${rel} (${encoded.encrypted ? 'encrypted' : 'PLAINTEXT'})`);
  return { wrote: true, file, manifestFile, tableCounts, encrypted: encoded.encrypted };
}

if (require.main === module) {
  createBackup().catch(e => {
    console.error('[backup] ERROR:', e.message);
    process.exit(1);
  });
} else {
  module.exports = {
    CRITICAL_TABLES,
    FINAL_STATUSES,
    createBackup,
    encryptPayload,
    decryptEnvelope,
    slug,
  };
}
