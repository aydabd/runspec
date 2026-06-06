import test from "node:test";
import assert from "node:assert/strict";
import { runSpecFramework } from "../src/blueprint/runSpecFramework.js";
import { runHarnesses } from "../src/core/runner.js";
import type {
  Command,
  HarnessEnvironment,
  HarnessRunOutcome,
} from "../src/core/model.js";

type Capture = {
  readonly commands: Command[];
  readonly evidenceWrites: Array<{ dir: string; fileName: string; content: string }>;
};

function makeStubEnvironment(
  outcomeFor: (command: Command) => HarnessRunOutcome,
): { env: HarnessEnvironment; capture: Capture } {
  const capture: Capture = { commands: [], evidenceWrites: [] };
  const env: HarnessEnvironment = {
    cwd: "/stub",
    now: () => "2026-06-06T00-00-00-000Z",
    run: command => {
      capture.commands.push(command);
      return outcomeFor(command);
    },
    writeEvidence: (dir, fileName, content) => {
      capture.evidenceWrites.push({ dir, fileName, content });
      return `${dir}/${fileName}`;
    },
  };
  return { env, capture };
}

test("runHarnesses executes every framework harness when no scenario filter is given", () => {
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }));
  const report = runHarnesses(runSpecFramework, {}, env);
  assert.equal(report.results.length, runSpecFramework.harnesses.length);
  assert.equal(capture.commands.length, runSpecFramework.harnesses.length);
  assert.equal(report.passed, true);
});

test("runHarnesses report.passed is false when any harness exits non-zero", () => {
  const { env } = makeStubEnvironment(command =>
    command.program === "node" && command.args[0] === "dist/src/cli.js"
      ? { exitCode: 1, stdout: "", stderr: "policy failed", durationMs: 5 }
      : { exitCode: 0, stdout: "", stderr: "", durationMs: 5 },
  );
  const report = runHarnesses(runSpecFramework, {}, env);
  assert.equal(report.passed, false);
  assert.ok(report.results.some(result => !result.passed));
});

test("runHarnesses filters to harnesses listed by the selected scenario", () => {
  const scenario = runSpecFramework.productCapabilities[0]!.scenarios[0]!;
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }));
  const report = runHarnesses(runSpecFramework, { scenarioId: scenario.id }, env);
  const scenarioHarnessKinds = new Set(scenario.harnesses);
  assert.ok(report.results.length > 0);
  for (const result of report.results) {
    assert.ok(scenarioHarnessKinds.has(result.kind), `unexpected harness kind ${result.kind}`);
  }
  assert.equal(capture.commands.length, report.results.length);
});

test("runHarnesses returns an empty result set for an unknown scenario id", () => {
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }));
  const report = runHarnesses(runSpecFramework, { scenarioId: "DOES_NOT_EXIST" }, env);
  assert.equal(report.results.length, 0);
  assert.equal(capture.commands.length, 0);
  assert.equal(report.passed, true);
});

test("runHarnesses dry-run short-circuits without calling env.run", () => {
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 1, stdout: "", stderr: "boom", durationMs: 1 }));
  const report = runHarnesses(runSpecFramework, { dryRun: true }, env);
  assert.equal(capture.commands.length, 0, "env.run was called during dry-run");
  assert.equal(capture.evidenceWrites.length, 0, "evidence was written during dry-run");
  assert.equal(report.passed, true);
  assert.equal(report.results.length, runSpecFramework.harnesses.length);
  for (const result of report.results) {
    assert.match(result.evidencePath, /dry-run\.json$/);
  }
});

test("runHarnesses writes evidence per result with timestamp and harness kind", () => {
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 0, stdout: "ok", stderr: "", durationMs: 3 }));
  runHarnesses(runSpecFramework, {}, env);
  assert.equal(capture.evidenceWrites.length, runSpecFramework.harnesses.length);
  for (const write of capture.evidenceWrites) {
    assert.match(write.fileName, /^2026-06-06T00-00-00-000Z-[a-z-]+\.json$/);
    const parsed = JSON.parse(write.content) as { kind: string; exitCode: number; stdout: string };
    assert.equal(parsed.exitCode, 0);
    assert.equal(parsed.stdout, "ok");
    assert.ok(parsed.kind.length > 0);
  }
});
