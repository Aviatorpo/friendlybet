// Deterministic unit test for the Pool-Pundit banter engine. No network.
// Run: node scripts/test-banter.js   (exit 0 = pass, 1 = fail)
const assert = require('assert');
const { buildPoolBanter } = require('./generate-banter');

let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`  ✓ ${name}`); }

// helpers
const U = (id, nickname, total_score, joined_at = '2026-06-01T00:00:00Z') => ({ id, nickname, total_score, joined_at, pool_id: 'P' });

console.log('Banter engine tests:');

// 1) First run, no scores -> null (stay quiet pre-tournament)
check('first run, no scores -> null', () => {
  const r = buildPoolBanter(null, [U('a', 'Yossi', 0), U('b', 'Dana', 0)], [], [], new Map(), 0);
  assert.strictEqual(r, null);
});

// 2) First run, with scores -> leader headline
check('first run with scores -> leader headline', () => {
  const r = buildPoolBanter(null, [U('a', 'Yossi', 12), U('b', 'Dana', 8)], [], [], new Map(), 3);
  assert.ok(r && r.headline);
  assert.strictEqual(r.headline.type, 'leader');
  assert.strictEqual(r.headline.featuredUserId, 'a');
  assert.ok(/Yossi/.test(r.headline.he) && /Yossi/.test(r.headline.en));
});

// 3) Lead change -> coup headline, featured = new leader, both langs
check('lead change -> coup headline', () => {
  const prev = [{ id: 'a', nickname: 'Yossi', total_score: 10 }, { id: 'b', nickname: 'Dana', total_score: 8 }];
  const cur = [U('b', 'Dana', 16), U('a', 'Yossi', 10)];
  const r = buildPoolBanter(prev, cur, [], [], new Map(), 2);
  assert.strictEqual(r.headline.type, 'lead-change');
  assert.strictEqual(r.headline.featuredUserId, 'b');
  assert.ok(/Dana/.test(r.headline.he), 'he names new leader');
  assert.ok(/Dana/.test(r.headline.en), 'en names new leader');
  assert.ok(/Yossi/.test(r.headline.he), 'he names dethroned');
});

// 4) Champion knocked out -> appears in items, names the team in both langs
check('champion knocked out -> item', () => {
  const prev = [{ id: 'a', nickname: 'Roi', total_score: 20 }, { id: 'b', nickname: 'Dana', total_score: 18 }];
  const cur = [U('a', 'Roi', 20), U('b', 'Dana', 18)];
  const ko = [{ match: { stage: 'QUARTER_FINALS' }, winner: 'FRA', loser: 'BRA' }];
  const champ = new Map([['a', 'BRA']]); // Roi bet Brazil as champion
  const r = buildPoolBanter(prev, cur, ko, [], champ, 1);
  const champItem = r.items.find(i => i.type === 'champion-out');
  assert.ok(champItem, 'has champion-out item');
  assert.strictEqual(champItem.featuredUserId, 'a');
  assert.ok(/ברזיל/.test(champItem.he), 'he names Brazil');
  assert.ok(/Brazil/.test(champItem.en), 'en names Brazil');
});

// 5) Big climber -> climber item with spot count and rank
check('big climber -> climber item', () => {
  const prev = [
    { id: 'a', nickname: 'A', total_score: 30 },
    { id: 'b', nickname: 'B', total_score: 20 },
    { id: 'c', nickname: 'C', total_score: 10 },
    { id: 'd', nickname: 'Zoom', total_score: 5 },
  ];
  const cur = [U('a', 'A', 30), U('d', 'Zoom', 28), U('b', 'B', 20), U('c', 'C', 10)];
  const r = buildPoolBanter(prev, cur, [], [], new Map(), 2);
  const climb = r.items.find(i => i.type === 'climber');
  assert.ok(climb, 'has climber');
  assert.strictEqual(climb.featuredUserId, 'd');
  assert.ok(/2/.test(climb.he), 'mentions 2 spots');
  assert.ok(/#2/.test(climb.en), 'mentions new rank #2');
});

// 6) Late winner -> real scorer + minute (incl stoppage), winner-team only
check('late winner -> buzzer line with scorer + minute', () => {
  const prev = [{ id: 'a', nickname: 'A', total_score: 5 }, { id: 'b', nickname: 'B', total_score: 5 }];
  const cur = [U('a', 'A', 9), U('b', 'B', 5)];
  const late = [{ goal: { player: 'Lamine Yamal', minute: 90, injury: 4, team: 'ESP' }, team: 'ESP' }];
  const r = buildPoolBanter(prev, cur, [], late, new Map(), 1);
  const lw = r.items.find(i => i.type === 'late-winner');
  assert.ok(lw, 'has late-winner');
  assert.ok(/Lamine Yamal/.test(lw.he) && /Lamine Yamal/.test(lw.en), 'names scorer in both');
  assert.ok(/90\+4/.test(lw.he), 'he shows stoppage minute');
  assert.ok(/90\+4/.test(lw.en), 'en shows stoppage minute');
  assert.ok(/ספרד/.test(lw.he) && /Spain/.test(lw.en), 'names Spain in both');
});

// 7) Tight race when top two within 2 pts
check('tight race at the top', () => {
  const prev = [{ id: 'a', nickname: 'A', total_score: 14 }, { id: 'b', nickname: 'B', total_score: 13 }];
  const cur = [U('a', 'A', 15), U('b', 'B', 14)];
  const r = buildPoolBanter(prev, cur, [], [], new Map(), 1);
  assert.ok(r.items.some(i => i.type === 'tight-race'), 'has tight-race');
});

// 8) Every produced item has both he and en non-empty and a featured id where relevant
check('all items bilingual + well-formed', () => {
  const prev = [{ id: 'a', nickname: 'A', total_score: 10 }, { id: 'b', nickname: 'B', total_score: 8 }];
  const cur = [U('b', 'B', 16), U('a', 'A', 10)];
  const r = buildPoolBanter(prev, cur, [], [], new Map(), 2);
  for (const it of r.items) {
    assert.ok(it.he && it.he.length > 3, `he ok for ${it.type}`);
    assert.ok(it.en && it.en.length > 3, `en ok for ${it.type}`);
    assert.ok(it.id, `id ok for ${it.type}`);
    assert.ok(it.emoji, `emoji ok for ${it.type}`);
  }
});

console.log(`\n${passed} checks passed.`);
process.exit(0);
