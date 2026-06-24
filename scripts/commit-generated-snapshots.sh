#!/usr/bin/env bash
set -euo pipefail

message="${1:-}"
if [ -z "$message" ]; then
  echo "::error::missing commit message"
  exit 1
fi
shift

if [ "$#" -eq 0 ]; then
  echo "::error::missing generated snapshot paths"
  exit 1
fi

paths=("$@")

has_changes() {
  [ -n "$(git status --porcelain -- "${paths[@]}")" ]
}

run_regenerate_commands() {
  if [ -z "${REGENERATE_COMMANDS:-}" ]; then
    return 0
  fi

  while IFS= read -r command; do
    [ -z "$command" ] && continue
    echo "+ $command"
    eval "$command"
  done <<< "$REGENERATE_COMMANDS"
}

commit_current_changes() {
  git add -- "${paths[@]}"
  git commit -q -m "$message"
}

abort_rebase_if_needed() {
  git rebase --abort >/dev/null 2>&1 || true
}

if ! has_changes; then
  echo "no generated snapshot change"
  exit 0
fi

commit_current_changes

for attempt in 1 2 3; do
  if [ "$attempt" -gt 1 ]; then
    abort_rebase_if_needed
    git fetch origin main
    git reset --hard origin/main
    run_regenerate_commands
    if ! has_changes; then
      echo "generated snapshots already match origin/main after regeneration"
      exit 0
    fi
    commit_current_changes
  fi

  if git pull --rebase --autostash && git push; then
    exit 0
  fi

  echo "generated snapshot push retry $attempt"
  abort_rebase_if_needed
  sleep 4
done

echo "::error::failed to push generated snapshots after regeneration retries"
exit 1
