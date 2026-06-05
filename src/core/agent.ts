import type { GateKind, RunSpecApplicationBuilder } from "./model.js";
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

    return {
      title: "Fix executable RunSpec framework definition",
      reason: `${firstIssue?.path ?? "unknown"}: ${firstIssue?.message ?? "validation failed"}`,
      allowedFiles: framework.agentPolicy.allowedToModify,
      deniedFiles: framework.agentPolicy.deniedToModify,
      commands: framework.agentPolicy.requiredCommandsBeforeCompletion,
      acceptance: ["RunSpec blueprint validation passes", "repository hygiene gate passes"],
    };
  }

  return {
    title: "Implement first vertical production builder slice",
    reason: "Blueprint is valid. Next step is executable service generation for one capability across domain, API, persistence, security, observability, and verification harnesses.",
    allowedFiles: framework.agentPolicy.allowedToModify,
    deniedFiles: framework.agentPolicy.deniedToModify,
    commands: framework.agentPolicy.requiredCommandsBeforeCompletion,
    acceptance: acceptanceForAllBlockingGates(framework.qualityGates.map(gate => gate.kind)),
  };
}

function acceptanceForAllBlockingGates(gates: readonly GateKind[]): readonly string[] {
  return gates.map(gate => `${gate} gate passes`);
}
