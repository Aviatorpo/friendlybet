// ============================================================
// FriendlyBet - Champion hero-image generator (one-off tooling)
// ============================================================
// Generates one "champion lifting the World Cup" hero illustration per WC2026
// national team via the OpenAI Images API (gpt-image-1). Output PNGs power the
// new share card (champion = the user's predicted winner).
//
// Usage:
//   node scripts/generate-champion-heroes.js            # all 48 teams
//   node scripts/generate-champion-heroes.js BRA ARG    # only these codes
//   node scripts/generate-champion-heroes.js --force ESP  # re-generate (overwrite)
//
// Key: read from _private/.env.prod (OPENAI_API_KEY=...) or process.env.
// Output: _private/heroes/hero-<CODE>.png  (gitignored, not committed)
// ------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '_private', 'heroes');

// --- API key ---------------------------------------------------------------
function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  try {
    const t = fs.readFileSync(path.join(ROOT, '_private', '.env.prod'), 'utf8');
    const m = t.match(/OPENAI_API_KEY\s*=\s*(\S+)/);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  } catch (_) {}
  return null;
}

// --- Team table: code -> { name, kit } -------------------------------------
// `kit` describes the HOME shirt so the model paints the right colours.
// player/number = WC2026 captain + shirt number (see _private/captains.json,
// verified across multiple sources 2026-06-06). manual:true marks mega-stars
// the OpenAI API moderation blocks (Messi/Ronaldo/etc.) — generate those by
// hand in ChatGPT; the batch run auto-skips them unless requested by code.
const TEAMS = {
  MEX:{name:'Mexico',kit:'green and white Mexico',player:'Edson Álvarez',number:4}, RSA:{name:'South Africa',kit:'gold-yellow and green South Africa',player:'Ronwen Williams',number:1}, KOR:{name:'South Korea',kit:'red South Korea',player:'Son Heung-min',number:7,manual:true}, CZE:{name:'Czechia',kit:'red Czech Republic',player:'Ladislav Krejčí',number:7},
  CAN:{name:'Canada',kit:'red Canada',player:'Alphonso Davies',number:19}, BIH:{name:'Bosnia',kit:'royal blue Bosnia',player:'Edin Džeko',number:11}, QAT:{name:'Qatar',kit:'dark maroon Qatar',player:'Hassan Al-Haydos',number:10}, SUI:{name:'Switzerland',kit:'red Switzerland',player:'Granit Xhaka',number:10},
  BRA:{name:'Brazil',kit:'iconic yellow and green Brazil',player:'Marquinhos',number:4}, MAR:{name:'Morocco',kit:'red and green Morocco',player:'Achraf Hakimi',number:2}, HAI:{name:'Haiti',kit:'blue and red Haiti',player:'Johny Placide',number:1}, SCO:{name:'Scotland',kit:'dark navy blue Scotland',player:'Andy Robertson',number:3},
  USA:{name:'United States',kit:'white and navy USA',player:'Tim Ream',number:13}, PAR:{name:'Paraguay',kit:'red and white striped Paraguay',player:'Gustavo Gómez',number:15}, AUS:{name:'Australia',kit:'gold-yellow Australia',player:'Mathew Ryan',number:1}, TUR:{name:'Turkey',kit:'red Turkey',player:'Hakan Çalhanoğlu',number:10},
  GER:{name:'Germany',kit:'white with black trim Germany',player:'Joshua Kimmich',number:6}, CUR:{name:'Curacao',kit:'blue Curacao',player:'Leandro Bacuna',number:10}, CIV:{name:'Ivory Coast',kit:'bright orange Ivory Coast',player:'Franck Kessié',number:8}, ECU:{name:'Ecuador',kit:'yellow Ecuador',player:'Enner Valencia',number:13},
  NED:{name:'Netherlands',kit:'bright orange Netherlands',player:'Virgil van Dijk',number:4,manual:true}, JPN:{name:'Japan',kit:'deep blue Japan',player:'Wataru Endo',number:6}, SWE:{name:'Sweden',kit:'yellow and blue Sweden',player:'Victor Nilsson Lindelöf',number:3}, TUN:{name:'Tunisia',kit:'red and white Tunisia',player:'Ellyes Skhiri',number:17},
  BEL:{name:'Belgium',kit:'red Belgium',player:'Youri Tielemans',number:8}, EGY:{name:'Egypt',kit:'red Egypt',player:'Mohamed Salah',number:10,manual:true}, IRN:{name:'Iran',kit:'white and red Iran',player:'Alireza Jahanbakhsh',number:7}, NZL:{name:'New Zealand',kit:'all white New Zealand',player:'Chris Wood',number:9},
  ESP:{name:'Spain',kit:'red Spain',player:'Rodri',number:16}, CPV:{name:'Cape Verde',kit:'blue Cape Verde',player:'Ryan Mendes',number:20}, SAU:{name:'Saudi Arabia',kit:'white and green Saudi Arabia',player:'Salem Al-Dawsari',number:10}, URU:{name:'Uruguay',kit:'sky blue (celeste) Uruguay',player:'Federico Valverde',number:8},
  FRA:{name:'France',kit:'blue France',player:'Kylian Mbappé',number:10,manual:true}, SEN:{name:'Senegal',kit:'white and green Senegal',player:'Kalidou Koulibaly',number:3}, IRQ:{name:'Iraq',kit:'white and green Iraq',player:'Jalal Hassan',number:12}, NOR:{name:'Norway',kit:'red Norway',player:'Martin Ødegaard',number:10},
  ARG:{name:'Argentina',kit:'sky blue and white vertical striped Argentina',player:'Lionel Messi',number:10,manual:true}, ALG:{name:'Algeria',kit:'white and green Algeria',player:'Riyad Mahrez',number:7}, AUT:{name:'Austria',kit:'red Austria',player:'David Alaba',number:8}, JOR:{name:'Jordan',kit:'red and white Jordan',player:'Ihsan Haddad',number:23},
  POR:{name:'Portugal',kit:'dark red with green trim Portugal',player:'Cristiano Ronaldo',number:7,manual:true}, COD:{name:'Congo DR',kit:'blue Congo',player:'Chancel Mbemba',number:22}, UZB:{name:'Uzbekistan',kit:'white and blue Uzbekistan',player:'Eldor Shomurodov',number:14}, COL:{name:'Colombia',kit:'bright yellow Colombia',player:'James Rodríguez',number:10},
  ENG:{name:'England',kit:'white England',player:'Harry Kane',number:9,manual:true}, CRO:{name:'Croatia',kit:'red and white checkered Croatia',player:'Luka Modrić',number:10,manual:true}, GHA:{name:'Ghana',kit:'white and red Ghana',player:'Jordan Ayew',number:9}, PAN:{name:'Panama',kit:'red Panama',player:'Aníbal Godoy',number:20},
};

// --- Prompt template -------------------------------------------------------
// Mirrors the prompt Eyal used in ChatGPT for the Spain reference:
// "captain of the current <team> national team playing in the upcoming World
//  Cup, lifting the World Cup trophy. Make it a slightly cartoonized character."
const STYLES = {
  painterly: 'Cinematic semi-realistic digital painting, soft brushwork and shading, rich warm colours, subtle cartoon stylization like a premium sports poster.',
  comic:     'Bold comic-book / graphic-novel illustration, strong black ink outlines, flat cel shading, punchy and dynamic, slight halftone texture.',
  render3d:  'Stylized 3D animated-movie character render (Pixar / EA Sports FIFA videogame style), glossy smooth shading, soft studio lighting, slightly exaggerated friendly features.',
};

function buildPrompt(team, styleText) {
  if (team.fullPrompt) return team.fullPrompt;
  const who = team.player
    ? `${team.player}, the captain of the current ${team.name} national football team`
    : `the captain of the current ${team.name} national football team`;
  const num = team.number
    ? `The shirt must show ONLY the number ${team.number} printed on it — no other text, letters or words, and no distorted logos.`
    : `The shirt must be plain with NO text, letters, numbers or words on it, and no distorted logos.`;
  const style = styleText
    || 'Slightly cartoonized, lightly stylized semi-realistic illustration with a soft illustrated finish and warm cinematic lighting.';
  return (
    `Create an image of ${who} ` +
    `(from the squad playing in the upcoming 2026 FIFA World Cup), wearing the ${team.kit} home kit, ` +
    `joyfully lifting the golden FIFA World Cup trophy high above his head, beaming with a huge smile, ` +
    `keeping a realistic likeness of the player. ` +
    `Behind him: a packed stadium crowd cheering, golden confetti falling, dramatic warm golden-hour ` +
    `floodlight glow. Portrait orientation, the player centered with the trophy near the top of the frame. ` +
    `${num} Art style: ${style}`
  );
}

// --- One image -------------------------------------------------------------
async function genOne(code, key, { force, quality, style }) {
  const team = TEAMS[code];
  if (!team) { console.log(`  ! unknown code ${code}, skipping`); return false; }
  const suffix = style ? `-${style.key}` : '';
  const fname = `hero-${code}${suffix}.png`;
  const outPath = path.join(OUT_DIR, fname);
  if (!force && fs.existsSync(outPath)) { console.log(`  = ${fname} exists, skip (use --force to redo)`); return true; }

  const body = {
    model: 'gpt-image-1',
    prompt: buildPrompt(team, style && style.text),
    size: '1024x1536',
    quality,            // 'low' | 'medium' | 'high'
    n: 1,
  };
  process.stdout.write(`  > ${code} (${team.name})${style ? ' ['+style.key+']' : ''} ... `);
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    console.log(`FAILED (${res.status})`);
    console.log('    ' + errTxt.slice(0, 400));
    return false;
  }
  const json = await res.json();
  const b64 = json && json.data && json.data[0] && json.data[0].b64_json;
  if (!b64) { console.log('FAILED (no image data)'); return false; }
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`OK ${kb}KB ${(Date.now() - t0) / 1000}s -> ${path.relative(ROOT, outPath)}`);
  return true;
}

// --- Main ------------------------------------------------------------------
(async () => {
  const key = loadKey();
  if (!key) { console.error('No OPENAI_API_KEY (set env or _private/.env.prod). Aborting.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const qArg = (argv.find(a => a.startsWith('--quality=')) || '').split('=')[1];
  const quality = qArg || 'medium';
  const styleArg = (argv.find(a => a.startsWith('--style=')) || '').split('=')[1];
  const includeManual = argv.includes('--include-manual');
  let codes = argv.filter(a => !a.startsWith('--')).map(c => c.toUpperCase());
  const explicit = codes.length > 0;
  if (!explicit) {
    // Full run: skip the mega-stars the API blocks (do those manually) unless asked.
    codes = Object.keys(TEAMS).filter(c => includeManual || !TEAMS[c].manual);
    const skipped = Object.keys(TEAMS).filter(c => TEAMS[c].manual);
    if (!includeManual && skipped.length) console.log(`Skipping ${skipped.length} manual/API-blocked stars: ${skipped.join(', ')} (generate by hand, or pass --include-manual)`);
  }

  // Build the list of (code, style) jobs.
  let styles = [null];
  if (styleArg === 'all') styles = Object.keys(STYLES).map(k => ({ key: k, text: STYLES[k] }));
  else if (styleArg && STYLES[styleArg]) styles = [{ key: styleArg, text: STYLES[styleArg] }];

  const jobs = [];
  for (const code of codes) for (const style of styles) jobs.push({ code, style });

  console.log(`Generating ${jobs.length} image(s) at quality=${quality}${force ? ' (force)' : ''}${styleArg ? ' style=' + styleArg : ''}`);
  let ok = 0, fail = 0;
  for (const { code, style } of jobs) {
    try { (await genOne(code, key, { force, quality, style })) ? ok++ : fail++; }
    catch (e) { console.log(`  ! ${code} error: ${e.message}`); fail++; }
  }
  console.log(`\nDone. ok=${ok} fail=${fail}. Output: ${path.relative(ROOT, OUT_DIR)}`);
})();
