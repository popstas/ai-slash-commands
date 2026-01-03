import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const defaultPromptsDir = path.join(repoRoot, "prompts");
const distDir = path.join(repoRoot, "dist");

const TARGETS = {
  claude:   { out: "claude/commands" },
  cursor:   { out: "cursor/commands" },
  windsurf: { out: "windsurf/workflows" },
  codex:    { out: "codex/prompts" },
};

function parseArgs() {
  const idxTargets = process.argv.indexOf("--targets");
  const rawTargets = idxTargets >= 0 ? process.argv[idxTargets + 1] : "claude,cursor,windsurf,codex";
  const targets = rawTargets.split(",").map(s => s.trim()).filter(Boolean);

  const idxSrc = process.argv.indexOf("--src");
  const rawSrc = idxSrc >= 0 ? process.argv[idxSrc + 1] : null;

  return { targets, promptsDir: rawSrc ? path.resolve(rawSrc) : defaultPromptsDir };
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function listPromptFiles(promptsDir) {
  const entries = await fs.readdir(promptsDir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map(e => e.name);
}

export async function generate({ targets, promptsDir }) {
  const promptFiles = await listPromptFiles(promptsDir);
  if (promptFiles.length === 0) {
    console.error(`No prompts found in ${promptsDir} (expected *.md).`);
    process.exit(1);
  }

  for (const t of targets) {
    if (!TARGETS[t]) {
      console.error(`Unknown target: ${t}. Allowed: ${Object.keys(TARGETS).join(", ")}`);
      process.exit(1);
    }
    await ensureDir(path.join(distDir, TARGETS[t].out));
  }

  for (const name of promptFiles) {
    const srcPath = path.join(promptsDir, name);
    const content = await fs.readFile(srcPath, "utf8");

    for (const t of targets) {
      const outPath = path.join(distDir, TARGETS[t].out, name);
      await fs.writeFile(outPath, content.endsWith("\n") ? content : content + "\n", "utf8");
    }
  }

  console.log("Generated:");
  for (const t of targets) {
    console.log(`- dist/${TARGETS[t].out}/`);
  }
}

async function main() {
  const { targets, promptsDir } = parseArgs();

  await generate({ targets, promptsDir });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
