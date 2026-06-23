// ============================================================
// FriendlyBet - Pundit news validator (the "0 hallucination" gate)
// ============================================================
// Mechanically enforces the verification policy on whatever the news agent
// wrote to public-data/pundit-news.json. Run it in CI right after the agent
// and BEFORE generate-pundit.js; a non-zero exit must block the commit.
//
// Rules (mirror marketing-scout/pundit/PUNDIT-AGENT.md):
//   * he + en text present, non-empty.
//   * confidence is 'confirmed' or 'reported'.
//   * sources: every entry needs a real http(s) url.
//       - reported  => >= 2 INDEPENDENT sources (distinct hostnames).
//       - confirmed => official/source-of-record OR >= 2 independent sources.
//   * expires_at present and a valid future-ish ISO date.
//   * topic_date/source_checked_at is recent enough for a live tournament feed.
//   * expires_at is short-lived, so old news cannot be banked for days/weeks.
//   * no em dash (-) anywhere in the copy (house style).
//
// Run:  node scripts/pundit-news-validate.js [--require-unexpired]
// ============================================================
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'public-data', 'pundit-news.json');
const HOUR_MS = 60 * 60 * 1000;
const MAX_NEWS_AGE_MS = 30 * HOUR_MS;
const MAX_NEWS_TTL_MS = 30 * HOUR_MS;
const DISALLOWED_SOURCE_RE = /\b(odds?|betting|bookmaker|sportsbook|accumulator|parlay|wager|casino|bet365|draftkings|fanduel|paddy\s*power|william\s*hill)\b/i;
const WC2026_TEAM_CODES = new Set([
  'MEX', 'RSA', 'KOR', 'CZE',
  'CAN', 'BIH', 'QAT', 'SUI',
  'BRA', 'MAR', 'HAI', 'SCO',
  'USA', 'PAR', 'AUS', 'TUR',
  'GER', 'CUR', 'CIV', 'ECU',
  'NED', 'JPN', 'SWE', 'TUN',
  'BEL', 'EGY', 'IRN', 'NZL',
  'ESP', 'CPV', 'SAU', 'URU',
  'FRA', 'SEN', 'IRQ', 'NOR',
  'ARG', 'ALG', 'AUT', 'JOR',
  'POR', 'COD', 'UZB', 'COL',
  'ENG', 'CRO', 'GHA', 'PAN',
]);
const OFFICIAL_HOSTS = [
  'fifa.com',
  'inside.fifa.com',
  'theifab.com',
  'concacaf.com',
  'uefa.com',
  'cafonline.com',
  'conmebol.com',
  'the-afc.com',
  'oceaniafootball.com',
];

function parseTime(value) {
  if (!value) return NaN;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return null; }
}

function isOfficialHost(host) {
  return !!host && OFFICIAL_HOSTS.some(official => host === official || host.endsWith(`.${official}`));
}

function validateTeamCode(value, at, errors) {
  if (value == null) return;
  const code = String(value);
  if (!/^[A-Z]{3}$/.test(code)) {
    errors.push(`${at}: team code must be a 3-letter WC2026 code, got "${code}"`);
    return;
  }
  if (!WC2026_TEAM_CODES.has(code)) {
    errors.push(`${at}: "${code}" is not a known WC2026 team code`);
  }
}

function validatePayload(raw, options = {}) {
  const items = Array.isArray(raw.items) ? raw.items : null;
  if (!items) return ['pundit-news.json: "items" must be an array'];

  const errors = [];
  const seenIds = new Set();
  const now = options.nowMs || Date.now();
  const feedUpdatedAt = parseTime(raw.updatedAt);

  items.forEach((it, i) => {
    const at = `item[${i}]${it && it.id ? ` (${it.id})` : ''}`;
    if (!it || typeof it !== 'object') { errors.push(`${at}: not an object`); return; }

    if (it.id) {
      if (seenIds.has(it.id)) errors.push(`${at}: duplicate id`);
      seenIds.add(it.id);
    }

    if (!it.he || !String(it.he).trim()) errors.push(`${at}: missing he text`);
    if (!it.en || !String(it.en).trim()) errors.push(`${at}: missing en text`);

    if (/—/.test(`${it.he || ''}${it.en || ''}`)) {
      errors.push(`${at}: contains an em dash (-) - house style forbids it`);
    }

    if (it.confidence !== 'confirmed' && it.confidence !== 'reported') {
      errors.push(`${at}: confidence must be 'confirmed' or 'reported'`);
    }

    const sources = Array.isArray(it.sources) ? it.sources : [];
    const validUrls = sources.filter(s => s && /^https?:\/\//i.test(s.url || ''));
    if (validUrls.length !== sources.length) errors.push(`${at}: every source needs an http(s) url`);
    sources.forEach((source, sourceIndex) => {
      const sourceText = `${source && source.name || ''} ${source && source.title || ''} ${source && source.url || ''}`;
      if (DISALLOWED_SOURCE_RE.test(sourceText)) {
        errors.push(`${at}: source[${sourceIndex}] looks like betting/odds/promotional material; use editorial, official, or professional news sources`);
      }
    });
    const hosts = new Set(validUrls.map(s => hostname(s.url)).filter(Boolean));
    const hasOfficial = [...hosts].some(isOfficialHost);
    if (it.confidence === 'confirmed') {
      if (!hasOfficial && hosts.size < 2) {
        errors.push(`${at}: 'confirmed' needs an official/source-of-record source or >=2 independent sources, got ${hosts.size}`);
      }
    } else if (hosts.size < 2) {
      errors.push(`${at}: 'reported' needs >=2 independent sources, got ${hosts.size}`);
    }

    if (!it.expires_at || isNaN(Date.parse(it.expires_at))) {
      errors.push(`${at}: missing/invalid expires_at (ISO date)`);
    } else {
      const expiresAt = parseTime(it.expires_at);
      const anchor = parseTime(it.topic_date) || parseTime(it.source_checked_at) || feedUpdatedAt;
      if (options.requireUnexpired && expiresAt <= now) {
        errors.push(`${at}: expires_at is already past; remove or refresh this news item for live-desk strict mode`);
      }
      if (!Number.isFinite(anchor)) {
        errors.push(`${at}: missing topic_date/source_checked_at (or file updatedAt)`);
      } else {
        if (anchor - now > HOUR_MS) errors.push(`${at}: topic/source timestamp is in the future`);
        if (now - anchor > MAX_NEWS_AGE_MS) errors.push(`${at}: topic/source timestamp is too old for the live feed`);
        if (expiresAt - anchor > MAX_NEWS_TTL_MS) errors.push(`${at}: expires_at is too far from topic/source timestamp`);
      }
    }

    // Optional routing flags. If present, they must be real WC2026 team codes.
    validateTeamCode(it.team, `${at}: team`, errors);
    if (it.teams != null) {
      if (!Array.isArray(it.teams)) {
        errors.push(`${at}: teams must be an array of WC2026 team codes`);
      } else {
        it.teams.forEach((team, teamIndex) => validateTeamCode(team, `${at}: teams[${teamIndex}]`, errors));
      }
    }
  });

  return errors;
}

function validate(options = {}) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return [`cannot read/parse pundit-news.json: ${e.message}`]; }
  return validatePayload(raw, options);
}

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  const errors = validate({
    requireUnexpired: args.has('--require-unexpired') || process.env.PUNDIT_NEWS_REQUIRE_UNEXPIRED === '1',
  });
  if (errors.length) {
    console.error('pundit-news validation FAILED:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('pundit-news validation OK');
} else {
  module.exports = {
    validate,
    validatePayload,
    WC2026_TEAM_CODES,
  };
}
