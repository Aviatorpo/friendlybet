#!/usr/bin/env node
/*
 * Deploy and wire the Supabase side of the prepared World Cup story automation.
 *
 * Required:
 *   GITHUB_DISPATCH_TOKEN  GitHub token that can call repository_dispatch.
 *
 * Optional:
 *   STORY_DISPATCH_SECRET  Shared DB-webhook -> Edge Function secret.
 *                          Generated for this run if omitted.
 *   GITHUB_REPO            Defaults to Aviatorpo/friendlybet.
 *   SUPABASE_PROJECT_REF   Defaults to supabase/.temp/project-ref.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'supabase', 'functions', 'world-cup-story-dispatch', 'setup-webhook.sql');
const DEFAULT_PROJECT_REF_PATH = path.join(ROOT, 'supabase', '.temp', 'project-ref');

function readProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF.trim();
  if (fs.existsSync(DEFAULT_PROJECT_REF_PATH)) return fs.readFileSync(DEFAULT_PROJECT_REF_PATH, 'utf8').trim();
  throw new Error('Missing SUPABASE_PROJECT_REF and supabase/.temp/project-ref');
}

function requiredEnv(name, fallbackName) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : '');
  if (!value) throw new Error(`Missing ${name}${fallbackName ? ` or ${fallbackName}` : ''}`);
  return value;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function run(command, args, options = {}) {
  const printable = [command, ...args.map(arg => (String(arg).includes(' ') ? `"${arg}"` : arg))].join(' ');
  console.log(`\n$ ${printable}`);
  const res = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (res.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${res.status}`);
  }
}

function writeSecretEnvFile(file, secrets) {
  const lines = Object.entries(secrets).map(([key, value]) => `${key}=${String(value).replace(/\r?\n/g, '')}`);
  fs.writeFileSync(file, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
}

function renderSql({ functionUrl, storyDispatchSecret }) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return template
    .replaceAll('__WORLD_CUP_STORY_DISPATCH_URL__', sqlLiteral(functionUrl))
    .replaceAll('__STORY_DISPATCH_SECRET__', sqlLiteral(storyDispatchSecret));
}

function main() {
  const projectRef = readProjectRef();
  const githubRepo = process.env.GITHUB_REPO || 'Aviatorpo/friendlybet';
  const githubDispatchToken = requiredEnv('GITHUB_DISPATCH_TOKEN', 'GH_TOKEN');
  const storyDispatchSecret = process.env.STORY_DISPATCH_SECRET || crypto.randomBytes(32).toString('hex');
  const functionUrl = `https://${projectRef}.functions.supabase.co/world-cup-story-dispatch`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'friendlybet-story-supabase-'));
  const envFile = path.join(tempDir, 'edge-function.env');
  const sqlFile = path.join(tempDir, 'setup-webhook.sql');

  try {
    writeSecretEnvFile(envFile, {
      STORY_DISPATCH_SECRET: storyDispatchSecret,
      GITHUB_REPO: githubRepo,
      GITHUB_DISPATCH_TOKEN: githubDispatchToken,
    });
    fs.writeFileSync(sqlFile, renderSql({ functionUrl, storyDispatchSecret }), 'utf8');

    console.log(`Supabase project: ${projectRef}`);
    console.log(`GitHub repo: ${githubRepo}`);
    console.log(`Edge Function URL: ${functionUrl}`);
    if (!process.env.STORY_DISPATCH_SECRET) {
      console.log('Generated STORY_DISPATCH_SECRET for this setup run.');
    }

    run('supabase', [
      'functions',
      'deploy',
      'world-cup-story-dispatch',
      '--project-ref',
      projectRef,
      '--no-verify-jwt',
      '--use-api',
    ]);

    run('supabase', ['secrets', 'set', '--project-ref', projectRef, '--env-file', envFile]);
    run('supabase', ['db', 'query', '--linked', '--file', sqlFile]);
    run('supabase', [
      'db',
      'query',
      '--linked',
      '--output',
      'table',
      "select n.nspname as schema, c.relname as table_name, t.tgname, t.tgenabled from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'matches' and t.tgname = 'matches_world_cup_story_dispatch';",
    ]);

    console.log('\nWorld Cup story Supabase automation is deployed.');
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

main();
