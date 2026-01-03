# ai-slash-commands-home

Один набор markdown-промптов в `./prompts/*.md`, генерация в `./dist/**` и установка в домашние папки для:
- Claude Code
- Cursor
- Windsurf (через линк в текущий workspace)
- Codex (custom prompts)

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
npm run install
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

- `npm run install` - копирует из `dist/**` в:
  - `~/.claude/commands`
  - `~/.cursor/commands`
  - `~/.windsurf/workflows` (хранилище, дальше линк)
  - `${CODEX_HOME:-~/.codex}/prompts`

- `npm run link:windsurf` - делает `.windsurf/workflows` -> `~/.windsurf/workflows` (symlink/junction)

## Примечания по папкам (ссылки на доки)
- Claude Code personal commands: `~/.claude/commands`
- Cursor global commands: `~/.cursor/commands`
- Codex custom prompts: `~/.codex/prompts` (или `$CODEX_HOME/prompts`)
- Windsurf workflows: `.windsurf/workflows` (workspace-level)
