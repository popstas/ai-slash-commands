#!/usr/bin/env node
// Compute today's release version in CalVer year.month.day form (e.g. 2026.5.28).
// Months and days are NOT zero-padded, matching the existing tag scheme.
// If a tag for today already exists, append an incrementing patch: 2026.5.28.1, .2, ...
//
// Usage:
//   node scripts/release-version.mjs          # print the version
//   node scripts/release-version.mjs --tag    # print with leading "v" (v2026.5.28)

import { execSync } from "node:child_process";

const now = new Date();
const base = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;

// Collect existing tags so a second release on the same day doesn't collide.
let tags = [];
try {
  tags = execSync("git tag --list", { encoding: "utf8" })
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
} catch {
  // Not a git repo / git unavailable — fall back to the bare date version.
}

let version = base;
if (tags.includes(`v${base}`)) {
  const prefix = `v${base}.`;
  const patches = tags
    .filter((t) => t.startsWith(prefix))
    .map((t) => Number.parseInt(t.slice(prefix.length), 10))
    .filter((n) => Number.isInteger(n));
  const next = patches.length ? Math.max(...patches) + 1 : 1;
  version = `${base}.${next}`;
}

const withTag = process.argv.includes("--tag");
process.stdout.write(`${withTag ? "v" : ""}${version}\n`);
