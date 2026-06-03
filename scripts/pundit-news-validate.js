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
//       - confirmed => >= 1 source.
//   * expires_at present and a valid future-ish ISO date.
//   * no em dash (-) anywhere in the copy (house style).
//
// Run:  node scripts/pundit-news-validate.js
// ============================================================
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'public-data', 'pundit-news.json');

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return null; }
}

function validate() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return [`cannot read/parse pundit-news.json: ${e.message}`]; }

  const items = Array.isArray(raw.items) ? raw.items : null;
  if (!items) return ['pundit-news.json: "items" must be an array'];

  const errors = [];
  const seenIds = new Set();

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
    const hosts = new Set(validUrls.map(s => hostname(s.url)).filter(Boolean));
    const need = it.confidence === 'confirmed' ? 1 : 2;
    if (hosts.size < need) {
      errors.push(`${at}: '${it.confidence}' needs >=${need} independent source(s), got ${hosts.size}`);
    }

    if (!it.expires_at || isNaN(Date.parse(it.expires_at))) {
      errors.push(`${at}: missing/invalid expires_at (ISO date)`);
    }

    // Optional: team flag. If present it must be a 3-letter WC2026 team code.
    if (it.team != null && !/^[A-Z]{3}$/.test(String(it.team))) {
      errors.push(`${at}: team must be a 3-letter team code (e.g. BRA), got "${it.team}"`);
    }
  });

  return errors;
}

const errors = validate();
if (errors.length) {
  console.error('pundit-news validation FAILED:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
console.log('pundit-news validation OK');
