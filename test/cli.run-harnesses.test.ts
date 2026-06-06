import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const cliPath = resolve(repoRoot, "dist", "src", "cli.js");

function runCli(argv: readonly string[], cwd: string) {
  const result = spawnSync(process.execPath, [cliPath, ...argv], { cwd, encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

test("cli run-harnesses --dry-run exits 0 and lists every framework harness", () => {
  const result = runCli(["run-harnesses", "--dry-run"], repoRoot);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout) as { results: Array<{ kind: string; passed: boolean }>; passed: boolean };
  assert.equal(parsed.passed, true);
  assert.ok(parsed.results.length > 0);
  for (const result of parsed.results) {
    assert.equal(result.passed, true);
  }
});

test("cli run-harnesses --dry-run with --scenario filters results", () => {
  const result = runCli(["run-harnesses", "--dry-run", "--scenario", "APPLICATION_BUILDER-001"], repoRoot);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout) as { results: Array<{ kind: string }> };
  assert.ok(parsed.results.length > 0);
  const kinds = new Set(parsed.results.map(entry => entry.kind));
  assert.ok(kinds.has("unit"));
  assert.ok(kinds.has("architecture"));
});

test("cli run-harnesses --dry-run with unknown scenario returns empty results", () => {
  const result = runCli(["run-harnesses", "--dry-run", "--scenario", "BOGUS"], repoRoot);
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout) as { results: unknown[]; passed: boolean };
  assert.equal(parsed.results.length, 0);
  assert.equal(parsed.passed, true);
});

test("cli --help lists run-harnesses", () => {
  const result = runCli(["--help"], repoRoot);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /run-harnesses/);
});
