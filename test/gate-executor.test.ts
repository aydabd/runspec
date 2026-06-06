import test from "node:test";
import assert from "node:assert/strict";
import { runSpecFramework } from "../src/blueprint/runSpecFramework.js";
import { runGates } from "../src/core/gate-executor.js";
import type { GateEnvironment, GateRunOutcome } from "../src/core/gate-executor.js";
import type { Command, RunSpecApplicationBuilder } from "../src/core/model.js";

type Capture = {
  readonly commands: Command[];
  readonly evidencePaths: string[];
};

function makeStubEnvironment(
  outcomeFor: (command: Command) => GateRunOutcome,
): { env: GateEnvironment; capture: Capture } {
  const capture: Capture = { commands: [], evidencePaths: [] };
  const env: GateEnvironment = {
    cwd: "/stub",
    now: () => "2026-06-06T01-00-00-000Z",
    run: command => {
      capture.commands.push(command);
      return outcomeFor(command);
    },
    writeEvidence: (evidencePath, _content) => {
      capture.evidencePaths.push(evidencePath);
      return `/stub/${evidencePath}`;
    },
  };
  return { env, capture };
}

test("runGates executes every quality gate in the framework", () => {
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }));
  const report = runGates(runSpecFramework, {}, env);
  assert.equal(report.results.length, runSpecFramework.qualityGates.length);
  assert.equal(capture.commands.length, runSpecFramework.qualityGates.length);
  assert.equal(report.passed, true);
});

test("runGates dry-run does not spawn anything", () => {
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 1, stdout: "", stderr: "", durationMs: 1 }));
  const report = runGates(runSpecFramework, { dryRun: true }, env);
  assert.equal(capture.commands.length, 0);
  assert.equal(capture.evidencePaths.length, 0);
  assert.equal(report.passed, true);
});

test("runGates blockingOnly filters to gates with blocking=true", () => {
  const framework: RunSpecApplicationBuilder = {
    ...runSpecFramework,
    qualityGates: [
      { kind: "report", name: "informational", blocking: false, command: { program: "true", args: [] }, evidence: "x" },
      { kind: "requirement", name: "blocking", blocking: true, command: { program: "true", args: [] }, evidence: "y" },
    ],
  };
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }));
  const report = runGates(framework, { blockingOnly: true }, env);
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0]?.kind, "requirement");
  assert.equal(capture.commands.length, 1);
});

test("runGates report.passed is true when only non-blocking gate fails", () => {
  const framework: RunSpecApplicationBuilder = {
    ...runSpecFramework,
    qualityGates: [
      { kind: "requirement", name: "blocking", blocking: true, command: { program: "true", args: [] }, evidence: "y" },
      { kind: "report", name: "informational", blocking: false, command: { program: "fails", args: [] }, evidence: "x" },
    ],
  };
  const { env } = makeStubEnvironment(command =>
    command.program === "fails" ? { exitCode: 1, stdout: "", stderr: "", durationMs: 1 } : { exitCode: 0, stdout: "", stderr: "", durationMs: 1 },
  );
  const report = runGates(framework, {}, env);
  assert.equal(report.passed, true);
  const failed = report.results.find(result => !result.passed);
  assert.ok(failed);
  assert.equal(failed.blocking, false);
});

test("runGates report.passed is false when a blocking gate fails", () => {
  const framework: RunSpecApplicationBuilder = {
    ...runSpecFramework,
    qualityGates: [
      { kind: "requirement", name: "blocking", blocking: true, command: { program: "fails", args: [] }, evidence: "y" },
    ],
  };
  const { env } = makeStubEnvironment(() => ({ exitCode: 2, stdout: "", stderr: "", durationMs: 1 }));
  const report = runGates(framework, {}, env);
  assert.equal(report.passed, false);
});

test("runGates writes evidence to gate.evidence path", () => {
  const { env, capture } = makeStubEnvironment(() => ({ exitCode: 0, stdout: "ok", stderr: "", durationMs: 1 }));
  runGates(runSpecFramework, {}, env);
  for (const gate of runSpecFramework.qualityGates) {
    assert.ok(capture.evidencePaths.includes(gate.evidence), `evidence path ${gate.evidence} not written`);
  }
});
