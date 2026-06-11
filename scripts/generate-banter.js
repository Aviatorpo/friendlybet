// ============================================================
// FriendlyBet - "Pool Pundit" banter generator
// ============================================================
// Produces witty, per-pool, real-time commentary about what just happened on
// the LEADERBOARD after each match — the lines shown below the podium and on the
// shareable "pool moment" card. Output: public-data/banter/<poolId>.json.
//
// HOW IT STAYS HONEST (the #1 project rule: zero fabrication):
//   Every line is derived ONLY from real data:
//     * standings BEFORE vs AFTER (this run's snapshot vs the stored previous),
//     * which matches actually finished since the last run (matches table),
//     * real goal data (matches.scorers: player + minute) for "late winner" lines,
//     * real champion picks (tournament_winner_picks) for "champion knocked out".
//   It NEVER invents a scorer, a minute, or a member fact. If the data isn't
//   there, the line isn't produced.
//
// ATTRIBUTION granularity: events are tied to "matches decided since the last
// scoring run" (the engine recomputes every 30 min). That's near-real-time, not
// instant — honest by design.
//
// State: public-data/banter-state.json holds each pool's previous standings +
// the set of finished match ids already accounted for, so the next run knows
// what's new. Output is written only-if-changed (like the other snapshots) so a
// quiet run produces no git diff / no redeploy, and the last banter persists
// until the next match moves the board.
//
// Run AFTER calculate-scores-v2.js + export-snapshots.js:
//   node scripts/generate-banter.js
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY
// ============================================================
const fs = require('fs');
const path = require('path');
const { teamName } = require('./team-names');
const { knockoutWinner } = require('./calculate-scores-v2');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_KEY && require.main === module) { console.error('Missing SUPABASE_SECRET_KEY'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public-data');
const BANTER_DIR = path.join(OUT_DIR, 'banter');
const STATE_FILE = path.join(OUT_DIR, 'banter-state.json');

const DAY_MS = 24 * 60 * 60 * 1000;
const NEWLY_WINDOW_MS = 2 * DAY_MS; // only treat matches finished in the last 2 days as "fresh drama"
const TERMINAL = new Set(['FINISHED', 'AWARDED']);

const REST_PAGE_SIZE = 1000;
async function sbAll(table, query = '', pageSize = REST_PAGE_SIZE) {
  const all = [];
  for (let from = 0, guard = 0; guard < 100; guard++, from += pageSize) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + pageSize - 1}`
      }
    });
    if (!res.ok) throw new Error(`Supabase GET ${table} ${res.status}: ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`Supabase GET ${table}: expected array page`);
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

// Stable nickname (never blank, no HTML — the client escapes on render).
function nick(u) { return (u && u.nickname && String(u.nickname).trim()) || '?'; }

// Rank a pool's users exactly like the leaderboard: score desc, then join order.
function rankUsers(users) {
  return users.slice().sort((a, b) =>
    ((b.total_score || 0) - (a.total_score || 0)) ||
    (Date.parse(a.joined_at || 0) - Date.parse(b.joined_at || 0)) ||
    String(a.id).localeCompare(String(b.id)));
}

// Minute label for a goal, incl. stoppage time ("90+4").
function minuteLabel(g) {
  if (g.injury != null && g.injury > 0) return `${g.minute}+${g.injury}`;
  return `${g.minute}`;
}

// ---------- Event builders (each returns {id,type,emoji,he,en,featuredUserId,featuredNickname} or null) ----------

function evLeadChange(prevTop, curTop, tag) {
  if (!curTop) return null;
  const A = nick(curTop);
  if (prevTop && prevTop.id !== curTop.id) {
    const B = nick(prevTop);
    return {
      id: `lead-${curTop.id}-${tag}`, type: 'lead-change', emoji: '👑',
      he: `הפיכה בצמרת! ${A} עוקף את ${B} וקופץ למקום הראשון 👑`,
      en: `Lead change at the top! ${A} overtakes ${B} to seize first place 👑`,
      featuredUserId: curTop.id, featuredNickname: A,
    };
  }
  return null;
}

function evChampionOut(featUser, teamCode, lang0, tag) {
  const A = nick(featUser);
  const thHe = teamName(teamCode, 'he'), thEn = teamName(teamCode, 'en');
  return {
    id: `champ-out-${featUser.id}-${teamCode}-${tag}`, type: 'champion-out', emoji: '💀',
    he: `${thHe} הודחה — והאלוף שעליו הימר ${A} כבר בדרך הביתה 💀`,
    en: `${thEn} are out — the champion ${A} bet on is heading home 💀`,
    featuredUserId: featUser.id, featuredNickname: A,
  };
}

function evClimber(user, spots, newRank, tag) {
  const A = nick(user);
  const heSpots = spots === 1 ? 'מקום אחד' : `${spots} מקומות`;
  const enSpots = spots === 1 ? '1 spot' : `${spots} spots`;
  return {
    id: `climb-${user.id}-${tag}`, type: 'climber', emoji: '🚀',
    he: `הזינוק של הסיבוב: ${A} מטפס ${heSpots}, ועכשיו במקום ה-${newRank} 🚀`,
    en: `Climb of the round: ${A} jumps ${enSpots} — now #${newRank} 🚀`,
    featuredUserId: user.id, featuredNickname: A,
  };
}

function evFaller(user, spots, newRank, tag) {
  const A = nick(user);
  const heSpots = spots === 1 ? 'מקום אחד' : `${spots} מקומות`;
  const enSpots = spots === 1 ? '1 spot' : `${spots} spots`;
  return {
    id: `fall-${user.id}-${tag}`, type: 'faller', emoji: '📉',
    he: `נפילה חופשית: ${A} מאבד ${heSpots} וצונח למקום ה-${newRank} 📉`,
    en: `Free fall: ${A} drops ${enSpots} to #${newRank} 📉`,
    featuredUserId: user.id, featuredNickname: A,
  };
}

function evLateWinner(goal, teamCode, featUser, tag) {
  const A = featUser ? nick(featUser) : null;
  const thHe = teamName(teamCode, 'he'), thEn = teamName(teamCode, 'en');
  const min = minuteLabel(goal);
  const extraHe = A ? ` ${A} הוא שמרוויח מזה בפול.` : '';
  const extraEn = A ? ` ${A} is the one cashing in.` : '';
  return {
    id: `late-${tag}`, type: 'late-winner', emoji: '⏱️',
    he: `${goal.player} בדקה ה-${min}! הגול המאוחר של ${thHe} מטלטל את טבלת הפול.${extraHe}`,
    en: `${goal.player} in the ${min}' minute! ${thEn}'s late strike shakes up the pool table.${extraEn}`,
    featuredUserId: featUser ? featUser.id : null,
    featuredNickname: A,
  };
}

function evTightRace(a, b, tag) {
  const A = nick(a), B = nick(b);
  const d = Math.abs((a.total_score || 0) - (b.total_score || 0));
  const heGap = d === 0 ? 'באותו ניקוד בדיוק' : `בהפרש ${d} נק' בלבד`;
  const enGap = d === 0 ? 'level on points' : `just ${d} pt${d === 1 ? '' : 's'} apart`;
  return {
    id: `tight-${a.id}-${b.id}-${tag}`, type: 'tight-race', emoji: '⚔️',
    he: `צמוד עד הסוף! ${A} ו${B} ${heGap} בראש הטבלה. כל גול קובע.`,
    en: `Neck and neck! ${A} and ${B} are ${enGap} at the top. Every goal counts.`,
    featuredUserId: a.id, featuredNickname: A,
  };
}

function evLeader(top, decided, tag) {
  const A = nick(top);
  const pts = top.total_score || 0;
  const heGames = decided > 0 ? `${decided} משחקים הוכרעו ו` : '';
  const enGames = decided > 0 ? `${decided} matches decided — ` : '';
  return {
    id: `leader-${top.id}-${pts}-${tag}`, type: 'leader', emoji: '🏆',
    he: `${heGames}${A} מוביל את הפול עם ${pts} נק'. מי יעקוף עד סוף הסיבוב?`,
    en: `${enGames}${A} leads the pool with ${pts} pts. Who'll catch up before the round ends?`,
    featuredUserId: top.id, featuredNickname: A,
  };
}

// ---------- Per-pool banter ----------
// prevStandings: [{id,nickname,total_score}] from last run (or null on first run)
// curUsers: full user rows for this pool (current)
// newlyKO: [{match, winner, loser}] knockout matches finished since last run
// lateGoals: [{goal, team}] late (>=80') goals from newly-finished matches
// champPicks: Map userId -> championTeamCode (this pool)
function buildPoolBanter(prevStandings, curUsers, newlyKO, lateGoals, champPicks, decidedCount) {
  const cur = rankUsers(curUsers);
  if (!cur.length) return null;
  const curTop = cur[0];
  const hasScores = cur.some(u => (u.total_score || 0) > 0);
  // Tag ties the ids to this exact situation so writeIfChanged only fires on real moves.
  const tag = hash(cur.map(u => u.id + ':' + (u.total_score || 0)).join('|'));

  // First run (no prior snapshot): no deltas to attribute. Lead with the leader
  // (or stay quiet pre-tournament when nobody has points yet).
  if (!prevStandings) {
    if (!hasScores) return null;
    const head = evLeader(curTop, decidedCount, tag);
    return { headline: head, items: [head] };
  }

  const prevRank = new Map(prevStandings.map((u, i) => [u.id, i]));
  const prevScore = new Map(prevStandings.map(u => [u.id, u.total_score || 0]));
  const prevTop = prevStandings[0] ? (cur.find(u => u.id === prevStandings[0].id) || prevStandings[0]) : null;

  // rank deltas (positive = climbed)
  const moves = cur.map((u, i) => {
    const pr = prevRank.has(u.id) ? prevRank.get(u.id) : i;
    return { u, newRank: i + 1, delta: pr - i, gained: (u.total_score || 0) - (prevScore.get(u.id) || 0) };
  });
  const climber = moves.filter(m => m.delta >= 1 && m.gained > 0).sort((a, b) => b.delta - a.delta || b.gained - a.gained)[0];
  const faller = moves.filter(m => m.delta <= -1).sort((a, b) => a.delta - b.delta)[0];

  const items = [];

  // 1) Lead change (the headline-grabber)
  const lead = evLeadChange(prevTop, curTop, tag);
  if (lead) items.push(lead);

  // 2) Champion knocked out (only when a champ pick's team just lost a KO match)
  for (const ko of newlyKO) {
    const matchUsers = cur.filter(u => champPicks.get(u.id) === ko.loser);
    for (const u of matchUsers) {
      // Avoid double-billing the same user already starring in the headline.
      items.push(evChampionOut(u, ko.loser, null, tag));
    }
  }

  // 3) Biggest climber / faller. Skip the climber when it's the very same user
  // the lead-change line already stars (don't say "Dana took #1" then "Dana climbed").
  if (climber && !(lead && climber.u.id === curTop.id)) items.push(evClimber(climber.u, climber.delta, climber.newRank, tag));
  if (faller && faller.delta <= -2) items.push(evFaller(faller.u, -faller.delta, faller.newRank, tag));

  // 4) Late winner flavor (real scorer + minute). Tie it to the climber if any.
  if (lateGoals.length) {
    const lg = lateGoals[0];
    items.push(evLateWinner(lg.goal, lg.team, climber ? climber.u : null, tag));
  }

  // 5) Tight race at the top
  if (cur.length >= 2 && hasScores && Math.abs((cur[0].total_score || 0) - (cur[1].total_score || 0)) <= 2) {
    items.push(evTightRace(cur[0], cur[1], tag));
  }

  // 6) Always-available fallback so the board is never silent once scores exist
  if (hasScores) items.push(evLeader(curTop, decidedCount, tag));

  if (!items.length) return null;

  // De-dupe by id, keep priority order.
  const seen = new Set();
  const ordered = items.filter(it => it && !seen.has(it.id) && seen.add(it.id));
  return { headline: ordered[0], items: ordered.slice(0, 4) };
}

// Write only-if-changed (ignore updatedAt), like export-snapshots.
function writeIfChanged(file, payload, compareKeys) {
  const prev = readJson(file, null);
  const same = prev && compareKeys.every(k => JSON.stringify(prev[k]) === JSON.stringify(payload[k]));
  if (same) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload));
  return true;
}

async function main() {
  fs.mkdirSync(BANTER_DIR, { recursive: true });
  const nowIso = new Date().toISOString();
  const now = Date.now();

  const pools = await sbAll('pools', '?select=id,name');
  const users = await sbAll('users', '?select=id,pool_id,nickname,total_score,joined_at&order=total_score.desc.nullslast');
  const matches = await sbAll('matches', '?select=*');
  let champRows = [];
  try { champRows = await sbAll('tournament_winner_picks', '?select=pool_id,user_id,team_code'); } catch (_) { champRows = []; }

  const state = readJson(STATE_FILE, { pools: {}, seenFinishedIds: [] });
  const globalSeen = new Set(state.seenFinishedIds || []);

  const finished = (matches || []).filter(m => TERMINAL.has(m.status));
  const finishedIds = finished.map(m => String(m.external_id || m.id));

  // Matches decided since the last run (and recent enough to be "fresh drama").
  const newly = finished
    .filter(m => !globalSeen.has(String(m.external_id || m.id)))
    .filter(m => m.match_date && (now - Date.parse(m.match_date)) < NEWLY_WINDOW_MS);

  // Knockout eliminations among the newly-finished matches.
  const newlyKO = newly
    .filter(m => m.stage && m.stage !== 'GROUP_STAGE' && m.stage !== 'THIRD_PLACE')
    .map(m => {
      const winner = knockoutWinner(m);
      if (!winner) return null;
      const loser = winner === m.home_team_code ? m.away_team_code : m.home_team_code;
      return loser ? { match: m, winner, loser } : null;
    })
    .filter(Boolean);

  // Late goals (>=80') from newly-finished matches, by the eventual winner — the
  // "buzzer-beater" flavor. Newest match first.
  const lateGoals = [];
  newly
    .slice()
    .sort((a, b) => Date.parse(b.match_date) - Date.parse(a.match_date))
    .forEach(m => {
      const winner = knockoutWinner(m) ||
        (m.home_score > m.away_score ? m.home_team_code : m.away_score > m.home_score ? m.away_team_code : null);
      const goals = Array.isArray(m.scorers) ? m.scorers : [];
      const late = goals
        .filter(g => g.player && g.minute != null && (g.minute + (g.injury || 0)) >= 80)
        .filter(g => !winner || g.team === winner) // a late goal by the side that won
        .sort((a, b) => (b.minute + (b.injury || 0)) - (a.minute + (a.injury || 0)))[0];
      if (late) lateGoals.push({ goal: late, team: late.team, match: m });
    });

  // Champion picks grouped per pool.
  const champByPool = {};
  (champRows || []).forEach(r => {
    (champByPool[r.pool_id] = champByPool[r.pool_id] || new Map()).set(r.user_id, r.team_code);
  });

  const usersByPool = {};
  (users || []).forEach(u => (usersByPool[u.pool_id] = usersByPool[u.pool_id] || []).push(u));

  let wrote = 0;
  const newStatePools = {};
  for (const pool of pools) {
    const pu = usersByPool[pool.id] || [];
    if (!pu.length) continue;

    const prevStandings = (state.pools && state.pools[pool.id] && state.pools[pool.id].standings) || null;
    const champPicks = champByPool[pool.id] || new Map();

    const result = buildPoolBanter(prevStandings, pu, newlyKO, lateGoals, champPicks, newly.length);

    // Always snapshot the current standings for next run's diff.
    newStatePools[pool.id] = {
      standings: rankUsers(pu).map(u => ({ id: u.id, nickname: nick(u), total_score: u.total_score || 0 })),
    };

    if (!result) continue;
    const payload = {
      updatedAt: nowIso, pool_id: pool.id,
      headline: result.headline, items: result.items,
    };
    if (writeIfChanged(path.join(BANTER_DIR, `${pool.id}.json`), payload, ['headline', 'items'])) wrote++;
  }

  // Persist state: snapshot standings + mark every finished match as accounted-for.
  const newState = {
    updatedAt: nowIso,
    pools: newStatePools,
    seenFinishedIds: finishedIds.slice(-2000), // cap so the file can't grow unbounded
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(newState));
  console.log(`banter: ${wrote} pool file(s) updated of ${pools.length}; ${newly.length} new match(es), ${lateGoals.length} late goal(s).`);
}

if (require.main === module) {
  main().catch(e => { console.error('generate-banter fatal:', e); process.exit(1); });
} else {
  module.exports = { main, buildPoolBanter, rankUsers, minuteLabel };
}
