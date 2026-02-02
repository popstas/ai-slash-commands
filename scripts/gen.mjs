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
  opencode: { out: "opencode/commands" },
  antigravity: { out: "antigravity/commands" },
};

function parseArgs() {
  const idxTargets = process.argv.indexOf("--targets");
  const rawTargets = idxTargets >= 0 ? process.argv[idxTargets + 1] : "claude,cursor,windsurf,codex,opencode,antigravity";
  const targets = rawTargets.split(",").map(s => s.trim()).filter(Boolean);

  const idxSrc = process.argv.indexOf("--src");
  const rawSrc = idxSrc >= 0 ? process.argv[idxSrc + 1] : null;

  return { targets, promptsDir: rawSrc ? path.resolve(rawSrc) : defaultPromptsDir };
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function descriptionFromFirstLine(firstLine) {
  const trimmed = firstLine.trim().replace(/^#+\s*/, "");
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-").map((s) => s.trim());
    return parts.slice(1).join(" - ").trim() || trimmed;
  }
  return trimmed || "No description";
}

function toAntigravityContent(content) {
  const lines = content.split("\n");
  const firstLine = lines[0]?.trim() ?? "";
  const description = descriptionFromFirstLine(firstLine);
  const body = lines.slice(1).join("\n").trimEnd();
  return `---
description: ${description}
---

${body}
`;
}

async function listPromptFiles(promptsDir) {
  const entries = await fs.readdir(promptsDir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map(e => e.name);
}

async function generateCommandsReadme(promptsDir) {
  const promptFiles = await listPromptFiles(promptsDir);
  const commands = [];

  for (const name of promptFiles) {
    if (name.toLowerCase() === "readme.md") {
      continue; // Skip README.md itself
    }
    const srcPath = path.join(promptsDir, name);
    const content = await fs.readFile(srcPath, "utf8");
    const commandName = name.replace(/\.md$/i, "");
    const firstLine = content.split("\n")[0] ?? "";
    const description = descriptionFromFirstLine(firstLine);
    commands.push({ name: commandName, description, filename: name });
  }

  // Sort commands alphabetically by name
  commands.sort((a, b) => a.name.localeCompare(b.name));

  // Generate README content
  let readmeContent = "# Commands\n\n";
  readmeContent += "This directory contains AI slash command prompts.\n\n";
  readmeContent += "## Available Commands\n\n";

  for (const cmd of commands) {
    readmeContent += `### \`/${cmd.name}\`\n\n`;
    readmeContent += `${cmd.description}\n\n`;
    readmeContent += `*Source: [${cmd.filename}](${cmd.filename})*\n\n`;
  }

  const readmePath = path.join(promptsDir, "README.md");
  await fs.writeFile(readmePath, readmeContent, "utf8");
  console.log(`Generated: ${path.relative(repoRoot, readmePath)}`);
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
    if (name.toLowerCase() === "readme.md") {
      continue; // Skip README.md
    }
    const srcPath = path.join(promptsDir, name);
    const content = await fs.readFile(srcPath, "utf8");

    for (const t of targets) {
      const outPath = path.join(distDir, TARGETS[t].out, name);
      const outContent =
        t === "antigravity"
          ? toAntigravityContent(content)
          : content.endsWith("\n")
            ? content
            : content + "\n";
      await fs.writeFile(outPath, outContent, "utf8");
    }
  }

  // Generate commands README in prompts directory
  await generateCommandsReadme(promptsDir);

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
