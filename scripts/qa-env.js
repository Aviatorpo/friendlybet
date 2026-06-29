const PROD_SUPABASE_REF = 'kovhuahdoluxyqqwqohw';

function supabaseRefFromUrl(url) {
  const match = String(url || '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return match ? match[1] : '';
}

function targetEnv() {
  return String(process.env.FRIENDLYBET_TARGET_ENV || process.env.TARGET_ENV || '').trim().toLowerCase();
}

function isQaTarget() {
  return ['qa', 'staging', 'test'].includes(targetEnv());
}

function assertQaSupabaseEnv(options = {}) {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SECRET_KEY || '';
  const ref = supabaseRefFromUrl(url);
  const env = targetEnv();
  const expectedRef = String(process.env.QA_SUPABASE_PROJECT_REF || process.env.EXPECTED_QA_SUPABASE_REF || '').trim();

  if (!isQaTarget()) {
    throw new Error(`Refusing QA run: TARGET_ENV/FRIENDLYBET_TARGET_ENV must be qa, staging, or test (got "${env || 'unset'}").`);
  }
  if (!url) throw new Error('Refusing QA run: SUPABASE_URL is missing.');
  if (!key && options.requireServiceKey !== false) {
    throw new Error('Refusing QA run: SUPABASE_SECRET_KEY is missing.');
  }
  if (!ref) throw new Error(`Refusing QA run: SUPABASE_URL is not a Supabase project URL (${url}).`);
  if (ref === PROD_SUPABASE_REF || url.includes(PROD_SUPABASE_REF)) {
    throw new Error(`Refusing QA run: SUPABASE_URL points at production project ${PROD_SUPABASE_REF}.`);
  }
  if (expectedRef && ref !== expectedRef) {
    throw new Error(`Refusing QA run: Supabase project ref "${ref}" does not match expected QA ref "${expectedRef}".`);
  }
  return { env, url, ref };
}

function assertQaIfRequested(options = {}) {
  if (!isQaTarget()) return null;
  return assertQaSupabaseEnv(options);
}

if (require.main === module) {
  try {
    const meta = assertQaSupabaseEnv();
    console.log(`QA Supabase environment OK: env=${meta.env} ref=${meta.ref} url=${meta.url}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  PROD_SUPABASE_REF,
  supabaseRefFromUrl,
  targetEnv,
  isQaTarget,
  assertQaSupabaseEnv,
  assertQaIfRequested,
};
