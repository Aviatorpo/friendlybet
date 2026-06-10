// ============================================================
// FriendlyBet - full Annex C impact audit
// ============================================================
// Read-only production audit. Compares the old generic matching allocator with
// the generated 495-row FIFA Annex C table, then reports users whose saved R32
// winner is no longer one of the corrected match's two teams.
//
// Run:
//   SUPABASE_SECRET_KEY=... node scripts/audit-annex-c-impact.js
//
// Optional:
//   --pool=<uuid>      limit to one pool
//   --out=<file.json>  write full JSON report
// ============================================================

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SECRET_KEY'); process.exit(1); }

const args = new Map(process.argv.slice(2).map(arg => {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] : [arg.replace(/^--/, ''), true];
}));
const POOL_FILTER = args.get('pool') || null;
const OUT_FILE = args.get('out') || null;

const SP_R32_DEF = {
  1:[{type:'gp',g:'A',p:2},{type:'gp',g:'B',p:2}],
  2:[{type:'gp',g:'E',p:1},{type:'third',allowed:['A','B','C','D','F']}],
  3:[{type:'gp',g:'F',p:1},{type:'gp',g:'C',p:2}],
  4:[{type:'gp',g:'C',p:1},{type:'gp',g:'F',p:2}],
  5:[{type:'gp',g:'I',p:1},{type:'third',allowed:['C','D','F','G','H']}],
  6:[{type:'gp',g:'E',p:2},{type:'gp',g:'I',p:2}],
  7:[{type:'gp',g:'A',p:1},{type:'third',allowed:['C','E','F','H','I']}],
  8:[{type:'gp',g:'L',p:1},{type:'third',allowed:['E','H','I','J','K']}],
  9:[{type:'gp',g:'D',p:1},{type:'third',allowed:['B','E','F','I','J']}],
  10:[{type:'gp',g:'G',p:1},{type:'third',allowed:['A','E','H','I','J']}],
  11:[{type:'gp',g:'K',p:2},{type:'gp',g:'L',p:2}],
  12:[{type:'gp',g:'H',p:1},{type:'gp',g:'J',p:2}],
  13:[{type:'gp',g:'B',p:1},{type:'third',allowed:['E','F','G','I','J']}],
  14:[{type:'gp',g:'J',p:1},{type:'gp',g:'H',p:2}],
  15:[{type:'gp',g:'K',p:1},{type:'third',allowed:['D','E','I','J','L']}],
  16:[{type:'gp',g:'D',p:2},{type:'gp',g:'G',p:2}]
};
const SP_THIRD_PLACE_SLOTS = [2,5,7,8,9,10,13,15].map(pos => ({
  pos,
  allowed: SP_R32_DEF[pos].find(f => f.type === 'third').allowed
}));

const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

function enc(v) { return encodeURIComponent(v); }
function userKey(poolId, userId) { return `${poolId}:${userId}`; }
function thirdKey(rows) { return [...new Set(rows.map(r => r.group_letter).filter(Boolean))].sort().join(''); }
function sameAssignment(a, b) {
  return SP_THIRD_PLACE_SLOTS.every(({ pos }) => a && b && a[pos] === b[pos]);
}
function has(team, pair) { return !!team && (team === pair.home || team === pair.away); }

async function getAll(table, params) {
  const page = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    const sep = params ? '&' : '';
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params || ''}${sep}offset=${offset}&limit=${page}`, { headers: H });
    if (!res.ok) throw new Error(`${table} ${res.status}: ${await res.text()}`);
    const chunk = await res.json();
    rows.push(...chunk);
    if (chunk.length < page) return rows;
    offset += page;
  }
}

function oldMatchThirdPlace(groups) {
  const chosen = new Set(groups);
  const slots = SP_THIRD_PLACE_SLOTS
    .map(s => ({ pos: s.pos, opts: s.allowed.filter(g => chosen.has(g)) }))
    .sort((a, b) => a.opts.length - b.opts.length);
  const assignment = {}, used = new Set();
  const bt = (i) => {
    if (i === slots.length) return true;
    for (const g of slots[i].opts) {
      if (used.has(g)) continue;
      assignment[slots[i].pos] = g; used.add(g);
      if (bt(i + 1)) return true;
      used.delete(g); delete assignment[slots[i].pos];
    }
    return false;
  };
  return bt(0) ? assignment : null;
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
    const [a, b] = SP_R32_DEF[pos];
    out[pos] = {
      home: resolveFeed(a, assignment, groupPositions, pos),
      away: resolveFeed(b, assignment, groupPositions, pos)
    };
  }
  return out;
}

(async () => {
  const { resolveThirdPlaceAssignment } = await import('../lib/third-place-allocation.mjs');
  const poolClause = POOL_FILTER ? `&pool_id=eq.${enc(POOL_FILTER)}` : '';

  const [users, thirdRows, groupRows, bracketRows] = await Promise.all([
    getAll('users', `select=id,pool_id,nickname,predictions_submitted_at${poolClause}`),
    getAll('sp_third_place_picks', `select=pool_id,user_id,group_letter${poolClause}&order=pool_id.asc,user_id.asc,group_letter.asc`),
    getAll('group_position_picks', `select=pool_id,user_id,group_letter,position,team_code${poolClause}&order=pool_id.asc,user_id.asc,group_letter.asc,position.asc`),
    getAll('knockout_picks', `select=pool_id,user_id,bracket_position,predicted_winner${poolClause}&bracket_position=not.is.null&order=pool_id.asc,user_id.asc,bracket_position.asc`)
  ]);

  const usersByKey = new Map(users.map(u => [userKey(u.pool_id, u.id), u]));
  const thirdsByUser = new Map();
  const groupsByUser = new Map();
  const bracketByUser = new Map();

  for (const r of thirdRows) {
    const k = userKey(r.pool_id, r.user_id);
    if (!thirdsByUser.has(k)) thirdsByUser.set(k, []);
    thirdsByUser.get(k).push(r);
  }
  for (const r of groupRows) {
    const k = userKey(r.pool_id, r.user_id);
    if (!groupsByUser.has(k)) groupsByUser.set(k, {});
    const gp = groupsByUser.get(k);
    if (!gp[r.group_letter]) gp[r.group_letter] = [];
    gp[r.group_letter][Number(r.position) - 1] = r.team_code;
  }
  for (const r of bracketRows) {
    const k = userKey(r.pool_id, r.user_id);
    if (!bracketByUser.has(k)) bracketByUser.set(k, {});
    bracketByUser.get(k)[Number(r.bracket_position)] = r.predicted_winner;
  }

  const comboStats = {};
  const affected = [];
  let completeThirdUsers = 0;
  let changedAllocationUsers = 0;

  for (const [k, thirdPicks] of thirdsByUser.entries()) {
    const combo = thirdKey(thirdPicks);
    if (combo.length !== 8) continue;
    completeThirdUsers += 1;
    const oldAssignment = oldMatchThirdPlace(combo.split(''));
    const officialAssignment = resolveThirdPlaceAssignment(combo.split(''));
    if (!officialAssignment) throw new Error(`missing official allocation for ${combo}`);
    if (!oldAssignment || sameAssignment(oldAssignment, officialAssignment)) continue;

    changedAllocationUsers += 1;
    comboStats[combo] = (comboStats[combo] || 0) + 1;

    const [poolId, userId] = k.split(':');
    const user = usersByKey.get(k) || { id: userId, pool_id: poolId };
    const groupPositions = groupsByUser.get(k) || {};
    const bracketPicks = bracketByUser.get(k) || {};
    const oldR32 = buildR32(groupPositions, oldAssignment);
    const officialR32 = buildR32(groupPositions, officialAssignment);
    const invalidR32 = [];

    for (const { pos } of SP_THIRD_PLACE_SLOTS) {
      const pick = bracketPicks[pos];
      if (pick && !has(pick, officialR32[pos])) {
        invalidR32.push({ pos, pick, oldPair: oldR32[pos], officialPair: officialR32[pos] });
      }
    }

    if (invalidR32.length) {
      affected.push({
        pool_id: poolId,
        user_id: userId,
        nickname: user.nickname || null,
        submitted_at: user.predictions_submitted_at || null,
        third_place_combo: combo,
        bracket_pick_count: Object.keys(bracketPicks).length,
        invalid_r32_count: invalidR32.length,
        invalid_r32: invalidR32
      });
    }
  }

  const topChangedCombos = Object.entries(comboStats)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 25)
    .map(([combo, users]) => ({ combo, users }));

  const report = {
    generated_at: new Date().toISOString(),
    scope: POOL_FILTER ? { pool_id: POOL_FILTER } : { pool_id: 'all' },
    complete_third_place_user_count: completeThirdUsers,
    changed_allocation_user_count: changedAllocationUsers,
    affected_user_count: affected.length,
    affected_submitted_user_count: affected.filter(r => r.submitted_at).length,
    affected_full_bracket_count: affected.filter(r => r.bracket_pick_count >= 31).length,
    top_changed_combinations: topChangedCombos,
    affected_users: affected
  };

  console.log(JSON.stringify({
    generated_at: report.generated_at,
    scope: report.scope,
    complete_third_place_user_count: report.complete_third_place_user_count,
    changed_allocation_user_count: report.changed_allocation_user_count,
    affected_user_count: report.affected_user_count,
    affected_submitted_user_count: report.affected_submitted_user_count,
    affected_full_bracket_count: report.affected_full_bracket_count,
    top_changed_combinations: report.top_changed_combinations
  }, null, 2));

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
