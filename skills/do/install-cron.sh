#!/bin/sh
# install-cron.sh - install (or print) a ~daily crontab line that runs
# todo_check_ready.py for the current project.
#
# Usage:
#   install-cron.sh             # install the line for $PWD (idempotent)
#   install-cron.sh --print     # just print the line, do not touch crontab
#   install-cron.sh --project /path/to/proj   # target a specific project
#
# The line is tagged with a marker comment that embeds the project dir so it
# can be matched and replaced idempotently across runs.
set -eu

PRINT_ONLY=0
PROJECT_DIR="$PWD"

while [ $# -gt 0 ]; do
  case "$1" in
    --print) PRINT_ONLY=1; shift ;;
    --project)
      [ $# -ge 2 ] || { echo "install-cron.sh: --project needs a value" >&2; exit 2; }
      PROJECT_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,12p' "$0"; exit 0 ;;
    *)
      echo "install-cron.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

# Resolve to an absolute path.
PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd || echo "$PROJECT_DIR")"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHECKER="$SCRIPT_DIR/todo_check_ready.py"

# Prefer python3, fall back to python.
PYTHON="$(command -v python3 || command -v python || echo python3)"

# Marker keys this line to the project so re-runs replace rather than duplicate.
MARKER="# ai-slash-commands:do ${PROJECT_DIR}"

# ~daily: 09:17 every day (minute chosen off the :00/:30 mark).
SCHEDULE="17 9 * * *"
CRON_LINE="${SCHEDULE} cd \"${PROJECT_DIR}\" && DO_PROJECT_DIR=\"${PROJECT_DIR}\" \"${PYTHON}\" \"${CHECKER}\" ${MARKER}"

if [ "$PRINT_ONLY" -eq 1 ]; then
  echo "$CRON_LINE"
  exit 0
fi

# Idempotent install: drop any existing line for this project, then append.
EXISTING="$(crontab -l 2>/dev/null || true)"
NEW="$(printf '%s\n' "$EXISTING" | grep -v -F "$MARKER" || true)"
{
  printf '%s\n' "$NEW" | sed '/^$/d'
  printf '%s\n' "$CRON_LINE"
} | crontab -

echo "Installed daily TODO check for ${PROJECT_DIR}:"
echo "  $CRON_LINE"
