const TEAM_CODE_ALIASES = {
  CUW: 'CUR',
  KSA: 'SAU',
};

function normalizeStoryTeamCode(code) {
  const value = String(code || '').trim().toUpperCase();
  return TEAM_CODE_ALIASES[value] || value;
}

function storyCoverageKey(match) {
  if (!match) return '';
  const date = String(match.match_date || match.utc_date || '').slice(0, 10);
  const home = normalizeStoryTeamCode(match.home_team_code);
  const away = normalizeStoryTeamCode(match.away_team_code);
  if (!date || !home || !away) return '';
  const homeScore = match.home_score == null ? '' : String(Number(match.home_score));
  const awayScore = match.away_score == null ? '' : String(Number(match.away_score));
  return `${date}|${home}-${away}|${homeScore}-${awayScore}`;
}

function storyItemCoverageKey(story, matchesById = new Map()) {
  const matchId = story && story.match_id != null ? String(story.match_id) : '';
  const sourceMatch = matchId ? matchesById.get(matchId) : null;
  if (sourceMatch) return storyCoverageKey(sourceMatch);

  const teams = Array.isArray(story && story.teams) ? story.teams : [];
  if (teams.length < 2) return '';
  const result = String(story && story.result || '');
  const score = result.match(/\b(\d+)\s*-\s*(\d+)\b/);
  return storyCoverageKey({
    match_date: String(story && story.id || '').match(/\d{4}-\d{2}-\d{2}/)?.[0] || '',
    home_team_code: teams[0],
    away_team_code: teams[1],
    home_score: score ? score[1] : null,
    away_score: score ? score[2] : null,
  });
}

function storyCoverageSet(stories, matches = []) {
  const matchesById = new Map((matches || [])
    .filter(match => match && match.id != null)
    .map(match => [String(match.id), match]));
  const covered = new Set();
  for (const story of stories || []) {
    if (!story) continue;
    if (story.match_id != null) covered.add(String(story.match_id));
    const key = storyItemCoverageKey(story, matchesById);
    if (key) covered.add(key);
  }
  return covered;
}

function storyCoversMatch(covered, match) {
  if (!covered || typeof covered.has !== 'function') return false;
  if (!match) return false;
  if (match.id != null && covered.has(String(match.id))) return true;
  const key = storyCoverageKey(match);
  return Boolean(key && covered.has(key));
}

module.exports = {
  normalizeStoryTeamCode,
  storyCoverageKey,
  storyCoverageSet,
  storyCoversMatch,
};
