// ============================================================
// FriendlyBet - Annex C option 486 impact audit
// ============================================================
// Read-only production audit for the verified FIFA 2026 third-place allocation
// bug:
//   advancing third-place groups A/B/C/D/E/F/I/J.
//
// It reports users whose saved R32 winner is no longer one of the two teams in
// the corrected FIFA match pairing. It does not modify data.
//
// Run:
//   SUPABASE_SECRET_KEY=... node scripts/audit-annex-c-row486-impact.js
//
// Optional:
//   --pool=<uuid>      limit to one pool
//   --out=<file.json>  write full JSON report
// ============================================================

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY');
  process.exit(1);
}

const args = new Map(process.argv.slice(2).map(arg => {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] : [arg.replace(/^--/, ''), true];
}));

const POOL_FILTER = args.get('pool') || null;
const OUT_FILE = args.get('out') || null;

const R32_DEF = {
  1:  [{type:'gp',g:'A',p:2}, {type:'gp',g:'B',p:2}],
  2:  [{type:'gp',g:'E',p:1}, {type:'third'}],
  3:  [{type:'gp',g:'F',p:1}, {type:'gp',g:'C',p:2}],
  4:  [{type:'gp',g:'C',p:1}, {type:'gp',g:'F',p:2}],
  5:  [{type:'gp',g:'I',p:1}, {type:'third'}],
  6:  [{type:'gp',g:'E',p:2}, {type:'gp',g:'I',p:2}],
  7:  [{type:'gp',g:'A',p:1}, {type:'third'}],
  8:  [{type:'gp',g:'L',p:1}, {type:'third'}],
  9:  [{type:'gp',g:'D',p:1}, {type:'third'}],
  10: [{type:'gp',g:'G',p:1}, {type:'third'}],
  11: [{type:'gp',g:'K',p:2}, {type:'gp',g:'L',p:2}],
  12: [{type:'gp',g:'H',p:1}, {type:'gp',g:'J',p:2}],
  13: [{type:'gp',g:'B',p:1}, {type:'third'}],
  14: [{type:'gp',g:'J',p:1}, {type:'gp',g:'H',p:2}],
  15: [{type:'gp',g:'K',p:1}, {type:'third'}],
  16: [{type:'gp',g:'D',p:2}, {type:'gp',g:'G',p:2}]
};

// What the app assigned before the fix for ABCDEFIJ.
const OLD_ROW486 = { 2:'B', 5:'C', 7:'F', 8:'E', 9:'J', 10:'A', 13:'I', 15:'D' };

// FIFA Regulations Annex C option 486:
// A B C D E F I J -> 1A:3C, 1B:3J, 1D:3B, 1E:3D, 1G:3A, 1I:3F, 1K:3E, 1L:3I
const OFFICIAL_ROW486 = { 2:'D', 5:'F', 7:'C', 8:'I', 9:'B', 10:'A', 13:'J', 15:'E' };

const THIRD_SLOTS = [2, 5, 7, 8, 9, 10, 13, 15];

const H = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`
};

function q(v) {
  return encodeURIComponent(v);
}

async function getAll(table, params) {
  const page = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    const sep = params ? '&' : '';
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params || ''}${sep}offset=${offset}&limit=${page}`;
    const res = await fetch(url, { headers: H });
    if (!res.ok) throw new Error(`${table} ${res.status}: ${await res.text()}`);
    const chunk = await res.json();
    rows.push(...chunk);
    if (chunk.length < page) return rows;
    offset += page;
  }
}

function userKey(poolId, userId) {
  return `${poolId}:${userId}`;
}

function keyOfThirds(rows) {
  return [...new Set(rows.map(r => r.group_letter).filter(Boolean))].sort().join('');
}

function resolveFeed(feed, assignment, groupPositions, pos) {
  if (feed.type === 'gp') {
    const arr = groupPositions[feed.g];
    return arr ? arr[feed.p - 1] : null;
  }
  const group = assignment[pos];
  const arr = groupPositions[group];
  return arr ? arr[2] : null;
}

function buildR32(groupPositions, assignment) {
  const out = {};
  for (let pos = 1; pos <= 16; pos++) {
    const [a, b] = R32_DEF[pos];
    out[pos] = {
      home: resolveFeed(a, assignment, groupPositions, pos),
      away: resolveFeed(b, assignment, groupPositions, pos)
    };
  }
  return out;
}

function inPair(team, pair) {
  return !!team && (team === pair.home || team === pair.away);
}

(async () => {
  const poolClause = POOL_FILTER ? `&pool_id=eq.${q(POOL_FILTER)}` : '';

  const [users, thirdRows, groupRows, bracketRows] = await Promise.all([
    getAll('users', `select=id,pool_id,nickname,predictions_submitted_at${poolClause}`),
    getAll('sp_third_place_picks', `select=pool_id,user_id,group_letter${poolClause}&order=pool_id.asc,user_id.asc,group_letter.asc`),
    getAll('group_position_picks', `select=pool_id,user_id,group_letter,position,team_code${poolClause}&order=pool_id.asc,user_id.asc,group_letter.asc,position.asc`),
    getAll('knockout_picks', `select=pool_id,user_id,bracket_position,predicted_winner${poolClause}&bracket_position=not.is.null&order=pool_id.asc,user_id.asc,bracket_position.asc`)
  ]);

  const usersByKey = new Map(users.map(u => [userKey(u.pool_id, u.id), u]));

  const thirdsByUser = new Map();
  for (const r of thirdRows) {
    const k = userKey(r.pool_id, r.user_id);
    if (!thirdsByUser.has(k)) thirdsByUser.set(k, []);
    thirdsByUser.get(k).push(r);
  }

  const groupsByUser = new Map();
  for (const r of groupRows) {
    const k = userKey(r.pool_id, r.user_id);
    if (!groupsByUser.has(k)) groupsByUser.set(k, {});
    const gp = groupsByUser.get(k);
    if (!gp[r.group_letter]) gp[r.group_letter] = [];
    gp[r.group_letter][Number(r.position) - 1] = r.team_code;
  }

  const bracketByUser = new Map();
  for (const r of bracketRows) {
    const k = userKey(r.pool_id, r.user_id);
    if (!bracketByUser.has(k)) bracketByUser.set(k, {});
    bracketByUser.get(k)[Number(r.bracket_position)] = r.predicted_winner;
  }

  const row486Users = [];
  const affected = [];

  for (const [k, thirdPicks] of thirdsByUser.entries()) {
    if (keyOfThirds(thirdPicks) !== 'ABCDEFIJ') continue;
    const [poolId, userId] = k.split(':');
    const user = usersByKey.get(k) || { id: userId, pool_id: poolId };
    const groupPositions = groupsByUser.get(k) || {};
    const bracketPicks = bracketByUser.get(k) || {};
    const oldR32 = buildR32(groupPositions, OLD_ROW486);
    const officialR32 = buildR32(groupPositions, OFFICIAL_ROW486);

    const invalidR32 = [];
    const changedSlots = [];
    for (const pos of THIRD_SLOTS) {
      const oldPair = oldR32[pos];
      const officialPair = officialR32[pos];
      if (oldPair.home !== officialPair.home || oldPair.away !== officialPair.away) {
        changedSlots.push({ pos, oldPair, officialPair });
      }
      const pick = bracketPicks[pos];
      if (pick && !inPair(pick, officialPair)) {
        invalidR32.push({ pos, pick, oldPair, officialPair });
      }
    }

    const record = {
      pool_id: poolId,
      user_id: userId,
      nickname: user.nickname || null,
      submitted_at: user.predictions_submitted_at || null,
      bracket_pick_count: Object.keys(bracketPicks).length,
      invalid_r32_count: invalidR32.length,
      changed_third_slot_count: changedSlots.length,
      invalid_r32: invalidR32,
      changed_slots: changedSlots
    };

    row486Users.push(record);
    if (invalidR32.length > 0) affected.push(record);
  }

  const report = {
    generated_at: new Date().toISOString(),
    scope: POOL_FILTER ? { pool_id: POOL_FILTER } : { pool_id: 'all' },
    row486_user_count: row486Users.length,
    affected_user_count: affected.length,
    affected_submitted_user_count: affected.filter(r => r.submitted_at).length,
    affected_full_bracket_count: affected.filter(r => r.bracket_pick_count >= 31).length,
    affected_users: affected,
    row486_users: row486Users
  };

  console.log(JSON.stringify({
    generated_at: report.generated_at,
    scope: report.scope,
    row486_user_count: report.row486_user_count,
    affected_user_count: report.affected_user_count,
    affected_submitted_user_count: report.affected_submitted_user_count,
    affected_full_bracket_count: report.affected_full_bracket_count
  }, null, 2));

  if (affected.length) {
    console.log('\nAffected users:');
    for (const r of affected) {
      console.log(`- ${r.nickname || r.user_id} pool=${r.pool_id} invalidR32=${r.invalid_r32_count} bracket=${r.bracket_pick_count}`);
      for (const bad of r.invalid_r32) {
        console.log(`  pos ${bad.pos}: picked ${bad.pick}; old ${bad.oldPair.home || '?'} vs ${bad.oldPair.away || '?'}; official ${bad.officialPair.home || '?'} vs ${bad.officialPair.away || '?'}`);
      }
    }
  }

  if (OUT_FILE) {
    const file = path.resolve(OUT_FILE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${file}`);
  }
})().catch(err => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
