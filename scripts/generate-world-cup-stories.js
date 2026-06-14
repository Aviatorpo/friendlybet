#!/usr/bin/env node
/*
 * Generates the public Story of the World Cup feed from finished matches.
 *
 * The client reads public-data/world-cup-stories.json with cache:no-store, so
 * this script can add fresh stories from the scheduled scoring workflow without
 * requiring an app version bump or a PWA cache release.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MATCHES_PATH = path.join(ROOT, 'public-data', 'matches.json');
const STORIES_PATH = path.join(ROOT, 'public-data', 'world-cup-stories.json');
const ASSET_DIR = path.join(ROOT, 'story-assets');
const MANIFEST_PATH = path.join(ASSET_DIR, 'manifest.json');
const MAX_STORIES = Number(process.env.WC_STORY_LIMIT || 5);

const TEAM_NAMES = {
  ARG: { en: 'Argentina', he: 'ארגנטינה' },
  AUS: { en: 'Australia', he: 'אוסטרליה' },
  AUT: { en: 'Austria', he: 'אוסטריה' },
  BEL: { en: 'Belgium', he: 'בלגיה' },
  BIH: { en: 'Bosnia and Herzegovina', he: 'בוסניה והרצגובינה' },
  BRA: { en: 'Brazil', he: 'ברזיל' },
  CAN: { en: 'Canada', he: 'קנדה' },
  CIV: { en: 'Ivory Coast', he: 'חוף השנהב' },
  COD: { en: 'DR Congo', he: 'הרפובליקה הדמוקרטית של קונגו' },
  COL: { en: 'Colombia', he: 'קולומביה' },
  CPV: { en: 'Cape Verde', he: 'כף ורדה' },
  CRO: { en: 'Croatia', he: 'קרואטיה' },
  CUR: { en: 'Curacao', he: 'קוראסאו' },
  CZE: { en: 'Czech Republic', he: "צ'כיה" },
  ECU: { en: 'Ecuador', he: 'אקוודור' },
  EGY: { en: 'Egypt', he: 'מצרים' },
  ENG: { en: 'England', he: 'אנגליה' },
  ESP: { en: 'Spain', he: 'ספרד' },
  FRA: { en: 'France', he: 'צרפת' },
  GER: { en: 'Germany', he: 'גרמניה' },
  GHA: { en: 'Ghana', he: 'גאנה' },
  HAI: { en: 'Haiti', he: 'האיטי' },
  IRN: { en: 'Iran', he: 'איראן' },
  IRQ: { en: 'Iraq', he: 'עיראק' },
  JPN: { en: 'Japan', he: 'יפן' },
  JOR: { en: 'Jordan', he: 'ירדן' },
  KOR: { en: 'South Korea', he: 'קוריאה הדרומית' },
  MAR: { en: 'Morocco', he: 'מרוקו' },
  MEX: { en: 'Mexico', he: 'מקסיקו' },
  NED: { en: 'Netherlands', he: 'הולנד' },
  NOR: { en: 'Norway', he: 'נורבגיה' },
  NZL: { en: 'New Zealand', he: 'ניו זילנד' },
  PAN: { en: 'Panama', he: 'פנמה' },
  PAR: { en: 'Paraguay', he: 'פרגוואי' },
  POR: { en: 'Portugal', he: 'פורטוגל' },
  QAT: { en: 'Qatar', he: 'קטאר' },
  RSA: { en: 'South Africa', he: 'דרום אפריקה' },
  SAU: { en: 'Saudi Arabia', he: 'ערב הסעודית' },
  SCO: { en: 'Scotland', he: 'סקוטלנד' },
  SEN: { en: 'Senegal', he: 'סנגל' },
  SUI: { en: 'Switzerland', he: 'שווייץ' },
  SWE: { en: 'Sweden', he: 'שוודיה' },
  TUN: { en: 'Tunisia', he: 'תוניסיה' },
  TUR: { en: 'Turkey', he: 'טורקיה' },
  URU: { en: 'Uruguay', he: 'אורוגוואי' },
  USA: { en: 'USA', he: 'ארה"ב' },
  UZB: { en: 'Uzbekistan', he: 'אוזבקיסטן' },
};

const STAR_PROFILES = {
  ARG: { player: 'Lionel Messi', number: 10 },
  AUS: { player: 'Mathew Ryan', number: 1, role: 'captain goalkeeper' },
  BEL: { player: 'Kevin De Bruyne', number: 7 },
  BIH: { player: 'Edin Dzeko', number: 11 },
  BRA: { player: 'Vinicius Jr', number: 7 },
  CAN: { player: 'Alphonso Davies', number: 19 },
  CRO: { player: 'Luka Modric', number: 10 },
  CZE: { player: 'Patrik Schick', number: 10 },
  ENG: { player: 'Harry Kane', number: 9 },
  ESP: { player: 'Alvaro Morata', number: 7 },
  FRA: { player: 'Kylian Mbappe', number: 10 },
  GER: { player: 'Jamal Musiala', number: 10 },
  HAI: { player: 'Duckens Nazon', number: 9 },
  JPN: { player: 'Takefusa Kubo', number: 20 },
  KOR: { player: 'Son Heung-min', number: 7 },
  MAR: { player: 'Achraf Hakimi', number: 2 },
  MEX: { player: 'Raul Jimenez', number: 9 },
  NED: { player: 'Virgil van Dijk', number: 4 },
  NOR: { player: 'Erling Haaland', number: 9 },
  PAR: { player: 'Miguel Almiron', number: 10 },
  POR: { player: 'Bruno Fernandes', number: 8 },
  QAT: { player: 'Akram Afif', number: 11 },
  RSA: { player: 'Ronwen Williams', number: 1, role: 'goalkeeper' },
  SCO: { player: 'Andy Robertson', number: 3 },
  SEN: { player: 'Sadio Mane', number: 10 },
  SUI: { player: 'Granit Xhaka', number: 10 },
  SWE: { player: 'Alexander Isak', number: 9 },
  TUR: { player: 'Hakan Calhanoglu', number: 10 },
  URU: { player: 'Federico Valverde', number: 15 },
  USA: { player: 'Christian Pulisic', number: 10 },
};

const DRAW_FOCUS = {
  'BRA-MAR': 'BRA',
  'CAN-BIH': 'CAN',
  'QAT-SUI': 'SUI',
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJsonIfChanged(file, data) {
  const next = JSON.stringify(data, null, 2) + '\n';
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current === next) return false;
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

function teamName(code, lang = 'en') {
  return (TEAM_NAMES[code] && TEAM_NAMES[code][lang]) || code;
}

function matchKey(match) {
  return `${match.home_team_code}-${match.away_team_code}`;
}

function storyId(match) {
  const date = String(match.match_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `${match.home_team_code}-${match.away_team_code}-${date}`.toLowerCase();
}

function outcomeFor(match) {
  if (match.winner_code) return match.winner_code;
  return Number(match.home_score) === Number(match.away_score) ? 'DRAW' : null;
}

function scoreDash(match) {
  return `${Number(match.home_score)}-${Number(match.away_score)}`;
}

function resultText(match) {
  return `${match.home_team_code} ${scoreDash(match)} ${match.away_team_code}`;
}

function assetSlug(match, outcome) {
  const home = teamName(match.home_team_code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const away = teamName(match.away_team_code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (outcome === 'DRAW') return `${home}-${away}-draw.png`;
  const winner = outcome === match.home_team_code ? home : away;
  const loser = outcome === match.home_team_code ? away : home;
  return `${winner}-wins-${loser}.png`;
}

function manifestAsset(manifest, match, outcome) {
  const item = (manifest.items || []).find(entry => entry.match_id === match.id);
  const image = item && item.outcomes && item.outcomes[outcome];
  if (!image) return '';
  return fs.existsSync(path.join(ROOT, image)) ? image : '';
}

function knownOrGeneratedAsset(manifest, match, outcome) {
  const known = manifestAsset(manifest, match, outcome);
  if (known) return known;
  const generated = path.join('story-assets', assetSlug(match, outcome));
  return fs.existsSync(path.join(ROOT, generated)) ? generated : '';
}

function focusTeam(match, outcome) {
  if (outcome === 'DRAW') {
    return DRAW_FOCUS[matchKey(match)] || DRAW_FOCUS[`${match.away_team_code}-${match.home_team_code}`] || match.home_team_code;
  }
  return outcome === match.home_team_code ? match.away_team_code : match.home_team_code;
}

function titleCopy(match, outcome) {
  const score = scoreDash(match);
  const homeHe = teamName(match.home_team_code, 'he');
  const awayHe = teamName(match.away_team_code, 'he');
  const homeEn = teamName(match.home_team_code, 'en');
  const awayEn = teamName(match.away_team_code, 'en');
  if (outcome === 'DRAW') {
    return {
      he: `${homeHe}-${awayHe} ${score}: דרמה בלי הכרעה`,
      en: `${homeEn}-${awayEn} ${score}: No winner, all drama`,
    };
  }
  const winner = outcome;
  const loser = winner === match.home_team_code ? match.away_team_code : match.home_team_code;
  return {
    he: `${teamName(winner, 'he')}-${teamName(loser, 'he')} ${score}: הצהרה!`,
    en: `${teamName(winner, 'en')}-${teamName(loser, 'en')} ${score}: Statement made!`,
  };
}

function poolFocus(match, outcome) {
  const focus = focusTeam(match, outcome);
  const teamHe = teamName(focus, 'he');
  const teamEn = teamName(focus, 'en');
  const score = scoreDash(match);
  if (outcome === 'DRAW') {
    return {
      table: 'group_position_picks',
      team_code: focus,
      team_he: teamHe,
      team_en: teamEn,
      position: 1,
      he_name: `{names} שם את {team} ראשונה בבית. אחרי ${score}, זה כבר פחות טיול ויותר רכבת הרים 🎢😅`,
      he_names: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, זה כבר פחות טיול ויותר רכבת הרים 🎢😅`,
      he_count: `{count} משתתפים שמו את {team} ראשונה בבית. אחרי ${score}, זה כבר פחות טיול ויותר רכבת הרים 🎢😅`,
      en_name: `{names} picked {team} to top the group. After ${score}, this is less a stroll and more a rollercoaster 🎢😅`,
      en_names: `{names} picked {team} to top the group. After ${score}, this is less a stroll and more a rollercoaster 🎢😅`,
      en_count: `{count} members picked {team} to top the group. After ${score}, this is less a stroll and more a rollercoaster 🎢😅`,
    };
  }
  return {
    table: 'group_position_picks',
    team_code: focus,
    team_he: teamHe,
    team_en: teamEn,
    position: 1,
    he_name: `{names} שם את {team} ראשונה בבית. אחרי ${score}, ההימור הזה כבר מבקש VAR 😅🔥`,
    he_names: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, ההימור הזה כבר מבקש VAR 😅🔥`,
    he_count: `{count} משתתפים שמו את {team} ראשונה בבית. אחרי ${score}, ההימור הזה כבר מבקש VAR 😅🔥`,
    en_name: `{names} picked {team} to top the group. After ${score}, that pick is already asking for VAR 😅🔥`,
    en_names: `{names} picked {team} to top the group. After ${score}, that pick is already asking for VAR 😅🔥`,
    en_count: `{count} members picked {team} to top the group. After ${score}, that pick is already asking for VAR 😅🔥`,
  };
}

function captionCopy(match, outcome) {
  const focus = focusTeam(match, outcome);
  const score = scoreDash(match);
  if (outcome === 'DRAW') {
    return {
      he: `${teamName(match.home_team_code, 'he')} ו${teamName(match.away_team_code, 'he')} משאירות את הבית פתוח. מי שבנה על ${teamName(focus, 'he')} לטיול קל כבר מרגיש את הדופק עולה 👀🎢`,
      en: `${teamName(match.home_team_code)} and ${teamName(match.away_team_code)} leave the group wide open. Anyone banking on ${teamName(focus)} just felt the pulse jump 👀🎢`,
    };
  }
  const loser = focus;
  return {
    he: `${teamName(outcome, 'he')} עושה רעש עם ${score}. מי שבנה על ${teamName(loser, 'he')} קיבל תזכורת קטנה שהטבלה לא עושה הנחות 😅🔥`,
    en: `${teamName(outcome)} makes noise with ${score}. Anyone banking on ${teamName(loser)} just got a small reminder that the table has no mercy 😅🔥`,
  };
}

function buildStory(match, image, outcome) {
  const titles = titleCopy(match, outcome);
  const captions = captionCopy(match, outcome);
  return {
    id: storyId(match),
    match_id: match.id,
    image,
    teams: [match.home_team_code, match.away_team_code],
    outcome,
    result: resultText(match),
    pool_focus: poolFocus(match, outcome),
    he: { headline: titles.he, caption: captions.he },
    en: { headline: titles.en, caption: captions.en },
  };
}

function normalizeExistingStory(story, matchById) {
  const match = story && matchById.get(story.match_id);
  if (!match || match.status !== 'FINISHED' || match.home_score == null || match.away_score == null) {
    return story;
  }
  const outcome = outcomeFor(match);
  if (!outcome || !story.image) return story;
  return {
    ...buildStory(match, story.image, outcome),
    id: story.id || storyId(match),
  };
}

function imagePrompt(match, outcome) {
  const home = match.home_team_code;
  const away = match.away_team_code;
  const winner = outcome === 'DRAW' ? null : outcome;
  const loser = winner ? (winner === home ? away : home) : null;
  const left = STAR_PROFILES[winner || home] || { player: `the biggest current star of ${teamName(winner || home)}`, number: 'current' };
  const right = STAR_PROFILES[loser || away] || { player: `the biggest current star of ${teamName(loser || away)}`, number: 'current' };
  const topText = outcome === 'DRAW' ? 'DRAW!' : `${teamName(winner).toUpperCase()} WINS!`;
  const leftMood = outcome === 'DRAW' ? 'disappointed but proud after a draw' : 'celebrating the win in a fresh dynamic pose';
  const rightMood = outcome === 'DRAW' ? 'frustrated but composed after a draw' : 'sad after the loss, head down or hands on face';
  return [
    'Create a polished cartoonized vertical 9:16 football meme-story base image for FriendlyBet.',
    `Match result context: ${teamName(home)} ${scoreDash(match)} ${teamName(away)} at FIFA World Cup 2026.`,
    'Show exactly two football stars, no other players anywhere.',
    `Left/foreground: ${left.player}, cartoon likeness, ${teamName(winner || home)} national-color kit, shirt number ${left.number}, ${leftMood}, face clearly visible.`,
    `Right/midground: ${right.player}, cartoon likeness, ${teamName(loser || away)} national-color kit, shirt number ${right.number}, ${rightMood}, face clearly visible.`,
    `Crowd: fans and flags of ${teamName(home)} and ${teamName(away)} only; no unrelated flags.`,
    'Composition: vertical portrait, dramatic stadium lights, two-player poster, realistic proportions but cartoonized.',
    'Leave a darker empty safe band around 22%-32% from the top for a yellow result overlay, and another darker empty safe band around 50%-64% from the top for white banter text. Do not place faces in those bands.',
    `Text: big top meme headline "${topText}" only. Bottom-left brand: FriendlyBet football icon followed by FriendlyBet wordmark in gold/beige on a dark pill.`,
    'Avoid: official FIFA logo, official club logos, sportswear logos, watermark, extra players, unrelated national flags, text over faces.',
  ].join('\n');
}

async function generateImage(match, outcome) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(`No OPENAI_API_KEY; skipping image generation for ${matchKey(match)} ${outcome}`);
    return '';
  }
  const fileName = assetSlug(match, outcome);
  const relative = path.join('story-assets', fileName).replace(/\\/g, '/');
  const output = path.join(ROOT, relative);
  if (fs.existsSync(output)) return relative;
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = process.env.OPENAI_IMAGE_SIZE || '1024x1536';
  const body = {
    model,
    prompt: imagePrompt(match, outcome),
    size,
  };
  console.log(`Generating ${relative} with ${model} (${size})`);
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI image generation failed for ${matchKey(match)} ${outcome}: ${res.status} ${text}`);
  }
  const json = await res.json();
  const first = json.data && json.data[0];
  const b64 = first && (first.b64_json || first.image_base64);
  if (!b64) throw new Error(`OpenAI image generation returned no base64 image for ${matchKey(match)} ${outcome}`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, Buffer.from(b64, 'base64'));
  return relative;
}

async function main() {
  const matchesPayload = readJson(MATCHES_PATH, { matches: [] });
  const matchById = new Map((matchesPayload.matches || []).map(match => [match.id, match]));
  const manifest = readJson(MANIFEST_PATH, { version: 1, items: [] });
  const storiesPayload = readJson(STORIES_PATH, { items: [] });
  const existing = (Array.isArray(storiesPayload.items) ? storiesPayload.items : [])
    .map(story => normalizeExistingStory(story, matchById));
  const existingByMatch = new Set(existing.map(item => item && item.match_id).filter(Boolean));
  const existingMatchDates = new Map(
    (matchesPayload.matches || []).map(match => [match.id, new Date(match.match_date).getTime()])
  );
  const newestExistingMatchTime = existing.reduce((latest, item) => {
    const time = existingMatchDates.get(item && item.match_id);
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
  const finished = (matchesPayload.matches || [])
    .filter(match => match && match.status === 'FINISHED' && match.home_score != null && match.away_score != null)
    .sort((a, b) => new Date(a.match_date) - new Date(b.match_date));

  const additions = [];
  for (const match of finished) {
    if (existingByMatch.has(match.id)) continue;
    const matchTime = new Date(match.match_date).getTime();
    if (newestExistingMatchTime && Number.isFinite(matchTime) && matchTime <= newestExistingMatchTime) {
      continue;
    }
    const outcome = outcomeFor(match);
    if (!outcome) continue;
    let image = knownOrGeneratedAsset(manifest, match, outcome);
    if (!image && process.env.STORY_AUTOGEN_IMAGES !== '0') {
      image = await generateImage(match, outcome);
    }
    if (!image) {
      console.warn(`No story image available for ${matchKey(match)} ${outcome}; story not added`);
      continue;
    }
    additions.push(buildStory(match, image, outcome));
    existingByMatch.add(match.id);
  }

  if (!additions.length) {
    console.log('No new world cup stories to add.');
    return;
  }

  const items = additions.reverse().concat(existing).slice(0, MAX_STORIES);
  const next = {
    updated_at: new Date().toISOString(),
    items,
  };
  writeJsonIfChanged(STORIES_PATH, next);
  console.log(`Added ${additions.length} world cup stories. Feed now has ${items.length}/${MAX_STORIES}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
