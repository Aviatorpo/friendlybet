#!/usr/bin/env node
/*
 * Sends a pending World Cup story review package to Eyal on Telegram.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const input = process.argv[2];

function die(message) {
  console.error(message);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function short(text, limit = 900) {
  text = String(text || '').trim();
  return text.length <= limit ? text : text.slice(0, limit - 16).trimEnd() + '\n...[trimmed]';
}

async function telegram(method, form) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({ ok: false, description: 'Invalid Telegram JSON response' }));
  if (!body.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

async function sendMessage(text) {
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('text', text);
  await telegram('sendMessage', form);
}

async function sendDocument(file, caption) {
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('caption', caption);
  form.set('document', new Blob([fs.readFileSync(file)]), path.basename(file));
  await telegram('sendDocument', form);
}

async function main() {
  if (!token || !chatId) die('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
  if (!input) die('Usage: node scripts/send-world-cup-story-review.js <draft-dir-or-created-json>');

  const paths = [];
  let blocked = [];
  const abs = path.resolve(ROOT, input);
  if (abs.endsWith('.json')) {
    const payload = readJson(abs);
    for (const item of payload.created || []) paths.push(path.join(ROOT, item.draft_dir));
    blocked = Array.isArray(payload.blocked) ? payload.blocked : [];
  } else {
    paths.push(abs);
  }

  if (!paths.length && !blocked.length) {
    console.log('No story review drafts to send.');
    return;
  }

  for (const dir of paths) {
    const meta = readJson(path.join(dir, 'meta.json'));
    const story = readJson(path.join(dir, 'story.json'));
    const image = path.join(ROOT, meta.review_image);
    const contact = path.join(ROOT, meta.contact_sheet);
    const focusLines = (story.pool_focuses || []).map((focus, idx) => {
      const table = focus.table || 'group_position_picks';
      const team = focus.team_en || focus.team_code || '';
      const en = focus.en_name || focus.en_names || focus.en_count || '';
      const he = focus.he_name || focus.he_names || focus.he_count || '';
      return `${idx + 1}. ${table} / ${team}\nEN: ${en}\nHE: ${he}`;
    }).join('\n\n');

    const message = [
      `REVIEW NEEDED: World Cup Story`,
      ``,
      `Slug: ${meta.slug}`,
      `Match: ${(meta.teams || []).join('-')} ${meta.result}`,
      `Final image path: ${meta.final_image}`,
      ``,
      `Fallback captions:`,
      `EN: ${story.en && story.en.caption}`,
      `HE: ${story.he && story.he.caption}`,
      ``,
      `Pool-specific focus order:`,
      short(focusLines, 1800),
      ``,
      `Approve manually in GitHub Actions:`,
      `Run "Approve World Cup Story" with slug: ${meta.slug}`,
      ``,
      `Fail closed: if anything looks wrong, do not approve. Ask for a regenerate/change instead.`,
    ].join('\n');

    await sendMessage(message);
    await sendDocument(image, `Story image review: ${meta.slug}`);
    await sendDocument(contact, `Safe-zone contact sheet: ${meta.slug}`);
    await sendDocument(path.join(dir, 'story.json'), `Story JSON: ${meta.slug}`);
    console.log(`Sent story review package: ${meta.slug}`);
  }

  if (blocked.length) {
    const lines = blocked.map(item => `- ${item.slug}: ${item.reason}`).join('\n');
    await sendMessage([
      `World Cup Story automation skipped ${blocked.length} match(es).`,
      ``,
      short(lines, 3000),
      ``,
      `No story was published. Add approved star profiles/shirt numbers, then rerun the scoring/story workflow.`,
    ].join('\n'));
    console.log(`Sent ${blocked.length} blocked story notice(s).`);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
