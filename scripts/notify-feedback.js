// ============================================================
// FriendlyBet - Feedback email notifier
// ============================================================
// Reads un-notified rows from the `feedback` table and prepares an
// email digest for Eyal, then marks them notified so they are never
// emailed twice. Runs from .github/workflows/notify-feedback.yml.
//
// Two subcommands (so the SMTP send can sit between them as a separate
// workflow step that needs no npm deps):
//   node notify-feedback.js fetch  -> writes feedback-body.txt +
//        feedback-ids.txt, sets GitHub output has_new=true|false
//   node notify-feedback.js mark   -> PATCHes notified_at on the ids
//        listed in feedback-ids.txt
//
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY (service key, bypasses RLS).
// ============================================================

const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SECRET_KEY');
  process.exit(1);
}

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};

const BODY_FILE = 'feedback-body.txt';
const IDS_FILE = 'feedback-ids.txt';

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
  console.log(`output ${name}=${value}`);
}

const CAT_LABEL = { bug: '🐛 Bug', idea: '💡 Idea', praise: '❤️ Praise', other: '💬 Other' };

async function fetchUnnotified() {
  const url = SUPABASE_URL +
    '/rest/v1/feedback?select=*&notified_at=is.null&order=created_at.asc&limit=200';
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error('fetch failed: ' + r.status + ' ' + (await r.text()));
  const rows = await r.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    setOutput('has_new', 'false');
    console.log('No new feedback.');
    return;
  }

  const lines = [];
  lines.push(`You have ${rows.length} new feedback message${rows.length > 1 ? 's' : ''} on FriendlyBet.`);
  lines.push('');
  rows.forEach((f, i) => {
    lines.push(`────────── #${i + 1} ──────────`);
    lines.push(`Type:    ${CAT_LABEL[f.category] || f.category}`);
    lines.push(`When:    ${f.created_at}`);
    if (f.reply_email) lines.push(`Reply to: ${f.reply_email}`);
    if (f.pool_code) lines.push(`Pool:    ${f.pool_code}`);
    lines.push(`Lang:    ${f.language || '?'}   App: ${f.app_version || '?'}   Screen: ${f.screen || '?'}`);
    lines.push('');
    lines.push(f.message);
    lines.push('');
  });

  fs.writeFileSync(BODY_FILE, lines.join('\n'), 'utf8');
  fs.writeFileSync(IDS_FILE, rows.map(r => r.id).join(','), 'utf8');
  setOutput('has_new', 'true');
  setOutput('count', String(rows.length));
  console.log(`Wrote ${rows.length} feedback rows to ${BODY_FILE}.`);
}

async function markNotified() {
  if (!fs.existsSync(IDS_FILE)) { console.log('No ids file, nothing to mark.'); return; }
  const ids = fs.readFileSync(IDS_FILE, 'utf8').trim();
  if (!ids) { console.log('Empty ids file, nothing to mark.'); return; }

  const nowIso = new Date().toISOString();
  const url = SUPABASE_URL + '/rest/v1/feedback?id=in.(' + ids + ')';
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ notified_at: nowIso })
  });
  if (!r.ok) throw new Error('mark failed: ' + r.status + ' ' + (await r.text()));
  console.log('Marked notified:', ids);
}

(async () => {
  const cmd = process.argv[2];
  try {
    if (cmd === 'fetch') await fetchUnnotified();
    else if (cmd === 'mark') await markNotified();
    else { console.error('Usage: node notify-feedback.js fetch|mark'); process.exit(1); }
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
})();
