# Port the todo-review skill into ai-slash-commands

## Overview

Bring the existing `todo-review` skill — a read-only, cross-project overview that scans every git
project under `~/projects` for a `docs/TODO.md`, prints each file's path and full content, and
writes a status summary — out of the private Obsidian vault and into this repo's `skills/`
directory so it is built and distributed like `do` and `commit`. After this work, `/todo-review`
is available in every editor target the repo generates for. This is a verbatim port (no behavior
change) plus the docs/TODO bookkeeping that records the task as done.

## Context

- New file: `skills/todo-review/SKILL.md` (prompt-only skill, no scripts/tests — mirrors `commit`).
- Source of truth to copy from: `~/projects/text/obsidian/home/.claude/skills/todo-review/SKILL.md`
  (Russian content preserved verbatim).
- Build pipeline `scripts/gen.mjs::generateSkills` auto-discovers `skills/<name>/`; no code change
  needed for the skill to be picked up. `dist/**` is gitignored.
- Docs to touch: `docs/TODO.md` (remove the now-satisfied task), `README.md` `## Skills` section
  (brief mention next to the `### Скилл do` block).
- Adopted from the in-session free-form plan "Port the todo-review skill into ai-slash-commands".

## Development Approach

- Testing approach: regular. This is a docs/prompt port — there is no application code to unit-test,
  so "tests" here means the repo's existing build + test suite still passes and the skill is
  discovered and shimmed correctly.
- Complete each task fully before moving to the next.
- Update this plan if scope changes during implementation.

## Testing Strategy

- After file changes, run `npm run gen` and confirm `todo-review` appears in the generated skill
  list and produces a command shim.
- Run `npm test` (node + python `do` tests + shell tests) and confirm it still passes.

## Technical Details

- The ported `SKILL.md` keeps frontmatter `name: todo-review` and its existing `description:`
  (trigger phrases: `/todo-review`, "обзор TODO по проектам", "что в TODO у проектов", "собери все
  docs/TODO.md", "статус по всем проектам", "review todos").
- Body sections to preserve verbatim: **Что делать** (1. find files via the
  `find ~/projects -type f -path '*/docs/TODO.md' … [ -e "$d/.git" ]` snippet; 2. print path + full
  content per project via Read; 3. final summary block with counts + 1–2 line takeaway) and
  **Замечания** (do not edit the TODO files; prioritize open items; defer running work to `do`).
- `gen.mjs` strips frontmatter and prepends `# todo-review - <description>` as the shim's first
  line — same path as `do`/`commit`, no special handling required.

## Implementation Steps

### Task 1: Add the todo-review skill file

- [ ] Create `skills/todo-review/SKILL.md` by copying the vault file
      `~/projects/text/obsidian/home/.claude/skills/todo-review/SKILL.md` verbatim (frontmatter +
      "Что делать" + "Замечания"), preserving the Russian content
- [ ] Run `npm run gen` and confirm the console prints `todo-review` in `Generated skills:` and
      that `dist/claude/skills/todo-review/SKILL.md` plus a `dist/claude/commands/todo-review.md`
      shim (H1 `# todo-review - …`) are produced
- [ ] run project tests - `npm test` must pass before next task

### Task 2: Record the task as done and document the skill

- [ ] Remove the completed `- [ ] Create skill todo-review …` item from `docs/TODO.md` (leaving the
      `# TODO` heading), consistent with how completed tasks are dropped
- [ ] Add a short `### Скилл todo-review` note (or one line) in `README.md` `## Skills` next to the
      `### Скилл do` block: cross-project overview of all `docs/TODO.md` in `~/projects`, complements
      `do`
- [ ] run project tests - `npm test` must pass before next task

### Task 3: Verify acceptance criteria

- [ ] Confirm `npm run gen` lists `todo-review` among generated skills and the per-target shims
      exist
- [ ] Run the full project test suite (`npm test`) - must pass
- [ ] Run `npm run install-configs` (or `npm run gen-install`) and confirm
      `~/.claude/skills/todo-review/SKILL.md` exists so `/todo-review` is usable
- [ ] Smoke-test: invoke `/todo-review` and confirm it lists `~/projects` git projects with
      `docs/TODO.md` and prints a summary, editing nothing
- [ ] Verify all requirements from Overview are implemented

## Post-Completion

*Items requiring manual intervention - no checkboxes, informational only*

- Commits follow repo conventions: the skill + README change as a `feat(todo-review): …` commit;
  the `docs/TODO.md` edit as a separate `task:`-prefixed commit (per the `do` skill convention),
  staging only `docs/TODO.md`. Leave the unrelated working-tree change `M skills/do/SKILL.md`
  untouched.
