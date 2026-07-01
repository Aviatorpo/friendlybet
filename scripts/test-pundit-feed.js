#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { build, resultCommentary, fixtureCommentary } = require('./generate-pundit');

const ROOT = path.resolve(__dirname, '..');
const MATCHES_FILE = path.join(ROOT, 'public-data', 'matches.json');
const NEWS_FILE = path.join(ROOT, 'public-data', 'pundit-news.json');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_ITEMS = 12;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function copyShape(text) {
  return String(text || '')
    .replace(/\d{1,2}:\d{2}/g, 'TIME')
    .replace(/\d+\s*-\s*\d+/g, 'SCORE')
    .replace(/\d+\s*:\s*\d+/g, 'SCORE')
    .replace(/\b(today|tomorrow|yesterday)\b/gi, 'DAY')
    .replace(/[^\p{Letter}\p{Number}\s{}-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const EN_CONSEQUENCE_TERMS = /\b(table|tables|group|prediction|predictions|predictors|pool|pools|pick|picks|picked|form|forms|slip|slips|called|safe|sweating|points|qualify|qualification|receipt|receipts)\b/i;
const HE_CONSEQUENCE_TERMS = /(?:טבלה|טבלאות|בית|בתים|תחזית|תחזיות|הימור|הימורים|טופס|טפסים|נקודות|מקום|מקומות|עלייה|קבלה|קבלות|סימן)/u;
const EN_CURRENT_KNOCKOUT_BANNED = /\b(group stage|group-stage|group places|group picture|whole group|advance from the groups|Group [A-L])\b/i;
const HE_CURRENT_KNOCKOUT_BANNED = /(?:שלב הבתים|מקומות בבית|תמונת הבית|חישוב בית|תיאוריות בית|טבלה תיאורטית של בתים|בית [A-L]|בית [א-ת])/u;
const EN_KNOCKOUT_ADVANCEMENT = /\b(advanced|advance|advances|through|went through|moves on|survived|survive|tiebreaker|penalties|ticket)\b/i;
const HE_KNOCKOUT_ADVANCEMENT = /(?:עלתה|עברה|ממשיכה|בשלב הבא|שרדה|שובר השוויון|פנדלים|כרטיס)/u;

const ENDING_EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?$/u;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const now = new Date(process.env.PUNDIT_NOW || Date.now());
if (Number.isNaN(now.getTime())) {
  console.error(`Invalid PUNDIT_NOW: ${process.env.PUNDIT_NOW}`);
  process.exit(1);
}

const matchesPayload = readJson(MATCHES_FILE, { matches: [] });
const matches = Array.isArray(matchesPayload.matches) ? matchesPayload.matches : [];
const newsPayload = readJson(NEWS_FILE, { items: [] });
const items = build(now);
const matchesById = new Map(matches.map(match => [String(match && match.id || ''), match]));

const tiedKnockoutWithWinner = matches.find(match =>
  match &&
  String(match.stage || '').toUpperCase() !== 'GROUP_STAGE' &&
  match.status === 'FINISHED' &&
  match.winner_code &&
  match.home_score != null &&
  match.away_score != null &&
  Number(match.home_score) === Number(match.away_score)
);
if (tiedKnockoutWithWinner) {
  const copy = resultCommentary(tiedKnockoutWithWinner, 'regression');
  if (!EN_KNOCKOUT_ADVANCEMENT.test(String(copy.en || ''))) {
    fail(`${tiedKnockoutWithWinner.id}: direct tied-knockout commentary must explain advancement/tiebreaker in English`);
  }
  if (!HE_KNOCKOUT_ADVANCEMENT.test(String(copy.he || ''))) {
    fail(`${tiedKnockoutWithWinner.id}: direct tied-knockout commentary must explain advancement/tiebreaker in Hebrew`);
  }
  if (/\b(draw|no winner|does not settle|still open|shared points|point each)\b/i.test(String(copy.en || ''))) {
    fail(`${tiedKnockoutWithWinner.id}: direct tied-knockout commentary must not be framed as a normal draw`);
  }
}

const currentKnockoutFixture = matches.find(match =>
  match &&
  String(match.stage || '').toUpperCase() !== 'GROUP_STAGE' &&
  (match.status === 'TIMED' || match.status === 'SCHEDULED') &&
  match.home_team_code &&
  match.away_team_code
);
if (currentKnockoutFixture) {
  const copy = fixtureCommentary(currentKnockoutFixture, now, 'regression');
  if (EN_CURRENT_KNOCKOUT_BANNED.test(String(copy.en || ''))) {
    fail(`${currentKnockoutFixture.id}: direct knockout fixture commentary must not use group-stage English framing`);
  }
  if (HE_CURRENT_KNOCKOUT_BANNED.test(String(copy.he || ''))) {
    fail(`${currentKnockoutFixture.id}: direct knockout fixture commentary must not use group-stage Hebrew framing`);
  }
}

if (!Array.isArray(items)) fail('generate-pundit build() must return an array');
if (items.length > MAX_ITEMS) fail(`pundit feed has ${items.length} items, max is ${MAX_ITEMS}`);

const matchTimes = matches.map(m => parseTime(m && m.match_date)).filter(Number.isFinite);
const firstKickoff = matchTimes.length ? Math.min(...matchTimes) : NaN;
const lastKickoff = matchTimes.length ? Math.max(...matchTimes) : NaN;
const nowMs = now.getTime();
const tournamentWindow = Number.isFinite(firstKickoff) && Number.isFinite(lastKickoff)
  && nowMs >= firstKickoff - DAY_MS
  && nowMs <= lastKickoff + 2 * DAY_MS;

if (tournamentWindow && !items.length) {
  fail('pundit feed is empty during the tournament window');
}

const seenIds = new Set();
const shapeCounts = new Map();
for (const item of items) {
  if (!item || typeof item !== 'object') {
    fail('pundit item is not an object');
    continue;
  }
  if (!item.id) fail('pundit item missing id');
  if (seenIds.has(item.id)) fail(`duplicate pundit item id: ${item.id}`);
  seenIds.add(item.id);
  if (!item.type) fail(`${item.id}: missing type`);
  if (!item.confidence) fail(`${item.id}: missing confidence`);
  if (!String(item.he || '').trim()) fail(`${item.id}: missing Hebrew copy`);
  if (!String(item.en || '').trim()) fail(`${item.id}: missing English copy`);
  if (!ENDING_EMOJI.test(String(item.he || '').trim())) fail(`${item.id}: Hebrew Pundit copy should end with an emoji`);
  if (!ENDING_EMOJI.test(String(item.en || '').trim())) fail(`${item.id}: English Pundit copy should end with an emoji`);
  const expiresAt = parseTime(item.expires_at);
  if (item.expires_at && !Number.isFinite(expiresAt)) fail(`${item.id}: invalid expires_at`);
  if (Number.isFinite(expiresAt) && expiresAt <= nowMs) fail(`${item.id}: expired item included in generated feed`);
  if (/\u05d1\u05e4\u05d5\u05dc(?:\u05d9\u05dd)?/u.test(String(item.he || ''))) {
    fail(`${item.id}: generated Hebrew Pundit copy must not use b'pool/b'poolim`);
  }
  if ((item.type === 'result' || item.type === 'fixture')) {
    if (!EN_CONSEQUENCE_TERMS.test(String(item.en || ''))) {
      fail(`${item.id}: ${item.type} English copy must include table/prediction/pool consequence, not only a score or fixture`);
    }
    if (!HE_CONSEQUENCE_TERMS.test(String(item.he || ''))) {
      fail(`${item.id}: ${item.type} Hebrew copy must include table/prediction/pool consequence, not only a score or fixture`);
    }
  }
  const matchId = String(item.id || '').replace(/^(result|fixture|live|verify)-/, '');
  const match = matchesById.get(matchId);
  const isKnockoutMatch = match && String(match.stage || '').toUpperCase() !== 'GROUP_STAGE';
  if (isKnockoutMatch) {
    if (EN_CURRENT_KNOCKOUT_BANNED.test(String(item.en || ''))) {
      fail(`${item.id}: current knockout Pundit English copy must not talk like group-stage content`);
    }
    if (HE_CURRENT_KNOCKOUT_BANNED.test(String(item.he || ''))) {
      fail(`${item.id}: current knockout Pundit Hebrew copy must not talk like group-stage content`);
    }
    if (
      item.type === 'result' &&
      match.home_score != null &&
      match.away_score != null &&
      Number(match.home_score) === Number(match.away_score) &&
      match.winner_code
    ) {
      if (!EN_KNOCKOUT_ADVANCEMENT.test(String(item.en || ''))) {
        fail(`${item.id}: tied knockout result with winner_code must explain advancement/tiebreaker in English`);
      }
      if (!HE_KNOCKOUT_ADVANCEMENT.test(String(item.he || ''))) {
        fail(`${item.id}: tied knockout result with winner_code must explain advancement/tiebreaker in Hebrew`);
      }
      if (/\b(draw|no winner|does not settle|still open|shared points|point each)\b/i.test(String(item.en || ''))) {
        fail(`${item.id}: tied knockout result with winner_code must not be framed as a normal draw`);
      }
      if (/(?:תיקו רגיל|אין מנצחת|לא סוגר סיפור|נקודה לכל צד|נשאר פתוח)/u.test(String(item.he || ''))) {
        fail(`${item.id}: tied knockout result with winner_code must not be framed as a normal draw in Hebrew`);
      }
    }
  }
  const shape = `${item.type}:${copyShape(item.en)}`;
  shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1);
}

for (const [shape, count] of shapeCounts.entries()) {
  if (count > 2) fail(`pundit feed repeats the same ${shape.split(':')[0]} structure ${count} times: ${shape}`);
}

const newsItems = Array.isArray(newsPayload.items) ? newsPayload.items : [];
if (tournamentWindow && newsItems.length === 0) {
  const message = 'pundit-news.json is empty during the tournament window; live desk should record sources checked or add verified news';
  if (process.env.PUNDIT_REQUIRE_NEWS === '1') fail(message);
  else console.warn(`warning: ${message}`);
}

for (const newsItem of newsItems) {
  if (!newsItem || !newsItem.id || !Array.isArray(newsItem.teams)) continue;
  const generated = items.find(item => item && item.id === newsItem.id);
  if (!generated) continue;
  const expectedTeams = newsItem.teams.map(team => String(team || '').toUpperCase());
  const actualTeams = Array.isArray(generated.teams) ? generated.teams : [];
  if (JSON.stringify(actualTeams) !== JSON.stringify(expectedTeams)) {
    fail(`${newsItem.id}: generated Pundit news item must preserve teams[] routing`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`pundit feed validated: ${items.length} item(s) at ${now.toISOString()}`);
