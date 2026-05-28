// Download up to 5 portraits per player to
//   player-photos-multi/<TEAM>/<name>/{1..5}.<ext>
//
// For each player whose first run found a Wikipedia article,
// re-query that article for ALL file references (prop=images),
// filter to portraits (jpg/png/webp, no flags/logos/stadiums),
// resolve each to a 600px thumbnail via Commons imageinfo, and
// download the first 5.
//
//   node scripts/download-player-photos-multi.js
//   node scripts/download-player-photos-multi.js --team=ARG
//   node scripts/download-player-photos-multi.js --max=3

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU';
const OUT_DIR = path.resolve(__dirname, '..', 'player-photos-multi');
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'FriendlyBetPhotoMulti/1.0 (https://friendlybet.live; +https://github.com/Aviatorpo/friendlybet)';
const THUMB_SIZE = 600;
const REQ_DELAY_MS = 350;
const MAX_RETRIES = 5;

const args = process.argv.slice(2);
const TEAM_FILTER = (args.find(a => a.startsWith('--team=')) || '').split('=')[1] || null;
const MAX_PER_PLAYER = parseInt((args.find(a => a.startsWith('--max=')) || '').split('=')[1] || '5', 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeName = (s) => String(s).normalize('NFKD').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
const extFromUrl = (url) => {
  const m = url.match(/\.(jpg|jpeg|png|webp|gif)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : 'jpg';
};

// Drop obvious non-portrait files by name.
const BAD_NAME_PATTERNS = [
  /flag/i, /coat[_ -]?of[_ -]?arms/i, /\bcrest\b/i, /\blogo\b/i, /\bbadge\b/i,
  /stadium/i, /\bmap\b/i, /signature/i,
  /\.svg$/i, /commons-logo/i, /wiki(?:pedia|media)/i,
  /world[_ -]?cup-?logo/i,
];

const isPortraitFile = (fileName) => {
  if (!/\.(jpg|jpeg|png|webp)$/i.test(fileName)) return false;
  return !BAD_NAME_PATTERNS.some((re) => re.test(fileName));
};

async function fetchJson(url) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.status === 429 || res.status === 503) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function fetchPlayers() {
  const filters = ['select=name_en,team_code,photo_attribution', 'photo_url=not.is.null'];
  if (TEAM_FILTER) filters.push(`team_code=eq.${TEAM_FILTER}`);
  const PAGE = 1000;
  const all = [];
  let offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/players?${filters.join('&')}&order=team_code.asc,name_en.asc&offset=${offset}&limit=${PAGE}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < PAGE) break;
    offset += page.length;
  }
  return all;
}

// photo_attribution is "<Page Title>, Wikipedia (CC-BY-SA)"
const titleFromAttribution = (attr) => {
  if (!attr) return null;
  return attr.replace(/, Wikipedia.*$/i, '').trim() || null;
};

async function listArticleImages(title) {
  const url = `${WIKI_API}?action=query&format=json&prop=images&titles=${encodeURIComponent(title)}&imlimit=50&origin=*`;
  const json = await fetchJson(url);
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0];
  const imgs = page?.images || [];
  return imgs.map((i) => i.title).filter((t) => t && /^File:/i.test(t));
}

async function resolveCommonsThumbs(files) {
  if (!files.length) return new Map();
  const url = `${COMMONS_API}?action=query&format=json&prop=imageinfo&iiprop=url|mime&iiurlwidth=${THUMB_SIZE}&titles=${encodeURIComponent(files.join('|'))}&origin=*`;
  const json = await fetchJson(url);
  const pages = json?.query?.pages || {};
  const out = new Map();
  for (const p of Object.values(pages)) {
    const info = p.imageinfo?.[0];
    if (info?.thumburl && /^image\/(jpe?g|png|webp)$/i.test(info.mime || '')) {
      out.set(p.title, info.thumburl);
    }
  }
  return out;
}

async function downloadFile(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return { skipped: true };
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.status === 429 || res.status === 503) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      return { bytes: buf.length };
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err;
      await sleep(500 * (attempt + 1));
    }
  }
}

(async () => {
  console.log(`📥 Multi-photo download → ${OUT_DIR}`);
  console.log(`    max per player = ${MAX_PER_PLAYER}, team = ${TEAM_FILTER || 'ALL'}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const players = await fetchPlayers();
  console.log(`    ${players.length} players in scope\n`);

  let processed = 0;
  let totalFiles = 0;
  let totalBytes = 0;
  let noTitle = 0;
  const credits = [];

  for (const p of players) {
    processed++;
    const title = titleFromAttribution(p.photo_attribution);
    if (!title) { noTitle++; continue; }

    const playerDir = path.join(OUT_DIR, p.team_code || 'UNKNOWN', safeName(p.name_en));

    try {
      const files = (await listArticleImages(title)).filter(isPortraitFile).slice(0, MAX_PER_PLAYER * 3);
      await sleep(REQ_DELAY_MS);
      if (!files.length) continue;

      const thumbs = await resolveCommonsThumbs(files);
      await sleep(REQ_DELAY_MS);

      const picks = files.filter((f) => thumbs.has(f)).slice(0, MAX_PER_PLAYER);
      if (!picks.length) continue;

      fs.mkdirSync(playerDir, { recursive: true });

      let savedHere = 0;
      for (let i = 0; i < picks.length; i++) {
        const file = picks[i];
        const url = thumbs.get(file);
        const dest = path.join(playerDir, `${i + 1}.${extFromUrl(url)}`);
        try {
          const r = await downloadFile(url, dest);
          if (!r.skipped) {
            totalBytes += r.bytes || 0;
            credits.push(`${p.team_code}/${safeName(p.name_en)}/${i + 1} — ${file} (Wikimedia Commons, CC-BY-SA)`);
          }
          savedHere++;
          await sleep(REQ_DELAY_MS);
        } catch (err) {
          console.log(`   ! ${p.team_code} ${p.name_en} #${i + 1}: ${err.message}`);
        }
      }
      totalFiles += savedHere;
    } catch (err) {
      console.log(`   ! ${p.team_code} ${p.name_en}: ${err.message}`);
    }

    if (processed % 25 === 0 || processed === players.length) {
      console.log(`  [${processed}/${players.length}] files=${totalFiles} noTitle=${noTitle}`);
    }
  }

  if (credits.length) {
    fs.appendFileSync(
      path.join(OUT_DIR, 'CREDITS.txt'),
      `\nDownloaded ${new Date().toISOString()}\n` + credits.join('\n') + '\n',
    );
  }

  console.log(`\n📊 done. files=${totalFiles} players=${processed} noTitle=${noTitle}`);
  console.log(`   total size = ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   output dir = ${OUT_DIR}`);
})().catch((err) => {
  console.error('💥', err);
  process.exit(1);
});
