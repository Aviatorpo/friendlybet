// Shared World Cup 2026 tournament-phase resolver.
// It never fetches. Callers provide match rows/snapshots; stale or partial data
// falls back to conservative copy instead of pretending to know the exact round.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FriendlyBetTournamentContext = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_MATCH_MS = 4 * 60 * 60 * 1000;
  const STALE_UNRESOLVED_GRACE_MS = 15 * 60 * 1000;
  const GROUP_TOTAL = 12;
  const MATCHES_PER_GROUP = 6;
  const ROUND_SEQUENCE = ['R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'];
  const ROUND_META = {
    R32: { order: 1, total: 16, labelKey: 'tournamentContext.round.r32' },
    R16: { order: 2, total: 8, labelKey: 'tournamentContext.round.r16' },
    QF: { order: 3, total: 4, labelKey: 'tournamentContext.round.qf' },
    SF: { order: 4, total: 2, labelKey: 'tournamentContext.round.sf' },
    THIRD_PLACE: { order: 5, total: 1, labelKey: 'tournamentContext.round.thirdPlace' },
    FINAL: { order: 6, total: 1, labelKey: 'tournamentContext.round.final' },
  };

  const FALLBACK_WINDOWS = [
    { round: 'R32', start: '2026-06-28T16:00:00Z', end: '2026-07-04T16:59:59Z' },
    { round: 'R16', start: '2026-07-04T17:00:00Z', end: '2026-07-09T19:59:59Z' },
    { round: 'QF', start: '2026-07-09T20:00:00Z', end: '2026-07-14T18:59:59Z' },
    { round: 'SF', start: '2026-07-14T19:00:00Z', end: '2026-07-18T20:59:59Z' },
    { round: 'THIRD_PLACE', start: '2026-07-18T21:00:00Z', end: '2026-07-19T18:59:59Z' },
    { round: 'FINAL', start: '2026-07-19T19:00:00Z', end: '2026-07-20T03:30:00Z' },
  ].map(item => ({
    round: item.round,
    startMs: Date.parse(item.start),
    endMs: Date.parse(item.end),
  }));

  function nowMs(value) {
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function normalizeStage(stage) {
    return String(stage || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  }

  function roundFromStage(stage) {
    const s = normalizeStage(stage);
    if (!s || s === 'GROUP_STAGE' || s === 'GROUP') return null;
    if (s.includes('ROUND_OF_32') || s === 'R32' || s.includes('ROUND_32')) return 'R32';
    if (s.includes('ROUND_OF_16') || s === 'R16' || s.includes('ROUND_16')) return 'R16';
    if (s.includes('QUARTER')) return 'QF';
    if (s.includes('SEMI')) return 'SF';
    if (s.includes('THIRD') || s.includes('BRONZE')) return 'THIRD_PLACE';
    if (s === 'FINAL' || s === 'FINALS' || /(^|_)FINAL(S)?$/.test(s)) return 'FINAL';
    return null;
  }

  function statusOf(match) {
    return String((match && match.status) || '').toUpperCase();
  }

  function hasNumericScore(match) {
    return match && match.home_score != null && match.away_score != null
      && Number.isFinite(Number(match.home_score))
      && Number.isFinite(Number(match.away_score));
  }

  function isPendingProviderFinal(match) {
    const source = String((match && match.live_source) || '').toLowerCase();
    const detail = String((match && match.status_detail) || '').toLowerCase();
    return source === 'espn-final' || detail.includes('pending verification');
  }

  function isTerminal(match) {
    const status = statusOf(match);
    return status === 'FINISHED' || status === 'AWARDED' || status === 'CANCELLED' || status === 'POSTPONED';
  }

  function isFinishedStatus(match) {
    const status = statusOf(match);
    return (status === 'FINISHED' || status === 'AWARDED') && !isPendingProviderFinal(match);
  }

  function hasVerifiedWinner(match) {
    const round = roundFromStage(match && match.stage);
    if (!round) return true;
    return !!String((match && match.winner_code) || '').trim();
  }

  function isVerifiedFinished(match) {
    if (!isFinishedStatus(match) || !hasNumericScore(match)) return false;
    return hasVerifiedWinner(match);
  }

  function kickoffMs(match) {
    const parsed = Date.parse((match && match.match_date) || '');
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isLiveish(match, now) {
    const status = statusOf(match);
    if (status === 'LIVE' || status === 'IN_PLAY' || status === 'PAUSED') return true;
    if (isTerminal(match)) return false;
    const ko = kickoffMs(match);
    return ko != null && ko <= now && (now - ko) < MAX_MATCH_MS;
  }

  function isRecentUnresolved(match, now) {
    if (isTerminal(match)) return false;
    const ko = kickoffMs(match);
    return ko != null && ko <= now && (now - ko) < (MAX_MATCH_MS + STALE_UNRESOLVED_GRACE_MS);
  }

  function isStaleUnresolved(match, now) {
    if (isVerifiedFinished(match) || isTerminal(match)) return false;
    const ko = kickoffMs(match);
    return ko != null && ko <= now && (now - ko) >= (MAX_MATCH_MS + STALE_UNRESOLVED_GRACE_MS);
  }

  function matchIdentity(match) {
    if (!match) return '';
    if (match.external_id) return `ext:${match.external_id}`;
    const ko = kickoffMs(match);
    const teams = [match.home_team_code || '', match.away_team_code || ''].sort().join('-');
    return [normalizeStage(match.stage), match.group_letter || '', teams, ko || ''].join('|');
  }

  function deriveGroupProgress(matches, provided) {
    if (provided && Number(provided.totalGroups) > 0) return provided;
    const byGroup = new Map();
    (matches || []).forEach(match => {
      if (normalizeStage(match && match.stage) !== 'GROUP_STAGE') return;
      if (!isVerifiedFinished(match)) return;
      const group = String(match.group_letter || match.group || match.group_name || '').replace(/^Group\s+/i, '').trim().charAt(0).toUpperCase();
      if (!group) return;
      if (!byGroup.has(group)) byGroup.set(group, new Set());
      byGroup.get(group).add(matchIdentity(match));
    });
    const sets = Array.from(byGroup.values());
    return {
      finished: sets.reduce((sum, set) => sum + Math.min(set.size, MATCHES_PER_GROUP), 0),
      total: GROUP_TOTAL * MATCHES_PER_GROUP,
      completeGroups: sets.filter(set => set.size >= MATCHES_PER_GROUP).length,
      totalGroups: GROUP_TOTAL,
    };
  }

  function emptyRoundStats(round) {
    return {
      round,
      total: ROUND_META[round].total,
      matches: [],
      knownMatches: 0,
      finished: 0,
      live: 0,
      confirming: 0,
      recentUnresolved: 0,
      staleUnresolved: 0,
      scheduled: 0,
      firstKickoffMs: null,
      lastKickoffMs: null,
      nextKickoffMs: null,
    };
  }

  function updateKickoffs(stats, ko, now) {
    if (ko == null) return;
    stats.firstKickoffMs = stats.firstKickoffMs == null ? ko : Math.min(stats.firstKickoffMs, ko);
    stats.lastKickoffMs = stats.lastKickoffMs == null ? ko : Math.max(stats.lastKickoffMs, ko);
    if (ko > now) stats.nextKickoffMs = stats.nextKickoffMs == null ? ko : Math.min(stats.nextKickoffMs, ko);
  }

  function deriveRoundStats(matches, now) {
    const stats = {};
    ROUND_SEQUENCE.forEach(round => { stats[round] = emptyRoundStats(round); });
    (matches || []).forEach(match => {
      const round = roundFromStage(match && match.stage);
      if (!round) return;
      const item = stats[round];
      item.matches.push(match);
      item.knownMatches += 1;
      const ko = kickoffMs(match);
      updateKickoffs(item, ko, now);
      if (isVerifiedFinished(match)) item.finished += 1;
      else if (isLiveish(match, now)) item.live += 1;
      else if (isPendingProviderFinal(match) || (isFinishedStatus(match) && (!hasNumericScore(match) || !hasVerifiedWinner(match)))) item.confirming += 1;
      else if (isStaleUnresolved(match, now)) item.staleUnresolved += 1;
      else if (isRecentUnresolved(match, now)) item.recentUnresolved += 1;
      else item.scheduled += 1;
    });
    return stats;
  }

  function windowForRound(round, stats) {
    const fallback = FALLBACK_WINDOWS.find(item => item.round === round) || null;
    const firstCandidates = [stats && stats.firstKickoffMs, fallback && fallback.startMs].filter(Number.isFinite);
    const lastCandidates = [stats && stats.lastKickoffMs, fallback && fallback.endMs].filter(Number.isFinite);
    const first = firstCandidates.length ? Math.min.apply(null, firstCandidates) : null;
    const last = lastCandidates.length ? Math.max.apply(null, lastCandidates) : null;
    const startMs = Number.isFinite(first) ? first : null;
    const endMs = Number.isFinite(last) ? Math.max(last + MAX_MATCH_MS, fallback ? fallback.endMs : last + MAX_MATCH_MS) : (fallback && fallback.endMs);
    return { startMs, endMs };
  }

  function roundFromDate(now, statsByRound) {
    for (const round of ROUND_SEQUENCE) {
      const win = windowForRound(round, statsByRound && statsByRound[round]);
      if (win.startMs != null && win.endMs != null && now >= win.startMs && now < win.endMs) return round;
    }
    return null;
  }

  function earliestUpcomingRound(now, statsByRound) {
    let best = null;
    ROUND_SEQUENCE.forEach(round => {
      const stats = statsByRound[round];
      const win = windowForRound(round, stats);
      const next = stats.nextKickoffMs || (win.startMs != null && win.startMs > now ? win.startMs : null);
      if (next != null && next > now && (!best || next < best.nextKickoffMs)) {
        best = { round, nextKickoffMs: next };
      }
    });
    return best && best.round;
  }

  function isRoundComplete(round, statsByRound) {
    const stats = statsByRound[round];
    return stats && stats.finished >= ROUND_META[round].total;
  }

  function earlierRoundsComplete(round, statsByRound) {
    const idx = ROUND_SEQUENCE.indexOf(round);
    if (idx <= 0) return true;
    return ROUND_SEQUENCE.slice(0, idx).every(prev => isRoundComplete(prev, statsByRound));
  }

  function hasEarlierStaleBlock(round, statsByRound) {
    const idx = ROUND_SEQUENCE.indexOf(round);
    if (idx <= 0) return false;
    return ROUND_SEQUENCE.slice(0, idx).some(prev => {
      const stats = statsByRound[prev];
      return stats && stats.staleUnresolved > 0 && !isRoundComplete(prev, statsByRound);
    });
  }

  function genericContext(reason, groupProgress, now) {
    return {
      phase: 'tournamentActive',
      round: null,
      roundState: 'safe',
      confidence: 'safe',
      exact: false,
      stale: reason && reason.indexOf('stale') >= 0,
      reason: reason || 'safe_fallback',
      generatedAt: new Date(now).toISOString(),
      groupProgress,
      roundLabelKey: 'tournamentContext.round.generic',
      dashboard: {
        kickerKey: 'dashboard.tournament.genericKicker',
        badgeKey: 'dashboard.tournament.genericBadge',
        titleKey: 'dashboard.tournament.genericTitle',
        textKey: 'dashboard.tournament.genericText',
        onePhaseTextKey: 'dashboard.tournament.genericText',
      },
      drama: {
        titleKey: 'dashboard.drama.tournamentGeneric.title',
        textKey: 'dashboard.drama.tournamentGeneric.text',
      },
      leaderboardStatusKey: 'leaderboard.statusTournamentGeneric',
      punditKey: 'pundit.tournament.generic',
    };
  }

  function completeContext(groupProgress, now) {
    return {
      phase: 'tournamentComplete',
      round: 'FINAL',
      roundState: 'complete',
      confidence: 'exact',
      exact: true,
      stale: false,
      reason: 'final_verified',
      generatedAt: new Date(now).toISOString(),
      groupProgress,
      roundLabelKey: ROUND_META.FINAL.labelKey,
      completedMatches: 1,
      totalMatches: 1,
      dashboard: {
        kickerKey: 'dashboard.tournament.completeKicker',
        badgeKey: 'dashboard.tournament.completeBadge',
        titleKey: 'dashboard.tournament.completeTitle',
        textKey: 'dashboard.tournament.completeText',
        onePhaseTextKey: 'dashboard.tournament.completeText',
      },
      drama: {
        titleKey: 'dashboard.drama.tournamentComplete.title',
        textKey: 'dashboard.drama.tournamentComplete.text',
      },
      leaderboardStatusKey: 'leaderboard.statusTournamentComplete',
      punditKey: 'pundit.tournament.complete',
    };
  }

  function roundContext(round, roundState, stats, groupProgress, now, reason) {
    const confirming = roundState === 'confirming';
    const upcoming = roundState === 'upcoming';
    return {
      phase: 'knockout',
      round,
      roundState,
      confidence: 'exact',
      exact: true,
      stale: false,
      reason: reason || `round_${roundState}`,
      generatedAt: new Date(now).toISOString(),
      groupProgress,
      roundLabelKey: ROUND_META[round].labelKey,
      completedMatches: stats ? Math.min(stats.finished, ROUND_META[round].total) : 0,
      totalMatches: ROUND_META[round].total,
      nextKickoffMs: stats && stats.nextKickoffMs,
      dashboard: {
        kickerKey: upcoming ? 'dashboard.tournament.upcomingKicker' : 'dashboard.tournament.roundKicker',
        badgeKey: confirming ? 'dashboard.tournament.confirmingBadge' : 'dashboard.tournament.roundBadge',
        titleKey: confirming ? 'dashboard.tournament.confirmingTitle' : (upcoming ? 'dashboard.tournament.upcomingTitle' : 'dashboard.tournament.roundTitle'),
        textKey: confirming ? 'dashboard.tournament.confirmingText' : (upcoming ? 'dashboard.tournament.upcomingText' : 'dashboard.tournament.roundText'),
        onePhaseTextKey: confirming ? 'dashboard.tournament.confirmingText' : (upcoming ? 'dashboard.tournament.upcomingText' : 'dashboard.tournament.roundOnePhaseText'),
      },
      drama: {
        titleKey: confirming ? 'dashboard.drama.tournamentConfirming.title' : (upcoming ? 'dashboard.drama.tournamentUpcoming.title' : 'dashboard.drama.tournamentRound.title'),
        textKey: confirming ? 'dashboard.drama.tournamentConfirming.text' : (upcoming ? 'dashboard.drama.tournamentUpcoming.text' : 'dashboard.drama.tournamentRound.text'),
      },
      leaderboardStatusKey: confirming ? 'leaderboard.statusTournamentConfirming' : (upcoming ? 'leaderboard.statusTournamentUpcoming' : 'leaderboard.statusTournamentRound'),
      punditKey: confirming ? 'pundit.tournament.confirming' : (upcoming ? 'pundit.tournament.upcoming' : 'pundit.tournament.round'),
    };
  }

  function isTournamentMomentUsable(moment, snapshot, nowValue) {
    if (!moment || typeof moment !== 'object') return false;
    const now = nowMs(nowValue);
    const expires = Date.parse(moment.expires_at || '');
    if (!Number.isFinite(expires) || expires <= now) return false;
    if (moment.schema_version != null && Number(moment.schema_version) !== 1) return false;
    if (moment.round && !ROUND_META[moment.round]) return false;
    const snapshotVersion = snapshot && (snapshot.result_version || snapshot.resultVersion);
    if (moment.result_version && snapshotVersion && moment.result_version !== snapshotVersion) return false;
    return true;
  }

  function deriveTournamentContext(input) {
    const opts = input || {};
    const now = nowMs(opts.now);
    const snapshot = opts.matchSnapshot || {};
    const matches = Array.isArray(opts.matches)
      ? opts.matches
      : (Array.isArray(snapshot.matches) ? snapshot.matches : []);
    const groupProgress = deriveGroupProgress(matches, opts.groupProgress);
    const groupsComplete = groupProgress.totalGroups > 0 && groupProgress.completeGroups >= groupProgress.totalGroups;

    if (!groupsComplete) {
      return {
        phase: 'groupStage',
        round: null,
        roundState: 'group',
        confidence: 'exact',
        exact: true,
        stale: false,
        reason: 'groups_not_complete',
        generatedAt: new Date(now).toISOString(),
        groupProgress,
        roundLabelKey: 'tournamentContext.round.groups',
      };
    }

    const statsByRound = deriveRoundStats(matches, now);
    if (isRoundComplete('FINAL', statsByRound)) return completeContext(groupProgress, now);

    let round = ROUND_SEQUENCE.find(item => {
      const stats = statsByRound[item];
      return stats.live > 0 || stats.confirming > 0 || stats.recentUnresolved > 0;
    });
    let reason = round ? 'live_or_confirming_match' : '';
    let roundState = 'live';

    if (!round) {
      round = ROUND_SEQUENCE.find(item => {
        const stats = statsByRound[item];
        return stats.finished > 0 && stats.finished < ROUND_META[item].total && stats.staleUnresolved === 0;
      });
      reason = round ? 'partial_verified_round' : '';
      roundState = 'live';
    }

    if (!round) {
      const dateRound = roundFromDate(now, statsByRound);
      round = dateRound && !isRoundComplete(dateRound, statsByRound) ? dateRound : null;
      reason = round ? 'schedule_window' : '';
      roundState = 'live';
    }

    if (!round) {
      round = earliestUpcomingRound(now, statsByRound);
      reason = round ? 'next_scheduled_round' : '';
      roundState = round ? 'upcoming' : 'safe';
    }

    if (!round || !ROUND_META[round]) return genericContext('no_round_signal', groupProgress, now);
    if (hasEarlierStaleBlock(round, statsByRound)) return genericContext('stale_earlier_round_unresolved', groupProgress, now);

    const stats = statsByRound[round];
    if (!earlierRoundsComplete(round, statsByRound)) {
      return genericContext('earlier_round_not_complete', groupProgress, now);
    }
    if (stats && stats.staleUnresolved > 0) return genericContext('stale_current_round_unresolved', groupProgress, now);
    if (stats && (stats.confirming > 0 || stats.recentUnresolved > 0)) roundState = 'confirming';
    if (stats && stats.finished === 0 && stats.live === 0 && stats.confirming === 0 && stats.recentUnresolved === 0) {
      const win = windowForRound(round, stats);
      if (win.startMs != null && now < win.startMs) roundState = 'upcoming';
    }

    return roundContext(round, roundState, stats, groupProgress, now, reason);
  }

  function buildTournamentMoment(input) {
    const ctx = deriveTournamentContext(input);
    const now = nowMs(input && input.now);
    return {
      schema_version: 1,
      generated_at: new Date(now).toISOString(),
      expires_at: new Date(now + 15 * 60 * 1000).toISOString(),
      result_version: input && input.result_version,
      phase: ctx.phase,
      round: ctx.round,
      round_state: ctx.roundState,
      confidence: ctx.confidence,
      exact: ctx.exact,
      reason: ctx.reason,
      round_label_key: ctx.roundLabelKey,
    };
  }

  return {
    ROUND_SEQUENCE,
    ROUND_META,
    FALLBACK_WINDOWS,
    roundFromStage,
    deriveTournamentContext,
    isTournamentMomentUsable,
    buildTournamentMoment,
  };
});
