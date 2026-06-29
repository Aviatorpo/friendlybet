// FriendlyBet ops: inspect encrypted critical backups for historical group_picks.
// Read-only. Restore work must go through an audited database RPC/migration path,
// not raw REST deletes against protected pick tables.

const fs = require('fs');
const path = require('path');
const { decryptEnvelope } = require('./backup-critical-data');

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.resolve(process.env.CRITICAL_BACKUP_DIR || path.join(ROOT, 'private-backups'));
const SECRET = process.env.BACKUP_ENCRYPTION_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const TEAM_GROUPS = {
  MEX:'A', RSA:'A', KOR:'A', CZE:'A',
  CAN:'B', BIH:'B', QAT:'B', SUI:'B',
  BRA:'C', MAR:'C', HAI:'C', SCO:'C',
  USA:'D', PAR:'D', AUS:'D', TUR:'D',
  GER:'E', CUR:'E', CIV:'E', ECU:'E',
  NED:'F', JPN:'F', SWE:'F', TUN:'F',
  BEL:'G', EGY:'G', IRN:'G', NZL:'G',
  ESP:'H', CPV:'H', SAU:'H', URU:'H',
  FRA:'I', SEN:'I', IRQ:'I', NOR:'I',
  ARG:'J', ALG:'J', AUT:'J', JOR:'J',
  POR:'K', COD:'K', UZB:'K', COL:'K',
  ENG:'L', CRO:'L', GHA:'L', PAN:'L',
};

function csvSet(name) {
  return new Set(String(process.env[name] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean));
}

function normTeam(code) {
  const c = String(code || '').trim().toUpperCase();
  if (c === 'CUW') return 'CUR';
  if (c === 'KSA') return 'SAU';
  return c;
}

function keyOf(row) {
  return `${row.pool_id}:${row.user_id}`;
}

function validFullGroupRows(rows) {
  const distinct = new Map();
  for (const row of rows || []) {
    const group = String(row.group_letter || '').trim().toUpperCase();
    const team = normTeam(row.team_code);
    if (!/^[A-L]$/.test(group) || TEAM_GROUPS[team] !== group) return null;
    distinct.set(`${group}:${team}`, {
      pool_id: row.pool_id,
      user_id: row.user_id,
      group_letter: group,
      team_code: team,
      multiplier_applied: row.multiplier_applied == null ? null : row.multiplier_applied,
    });
  }
  const out = [...distinct.values()];
  if (out.length !== 32) return null;
  const teams = new Set(out.map(r => r.team_code));
  if (teams.size !== 32) return null;
  const byGroup = new Map();
  for (const row of out) byGroup.set(row.group_letter, (byGroup.get(row.group_letter) || 0) + 1);
  if (byGroup.size !== 12) return null;
  for (const n of byGroup.values()) if (n < 2 || n > 3) return null;
  return out.sort((a, b) => a.group_letter.localeCompare(b.group_letter) || a.team_code.localeCompare(b.team_code));
}

async function main() {
  if (!SECRET) throw new Error('Missing BACKUP_ENCRYPTION_KEY');
  if (process.env.CRITICAL_BACKUP_RESTORE === '1') {
    throw new Error('CRITICAL_BACKUP_RESTORE is retired. Use the audited heal_two_phase_group_picks_from_backup RPC/migration path.');
  }
  const poolIds = csvSet('CRITICAL_BACKUP_POOL_IDS');
  const userIds = csvSet('CRITICAL_BACKUP_USER_IDS');
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json.enc'))
    .sort()
    .map(f => path.join(BACKUP_DIR, f));

  const history = new Map();
  let decrypted = 0;
  for (const file of files) {
    const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
    const payload = decryptEnvelope(envelope, SECRET);
    decrypted += 1;
    const rows = ((payload.tables && payload.tables.group_picks) || [])
      .filter(r => (!poolIds.size || poolIds.has(String(r.pool_id)))
        && (!userIds.size || userIds.has(String(r.user_id))));
    const byUser = new Map();
    for (const row of rows) {
      const k = keyOf(row);
      if (!byUser.has(k)) byUser.set(k, []);
      byUser.get(k).push(row);
    }
    for (const [k, groupRows] of byUser.entries()) {
      if (!history.has(k)) history.set(k, []);
      history.get(k).push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        createdAt: payload.createdAt || envelope.createdAt || null,
        count: groupRows.length,
        validRows: validFullGroupRows(groupRows),
      });
    }
  }

  console.log(JSON.stringify({
    backupFilesChecked: files.length,
    backupFilesDecrypted: decrypted,
    requestedPoolIds: [...poolIds],
    requestedUserIds: [...userIds],
    usersWithGroupRowsInBackups: history.size,
  }, null, 2));

  for (const [k, entries] of history.entries()) {
    const best = entries.filter(e => e.validRows).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
    console.log(JSON.stringify({
      key: k,
      snapshotsWithRows: entries.length,
      maxRowCount: Math.max(...entries.map(e => e.count)),
      latestWithRows: entries[entries.length - 1],
      bestValid32: best && { file: best.file, createdAt: best.createdAt, count: best.validRows.length },
    }, null, 2));
  }
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
