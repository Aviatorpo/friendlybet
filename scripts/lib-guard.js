// ============================================================
// Shared write-safety guard for server-side Supabase REST helpers
// ============================================================
// Added after the 2026-06-10 incident: scripts/sync-teams.js DELETEd ALL
// knockout_picks + group_picks on EVERY run (leftover disposable-test-data code),
// wiping ~32k live user brackets twice in one morning. No scheduled sync/score job
// has any business DELETEing user-prediction or account tables. If one tries — even
// via revived old code — fail HARD and loud instead of silently destroying data.
//
// Drop-in: require this and call fbGuardDelete(method, table) at the top of every
// callSupabase()-style REST helper. It is a no-op for non-DELETE methods and for
// non-protected tables (teams/players/matches/etc. that sync jobs legitimately
// manage), so it never blocks normal syncing.

const FB_PROTECTED_TABLES = new Set([
  'knockout_picks',
  'group_picks',
  'group_position_picks',
  'tournament_winner_picks',
  'top_scorer_picks',
  'sp_third_place_picks',
  'pick_backups',
  'users',
  'pools',
]);

function fbGuardDelete(method, table) {
  if (String(method).toUpperCase() === 'DELETE' && FB_PROTECTED_TABLES.has(table)) {
    throw new Error(
      `[fb-guard] Refusing DELETE on protected user-data table "${table}". ` +
      `Sync/score jobs must NEVER delete user predictions or accounts ` +
      `(post-2026-06-10 sync-teams wipe). If a row truly must be removed, do it ` +
      `through a scoped SECURITY DEFINER RPC, not a blanket REST DELETE.`
    );
  }
}

module.exports = { fbGuardDelete, FB_PROTECTED_TABLES };
