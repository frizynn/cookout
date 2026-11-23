#!/usr/bin/env bash
# Fails a commit that stages nothing, so `git commit` without `git add` says so instead of passing silently (#256).
# A merge, `--amend` and `--allow-empty` may stage nothing; the git process that ran the hook is found by walking up.
set -euo pipefail
git diff --cached --quiet || exit 0
[ -f "$(git rev-parse --git-path MERGE_HEAD)" ] && exit 0
pid=$PPID
while [ "$pid" -gt 1 ]; do
  args=$(ps -o args= -p "$pid" 2>/dev/null) || break
  case " $args " in
    *git*" commit "*--amend* | *git*" commit "*--allow-empty*) exit 0 ;;
  esac
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ') || break
done
echo "nothing staged: run git add first" >&2
exit 1
