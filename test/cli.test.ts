import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const cliPath = resolve(repoRoot, "dist", "src", "cli.js");

type CliResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

function runCli(argv: readonly string[], cwd: string): CliResult {
  const result = spawnSync(process.execPath, [cliPath, ...argv], { cwd, encoding: "utf8" });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

test("cli --help exits 0 and prints usage to stdout", () => {
  const result = runCli(["--help"], repoRoot);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: runspec/);
});

test("cli --version exits 0 and prints the package version", () => {
  const result = runCli(["--version"], repoRoot);
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test("cli with no command exits 2 with stderr usage", () => {
  const result = runCli([], repoRoot);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /missing command/);
});

test("cli with unknown command exits 2 and names the offender", () => {
  const result = runCli(["bogus"], repoRoot);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown command "bogus"/);
});

test("cli with unknown option exits 2 with stderr", () => {
  const result = runCli(["verify-blueprint", "--what"], repoRoot);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option: --what/);
});

test("cli verify-blueprint exits 0 on the real blueprint", () => {
  const result = runCli(["verify-blueprint"], repoRoot);
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.valid, true);
});

test("cli verify-markdown exits 0 on the real repo", () => {
  const result = runCli(["verify-markdown"], repoRoot);
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.valid, true);
});

test("cli verify-markdown outside a git repo exits 2", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "runspec-cli-nogit-"));
  try {
    const result = runCli(["verify-markdown"], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not inside a git repository/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test(
  "cli verify-markdown does not follow symbolic links into the wider filesystem",
  { skip: process.platform === "win32" },
  () => {
    const dir = mkdtempSync(resolve(tmpdir(), "runspec-cli-symlink-"));
    try {
      spawnSync("git", ["init", "-q", dir], { encoding: "utf8" });
      writeFileSync(resolve(dir, "README.md"), "# minimal");
      mkdirSync(resolve(dir, "subdir"));
      writeFileSync(resolve(dir, "subdir", "linked.md"), "# linked");
      symlinkSync(resolve(dir, "subdir"), resolve(dir, "via-symlink"), "dir");
      const result = runCli(["verify-markdown"], dir);
      assert.equal(result.status, 1);
      const parsed = JSON.parse(result.stdout);
      assert.ok(Array.isArray(parsed.forbidden));
      assert.ok(parsed.forbidden.includes("subdir/linked.md"));
      assert.ok(!parsed.forbidden.some((f: string) => f.startsWith("via-symlink/")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test("cli verify-plan returns a structured PlanStatus for the bootstrap plan", () => {
  if (!existsSync(resolve(repoRoot, "dist", "src", "plans", "pr1.js"))) {
    return;
  }
  const result = runCli(["verify-plan", "--plan", "src/plans/pr1.ts"], repoRoot);
  assert.ok(result.status === 0 || result.status === 1, `unexpected exit ${result.status}: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.planId, "pr-1-bootstrap-runspec");
  assert.ok(Array.isArray(parsed.commits));
  assert.ok(parsed.commits.length >= 12);
  assert.ok(Array.isArray(parsed.followUps));
});

test("cli verify-plan with missing plan file exits 2", () => {
  const result = runCli(["verify-plan", "--plan", "src/plans/does-not-exist.ts"], repoRoot);
  assert.equal(result.status, 2);
});

test("cli --plan without a value exits 2 with UsageError message", () => {
  const result = runCli(["verify-plan", "--plan"], repoRoot);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--plan requires a path argument/);
});

test("cli list-followups prints the followUps and delivers arrays", () => {
  const result = runCli(["list-followups", "--plan", "src/plans/pr1.ts"], repoRoot);
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.ok(Array.isArray(parsed.followUps));
  assert.ok(parsed.followUps.length > 0);
  assert.ok(Array.isArray(parsed.delivers));
});
