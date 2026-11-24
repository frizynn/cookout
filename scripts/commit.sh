#!/usr/bin/env bash
# Runs `git commit "$@"`, but first fails a commit that stages nothing, so the pre-commit hook always gets to run (#256).
# lefthook skips every pre-commit job when nothing is staged, so the hook alone can't say so.
# A merge, `--amend`, `--allow-empty` and `--all` may stage nothing beforehand.
set -euo pipefail
allowed=false
for arg in "$@"; do
  case "$arg" in
    --amend | --allow-empty | --all | -a) allowed=true ;;
  esac
done
if [ "$allowed" = false ] && [ ! -f "$(git rev-parse --git-path MERGE_HEAD)" ] && git diff --cached --quiet; then
  echo "nothing staged: run git add first" >&2
  exit 1
fi
exec git commit "$@"
