import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");

const home = os.homedir();

// Uninstall locations (home-based)
const DEST = {
  claude:   path.join(home, ".claude", "commands"),
  cursor:   path.join(home, ".cursor", "commands"),
  // Windsurf does not (currently) document a global workflows directory.
  // We install to ~/.windsurf/workflows and provide a separate link script
  // to link this folder into the current workspace as .windsurf/workflows.
  windsurf: path.join(home, ".windsurf", "workflows"),
  // Codex supports CODEX_HOME (defaults to ~/.codex). Prompts live under $CODEX_HOME/prompts.
  codex:    path.join(process.env.CODEX_HOME ?? path.join(home, ".codex"), "prompts"),
  opencode: path.join(home, ".config", "opencode", "commands"),
  // Must mirror install-configs.mjs so uninstall removes what install created.
  antigravity: path.join(home, ".gemini", "antigravity", "global_workflows"),
};

const SRC = {
  claude:   path.join(distDir, "claude", "commands"),
  cursor:   path.join(distDir, "cursor", "commands"),
  windsurf: path.join(distDir, "windsurf", "workflows"),
  codex:    path.join(distDir, "codex", "prompts"),
  opencode: path.join(distDir, "opencode", "commands"),
  antigravity: path.join(distDir, "antigravity", "commands"),
};

// Skills are Claude-native and ship as whole directories.
const SKILLS_SRC = path.join(distDir, "claude", "skills");
const SKILLS_DEST = path.join(home, ".claude", "skills");

async function listMd(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".md"))
      .map(e => e.name);
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function removeAll(srcDir, dstDir) {
  const files = await listMd(srcDir);
  let removed = 0;

  for (const f of files) {
    const dstPath = path.join(dstDir, f);
    try {
      await fs.unlink(dstPath);
      removed += 1;
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  return { removed, total: files.length };
}

async function listSkillDirs(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

// Remove installed skill dirs that mirror dist/claude/skills/<name>/.
export async function uninstallSkills() {
  const names = await listSkillDirs(SKILLS_SRC);
  let removed = 0;
  for (const name of names) {
    const dst = path.join(SKILLS_DEST, name);
    try {
      await fs.rm(dst, { recursive: true, force: true });
      removed += 1;
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  console.log(`claude: removed ${removed}/${names.length} skill(s) from ${SKILLS_DEST}`);
  return removed;
}

function parseArgs() {
  const idx = process.argv.indexOf("--targets");
  const raw = idx >= 0 ? process.argv[idx + 1] : "claude,cursor,windsurf,codex,opencode,antigravity";
  const targets = raw.split(",").map(s => s.trim()).filter(Boolean);
  return { targets };
}

export async function uninstall({ targets }) {
  for (const t of targets) {
    if (!SRC[t] || !DEST[t]) {
      console.error(`Unknown target: ${t}. Allowed: ${Object.keys(SRC).join(", ")}`);
      process.exit(1);
    }
  }

  for (const t of targets) {
    const { removed, total } = await removeAll(SRC[t], DEST[t]);
    const note = total === 0 ? " (no source prompts found)" : "";
    console.log(`${t}: removed ${removed}/${total} prompt(s) from ${DEST[t]}${note}`);
  }

  // Skills are Claude-native; remove them whenever the claude target is selected.
  if (targets.includes("claude")) {
    await uninstallSkills();
  }
}

async function main() {
  const { targets } = parseArgs();
  await uninstall({ targets });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
