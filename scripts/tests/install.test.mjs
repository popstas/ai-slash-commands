import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const promptsDir = path.join(repoRoot, "prompts");

let tmpHome;
let originalHome;

before(async () => {
  // os.homedir() (via libuv uv_os_homedir) honors $HOME on POSIX, and the
  // install module computes its DEST/SKILLS_DEST from os.homedir() at import
  // time — so HOME must be set before the dynamic import below.
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "asc-install-"));
  originalHome = process.env.HOME;
  process.env.HOME = tmpHome;
});

after(async () => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  if (tmpHome) {
    await fs.rm(tmpHome, { recursive: true, force: true });
  }
});

test("gen + install lands the do skill and command shim in a temp HOME", async () => {
  const { generate } = await import("../gen.mjs");
  const { install } = await import("../install-configs.mjs");

  await generate({ targets: ["claude"], promptsDir });
  await install({ targets: ["claude"] });

  const skillDir = path.join(tmpHome, ".claude", "skills", "do");

  // SKILL.md present
  const skillMd = path.join(skillDir, "SKILL.md");
  const skillStat = await fs.stat(skillMd);
  assert.ok(skillStat.isFile(), "SKILL.md should be installed");

  // todo_check_ready.py present and executable for the owner
  const py = path.join(skillDir, "todo_check_ready.py");
  const pyStat = await fs.stat(py);
  assert.ok(pyStat.isFile(), "todo_check_ready.py should be installed");
  assert.ok((pyStat.mode & 0o100) !== 0, "todo_check_ready.py should stay executable");

  // telegram-send wrapper preserved executable
  const tg = path.join(skillDir, "telegram-send");
  const tgStat = await fs.stat(tg);
  assert.ok((tgStat.mode & 0o100) !== 0, "telegram-send should stay executable");

  // command shim installed for claude
  const shim = path.join(tmpHome, ".claude", "commands", "do.md");
  const shimContent = await fs.readFile(shim, "utf8");
  assert.ok(shimContent.startsWith("# do -"), "do.md shim should start with the H1 line");
});

test("uninstall removes the installed skill dir", async () => {
  const { uninstall } = await import("../uninstall.mjs");

  const skillDir = path.join(tmpHome, ".claude", "skills", "do");
  // sanity: present before uninstall (installed by the previous test)
  await fs.stat(skillDir);

  await uninstall({ targets: ["claude"] });

  await assert.rejects(
    () => fs.stat(skillDir),
    (err) => err.code === "ENOENT",
    "skill dir should be gone after uninstall",
  );
});
