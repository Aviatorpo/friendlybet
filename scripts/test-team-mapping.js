// ============================================================
// Test: smart-sync team-name mapping, placeholder detection, critical statuses
// ============================================================
// Guards the v2.9.14/16/17 hardening: real teams resolve (incl. diacritics +
// curly apostrophes), the dangerous Korea DPR alias stays UNMAPPED, knockout
// placeholders are not treated as real teams, and AWARDED/SUSPENDED are in the
// scoring-critical fail-loud set (CANCELLED/POSTPONED are NOT).
// Run: node scripts/test-team-mapping.js   (no DB / no secrets)
// ============================================================

process.env.SUPABASE_SECRET_KEY = 'test';
process.env.FOOTBALL_DATA_TOKEN = 'test';
const S = require('./smart-sync.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}`); cond ? pass++ : fail++; };
const code = (name) => S.getTeamCode(name);

// --- real teams + provider name variants resolve ---
ok('South Korea -> KOR', code('South Korea') === 'KOR');
ok('Korea Republic -> KOR', code('Korea Republic') === 'KOR');
ok('Republic of Korea -> KOR', code('Republic of Korea') === 'KOR');
ok('case-insensitive "south korea" -> KOR', code('south korea') === 'KOR');
ok('Ivory Coast -> CIV', code('Ivory Coast') === 'CIV');
ok("Cote d'Ivoire (straight) -> CIV", code("Cote d'Ivoire") === 'CIV');
ok('Côte d’Ivoire (curly+accent) -> CIV', code('Côte d’Ivoire') === 'CIV');
ok('Curacao -> CUR', code('Curacao') === 'CUR');
ok('Curaçao (cedilla) -> CUR', code('Curaçao') === 'CUR');
ok('DR Congo -> COD', code('DR Congo') === 'COD');
ok('Congo DR -> COD', code('Congo DR') === 'COD');
ok('United States of America -> USA', code('United States of America') === 'USA');
ok('Bosnia and Herzegovina -> BIH', code('Bosnia and Herzegovina') === 'BIH');
ok('Czech Republic -> CZE', code('Czech Republic') === 'CZE');
ok('Cape Verde -> CPV', code('Cape Verde') === 'CPV');

// --- the dangerous alias must NOT exist ---
ok('Korea DPR -> null (NOT mapped to KOR — DPRK != South Korea)', code('Korea DPR') === null);
ok('unknown team -> null', code('Atlantis FC') === null);
ok('null -> null', code(null) === null);

// --- placeholder vs real team ---
ok('isRealTeamName("Brazil") = true', S.isRealTeamName('Brazil') === true);
ok('isRealTeamName("TBD") = false', S.isRealTeamName('TBD') === false);
ok('isRealTeamName("Winner Semi-final 1") = false', S.isRealTeamName('Winner Semi-final 1') === false);
ok('isRealTeamName("Runner-up Group A") = false', S.isRealTeamName('Runner-up Group A') === false);
ok('isRealTeamName("Loser SF1") = false', S.isRealTeamName('Loser SF1') === false);
ok('isRealTeamName(null) = false', S.isRealTeamName(null) === false);

// --- scoring-critical status set ---
['IN_PLAY', 'PAUSED', 'FINISHED', 'LIVE', 'AWARDED', 'SUSPENDED'].forEach(s =>
  ok(`status ${s} is scoring-critical`, S.LIVE_OR_FINAL_STATUS.has(s)));
['SCHEDULED', 'TIMED', 'CANCELLED', 'POSTPONED'].forEach(s =>
  ok(`status ${s} is NOT scoring-critical`, !S.LIVE_OR_FINAL_STATUS.has(s)));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
