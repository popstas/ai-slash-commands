#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./gen.mjs";
import { install } from "./install-configs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const defaultPromptsDir = path.join(repoRoot, "prompts");

function parseArgs() {
  const args = process.argv.slice(2);
  let targetsRaw = null;
  let commandsDir = null;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--targets") {
      targetsRaw = args[i + 1];
      i += 1;
      continue;
    }
    if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    }
    if (commandsDir) {
      console.error("Only one commands directory is allowed.");
      process.exit(1);
    }
    commandsDir = a;
  }

  const targets = (targetsRaw ?? "claude,cursor,windsurf,codex")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  return { commandsDir: commandsDir ? path.resolve(commandsDir) : defaultPromptsDir, targets };
}

async function ensureCommandsDir(commandsDir) {
  let stat;
  try {
    stat = await fs.stat(commandsDir);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`Commands directory not found: ${commandsDir}`);
      process.exit(1);
    }
    throw err;
  }

  if (!stat.isDirectory()) {
    console.error(`Not a directory: ${commandsDir}`);
    process.exit(1);
  }

  const entries = await fs.readdir(commandsDir, { withFileTypes: true });
  const hasMd = entries.some(e => e.isFile() && e.name.toLowerCase().endsWith(".md"));
  if (!hasMd) {
    console.error(`No .md files found in ${commandsDir}`);
    process.exit(1);
  }
}

async function main() {
  const { commandsDir, targets } = parseArgs();
  await ensureCommandsDir(commandsDir);
  await generate({ targets, promptsDir: commandsDir });
  await install({ targets });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
