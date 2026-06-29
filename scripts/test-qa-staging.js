#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const qaEnv = require('./qa-env');

const ROOT = path.resolve(__dirname, '..');

function withEnv(patch, fn) {
  const prev = {};
  Object.keys(patch).forEach(k => { prev[k] = process.env[k]; });
  try {
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null) delete process.env[k];
      else process.env[k] = v;
    });
    return fn();
  } finally {
    Object.entries(prev).forEach(([k, v]) => {
      if (v == null) delete process.env[k];
      else process.env[k] = v;
    });
  }
}

withEnv({
  TARGET_ENV: 'qa',
  FRIENDLYBET_TARGET_ENV: null,
  QA_SUPABASE_PROJECT_REF: null,
  SUPABASE_URL: 'https://kovhuahdoluxyqqwqohw.supabase.co',
  SUPABASE_SECRET_KEY: 'test'
}, () => {
  assert.throws(() => qaEnv.assertQaSupabaseEnv(), /production project/);
});

withEnv({
  TARGET_ENV: 'qa',
  FRIENDLYBET_TARGET_ENV: null,
  QA_SUPABASE_PROJECT_REF: 'exampleqa',
  SUPABASE_URL: 'https://exampleqa.supabase.co',
  SUPABASE_SECRET_KEY: 'test'
}, () => {
  const meta = qaEnv.assertQaSupabaseEnv();
  assert.strictEqual(meta.ref, 'exampleqa');
});

withEnv({
  TARGET_ENV: 'qa',
  FRIENDLYBET_TARGET_ENV: null,
  QA_SUPABASE_PROJECT_REF: 'expectedqa',
  SUPABASE_URL: 'https://wrongqa.supabase.co',
  SUPABASE_SECRET_KEY: 'test'
}, () => {
  assert.throws(() => qaEnv.assertQaSupabaseEnv(), /does not match expected QA ref/);
});

withEnv({
  TARGET_ENV: null,
  FRIENDLYBET_TARGET_ENV: null,
  SUPABASE_URL: 'https://kovhuahdoluxyqqwqohw.supabase.co',
  SUPABASE_SECRET_KEY: 'test'
}, () => {
  assert.strictEqual(qaEnv.assertQaIfRequested(), null);
});

const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'qa-staging-pipeline.yml'), 'utf8');
assert.ok(workflow.includes('environment: qa-staging'), 'QA workflow must use the qa-staging environment');
assert.ok(workflow.includes('permissions:\n  contents: read'), 'QA workflow must not have contents: write');
assert.ok(workflow.includes('PUBLIC_DATA_DIR: _qa-artifacts/public-data'), 'QA workflow must isolate generated public-data');
assert.ok(workflow.includes('actions/upload-artifact'), 'QA workflow must upload proof artifacts');
assert.ok(!/\bgit\s+push\b/.test(workflow), 'QA workflow must not push');
assert.ok(!/\bgit\s+commit\b/.test(workflow), 'QA workflow must not commit');
assert.ok(!workflow.includes('kovhuahdoluxyqqwqohw.supabase.co'), 'QA workflow must not hardcode production Supabase');

const exportSnapshots = fs.readFileSync(path.join(ROOT, 'scripts', 'export-snapshots.js'), 'utf8');
assert.ok(exportSnapshots.includes('process.env.PUBLIC_DATA_DIR'), 'export-snapshots must support PUBLIC_DATA_DIR');
const generatePundit = fs.readFileSync(path.join(ROOT, 'scripts', 'generate-pundit.js'), 'utf8');
assert.ok(generatePundit.includes('process.env.PUBLIC_DATA_DIR'), 'generate-pundit must support PUBLIC_DATA_DIR');
const generateBanter = fs.readFileSync(path.join(ROOT, 'scripts', 'generate-banter.js'), 'utf8');
assert.ok(generateBanter.includes('process.env.PUBLIC_DATA_DIR'), 'generate-banter must support PUBLIC_DATA_DIR');

console.log('qa staging guard tests passed');
