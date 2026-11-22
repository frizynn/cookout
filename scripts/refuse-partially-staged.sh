#!/usr/bin/env bash
set -euo pipefail
partial=$(comm -12 <(git diff --name-only | sort) <(git diff --cached --name-only | sort))
[ -z "$partial" ] || { echo "Partially staged: $partial" >&2; exit 1; }
backup="lefthook auto backup - $(basename "$(git rev-parse --show-toplevel)")"
if git stash list --format=%gs | grep -qxF "$backup"; then
  echo "Partially staged files: stage or revert each file's unstaged changes, then commit again." >&2
  exit 1
fi
