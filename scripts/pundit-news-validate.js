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
//   * source_ledger, story_score, self_review, and red_team_review present, so
//     the desk proves why this story is source-led, relevant, safe, and worth publishing.
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
const STORY_SCORE_KEYS = ['freshness', 'verification', 'friendlybet_relevance', 'drama', 'uniqueness', 'clarity'];
const SOURCE_LEDGER_TIERS = new Set(['official', 'trusted', 'primary-social', 'scout-only']);

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

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateSourceLedger(it, at, validSourceUrls, errors) {
  const ledger = Array.isArray(it.source_ledger) ? it.source_ledger : null;
  if (!ledger || ledger.length === 0) {
    errors.push(`${at}: missing source_ledger with claim/source/tier/confirmation/usability rows`);
    return;
  }
  const sourceUrls = new Set(validSourceUrls.map(source => source.url));
  ledger.forEach((row, rowIndex) => {
    const rowAt = `${at}: source_ledger[${rowIndex}]`;
    if (!row || typeof row !== 'object') {
      errors.push(`${rowAt}: must be an object`);
      return;
    }
    if (!nonEmptyString(row.claim)) errors.push(`${rowAt}: missing claim`);
    if (!nonEmptyString(row.source)) errors.push(`${rowAt}: missing source`);
    if (!nonEmptyString(row.url) || !/^https?:\/\//i.test(row.url)) {
      errors.push(`${rowAt}: missing http(s) url`);
    } else if (!sourceUrls.has(row.url)) {
      errors.push(`${rowAt}: url must match one of the item sources[] urls`);
    }
    if (!SOURCE_LEDGER_TIERS.has(row.tier)) {
      errors.push(`${rowAt}: tier must be one of ${Array.from(SOURCE_LEDGER_TIERS).join(', ')}`);
    }
    if (!nonEmptyString(row.published_or_updated_at)) errors.push(`${rowAt}: missing published_or_updated_at`);
    if (!nonEmptyString(row.confirmation)) errors.push(`${rowAt}: missing confirmation`);
    if (!nonEmptyString(row.uncertainty)) errors.push(`${rowAt}: missing uncertainty`);
    if (row.usable !== true && row.usable !== false) errors.push(`${rowAt}: usable must be boolean`);
  });
}

function validateStoryScore(it, at, errors) {
  const score = it.story_score;
  if (!score || typeof score !== 'object' || Array.isArray(score)) {
    errors.push(`${at}: missing story_score`);
    return;
  }
  STORY_SCORE_KEYS.forEach(key => {
    const value = score[key];
    if (!Number.isInteger(value) || value < 0 || value > 5) {
      errors.push(`${at}: story_score.${key} must be an integer from 0 to 5`);
    }
  });
  if (!nonEmptyString(score.decision)) errors.push(`${at}: story_score.decision is required`);
  if (!nonEmptyString(score.reason)) errors.push(`${at}: story_score.reason is required`);
  if (Number.isInteger(score.verification) && score.verification < 3) {
    errors.push(`${at}: story_score.verification must be at least 3 for publishable Pundit news`);
  }
  if (Number.isInteger(score.friendlybet_relevance) && score.friendlybet_relevance < 3) {
    errors.push(`${at}: story_score.friendlybet_relevance must be at least 3 for publishable Pundit news`);
  }
}

function validateSelfReview(it, at, errors) {
  const review = it.self_review;
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    errors.push(`${at}: missing self_review`);
    return;
  }
  [
    'could_be_wrong',
    'proof_source',
    'stale_risk',
    'overclaiming_check',
    'privacy_check',
    'gambling_check',
    'repeated_shape_check',
    'expiry_reason',
  ].forEach(key => {
    if (!nonEmptyString(review[key])) errors.push(`${at}: self_review.${key} is required`);
  });
}

function validateRedTeamReview(it, at, errors) {
  const review = it.red_team_review;
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    errors.push(`${at}: missing red_team_review`);
    return;
  }
  if (!Number.isInteger(review.score) || review.score < 0 || review.score > 100) {
    errors.push(`${at}: red_team_review.score must be an integer from 0 to 100`);
  } else if (review.score < 90) {
    errors.push(`${at}: red_team_review.score must be at least 90 for publishable Pundit news`);
  }
  const blockers = Array.isArray(review.blockers) ? review.blockers : null;
  if (!blockers) {
    errors.push(`${at}: red_team_review.blockers must be an array`);
  } else if (blockers.length > 0) {
    errors.push(`${at}: red_team_review.blockers must be empty before publication`);
  }
  [
    'decision',
    'stale_state_check',
    'source_check',
    'pool_relevance_check',
    'tone_check',
    'repetition_check',
    'rewrite_note',
  ].forEach(key => {
    if (!nonEmptyString(review[key])) errors.push(`${at}: red_team_review.${key} is required`);
  });
  if (nonEmptyString(review.decision) && review.decision !== 'approve') {
    errors.push(`${at}: red_team_review.decision must be approve before publication`);
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

    validateSourceLedger(it, at, validUrls, errors);
    validateStoryScore(it, at, errors);
    validateSelfReview(it, at, errors);
    validateRedTeamReview(it, at, errors);

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
