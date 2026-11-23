#!/usr/bin/env bash
# Runs a command and prints its output only if it fails, so a hook job that passes says nothing.
set -uo pipefail
out=$("$@" 2>&1) || {
  status=$?
  printf '%s\n' "$out" >&2
  exit "$status"
}
