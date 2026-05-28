// ============================================================
// FriendlyBet - Player Photo Sync (Wikipedia)
// ============================================================
// For every player row in `players`, find a portrait via the
// Wikipedia API and store the thumbnail URL on the row.
//
// Source: en.wikipedia.org pageimages (CC-BY-SA, attribution required).
// We store the URL only — Wikipedia serves the image hot from
// upload.wikimedia.org. No download / Storage upload.
//
// Strategy per player:
//   1. Search "<name> <team> footballer" → take top hit's page title.
//   2. Fetch pageimages thumbnail (400px) for that title.
//   3. Write players.photo_url + photo_source='wikipedia'
//      + photo_attribution='<page title>, Wikipedia (CC-BY-SA)'.
//   4. If no result, leave photo_url NULL; the app falls back to
//      a flag-and-initials avatar.
//
// Idempotent: by default skips rows where photo_synced_at is set.
// Pass --force to re-sync everyone (e.g. after squads refresh).
//
// Run locally:
//   SUPABASE_SECRET_KEY=... node scripts/sync-player-photos.js
// Or one team:
//   node scripts/sync-player-photos.js --team=ARG
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const TEAM_FILTER = (args.find(a => a.startsWith('--team=')) || '').split('=')[1] || null;
const LIMIT = parseInt((args.find(a => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10);

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const THUMB_SIZE = 400;
const USER_AGENT = 'FriendlyBetPhotoSync/1.0 (https://friendlybet.live; contact: +https://github.com/Aviatorpo/friendlybet)';
const REQUEST_DELAY_MS = 200;

const TEAM_FULL_NAME = {
  ARG: 'Argentina', BRA: 'Brazil', FRA: 'France', ENG: 'England', ESP: 'Spain',
  POR: 'Portugal', NED: 'Netherlands', GER: 'Germany', BEL: 'Belgium', CRO: 'Croatia',
  URU: 'Uruguay', USA: 'United States', MEX: 'Mexico', SUI: 'Switzerland',
  AUT: 'Austria', SWE: 'Sweden', SEN: 'Senegal', MAR: 'Morocco', JPN: 'Japan',
  KOR: 'South Korea', AUS: 'Australia', CAN: 'Canada', UKR: 'Ukraine', TUR: 'Turkey',
  NOR: 'Norway', IRN: 'Iran', TUN: 'Tunisia', EGY: 'Egypt', CMR: 'Cameroon',
  GHA: 'Ghana', PAN: 'Panama', JAM: 'Jamaica', PAR: 'Paraguay', NZL: 'New Zealand',
  UZB: 'Uzbekistan', IRQ: 'Iraq', SAU: 'Saudi Arabia', JOR: 'Jordan',
  RSA: 'South Africa', ALG: 'Algeria', CZE: 'Czech Republic', HAI: 'Haiti',
  BIH: 'Bosnia and Herzegovina', CPV: 'Cape Verde', COD: 'DR Congo', CIV: 'Ivory Coast',
  QAT: 'Qatar', SCO: 'Scotland', CUR: 'Curaçao',
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callSupabase(method, table, options = {}) {
  const { data, query = '' } = options;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function wikiSearchTitle(playerName, teamCode) {
  const teamName = TEAM_FULL_NAME[teamCode] || '';
  const query = `${playerName} ${teamName} footballer`.trim();
  const url = `${WIKI_API}?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`wiki search ${res.status}`);
  const json = await res.json();
  return json?.query?.search?.[0]?.title || null;
}

async function wikiThumbnail(title) {
  const url = `${WIKI_API}?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=${THUMB_SIZE}&titles=${encodeURIComponent(title)}&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`wiki thumb ${res.status}`);
  const json = await res.json();
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0];
  return page?.thumbnail?.source || null;
}

async function findPhoto(player) {
  try {
    const title = await wikiSearchTitle(player.name_en, player.team_code);
    if (!title) return null;
    await sleep(REQUEST_DELAY_MS);
    const thumb = await wikiThumbnail(title);
    if (!thumb) return { url: null, title };
    return { url: thumb, title };
  } catch (err) {
    console.log(`   ! wiki error for ${player.name_en}: ${err.message}`);
    return null;
  }
}

async function fetchPlayers() {
  const filters = ['select=id,name_en,team_code,photo_synced_at'];
  if (TEAM_FILTER) filters.push(`team_code=eq.${TEAM_FILTER}`);
  if (!FORCE) filters.push('photo_synced_at=is.null');
  const baseQuery = `?${filters.join('&')}&order=team_code.asc,name_en.asc`;

  // PostgREST caps responses at 1000 rows by default — paginate manually.
  const PAGE = 1000;
  const cap = LIMIT > 0 ? LIMIT : Infinity;
  const all = [];
  let offset = 0;
  while (all.length < cap) {
    const want = Math.min(PAGE, cap - all.length);
    const page = await callSupabase('GET', 'players', {
      query: `${baseQuery}&offset=${offset}&limit=${want}`,
    }) || [];
    all.push(...page);
    if (page.length < want) break;
    offset += page.length;
  }
  return all;
}

async function updatePlayer(id, patch) {
  await callSupabase('PATCH', 'players', {
    data: patch,
    query: `?id=eq.${id}`,
  });
}

(async () => {
  console.log('🎞️  Player photo sync starting');
  console.log(`    force=${FORCE} team=${TEAM_FILTER || 'ALL'} limit=${LIMIT || 'none'}`);

  const players = await fetchPlayers();
  console.log(`    ${players.length} players to process\n`);

  let hits = 0;
  let misses = 0;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const found = await findPhoto(p);
    const now = new Date().toISOString();

    if (found && found.url) {
      await updatePlayer(p.id, {
        photo_url: found.url,
        photo_source: 'wikipedia',
        photo_attribution: `${found.title}, Wikipedia (CC-BY-SA)`,
        photo_synced_at: now,
      });
      hits++;
      console.log(`   ✓ [${i + 1}/${players.length}] ${p.team_code} ${p.name_en}`);
    } else {
      await updatePlayer(p.id, {
        photo_url: null,
        photo_source: found ? 'wikipedia-no-image' : 'not-found',
        photo_attribution: found?.title || null,
        photo_synced_at: now,
      });
      misses++;
      console.log(`   · [${i + 1}/${players.length}] ${p.team_code} ${p.name_en} — no photo`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n📊 done. hits=${hits} misses=${misses} total=${players.length}`);
  console.log(`    coverage=${players.length ? Math.round((hits / players.length) * 100) : 0}%`);
})().catch(err => {
  console.error('💥', err);
  process.exit(1);
});
