#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'public-data', 'world-cup-schedule.json');
const FIFA_SCHEDULE_URL = 'https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idCompetition=17&from=2026-06-01&to=2026-07-31';
const FIFA_PAGE_URL = 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=IL&wtw-filter=ALL';
const DEFAULT_WINDOW_BEFORE_MINUTES = 60;
const DEFAULT_WINDOW_AFTER_MINUTES = 360;

function parseArgs(argv) {
  const options = {
    ifWindow: false,
    now: new Date(),
    windowBeforeMinutes: DEFAULT_WINDOW_BEFORE_MINUTES,
    windowAfterMinutes: DEFAULT_WINDOW_AFTER_MINUTES
  };

  for (const arg of argv) {
    if (arg === '--if-window') {
      options.ifWindow = true;
    } else if (arg.startsWith('--now=')) {
      options.now = parseDateArg('now', arg.slice('--now='.length));
    } else if (arg.startsWith('--window-before-min=')) {
      options.windowBeforeMinutes = parsePositiveNumber('window-before-min', arg.slice('--window-before-min='.length));
    } else if (arg.startsWith('--window-after-min=')) {
      options.windowAfterMinutes = parsePositiveNumber('window-after-min', arg.slice('--window-after-min='.length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parseDateArg(label, value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid --${label} value: ${value}`);
  return parsed;
}

function parsePositiveNumber(label, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid --${label} value: ${value}`);
  return parsed;
}

function readExistingSchedule() {
  try {
    return JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

function githubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function scheduleRefreshWindow(existing, now, beforeMs, afterMs) {
  const matches = existing && Array.isArray(existing.matches) ? existing.matches : [];
  if (!matches.length) {
    return { shouldRefresh: true, reason: 'missing local schedule snapshot' };
  }

  let nextOpenAt = null;
  for (const match of matches) {
    const matchTime = Date.parse(match.match_date || '');
    if (!Number.isFinite(matchTime)) continue;

    const openAt = matchTime - beforeMs;
    const closeAt = matchTime + afterMs;
    if (now.getTime() >= openAt && now.getTime() <= closeAt) {
      return {
        shouldRefresh: true,
        reason: `inside refresh window for match ${match.match_number || match.id}`,
        match
      };
    }

    if (now.getTime() < openAt && (nextOpenAt == null || openAt < nextOpenAt)) {
      nextOpenAt = openAt;
    }
  }

  return {
    shouldRefresh: false,
    reason: nextOpenAt
      ? `next refresh window opens at ${new Date(nextOpenAt).toISOString()}`
      : 'all match refresh windows have passed'
  };
}

function stableSnapshot(snapshot) {
  return JSON.stringify({
    source: snapshot.source,
    sourcePage: snapshot.sourcePage,
    count: snapshot.count,
    matches: snapshot.matches
  });
}

function localized(list, fallback = null) {
  if (!Array.isArray(list)) return fallback;
  const en = list.find(x => String(x.Locale || '').toLowerCase().startsWith('en'));
  return (en && en.Description) || (list[0] && list[0].Description) || fallback;
}

function stageCode(label, matchNumber = null) {
  const number = Number(matchNumber);
  // FIFA's official WC2026 numbering is an additional invariant for the two
  // placement fixtures. Keep it ahead of provider wording so a label change
  // cannot silently turn the bronze final into the tournament final again.
  if (number === 103) return 'THIRD_PLACE';
  if (number === 104) return 'FINAL';

  const value = String(label || '').toLowerCase();
  if (value.includes('first stage')) return 'GROUP_STAGE';
  if (value.includes('round of 32')) return 'ROUND_OF_32';
  if (value.includes('round of 16')) return 'ROUND_OF_16';
  if (value.includes('quarter')) return 'QUARTER_FINALS';
  if (value.includes('semi')) return 'SEMI_FINALS';
  if (value.includes('third') || value.includes('bronze')) return 'THIRD_PLACE';
  if (value.includes('final')) return 'FINAL';
  return 'UNKNOWN';
}

function validatePlacementStages(rows) {
  const byNumber = new Map(rows.map(row => [Number(row.match_number), row]));
  const thirdPlace = byNumber.get(103);
  const final = byNumber.get(104);
  if (!thirdPlace || thirdPlace.stage !== 'THIRD_PLACE') {
    throw new Error('FIFA match 103 must be classified as THIRD_PLACE');
  }
  if (!final || final.stage !== 'FINAL') {
    throw new Error('FIFA match 104 must be classified as FINAL');
  }

  const thirdPlaceRows = rows.filter(row => row.stage === 'THIRD_PLACE');
  const finalRows = rows.filter(row => row.stage === 'FINAL');
  if (thirdPlaceRows.length !== 1 || finalRows.length !== 1) {
    throw new Error(`Expected one third-place match and one final, got ${thirdPlaceRows.length} and ${finalRows.length}`);
  }
}

function groupLetter(groupName) {
  const match = String(groupName || '').match(/Group\s+([A-L])/i);
  return match ? match[1].toUpperCase() : null;
}

function team(raw) {
  if (!raw) return null;
  return {
    code: raw.Abbreviation || raw.IdCountry || null,
    name: raw.ShortClubName || localized(raw.TeamName),
    country: raw.IdCountry || raw.Abbreviation || null,
    score: raw.Score == null ? null : Number(raw.Score)
  };
}

function status(raw) {
  const homeScore = raw.Home && raw.Home.Score;
  const awayScore = raw.Away && raw.Away.Score;
  if (raw.ResultType === 1 || (raw.MatchStatus === 0 && homeScore != null && awayScore != null)) return 'FINISHED';
  if (raw.MatchStatus === 1) return 'SCHEDULED';
  return 'TIMED';
}

function transform(raw) {
  const stageName = localized(raw.StageName);
  const groupName = localized(raw.GroupName);
  const home = team(raw.Home);
  const away = team(raw.Away);
  const venue = raw.Stadium || {};
  return {
    id: `fifa-${raw.IdMatch}`,
    source: 'fifa',
    source_url: FIFA_PAGE_URL,
    fifa_match_id: raw.IdMatch || null,
    match_number: raw.MatchNumber == null ? null : Number(raw.MatchNumber),
    stage: stageCode(stageName, raw.MatchNumber),
    stage_name: stageName,
    group_letter: groupLetter(groupName),
    group_name: groupName || null,
    match_date: raw.Date || null,
    local_date: raw.LocalDate || null,
    status: status(raw),
    fifa_status: raw.MatchStatus == null ? null : raw.MatchStatus,
    result_type: raw.ResultType == null ? null : raw.ResultType,
    home_team_code: home && home.code,
    away_team_code: away && away.code,
    home_team_name: home && home.name,
    away_team_name: away && away.name,
    home_score: home && home.score,
    away_score: away && away.score,
    venue: localized(venue.Name),
    city: localized(venue.CityName),
    country: venue.IdCountry || null
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const existing = readExistingSchedule();

  if (options.ifWindow) {
    const window = scheduleRefreshWindow(
      existing,
      options.now,
      options.windowBeforeMinutes * 60 * 1000,
      options.windowAfterMinutes * 60 * 1000
    );

    if (!window.shouldRefresh) {
      githubOutput('within_window', 'false');
      githubOutput('changed', 'false');
      console.log(`Outside FIFA schedule refresh window; skipping provider call (${window.reason}).`);
      return;
    }

    githubOutput('within_window', 'true');
    console.log(`Refreshing FIFA schedule: ${window.reason}.`);
  }

  const res = await fetch(FIFA_SCHEDULE_URL, {
    headers: {
      accept: 'application/json',
      'user-agent': 'FriendlyBet schedule snapshot (+https://friendlybet.live)'
    }
  });
  if (!res.ok) throw new Error(`FIFA schedule fetch failed: ${res.status}`);
  const payload = await res.json();
  const rows = (payload.Results || []).map(transform).sort((a, b) => {
    const at = Date.parse(a.match_date || '') || 0;
    const bt = Date.parse(b.match_date || '') || 0;
    return at - bt || (a.match_number || 0) - (b.match_number || 0);
  });
  if (rows.length !== 104) throw new Error(`Expected 104 FIFA World Cup matches, got ${rows.length}`);
  validatePlacementStages(rows);

  const stableOut = {
    source: FIFA_SCHEDULE_URL,
    sourcePage: FIFA_PAGE_URL,
    count: rows.length,
    matches: rows
  };

  if (existing && stableSnapshot(existing) === stableSnapshot(stableOut)) {
    githubOutput('changed', 'false');
    console.log(`FIFA schedule unchanged; left ${path.relative(ROOT, OUT_PATH)} untouched.`);
    return;
  }

  const out = {
    updatedAt: new Date().toISOString(),
    ...stableOut
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
  githubOutput('changed', 'true');
  console.log(`Wrote ${rows.length} FIFA schedule rows to ${path.relative(ROOT, OUT_PATH)}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { stageCode, transform, validatePlacementStages };
