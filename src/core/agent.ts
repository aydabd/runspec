import type { QualityGate, RunSpecApplicationBuilder } from "./model.js";
import { validateRunSpecFramework } from "./validators.js";

export type AgentTask = {
  readonly title: string;
  readonly reason: string;
  readonly allowedFiles: readonly string[];
  readonly deniedFiles: readonly string[];
  readonly commands: readonly string[];
  readonly acceptance: readonly string[];
};

export function nextAgentTask(framework: RunSpecApplicationBuilder): AgentTask {
  const validation = validateRunSpecFramework(framework);

  if (!validation.valid) {
    const firstIssue = validation.issues[0];
    const deniedFiles = uniqueValues([
      ...framework.agentPolicy.deniedToModify,
      ".runspec/generated/**",
      "dist/**",
      "node_modules/**",
    ]);
    const commands = uniqueValues([
      ...framework.agentPolicy.requiredCommandsBeforeCompletion,
      "npm test",
    ]);

    return {
      title: "Fix executable RunSpec framework definition",
      reason: `${firstIssue?.path ?? "unknown"}: ${firstIssue?.message ?? "validation failed"}`,
      allowedFiles: ["src/**", "test/**", "package.json", "tsconfig.json", ".github/workflows/**"],
      deniedFiles,
      commands,
      acceptance: [
        "manual review confirms the remediation scope",
        "RunSpec blueprint validation passes",
        "repository hygiene gate passes",
      ],
    };
  }

  return {
    title: "Implement first vertical production builder slice",
    reason: "Blueprint is valid. Next step is executable service generation for one capability across domain, API, persistence, security, observability, and verification harnesses.",
    allowedFiles: framework.agentPolicy.allowedToModify,
    deniedFiles: framework.agentPolicy.deniedToModify,
    commands: framework.agentPolicy.requiredCommandsBeforeCompletion,
    acceptance: acceptanceForBlockingGates(framework.qualityGates),
  };
}

export function acceptanceForBlockingGates(gates: readonly QualityGate[]): readonly string[] {
  return gates.filter(gate => gate.blocking).map(gate => `${gate.kind} gate passes`);
}

function uniqueValues(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
