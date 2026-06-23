#!/usr/bin/env node
// Browser-backed visual proof for the live group-stage dashboard/leaderboard
// states. This is intentionally optional: it uses Playwright + an installed
// Chrome/Chromium only when available, so FriendlyBet keeps its static/no-build
// production shape. Set LIVE_UX_VISUAL_STRICT=1 to fail when no browser exists.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.env.LIVE_UX_VISUAL_STRICT === '1';
const OUT_DIR = process.env.LIVE_UX_VISUAL_OUT_DIR
  ? path.resolve(process.env.LIVE_UX_VISUAL_OUT_DIR)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'friendlybet-live-ux-visuals-'));

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1180, height: 900 },
];

const STATES = [
  {
    id: 'live-no-official',
    title: 'Live, no official points yet',
    statusTitle: 'Matches are underway',
    statusText: '5 of 72 group-stage matches are finished. Official pool points unlock only when a full group completes all 6 fixtures.',
    badge: 'Waiting for a completed group',
    projection: true,
    podium: [],
    users: [
      ['-', 'Eyal With A Very Very Long FriendlyBet Name', 'You', 'No points yet', 0],
      ['-', 'Dana', '', 'No points yet', 0],
      ['-', 'Avi', 'Admin', 'No points yet', 0],
    ],
    banter: 'The Pundit: live drama is moving the group table, but this pool still waits for the first official receipt.',
  },
  {
    id: 'first-official-zero',
    title: 'First completed group, pool still on zero',
    statusTitle: 'Official scoring has started',
    statusText: 'Group A is complete. Points are now official, even if this pool has not hit a correct slot yet.',
    badge: '1/12 groups finalized',
    projection: false,
    podium: [],
    emptyTitle: 'Official scoring is live',
    emptyText: '1 of 12 groups are complete, but this pool still has 0 points. The list below is participants, not a final ranking.',
    users: [
      ['-', 'Eyal With A Very Very Long FriendlyBet Name', 'You', 'No points yet', 0],
      ['-', 'Dana', '', 'No points yet', 0],
      ['-', 'Avi', 'Admin', 'No points yet', 0],
    ],
    banter: 'The Pundit: Group A closed the first receipt. No fake podium until someone actually scores.',
  },
  {
    id: 'several-official',
    title: 'Several groups completed',
    statusTitle: 'The table is moving now',
    statusText: '3 of 12 groups are finalized. Official group points, rank changes, and pool receipts are live.',
    badge: '3/12 groups finalized',
    projection: false,
    podium: [
      ['second', 'Dana', 12, '2nd'],
      ['first', 'Eyal With A Long Name That Must Ellipsize', 18, '1st'],
      ['third', 'Avi', 8, '3rd'],
    ],
    users: [
      ['#1', 'Eyal With A Long Name That Must Ellipsize', 'You', 'Groups: 18', 18],
      ['#2', 'Dana', '', 'Groups: 12', 12],
      ['#3', 'Avi', 'Admin', 'Groups: 8', 8],
    ],
    banter: 'The Pundit: Group C just paid out. Eyal took two exact slots and the podium finally has real teeth.',
  },
  {
    id: 'groups-complete',
    title: 'Group stage complete',
    statusTitle: 'Group-stage points are final',
    statusText: 'All 12 groups are complete. The theoretical table is gone; the official standings lead the screen.',
    badge: '12/12 groups finalized',
    projection: false,
    podium: [
      ['second', 'Dana', 54, '2nd'],
      ['first', 'Eyal With A Long Name That Must Ellipsize', 61, '1st'],
      ['third', 'Avi', 49, '3rd'],
    ],
    users: [
      ['#1', 'Eyal With A Long Name That Must Ellipsize', 'You', 'Groups: 41 / Knockout: 20', 61],
      ['#2', 'Dana', '', 'Groups: 38 / Knockout: 16', 54],
      ['#3', 'Avi', 'Admin', 'Groups: 33 / Knockout: 16', 49],
    ],
    banter: 'The Pundit: every group is closed. No projections, no maybe-table, only official receipts from here.',
  },
];

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[ch]));
}

function browserCandidates() {
  const local = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || '';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || '';
  return [
    process.env.CHROME_PATH,
    path.join(local, 'Google/Chrome/Application/chrome.exe'),
    path.join(programFiles, 'Google/Chrome/Application/chrome.exe'),
    path.join(programFilesX86, 'Google/Chrome/Application/chrome.exe'),
    path.join(programFiles, 'Microsoft/Edge/Application/msedge.exe'),
    path.join(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (err) {
    if (STRICT) throw err;
    console.warn(`live-ux-visual-proof skipped: Playwright is unavailable (${err.message})`);
    return null;
  }
}

function podiumHtml(rows) {
  if (!rows.length) return '';
  return `<div class="lb-podium" data-proof="real-podium">${rows.map(([rank, name, points, label]) => `
    <div class="podium-spot ${rank}">
      <div class="podium-medal">${esc(label)}</div>
      <div class="podium-name">${esc(name)}</div>
      <div class="podium-points">${points}</div>
      <div class="podium-points-label">Points</div>
    </div>`).join('')}</div>`;
}

function projectionHtml() {
  return `<div class="lb-projection" data-proof="projection">
    <div class="lb-projection-head">
      <div>
        <div class="lb-projection-kicker">Theoretical table only</div>
        <div class="lb-projection-title">The theoretical podium</div>
      </div>
      <div class="lb-projection-pill">Not official</div>
    </div>
    <div class="lb-projection-note">No projection points are counted. This is only what would happen if the groups ended right now.</div>
    <div class="lb-projection-podium">
      <div class="podium-spot projection second"><div class="projection-rank-chip">2</div><div class="podium-name">Dana</div><div class="podium-points">4</div><div class="podium-points-label">Projected</div></div>
      <div class="podium-spot projection first"><div class="projection-rank-chip">1</div><div class="podium-name">Eyal With A Very Very Long Name</div><div class="podium-points">6</div><div class="podium-points-label">Projected</div></div>
      <div class="podium-spot projection third"><div class="projection-rank-chip">3</div><div class="podium-name">Avi</div><div class="podium-points">3</div><div class="podium-points-label">Projected</div></div>
    </div>
    <div class="lb-projection-pundit">The Pundit: screenshot the maybe-table now; one goal can flip it.</div>
  </div>`;
}

function rowsHtml(rows) {
  return `<div class="lb-full-list" data-proof="full-list">${rows.map(([rank, name, badge, meta, points], index) => `
    <div class="lb-row ${index === 0 ? 'is-me' : ''}">
      <div class="lb-rank">${esc(rank)}</div>
      <div class="lb-avatar-small">${esc(name[0] || '?')}</div>
      <div class="lb-info">
        <div class="lb-name">
          <span class="lb-name-text">${esc(name)}</span>
          ${badge === 'You' ? '<span class="lb-badge">You</span>' : ''}
          ${badge === 'Admin' ? '<span class="admin-badge">Admin</span>' : ''}
        </div>
        <div class="lb-meta">${esc(meta)}</div>
      </div>
      <div class="lb-score-cell"><div class="lb-points">${points}</div><div class="lb-points-label">Points</div></div>
    </div>`).join('')}</div>`;
}

function pageHtml(state, desktop) {
  const appCss = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  const fixtureCss = `
    html,body{width:100%;max-width:100%;overflow-x:hidden}
    .visual-shell{min-height:100vh;width:100%;padding:20px;background:linear-gradient(180deg,#090906,#12100b 60%,#080806)}
    .visual-app{width:100%;max-width:430px;margin:0 auto;min-width:0}
    .visual-desktop .visual-app{max-width:900px}
    .visual-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
    .visual-desktop .visual-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr)}
    .visual-panel{min-width:0;overflow:hidden;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:16px;box-shadow:0 16px 40px rgba(0,0,0,.25)}
    .visual-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
    .visual-brand{font-weight:900;color:#ecd49a}
    .visual-phase{font-size:11px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.08em}
    .section-title-small{font-size:13px;font-weight:800;color:#ecd49a;text-transform:uppercase;margin:0 0 10px}
    .dashboard-live-title{font-size:16px;font-weight:850;color:#fff;margin-bottom:5px}
    .dashboard-live-text{font-size:13px;line-height:1.42;color:rgba(255,255,255,.72);overflow:visible}
    .dashboard-live-badge{display:inline-flex;margin-top:10px;padding:5px 9px;border-radius:999px;background:rgba(217,180,106,.14);border:1px solid rgba(217,180,106,.32);color:#ecd49a;font-size:11px;font-weight:800}
    .dashboard-projection-card{max-width:100%;grid-template-columns:minmax(0,1fr);height:auto}
    .dpc-score{width:100%;min-width:0}
    .lb-empty{border:1px dashed rgba(217,180,106,.25);border-radius:12px;background:rgba(0,0,0,.12);margin-bottom:14px}
    .lb-empty-title{font-size:16px;font-weight:850;color:#fff;margin-bottom:6px}
    .lb-empty-text{font-size:13px;line-height:1.4;color:rgba(255,255,255,.66)}
    .lb-banter{margin:0 0 16px}
    .lb-podium{margin-bottom:16px}
    .lb-full-list{margin-top:0}
    .lb-score-cell{flex-shrink:0}
    .lb-projection{overflow:hidden}
    .lb-projection-head{min-width:0}
    .lb-projection-podium{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)}
    .visual-official .lb-projection{display:none!important}
    @media(max-width:520px){.visual-shell{padding:14px}.visual-panel{padding:14px}.lb-row{gap:9px;padding:11px 10px}.lb-podium{gap:7px}.podium-spot{padding-left:6px;padding-right:6px}.lb-rank{min-width:22px}.lb-avatar-small{width:30px;height:30px}}
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${appCss}\n${fixtureCss}</style></head><body>
    <main class="visual-shell ${desktop ? 'visual-desktop' : ''} ${state.projection ? '' : 'visual-official'}">
      <div class="visual-app">
        <div class="visual-top"><div><div class="visual-brand">FriendlyBet</div><div class="visual-phase">${esc(state.title)}</div></div><div class="visual-phase">v2.10.89</div></div>
        <div class="visual-grid">
          <section class="visual-panel">
            <h2 class="section-title-small">Dashboard</h2>
            <div class="dashboard-live-status" data-proof="status"><div class="dashboard-live-title">${esc(state.statusTitle)}</div><div class="dashboard-live-text">${esc(state.statusText)}</div><div class="dashboard-live-badge">${esc(state.badge)}</div></div>
            ${state.projection ? `<button class="dashboard-projection-card" data-proof="dashboard-projection"><div class="dpc-main"><div class="dpc-kicker">Theoretical table only</div><div class="dpc-title">If the groups ended right now</div><div class="dpc-sub">Temporary context from live group results; not official points.</div><div class="dpc-pundit">The Pundit: useful drama, zero official points.</div></div><div class="dpc-score"><strong>6</strong><span>Projected</span></div><div class="dpc-cta">Open</div></button>` : ''}
            <div class="lb-banter"><div class="lb-banter-head"><span class="lb-banter-mic">Mic</span><span class="lb-banter-title">Pool Pundit</span></div><div class="lb-banter-line">${esc(state.banter)}</div></div>
          </section>
          <section class="visual-panel">
            <h2 class="section-title-small">Leaderboard</h2>
            <div class="lb-pool-info"><div class="lb-pool-name">Friday Office Pool</div><div class="lb-pool-meta">${esc(state.badge)}<span class="lb-dot">/</span>${state.users.length} participants</div></div>
            ${podiumHtml(state.podium)}
            ${state.emptyTitle ? `<div class="lb-empty" data-proof="official-zero"><div class="lb-empty-title">${esc(state.emptyTitle)}</div><div class="lb-empty-text">${esc(state.emptyText)}</div></div>` : ''}
            ${state.projection ? projectionHtml() : ''}
            <h3 class="section-title-small">${state.podium.length ? 'Full ranking' : 'Pool participants'}</h3>
            ${rowsHtml(state.users)}
          </section>
        </div>
      </div>
    </main>
  </body></html>`;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const playwright = await loadPlaywright();
  if (!playwright) return { skipped: true, reason: 'missing-playwright', outDir: OUT_DIR };
  const executablePath = browserCandidates();
  if (!executablePath && STRICT) throw new Error('No Chrome/Chromium executable found; set CHROME_PATH or install a browser');
  if (!executablePath) {
    console.warn('live-ux-visual-proof skipped: no Chrome/Chromium executable found');
    return { skipped: true, reason: 'missing-browser', outDir: OUT_DIR };
  }

  const browser = await playwright.chromium.launch({ headless: true, executablePath });
  const evidence = [];
  const failures = [];

  for (const viewport of VIEWPORTS) {
    for (const state of STATES) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      await page.setContent(pageHtml(state, viewport.name === 'desktop'), { waitUntil: 'load' });
      const file = path.join(OUT_DIR, `${viewport.name}-${state.id}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const checks = await page.evaluate((expected) => {
        const result = {
          projectionCount: document.querySelectorAll('[data-proof="projection"],[data-proof="dashboard-projection"]').length,
          podiumSpots: document.querySelectorAll('.lb-podium .podium-spot').length,
          ellipsized: [],
          hardOverflows: [],
          overlaps: [],
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          textLength: document.body.innerText.length,
          expectedProjection: expected.projection ? 2 : 0,
          expectedPodium: expected.podium.length,
        };
        document.querySelectorAll('.lb-name-text,.podium-name').forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 1) result.ellipsized.push(el.className || el.textContent.slice(0, 20));
        });
        document.querySelectorAll('.dashboard-live-status,.dashboard-projection-card,.lb-projection,.lb-row,.lb-empty,.lb-banter').forEach((el) => {
          const box = el.getBoundingClientRect();
          if (el.scrollWidth > el.clientWidth + 2 || box.right > window.innerWidth + 2) {
            result.hardOverflows.push(el.className || el.dataset.proof || el.tagName);
          }
        });
        const boxes = [...document.querySelectorAll('.lb-podium .podium-spot')].map((el) => ({ cls: el.className, r: el.getBoundingClientRect() }));
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i].r;
            const b = boxes[j].r;
            if (!(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)) {
              result.overlaps.push([boxes[i].cls, boxes[j].cls]);
            }
          }
        }
        return result;
      }, state);
      const bytes = fs.statSync(file).size;
      evidence.push({ viewport: viewport.name, state: state.id, file, bytes, checks });

      if (bytes < 50000) failures.push(`${viewport.name}/${state.id}: screenshot too small (${bytes} bytes)`);
      if (checks.projectionCount !== checks.expectedProjection) failures.push(`${viewport.name}/${state.id}: projectionCount=${checks.projectionCount}, expected=${checks.expectedProjection}`);
      if (checks.podiumSpots !== checks.expectedPodium) failures.push(`${viewport.name}/${state.id}: podiumSpots=${checks.podiumSpots}, expected=${checks.expectedPodium}`);
      if (checks.hardOverflows.length) failures.push(`${viewport.name}/${state.id}: hard overflow ${checks.hardOverflows.join(', ')}`);
      if (checks.overlaps.length) failures.push(`${viewport.name}/${state.id}: podium overlap ${JSON.stringify(checks.overlaps)}`);
      if (checks.scrollWidth > checks.clientWidth) failures.push(`${viewport.name}/${state.id}: document horizontal overflow ${checks.scrollWidth}>${checks.clientWidth}`);
      await page.close();
    }
  }

  await browser.close();
  const summary = { outDir: OUT_DIR, executablePath, evidence, failures };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  if (failures.length) {
    const err = new Error(`live UX visual proof failed:\n- ${failures.join('\n- ')}`);
    err.summary = summary;
    throw err;
  }
  return summary;
}

if (require.main === module) {
  run().then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  }).catch((err) => {
    console.error(err.message);
    if (err.summary) console.error(JSON.stringify(err.summary, null, 2));
    process.exit(1);
  });
} else {
  module.exports = { run, STATES, VIEWPORTS, browserCandidates };
}
