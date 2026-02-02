import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");

const home = os.homedir();

// Install locations (home-based)
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

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function listMd(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".md"))
      .map(e => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function copyAll(srcDir, dstDir) {
  await ensureDir(dstDir);

  const files = await listMd(srcDir);
  for (const f of files) {
    await fs.copyFile(path.join(srcDir, f), path.join(dstDir, f));
  }
  return files.length;
}

function parseArgs() {
  const idx = process.argv.indexOf("--targets");
  const raw = idx >= 0 ? process.argv[idx + 1] : "claude,cursor,windsurf,codex,opencode,antigravity";
  const targets = raw.split(",").map(s => s.trim()).filter(Boolean);
  return { targets };
}

export async function install({ targets }) {
  for (const t of targets) {
    if (!SRC[t] || !DEST[t]) {
      console.error(`Unknown target: ${t}. Allowed: ${Object.keys(SRC).join(", ")}`);
      process.exit(1);
    }
  }

  for (const t of targets) {
    const count = await copyAll(SRC[t], DEST[t]);
    console.log(`${t}: installed ${count} prompt(s) -> ${DEST[t]}`);
  }
}

async function main() {
  const { targets } = parseArgs();
  await install({ targets });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
