# commit - make a commit

Act as a senior software engineer to commit changes to the repository in this format:
"$type${[(scope)]}{[!]}: $description"
# Notes:
# - Square brackets [] indicate optional parts.
# - "!" marks a breaking change.

Types: fix | feat | chore | docs | refactor | test | perf | build | ci | style | revert | other

Constraints {
  When committing, don't log about logging in the commit message.
  Use multiple -m flags, one for each log entry.
  Limit the first commit message line to 50 characters.
  Use conventional commits with a scope, title, and body.
}

If there are tests in project, run them before committing.
