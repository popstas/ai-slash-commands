import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, skillToCommand } from "../gen.mjs";

test("parseFrontmatter extracts key/value data and body", () => {
  const content = "---\nname: do\ndescription: do things\n---\n\nBody line one\nBody line two\n";
  const { data, body } = parseFrontmatter(content);
  assert.equal(data.name, "do");
  assert.equal(data.description, "do things");
  assert.equal(body, "\nBody line one\nBody line two\n");
});

test("parseFrontmatter returns empty data when no frontmatter", () => {
  const content = "# just a heading\n\nsome text";
  const { data, body } = parseFrontmatter(content);
  assert.deepEqual(data, {});
  assert.equal(body, content);
});

test("parseFrontmatter tolerates a leading BOM", () => {
  const content = "﻿---\nname: x\ndescription: y\n---\nbody";
  const { data } = parseFrontmatter(content);
  assert.equal(data.name, "x");
  assert.equal(data.description, "y");
});

test("skillToCommand strips frontmatter and prepends H1 line", () => {
  const content = "---\nname: do\ndescription: orchestrate TODO\n---\n\nFirst paragraph.\nSecond line.\n";
  const out = skillToCommand("do", content);
  const lines = out.split("\n");
  assert.equal(lines[0], "# do - orchestrate TODO");
  assert.equal(lines[1], "");
  assert.equal(lines[2], "First paragraph.");
  assert.ok(!out.includes("---"), "frontmatter delimiters should be gone");
  assert.ok(out.includes("Second line."), "body should be preserved");
});

test("skillToCommand falls back to a default description", () => {
  const content = "---\nname: do\n---\nbody only\n";
  const out = skillToCommand("do", content);
  assert.equal(out.split("\n")[0], "# do - No description");
});

test("skillToCommand handles content without frontmatter", () => {
  const content = "raw body without frontmatter";
  const out = skillToCommand("commit", content);
  assert.equal(out.split("\n")[0], "# commit - No description");
  assert.ok(out.includes("raw body without frontmatter"));
});
