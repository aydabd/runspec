import type {
  HarnessEnvironment,
  HarnessKind,
  HarnessReport,
  HarnessResult,
  HarnessRunOptions,
  RunSpecApplicationBuilder,
  VerificationHarness,
} from "./model.js";

export function runHarnesses(
  framework: RunSpecApplicationBuilder,
  options: HarnessRunOptions,
  env: HarnessEnvironment,
): HarnessReport {
  const selected = selectHarnesses(framework, options);
  if (options.dryRun === true) {
    const results = selected.map(harness => dryRunResult(harness));
    return { results, passed: true };
  }
  const results = selected.map(harness => runOne(harness, env));
  return {
    results,
    passed: results.every(result => result.passed),
  };
}

function selectHarnesses(
  framework: RunSpecApplicationBuilder,
  options: HarnessRunOptions,
): readonly VerificationHarness[] {
  if (options.scenarioId === undefined) {
    return framework.harnesses;
  }
  const scenario = framework.productCapabilities
    .flatMap(capability => capability.scenarios)
    .find(entry => entry.id === options.scenarioId);
  if (scenario === undefined) {
    return [];
  }
  const required = new Set<HarnessKind>(scenario.harnesses);
  return framework.harnesses.filter(harness => required.has(harness.kind));
}

function runOne(harness: VerificationHarness, env: HarnessEnvironment): HarnessResult {
  const outcome = env.run(harness.command, env.cwd);
  const timestamp = env.now();
  const fileName = `${timestamp}-${harness.kind}.json`;
  const evidencePath = env.writeEvidence(
    harness.evidenceDir,
    fileName,
    JSON.stringify(
      {
        kind: harness.kind,
        name: harness.name,
        command: harness.command,
        exitCode: outcome.exitCode,
        durationMs: outcome.durationMs,
        timestamp,
        stdout: outcome.stdout,
        stderr: outcome.stderr,
      },
      null,
      2,
    ),
  );
  return {
    kind: harness.kind,
    name: harness.name,
    command: harness.command,
    exitCode: outcome.exitCode,
    passed: outcome.exitCode === 0,
    durationMs: outcome.durationMs,
    evidencePath,
  };
}

function dryRunResult(harness: VerificationHarness): HarnessResult {
  return {
    kind: harness.kind,
    name: harness.name,
    command: harness.command,
    exitCode: 0,
    passed: true,
    durationMs: 0,
    evidencePath: `${harness.evidenceDir}/dry-run.json`,
  };
}
