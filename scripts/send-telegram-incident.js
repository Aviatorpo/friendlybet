#!/usr/bin/env node
const fs = require('fs');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const input = process.argv[2];

function short(text, limit = 3200) {
  const s = String(text || '').trim();
  return s.length <= limit ? s : s.slice(0, limit - 16).trimEnd() + '\n...[trimmed]';
}

async function sendMessage(text) {
  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID; cannot send incident alert.');
    process.exit(2);
  }
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('text', text);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({ ok: false, description: 'Invalid Telegram JSON response' }));
  if (!body.ok) throw new Error(`Telegram sendMessage failed: ${JSON.stringify(body).slice(0, 500)}`);
}

function buildIncidentText(payload) {
  let parsed = null;
  try { parsed = JSON.parse(payload); } catch (_) {}
  if (!parsed) {
    return 'FriendlyBet live incident\n\nA real-time readiness check failed, but its output was not valid JSON.\n\nWhat to do: open the GitHub Actions run, inspect the failing step, and keep two-phase knockout closed until the failing check is fixed.\n\nRaw output:\n' + short(payload, 1800);
  }
  const failed = (parsed.checks || []).filter(c => !c.ok);
  const official = parsed.live_db && parsed.live_db.official_knockout_readiness;
  const lines = [
    'FriendlyBet live incident',
    '',
    `Checked at: ${parsed.checked_at || new Date().toISOString()}`,
    `Failed checks: ${failed.length}`,
  ];
  if (official) lines.push(`Official knockout readiness: ${official.reason || 'unknown'} (${official.detail || 'no detail'})`);
  lines.push('');
  lines.push('What failed:');
  lines.push(failed.length ? failed.slice(0, 8).map(c => `- ${c.name}: ${c.detail || 'no detail'}`).join('\n') : '- Readiness command failed without a failed check row.');
  lines.push('');
  lines.push('What to do:');
  lines.push('1. Open the failed GitHub Actions run for live-completion-readiness.');
  lines.push('2. The automated readiness/resolver workflows will keep retrying; keep knockout closed until the official bracket check is green.');
  lines.push('3. Do not manually tell users knockout is open while fair-play/team-conduct or Annex C readiness is blocked.');
  return short(lines.join('\n'));
}

(async () => {
  const payload = input && fs.existsSync(input) ? fs.readFileSync(input, 'utf8') : (input || '');
  await sendMessage(buildIncidentText(payload));
})().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
