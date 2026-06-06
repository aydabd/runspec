import type {
  Command,
  QualityGate,
  RunSpecApplicationBuilder,
} from "./model.js";

export type GateRunOutcome = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
};

export type GateEnvironment = {
  readonly run: (command: Command, cwd: string) => GateRunOutcome;
  readonly writeEvidence: (evidencePath: string, content: string) => string;
  readonly now: () => string;
  readonly cwd: string;
};

export type GateResult = {
  readonly kind: QualityGate["kind"];
  readonly name: string;
  readonly blocking: boolean;
  readonly command: Command;
  readonly exitCode: number;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly evidencePath: string;
};

export type GateReport = {
  readonly results: readonly GateResult[];
  readonly passed: boolean;
};

export type GateRunOptions = {
  readonly dryRun?: boolean;
  readonly blockingOnly?: boolean;
};

export function runGates(
  framework: RunSpecApplicationBuilder,
  options: GateRunOptions,
  env: GateEnvironment,
): GateReport {
  const selected = options.blockingOnly === true
    ? framework.qualityGates.filter(gate => gate.blocking)
    : framework.qualityGates;
  if (options.dryRun === true) {
    return {
      results: selected.map(gate => dryRunResult(gate)),
      passed: true,
    };
  }
  const results = selected.map(gate => runOne(gate, env));
  const passed = results.every(result => result.passed || !result.blocking);
  return { results, passed };
}

function runOne(gate: QualityGate, env: GateEnvironment): GateResult {
  const outcome = env.run(gate.command, env.cwd);
  const timestamp = env.now();
  const evidencePath = env.writeEvidence(
    gate.evidence,
    JSON.stringify(
      {
        kind: gate.kind,
        name: gate.name,
        blocking: gate.blocking,
        command: gate.command,
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
    kind: gate.kind,
    name: gate.name,
    blocking: gate.blocking,
    command: gate.command,
    exitCode: outcome.exitCode,
    passed: outcome.exitCode === 0,
    durationMs: outcome.durationMs,
    evidencePath,
  };
}

function dryRunResult(gate: QualityGate): GateResult {
  return {
    kind: gate.kind,
    name: gate.name,
    blocking: gate.blocking,
    command: gate.command,
    exitCode: 0,
    passed: true,
    durationMs: 0,
    evidencePath: gate.evidence,
  };
}
