#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'public-data', 'world-cup-schedule.json');
const FIFA_SCHEDULE_URL = 'https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idCompetition=17&from=2026-06-01&to=2026-07-31';
const FIFA_PAGE_URL = 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=IL&wtw-filter=ALL';

function localized(list, fallback = null) {
  if (!Array.isArray(list)) return fallback;
  const en = list.find(x => String(x.Locale || '').toLowerCase().startsWith('en'));
  return (en && en.Description) || (list[0] && list[0].Description) || fallback;
}

function stageCode(label) {
  const value = String(label || '').toLowerCase();
  if (value.includes('first stage')) return 'GROUP_STAGE';
  if (value.includes('round of 32')) return 'ROUND_OF_32';
  if (value.includes('round of 16')) return 'ROUND_OF_16';
  if (value.includes('quarter')) return 'QUARTER_FINALS';
  if (value.includes('semi')) return 'SEMI_FINALS';
  if (value.includes('third')) return 'THIRD_PLACE';
  if (value.includes('final')) return 'FINAL';
  return 'UNKNOWN';
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
    stage: stageCode(stageName),
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

  const out = {
    updatedAt: new Date().toISOString(),
    source: FIFA_SCHEDULE_URL,
    sourcePage: FIFA_PAGE_URL,
    count: rows.length,
    matches: rows
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${rows.length} FIFA schedule rows to ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
