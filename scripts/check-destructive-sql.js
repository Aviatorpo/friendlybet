// ============================================================
// Static guard: fail CI if unguarded destructive SQL re-enters the repo
// ============================================================
// Added after the 2026-06-10 incident (sync-teams.js DELETEd all knockout_picks every
// run; the fix-draw / r32 migrations blanket-DELETE picks if replayed). This scanner
// catches that whole class BEFORE it ships:
//   * migrations/*.sql: TRUNCATE, or a blanket DELETE FROM a protected user-data table
//     (a DELETE whose statement does NOT scope by user_id/pool_id) — UNLESS the file
//     carries the explicit replay guard (`allow_destructive_replay`) or is allowlisted.
//   * scripts/*.js: a blanket REST delete of a protected table
//     (callSupabase('DELETE','<protected>', ...neq.0000/__NEVER__...) or
//      .from('<protected>').delete() without an .eq('user_id'/'pool_id')).
// Exit non-zero on any finding. Run via `node scripts/check-destructive-sql.js`.

const fs = require('fs');
const path = require('path');
const { FB_PROTECTED_TABLES } = require('./lib-guard');

const ROOT = path.join(__dirname, '..');
const PROT = [...FB_PROTECTED_TABLES];
const protAlt = PROT.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

// Files explicitly accepted (one-off, already applied, now guarded). Add new entries
// only WITH a written rationale — never to silence a genuinely new destructive change.
const MIGRATION_ALLOWLIST = new Set([
  // (none needed: the two historical destructive migrations now carry the replay guard)
]);

// Strip SQL comments so patterns inside `-- …` / `/* … */` (e.g. an incident note that
// quotes "DELETE FROM knockout_picks") are not mistaken for real statements.
function stripSqlComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

const findings = [];

// ---- migrations/*.sql ----
const migDir = path.join(ROOT, 'migrations');
for (const f of fs.existsSync(migDir) ? fs.readdirSync(migDir) : []) {
  if (!f.endsWith('.sql')) continue;
  const raw = fs.readFileSync(path.join(migDir, f), 'utf8');
  const guarded = /allow_destructive_replay/i.test(raw) || MIGRATION_ALLOWLIST.has(f);
  if (guarded) continue;
  const src = stripSqlComments(raw);
  // a real TRUNCATE STATEMENT (line-starts with truncate) — not `revoke truncate`,
  // not the word inside a string/comment.
  if (/^\s*truncate\s+/im.test(src)) findings.push(`${f}: contains a TRUNCATE statement (no replay guard)`);
  // a DELETE FROM a protected table is "blanket" (dangerous) if it has NO where clause
  // at all, or a fake never-match filter (id<>'0000…' / code<>'__NEVER__'). A genuinely
  // scoped delete (WHERE id/user_id = <value>) inside an RPC is fine.
  const re = new RegExp(`delete\\s+from\\s+(?:"?public"?\\.)?"?(${protAlt})"?\\b([^;]*);`, 'gi');
  let m;
  while ((m = re.exec(src))) {
    const tail = m[2] || '';
    const hasWhere = /\bwhere\b/i.test(tail);
    const fakeFilter = /(!=|<>|\bneq\b|\bnot\s+in\b)[^;]*(0{4,}|__NEVER__)/i.test(tail);
    if (!hasWhere || fakeFilter) {
      findings.push(`${f}: blanket DELETE FROM ${m[1]} (no scoped WHERE, no replay guard)`);
    }
  }
}

// ---- scripts/*.js ----
const scrDir = path.join(ROOT, 'scripts');
for (const f of fs.existsSync(scrDir) ? fs.readdirSync(scrDir) : []) {
  if (!f.endsWith('.js')) continue;
  if (f === path.basename(__filename) || f.startsWith('test-')) continue;
  const src = fs.readFileSync(path.join(scrDir, f), 'utf8');
  for (const tbl of PROT) {
    // REST helper blanket delete: callSupabase('DELETE','<protected>'  / sb('DELETE','<protected>'
    const restRe = new RegExp(`\\(\\s*['"]DELETE['"]\\s*,\\s*['"]${tbl}['"]`, 'i');
    if (restRe.test(src)) findings.push(`${f}: REST DELETE on protected table '${tbl}' (use a scoped RPC)`);
    // client-style .from('<protected>').delete() with no eq(user_id/pool_id) nearby
    const fromRe = new RegExp(`from\\(\\s*['"]${tbl}['"]\\s*\\)([\\s\\S]{0,160}?)\\.delete\\(`, 'i');
    const fm = fromRe.exec(src);
    if (fm && !/\.eq\(\s*['"](user_id|pool_id|id)['"]/i.test(fm[1] + src.slice(fm.index, fm.index + 240))) {
      findings.push(`${f}: .from('${tbl}').delete() not scoped by user_id/pool_id/id`);
    }
  }
}

if (findings.length) {
  console.error('✗ destructive-SQL guard FAILED — unguarded destructive operations found:');
  for (const x of findings) console.error('  - ' + x);
  console.error('\nFix: scope the delete by user_id/pool_id, route writes through a SECURITY');
  console.error('DEFINER RPC, or (for a one-off migration) add the replay guard block.');
  process.exit(1);
}
console.log('✓ destructive-SQL guard passed — no unguarded TRUNCATE / blanket DELETE on protected tables.');
