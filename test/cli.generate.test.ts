import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const cliPath = resolve(repoRoot, "dist", "src", "cli.js");

function runCli(argv: readonly string[], cwd: string) {
  const result = spawnSync(process.execPath, [cliPath, ...argv], { cwd, encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

test("cli generate without --capability exits 2", () => {
  const result = runCli(["generate"], repoRoot);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /generate requires --capability/);
});

test("cli generate without --service exits 2", () => {
  const result = runCli(["generate", "--capability", "APPLICATION_BUILDER"], repoRoot);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /generate requires --service/);
});

test("cli generate --dry-run prints summary JSON and writes no files", () => {
  const outputDir = mkdtempSync(resolve(tmpdir(), "runspec-gen-dryrun-"));
  try {
    const result = runCli(
      ["generate", "--capability", "APPLICATION_BUILDER", "--service", "go-http-service", "--output", outputDir, "--dry-run"],
      repoRoot,
    );
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.capability, "APPLICATION_BUILDER");
    assert.equal(parsed.service, "go-http-service");
    assert.equal(parsed.generator, "go-http");
    assert.equal(parsed.dryRun, true);
    assert.ok(Array.isArray(parsed.files));
    assert.ok(parsed.files.includes("go.mod"));
    assert.equal(existsSync(resolve(outputDir, "go.mod")), false);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("cli generate writes files when --dry-run is omitted", () => {
  const outputDir = mkdtempSync(resolve(tmpdir(), "runspec-gen-write-"));
  try {
    const result = runCli(
      ["generate", "--capability", "APPLICATION_BUILDER", "--service", "go-http-service", "--output", outputDir],
      repoRoot,
    );
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(existsSync(resolve(outputDir, "go.mod")), true);
    assert.equal(existsSync(resolve(outputDir, "main.go")), true);
    assert.equal(existsSync(resolve(outputDir, "domain/product_capability.go")), true);
    const goMod = readFileSync(resolve(outputDir, "go.mod"), "utf8");
    assert.match(goMod, /module example\.com\/go-http-service/);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("cli generate refuses to overwrite without --force", () => {
  const outputDir = mkdtempSync(resolve(tmpdir(), "runspec-gen-overwrite-"));
  try {
    writeFileSync(resolve(outputDir, "go.mod"), "module pre-existing\n");
    const result = runCli(
      ["generate", "--capability", "APPLICATION_BUILDER", "--service", "go-http-service", "--output", outputDir],
      repoRoot,
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /refusing to overwrite/);
    const goMod = readFileSync(resolve(outputDir, "go.mod"), "utf8");
    assert.match(goMod, /module pre-existing/);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("cli generate --force replaces existing files", () => {
  const outputDir = mkdtempSync(resolve(tmpdir(), "runspec-gen-force-"));
  try {
    writeFileSync(resolve(outputDir, "go.mod"), "module pre-existing\n");
    const result = runCli(
      ["generate", "--capability", "APPLICATION_BUILDER", "--service", "go-http-service", "--output", outputDir, "--force"],
      repoRoot,
    );
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const goMod = readFileSync(resolve(outputDir, "go.mod"), "utf8");
    assert.match(goMod, /module example\.com\/go-http-service/);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("cli generate against unknown capability exits 1", () => {
  const result = runCli(
    ["generate", "--capability", "DOES_NOT_EXIST", "--service", "go-http-service", "--dry-run"],
    repoRoot,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /capability "DOES_NOT_EXIST"/);
});
