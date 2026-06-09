#!/usr/bin/env node
// Cut a new release: bump package.json to today's CalVer version, regenerate the
// changelog, commit, and create the matching git tag. Does NOT push by default —
// pushing the tag is what triggers the GitHub release workflow.
//
// Usage:
//   node scripts/release.mjs            # bump + changelog + commit + tag (local only)
//   node scripts/release.mjs --push     # also push the branch and the tag
//   node scripts/release.mjs --dry-run  # print what would happen, change nothing

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const pkgPath = path.join(repoRoot, "package.json");
const lockPath = path.join(repoRoot, "package-lock.json");

const dryRun = process.argv.includes("--dry-run");
const push = process.argv.includes("--push");

const run = (cmd) => {
  console.log(`$ ${cmd}`);
  if (!dryRun) execSync(cmd, { stdio: "inherit", cwd: repoRoot });
};

// Refuse to release with a dirty tree (the bump/changelog must be the only changes).
const status = execSync("git status --porcelain", { encoding: "utf8", cwd: repoRoot }).trim();
if (status && !dryRun) {
  console.error("Working tree is not clean — commit or stash changes first:\n" + status);
  process.exit(1);
}

const version = execSync("node scripts/release-version.mjs", { encoding: "utf8", cwd: repoRoot }).trim();
const tag = `v${version}`;
console.log(`Releasing ${tag}`);

// 1. Bump package.json version (preserve formatting: 2-space indent + trailing newline).
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
if (!dryRun) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// 1b. Keep package-lock.json in sync (it carries the version in two places).
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;
if (!dryRun) writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

// 2. Regenerate the changelog (pre-commit also does this, but keep it explicit).
run("npx git-cliff -o CHANGELOG.md");

// 3. Commit and tag.
run("git add package.json package-lock.json CHANGELOG.md");
run(`git commit -m "chore(release): ${tag}"`);
run(`git tag ${tag}`);

// 4. Optionally push (this triggers .github/workflows/release.yml).
if (push) {
  run("git push");
  run(`git push origin ${tag}`);
  console.log(`\nPushed ${tag} — the Release workflow will publish the GitHub release.`);
} else {
  console.log(`\nLocal release ready. To publish, run:\n  git push && git push origin ${tag}`);
}
