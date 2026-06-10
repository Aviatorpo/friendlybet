const assert = require('assert');
const B = require('./backup-critical-data.js');

const secret = 'unit-test-secret';
const payload = {
  createdAt: '2026-06-10T00:00:00.000Z',
  trigger: { reason: 'unit', matches: [{ external_id: 'm1' }] },
  tables: { users: [{ id: 'u1', recovery_code_hash: 'hash' }] },
};

const enc = B.encryptPayload(payload, secret);
assert.strictEqual(enc.encrypted, true);
assert.strictEqual(enc.ext, '.json.enc');
assert.ok(!enc.body.includes('recovery_code_hash'));
assert.deepStrictEqual(B.decryptEnvelope(JSON.parse(enc.body), secret), payload);

assert.ok(B.CRITICAL_TABLES.includes('pick_backups'));
assert.ok(B.CRITICAL_TABLES.includes('group_picks'));
assert.ok(B.CRITICAL_TABLES.includes('knockout_picks'));
assert.ok(B.FINAL_STATUSES.has('FINISHED'));
assert.ok(B.FINAL_STATUSES.has('AWARDED'));
assert.strictEqual(B.slug('201 MEX/RSA'), '201-MEX-RSA');

console.log('backup-critical-data tests passed');
