// Download every players.photo_url to ./player-photos/<TEAM>/<name>.<ext>
// Uses the public Supabase key — RLS allows SELECT on players.
//
//   node scripts/download-player-photos.js

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU';
const OUT_DIR = path.resolve(__dirname, '..', 'player-photos');
const CONCURRENCY = 2;
const REQ_DELAY_MS = 250;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safeName(s) {
  return String(s).normalize('NFKD').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function extFromUrl(url) {
  const m = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : 'jpg';
}

async function fetchAll() {
  const PAGE = 1000;
  const all = [];
  let offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/players?select=name_en,team_code,photo_url,photo_attribution&photo_url=not.is.null&order=team_code.asc,name_en.asc&offset=${offset}&limit=${PAGE}`;
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

async function downloadOne(player) {
  const teamDir = path.join(OUT_DIR, player.team_code || 'UNKNOWN');
  fs.mkdirSync(teamDir, { recursive: true });
  const ext = extFromUrl(player.photo_url);
  const file = path.join(teamDir, `${safeName(player.name_en)}.${ext}`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) {
    return { skipped: true };
  }
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(player.photo_url, {
        headers: { 'User-Agent': 'FriendlyBetPhotoDownloader/1.0 (+https://github.com/Aviatorpo/friendlybet)' },
      });
      if (res.status === 429 || res.status === 503) {
        const wait = 1000 * Math.pow(2, attempt);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      await sleep(REQ_DELAY_MS);
      return { bytes: buf.length };
    } catch (err) {
      lastErr = err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr || new Error('exhausted retries');
}

async function runPool(items, worker, n) {
  let i = 0;
  let ok = 0, skip = 0, fail = 0, bytes = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        const p = items[idx];
        try {
          const r = await worker(p);
          if (r.skipped) skip++;
          else { ok++; bytes += r.bytes || 0; }
          if ((idx + 1) % 25 === 0 || idx + 1 === items.length) {
            console.log(`  [${idx + 1}/${items.length}] ok=${ok} skip=${skip} fail=${fail}`);
          }
        } catch (err) {
          fail++;
          console.log(`  ! ${p.team_code} ${p.name_en}: ${err.message}`);
        }
      }
    })
  );
  return { ok, skip, fail, bytes };
}

(async () => {
  console.log(`📥 Downloading player photos → ${OUT_DIR}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const players = await fetchAll();
  console.log(`   ${players.length} players with photos\n`);

  const stats = await runPool(players, downloadOne, CONCURRENCY);

  const credits = players
    .map(p => `${p.team_code}/${safeName(p.name_en)} — ${p.photo_attribution || 'Wikipedia'} (CC-BY-SA)`)
    .join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'CREDITS.txt'),
    `Player portraits sourced from Wikipedia (CC-BY-SA).\nAttribution per file:\n\n${credits}\n`);

  console.log(`\n📊 done. downloaded=${stats.ok} skipped=${stats.skip} failed=${stats.fail}`);
  console.log(`   total size = ${(stats.bytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   output dir = ${OUT_DIR}`);
})().catch(err => {
  console.error('💥', err);
  process.exit(1);
});
