# Релиз новой версии

Версии — CalVer в формате `год.месяц.день` (без ведущих нулей): тег `v2026.5.28`.
Changelog и GitHub-релиз генерируются из conventional commits через
[git-cliff](https://git-cliff.org/) (`cliff.toml`).

## Быстрый способ (рекомендуется)

```bash
npm run release           # bump версии + changelog + коммит + тег (локально)
git push && git push origin "v$(npm run --silent version:today)"
```

Или одной командой с пушем (сразу запускает GitHub-релиз):

```bash
npm run release -- --push
```

Перед запуском рабочее дерево должно быть чистым — `npm run release` откажется
работать с незакоммиченными изменениями. Проверить, что получится, без изменений:

```bash
npm run release -- --dry-run
```

## Что делает релиз

1. Считает версию на сегодня: `npm run version:today` → `2026.5.28`
   (если тег `v2026.5.28` уже есть, добавит патч: `2026.5.28.1`).
2. Записывает её в `package.json`.
3. Перегенерирует `CHANGELOG.md` (git-cliff). Коммит `chore(release): ...`
   в changelog не попадает — он отфильтрован в `cliff.toml`.
4. Делает коммит и тег `vГГГГ.М.Д`.
5. С `--push` пушит ветку и тег.

## Что происходит после пуша тега

Пуш тега `v*` запускает `.github/workflows/release.yml`:
1. git-cliff формирует release notes для последнего тега (`--latest`), и
   `softprops/action-gh-release` создаёт GitHub-релиз с этим описанием.
2. Пакет публикуется в npm: `npm ci` + `npm publish --provenance --access public`.

Версия в npm берётся из `package.json`, поэтому `npm run release` (который её
бампит) должен пройти до пуша тега.

После релиза можно дать ему человекочитаемое имя:

```bash
gh release view v2026.5.28 --json body          # посмотреть notes
gh release edit v2026.5.28 --title "v2026.5.28: <главная фича>"
```

## Публикация в npm

В CI публикация автоматическая (см. выше), но требует **секрет `NPM_TOKEN`** в
настройках репозитория (Settings → Secrets and variables → Actions). Токен —
npm **Automation** token (обходит 2FA):

```bash
# создать токен: npmjs.com → Access Tokens → Generate → Automation
gh secret set NPM_TOKEN          # вставить токен в prompt
```

Ручная публикация (если CI недоступен или токена нет):

```bash
npm whoami        # должен показать пользователя; если нет — npm login
npm publish --provenance --access public
```

`npm publish` запускает скрипт `prepare` (husky), поэтому в чистом окружении
сначала `npm ci`. В тарбол попадают только `scripts/`, `prompts/`, `skills/`
(без тестов и `__pycache__`), `README.md`, `CHANGELOG.md` — см. `.npmignore`.

## Ручной способ целиком (без скрипта)

```bash
VERSION=$(npm run --silent version:today)        # напр. 2026.5.28
npm pkg set version="$VERSION"
npm run changelog
git add package.json CHANGELOG.md
git commit -m "chore(release): v$VERSION"
git tag "v$VERSION"
git push && git push origin "v$VERSION"           # CI создаст релиз и опубликует в npm
# или вручную: npm publish --provenance --access public
```

## Примечания

- Conventional commits обязательны, чтобы попасть в changelog: `feat:`, `fix:`,
  `docs:`, `chore:`, `task:`, `refactor:`, `perf:`, `test:` и т.д. Неконвенциональные
  коммиты git-cliff пропускает.
- Pre-commit hook (husky) на каждом коммите перегенерирует `CHANGELOG.md`, так что
  раздел Unreleased всегда актуален.
- Старые теги `vГГГГ.М.PATCH` (`v2026.2.1` и т.п.) остаются в changelog; новая схема
  `год.месяц.день` применяется только к новым релизам.
