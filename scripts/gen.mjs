import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const defaultPromptsDir = path.join(repoRoot, "prompts");
const skillsDir = path.join(repoRoot, "skills");
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

// Parse leading `--- ... ---` YAML-ish frontmatter from a SKILL.md.
// Returns { data: { key: value, ... }, body: "<content after frontmatter>" }.
// If no frontmatter is present, data is {} and body is the original content.
export function parseFrontmatter(content) {
  const normalized = content.replace(/^﻿/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { data: {}, body: normalized };
  }
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (m) {
      data[m[1]] = m[2].trim();
    }
  }
  const body = normalized.slice(match[0].length);
  return { data, body };
}

// Convert a SKILL.md into a command-prompt shim: strip frontmatter and
// prepend `# <name> - <description>` so /<name> works in every editor target.
export function skillToCommand(name, content) {
  const { data, body } = parseFrontmatter(content);
  const description = data.description || "No description";
  return `# ${name} - ${description}\n\n${body.replace(/^\n+/, "").trimEnd()}\n`;
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

async function listSkillNames(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const names = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(dir, e.name, "SKILL.md");
    try {
      await fs.access(skillFile);
      names.push(e.name);
    } catch {
      // directory without a SKILL.md — not a skill
    }
  }
  return names.sort();
}

// Generate skill outputs:
// - copy each skills/<name>/ recursively to dist/claude/skills/<name>/
//   (Claude consumes skills natively)
// - emit a command shim dist/<target>/<commandsDir>/<name>.md for every target
//   so /<name> works in all editors.
export async function generateSkills({ targets, skillsDir: dir = skillsDir }) {
  const names = await listSkillNames(dir);
  if (names.length === 0) {
    return [];
  }

  const distSkillsDir = path.join(distDir, "claude", "skills");
  await ensureDir(distSkillsDir);

  for (const name of names) {
    const srcSkillDir = path.join(dir, name);
    const destSkillDir = path.join(distSkillsDir, name);
    await fs.rm(destSkillDir, { recursive: true, force: true });
    await fs.cp(srcSkillDir, destSkillDir, {
      recursive: true,
      filter: (src) => !src.includes("__pycache__"),
    });

    const content = await fs.readFile(path.join(srcSkillDir, "SKILL.md"), "utf8");
    const shim = skillToCommand(name, content);

    for (const t of targets) {
      const outPath = path.join(distDir, TARGETS[t].out, `${name}.md`);
      const outContent = t === "antigravity" ? toAntigravityContent(shim) : shim;
      await ensureDir(path.dirname(outPath));
      await fs.writeFile(outPath, outContent, "utf8");
    }
  }

  console.log(`Generated skills: ${names.join(", ")}`);
  return names;
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

  // Generate skill outputs (skills/<name>/ → dist/claude/skills + per-target shims)
  await generateSkills({ targets });

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
