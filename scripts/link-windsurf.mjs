import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const home = os.homedir();
const globalWorkflows = path.join(home, ".windsurf", "workflows");

const workspaceRoot = process.cwd();
const workspaceWindsurfDir = path.join(workspaceRoot, ".windsurf");
const workspaceWorkflows = path.join(workspaceWindsurfDir, "workflows");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function exists(p) {
  try { await fs.lstat(p); return true; } catch { return false; }
}

async function main() {
  await ensureDir(globalWorkflows);
  await ensureDir(workspaceWindsurfDir);

  if (await exists(workspaceWorkflows)) {
    console.error(`Already exists: ${workspaceWorkflows}`);
    console.error("Remove it first if you want to re-link.");
    process.exit(1);
  }

  // On Windows, use 'junction' to avoid admin rights requirement for symlinks.
  const type = process.platform === "win32" ? "junction" : "dir";
  await fs.symlink(globalWorkflows, workspaceWorkflows, type);

  console.log("Linked Windsurf workflows:");
  console.log(`- global:   ${globalWorkflows}`);
  console.log(`- workspace:${workspaceWorkflows}`);
  console.log("Now the workspace will see workflows from your home folder.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
