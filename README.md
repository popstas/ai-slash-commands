# ai-slash-commands

A tool for managing AI slash commands and prompts across multiple AI-powered editors. Write prompts once in markdown, and install them to Claude Code, Cursor, Windsurf, Codex, OpenCode, and Google Antigravity.

**Quick start:**
```bash
npx ai-slash-commands
```

[Prompts list](prompts/)

Some of commands was copied from:
- https://github.com/hamzafer/cursor-commands

Один набор markdown-промптов в `./prompts/*.md`, генерация в `./dist/**` и установка в домашние папки для:
- Claude Code
- Cursor
- Windsurf (через линк в текущий workspace)
- Codex (custom prompts)
- OpenCode
- Google Antigravity

## Почему так
- Источник истины - только prompt (markdown).  
- `id`/имя команды вычисляется из имени файла (`prompts/<name>.md`).
- Всё сгенерированное лежит только в `dist/`.

## Требования
- Node.js 18+ (Windows / Ubuntu)

## Быстрый старт
1) Добавь промпты в `prompts/*.md`

2) Сгенерируй в dist:
```bash
npm run gen
```

3) Установи в домашние папки:
```bash
npm run install-configs
```

## NPX
По умолчанию можно установить команды из встроенной папки `./prompts`:
```bash
npx ai-slash-commands
```

Можно установить команды из любой папки с `*.md` файлами:
```bash
npx ai-slash-commands ./path/to/commands
```

Опционально можно ограничить список целей:
```bash
npx ai-slash-commands ./path/to/commands --targets claude,cursor
```

## Windsurf: важный момент
Официально workflows подхватываются из `.windsurf/workflows` внутри workspace.  
Глобальная папка workflows в home в доках не описана, поэтому тут используется компромисс:
- хранение в `~/.windsurf/workflows`
- линк в конкретный репозиторий/папку workspace

Сделать линк для текущей папки:
```bash
npm run link:windsurf
```

## Скрипты
- `npm run gen` - копирует `prompts/*.md` в:
  - `dist/claude/commands/*.md`
  - `dist/cursor/commands/*.md`
  - `dist/windsurf/workflows/*.md`
  - `dist/codex/prompts/*.md`
  - `dist/opencode/commands/*.md`
  - `dist/antigravity/commands/*.md`

- `npm run install-configs` - копирует из `dist/**` в:
  - `~/.claude/commands`
  - `~/.cursor/commands`
  - `~/.windsurf/workflows` (хранилище, дальше линк)
  - `${CODEX_HOME:-~/.codex}/prompts`
  - `~/.config/opencode/commands`
  - `~/.gemini/antigravity/global_workflows`

- `npm run uninstall` - удаляет из целевых папок файлы команд, перечисленные в `dist/**`

- `npm run link:windsurf` - делает `.windsurf/workflows` -> `~/.windsurf/workflows` (symlink/junction)

- `npm run changelog` - перегенерирует `CHANGELOG.md` из conventional commits (git-cliff)

- `npm run version:today` - печатает версию релиза на сегодня в формате `год.месяц.день` (например `2026.5.28`). При повторном релизе в тот же день добавляет патч: `2026.5.28.1`

- `npm run release` - локально готовит релиз: bump `package.json`, обновляет `CHANGELOG.md`, коммит и тег `vГГГГ.М.Д`. Не пушит. Флаг `--push` — запушить ветку и тег (запускает GitHub-релиз), `--dry-run` — показать шаги без изменений

См. [docs/RELEASING.md](docs/RELEASING.md) — как выпустить новую версию.

## Skills

Помимо промптов (`prompts/*.md`), репозиторий содержит **скиллы** в `skills/<name>/SKILL.md`.
Скилл — это директория с `SKILL.md` (frontmatter `--- name / description ---`) и любыми
вспомогательными файлами (скрипты, тесты). При `npm run gen` каждый скилл:

- копируется целиком в `dist/claude/skills/<name>/` (Claude Code умеет скиллы нативно);
- превращается в command-shim `dist/<target>/<commandsDir>/<name>.md` для **всех** целей
  (frontmatter срезается, первой строкой добавляется `# <name> - <description>`), так что
  `/do`, `/commit` доступны во всех редакторах.

`npm run install-configs` копирует `dist/claude/skills/` → `~/.claude/skills/` (сохраняя
исполняемый бит у `*.py` / `*.sh` / `telegram-send`), а `npm run uninstall` их удаляет.

### Скилл `do`

`do` превращает `docs/TODO.md` проекта в автономный цикл «планируй и кодь»:

- **cron** — `skills/do/todo_check_ready.py` (только stdlib) ~раз в день решает, накопилось ли
  достаточно задач, и при готовности шлёт Telegram-нудж с командой/ссылкой, открывающей Claude в
  проекте и запускающей `/ralphex:ralphex-adopt docs/TODO.md`;
- **вручную** — `/do` оценивает список задач, может запустить ralphex-adopt → ralphex и
  редактировать список (`do add` / `do remove`, коммиты с префиксом `task:`).

Требуемые env: `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`; опционально `DO_TODO_PATH`, `DO_PROJECT_DIR`,
`DO_MIN_TASKS`, `DO_STATE_DIR`, `DO_AGENT`, `DO_LAUNCH_AGENT`. Установка cron-строки:
`sh skills/do/install-cron.sh` (или `--print`). Подробности — в
[`skills/do/README.md`](skills/do/README.md) и [`skills/do/SKILL.md`](skills/do/SKILL.md).

### Скилл `todo-review`

`todo-review` — read-only обзор по всем проектам: сканирует git-проекты в `~/projects`, находит
`docs/TODO.md`, печатает путь и полное содержимое каждого файла и выводит итоговую сводку (счётчики
+ короткий вывод), ничего не редактируя. Дополняет `do`: показывает, где накопились задачи, а
запуск работы оставляет за `/do`. Подробности — в [`skills/todo-review/SKILL.md`](skills/todo-review/SKILL.md).

## Примечания по папкам (ссылки на доки)
- Claude Code personal commands: `~/.claude/commands`
- Cursor global commands: `~/.cursor/commands`
- Codex custom prompts: `~/.codex/prompts` (или `$CODEX_HOME/prompts`)
- Windsurf workflows: `.windsurf/workflows` (workspace-level)
- OpenCode commands: `~/.config/opencode/commands`
- Google Antigravity commands: `~/.gemini/antigravity/global_workflows`
