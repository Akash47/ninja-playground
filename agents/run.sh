#!/bin/bash
# One agent per project, looping forever. Each reads its task from TASKS.md and works ONLY inside its project dir.
# Needs the `claude` CLI. Add --permission-mode / allowedTools to taste; not skipping permissions by default.
cd "$(dirname "$0")/.."
while true; do
  node agents/watch.js >/dev/null
  for d in projects/*/; do
    n=$(basename "$d")
    (cd "$d" && claude -p "You are the owner-agent of project '$n'. Your task from ../../agents/TASKS.md: $(grep "\*\*$n\*\*" ../../agents/TASKS.md). Make ONE small improvement in this folder, keep it silly, minimal, no new deps. Summarize what you did in one line." >> ../../agents/log.txt 2>&1)
  done
  sleep "${INTERVAL:-3600}"
done
