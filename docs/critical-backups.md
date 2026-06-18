# Critical Backups

FriendlyBet writes an encrypted critical-data backup after match results are
finalized and the scoring workflow runs.

The GitHub Actions `calculate-scores-v2` workflow runs:

```bash
node scripts/backup-critical-data.js
```

The backup includes the mutable and recovery-critical tables: pools, users,
pick tables, `pick_backups`, reopen grants, matches, teams, and players. Files
are encrypted with `BACKUP_ENCRYPTION_KEY` and committed under
`private-backups/`; `manifest.json` records which final matches already have a
backup so the job is idempotent.

To enable production backups, add a GitHub Actions repository secret named
`BACKUP_ENCRYPTION_KEY`. Use a long random passphrase, or a base64-encoded
32-byte key.

Manual local copy:

```powershell
$env:SUPABASE_SECRET_KEY="..."
$env:BACKUP_ENCRYPTION_KEY="..."
$env:BACKUP_OUT_DIR="C:\Users\user\Documents\FriendlyBetBackups"
node scripts/backup-critical-data.js --force
```

Manual GitHub test before kickoff:

1. Open `Actions` -> `Calculate User Scores (v2)`.
2. Click `Run workflow`.
3. Enable `force_backup`.
4. Run it. This creates an encrypted `baseline` backup even if no match has
   finished yet.

Plaintext local exports are blocked by default. For an emergency offline export
only, set `BACKUP_ALLOW_PLAINTEXT=1` and omit `BACKUP_ENCRYPTION_KEY`.
