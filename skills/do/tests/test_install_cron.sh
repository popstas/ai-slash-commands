#!/bin/sh
# Tests for install-cron.sh --print: must emit a valid 5-field cron line
# that targets the given project and invokes todo_check_ready.py.
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL="$SCRIPT_DIR/../install-cron.sh"
FAILED=0

fail() { echo "FAIL: $1" >&2; FAILED=1; }
pass() { echo "ok: $1"; }

PROJ="/tmp/some-project"
line="$($INSTALL --print --project "$PROJ")"

# 1. The schedule prefix is a valid 5-field cron spec.
fields="$(printf '%s\n' "$line" | awk '{print $1, $2, $3, $4, $5}')"
case "$fields" in
  *' '*' '*' '*' '*) pass "five schedule fields present" ;;
  *) fail "schedule does not have five fields: $line" ;;
esac

# Each of the five fields must be a cron token (digit, *, range, list, step).
# Disable globbing so a bare '*' field is not expanded into filenames.
set -f
i=1
for f in $(printf '%s\n' "$line" | awk '{print $1, $2, $3, $4, $5}'); do
  case "$f" in
    *[!0-9*/,-]*) fail "field $i not a cron token: '$f'" ;;
    "") fail "field $i empty" ;;
    *) : ;;
  esac
  i=$((i + 1))
  [ "$i" -gt 5 ] && break
done
set +f
[ "$FAILED" -eq 0 ] && pass "all five fields are cron tokens"

# 2. The command targets the project and the checker script.
case "$line" in
  *"$PROJ"*) pass "project dir present" ;;
  *) fail "project dir missing: $line" ;;
esac
case "$line" in
  *"todo_check_ready.py"*) pass "checker script present" ;;
  *) fail "checker script missing: $line" ;;
esac

# 3. The marker comment is present for idempotent replacement.
case "$line" in
  *"# ai-slash-commands:do $PROJ"*) pass "idempotency marker present" ;;
  *) fail "marker missing: $line" ;;
esac

# 4. --print must not produce more than one line.
n="$(printf '%s\n' "$line" | wc -l | tr -d ' ')"
[ "$n" = "1" ] && pass "single line emitted" || fail "expected one line, got $n"

# 5. A project path containing spaces must be quoted so the cron command
#    cd's into the right directory instead of splitting on the space.
SPACED="/tmp/space dir/proj"
sline="$($INSTALL --print --project "$SPACED")"
case "$sline" in
  *"cd \"$SPACED\""*) pass "spaced project dir is quoted in cd" ;;
  *) fail "spaced project dir not quoted: $sline" ;;
esac
case "$sline" in
  *"DO_PROJECT_DIR=\"$SPACED\""*) pass "spaced DO_PROJECT_DIR is quoted" ;;
  *) fail "spaced DO_PROJECT_DIR not quoted: $sline" ;;
esac

if [ "$FAILED" -eq 0 ]; then
  echo "All install-cron tests passed."
  exit 0
fi
echo "install-cron tests FAILED." >&2
exit 1
