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

test("cli run-gates --dry-run exits 0 and lists every quality gate", () => {
  const result = runCli(["run-gates", "--dry-run"], repoRoot);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout) as { results: Array<{ kind: string; passed: boolean; blocking: boolean }>; passed: boolean };
  assert.equal(parsed.passed, true);
  assert.ok(parsed.results.length >= 12);
  for (const result of parsed.results) {
    assert.equal(result.passed, true);
  }
});

test("cli --help lists run-gates", () => {
  const result = runCli(["--help"], repoRoot);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /run-gates/);
});
