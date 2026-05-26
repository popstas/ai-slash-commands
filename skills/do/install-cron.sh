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

# Log directory mirrors the checker's default state dir.
LOG_DIR="${DO_STATE_DIR:-$HOME/.cache/ai-slash-commands/do}"
LOG_FILE="${LOG_DIR}/cron.log"

# cron runs with a minimal environment that does not inherit the shell's
# TELEGRAM_* vars, so embed them into the line when they are set at install
# time. Without them the checker can never send the nudge it exists to send.
ENV_PREFIX="DO_PROJECT_DIR=\"${PROJECT_DIR}\""
if [ -n "${TELEGRAM_TOKEN:-}" ]; then
  ENV_PREFIX="TELEGRAM_TOKEN=\"${TELEGRAM_TOKEN}\" ${ENV_PREFIX}"
fi
if [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  ENV_PREFIX="TELEGRAM_CHAT_ID=\"${TELEGRAM_CHAT_ID}\" ${ENV_PREFIX}"
fi
if [ -z "${TELEGRAM_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "install-cron.sh: warning: TELEGRAM_TOKEN / TELEGRAM_CHAT_ID not set in" \
       "the current environment, so the cron line will not be able to send a" \
       "notification. Re-run with them exported, or edit the crontab line to" \
       "add them." >&2
fi

# ~daily: 09:17 every day (minute chosen off the :00/:30 mark).
SCHEDULE="17 9 * * *"
CRON_LINE="${SCHEDULE} cd \"${PROJECT_DIR}\" && ${ENV_PREFIX} \"${PYTHON}\" \"${CHECKER}\" >> \"${LOG_FILE}\" 2>&1 ${MARKER}"

if [ "$PRINT_ONLY" -eq 1 ]; then
  echo "$CRON_LINE"
  exit 0
fi

# The redirect appends to LOG_FILE, so its directory must exist before cron
# runs the line, otherwise the whole command fails before the checker starts.
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Idempotent install: drop any existing line for this project, then append.
# Match the marker as an exact line *suffix* (not a substring): a plain
# substring match would treat "...do /tmp/proj" as present in a sibling line
# "...do /tmp/proj-extra" and wipe out that other project's cron entry.
EXISTING="$(crontab -l 2>/dev/null || true)"
NEW="$(printf '%s\n' "$EXISTING" | awk -v m="$MARKER" \
  'length($0) < length(m) || substr($0, length($0) - length(m) + 1) != m' || true)"
{
  printf '%s\n' "$NEW" | sed '/^$/d'
  printf '%s\n' "$CRON_LINE"
} | crontab -

echo "Installed daily TODO check for ${PROJECT_DIR}:"
echo "  $CRON_LINE"
