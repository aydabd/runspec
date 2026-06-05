import type {
  AcceptancePredicate,
  RunSpecApplicationBuilder,
  ValidationIssue,
  ValidationResult,
  WorkPlan,
} from "./model.js";

export type ValidationRule = (framework: RunSpecApplicationBuilder) => readonly ValidationIssue[];

const acceptancePredicateKinds: ReadonlySet<AcceptancePredicate["kind"]> = new Set<AcceptancePredicate["kind"]>([
  "module-export",
  "module-property-equals",
  "file-present",
  "file-absent",
  "tsconfig-flag",
  "package-json-field",
  "npm-script-passes",
  "cli-exit",
  "readme-mermaid-blocks",
  "plan-self-validates",
]);

export const sourceOfTruthRule: ValidationRule = framework => {
  const issues: ValidationIssue[] = [];
  const policy = framework.sourceOfTruth;
  if (!policy.executableDefinitionsOnly) {
    issues.push({ path: "sourceOfTruth.executableDefinitionsOnly", message: "source of truth must be executable definitions" });
  }
  if (policy.commentsAsSpecificationAllowed) {
    issues.push({ path: "sourceOfTruth.commentsAsSpecificationAllowed", message: "comments cannot be accepted as specifications" });
  }
  if (policy.externalSpecFrameworksAllowed) {
    issues.push({ path: "sourceOfTruth.externalSpecFrameworksAllowed", message: "external markdown-first spec frameworks cannot be source of truth" });
  }
  if (!policy.generatedArtifactsAreReadOnlyForAgents) {
    issues.push({ path: "sourceOfTruth.generatedArtifactsAreReadOnlyForAgents", message: "generated artifacts must be read-only for agents" });
  }
  if (policy.generatedArtifactDirectory !== ".runspec/generated") {
    issues.push({ path: "sourceOfTruth.generatedArtifactDirectory", message: "generated artifacts must live under .runspec/generated" });
  }
  const md = policy.markdownPolicy;
  if (!md.humanOnboarding.includes("README.md")) {
    issues.push({ path: "sourceOfTruth.markdownPolicy.humanOnboarding", message: "README.md must be declared as a human-onboarding markdown file" });
  }
  if (!md.humanOnboarding.every(path => path.length > 0 && !path.endsWith("/"))) {
    issues.push({ path: "sourceOfTruth.markdownPolicy.humanOnboarding", message: "human-onboarding entries must be non-empty file paths" });
  }
  if (!md.agentRuntimeConfiguration.every(path => path.length > 0)) {
    issues.push({ path: "sourceOfTruth.markdownPolicy.agentRuntimeConfiguration", message: "agent-runtime-configuration entries must be non-empty" });
  }
  if (!(md.excludedDirectories.includes(".git") && md.excludedDirectories.includes("node_modules"))) {
    issues.push({ path: "sourceOfTruth.markdownPolicy.excludedDirectories", message: ".git and node_modules must be excluded from markdown scanning" });
  }
  return issues;
};

export const workspaceModesRule: ValidationRule = framework => {
  const modes = new Set(framework.workspaceCapabilities.map(capability => capability.mode));
  if (modes.has("single-service") && modes.has("monorepo") && modes.has("multi-repo")) {
    return [];
  }
  return [{ path: "workspaceCapabilities", message: "single-service, monorepo, and multi-repo modes must be modeled" }];
};

export const serviceTargetsRule: ValidationRule = framework => {
  const targets = new Set(framework.serviceTargets.map(target => `${target.language}:${target.framework}`));
  if (targets.has("go:go-http") && targets.has("java:spring-boot") && targets.has("typescript:node-http")) {
    return [];
  }
  return [{ path: "serviceTargets", message: "Go, Spring Boot, and TypeScript service targets must be modeled" }];
};

export const infrastructureAdaptersRule: ValidationRule = framework => {
  const issues: ValidationIssue[] = [];
  if (!framework.infrastructureAdapters.some(adapter => adapter.kind === "postgres")) {
    issues.push({ path: "infrastructureAdapters.postgres", message: "Postgres adapter is required" });
  }
  if (!framework.infrastructureAdapters.some(adapter => adapter.kind === "kafka")) {
    issues.push({ path: "infrastructureAdapters.kafka", message: "Kafka adapter is required" });
  }
  if (!framework.infrastructureAdapters.some(adapter => adapter.kind === "rabbitmq")) {
    issues.push({ path: "infrastructureAdapters.rabbitmq", message: "RabbitMQ adapter is required" });
  }
  return issues;
};

export const qualityGatesRule: ValidationRule = framework => {
  const issues: ValidationIssue[] = [];
  if (framework.qualityGates.length === 0) {
    issues.push({ path: "qualityGates", message: "at least one quality gate is required" });
    return issues;
  }
  if (!framework.qualityGates.every(gate => gate.blocking)) {
    issues.push({ path: "qualityGates", message: "all initial quality gates must be blocking" });
  }
  return issues;
};

export const harnessesRule: ValidationRule = framework => {
  return framework.harnesses.length > 0
    ? []
    : [{ path: "harnesses", message: "verification harnesses are required" }];
};

export const diagramTargetsRule: ValidationRule = framework => {
  return framework.diagramTargets.length > 0
    ? []
    : [{ path: "diagramTargets", message: "diagram generation targets are required" }];
};

export const capabilitiesRule: ValidationRule = framework => {
  const issues: ValidationIssue[] = [];
  const capabilities = framework.productCapabilities;
  const threatModels = framework.threatModels;
  const capabilityIds = new Set(capabilities.map(capability => capability.id));
  const threatIds = new Set(threatModels.flatMap(model => model.threats.map(threat => threat.id)));
  const scenarioIds = new Set(capabilities.flatMap(capability => capability.scenarios.map(scenario => scenario.id)));

  for (const capability of capabilities) {
    const base = `productCapabilities.${capability.id}`;
    if (capability.id.length === 0) {
      issues.push({ path: `${base}.id`, message: "capability id is required" });
    }
    if (!capability.implementation.generatedSkeletonRequired) {
      issues.push({ path: `${base}.implementation.generatedSkeletonRequired`, message: "implementation skeleton must be generated from executable capability" });
    }
    if (capability.scenarios.length === 0) {
      issues.push({ path: `${base}.scenarios`, message: "capability must define executable scenarios" });
    }
    for (const requiredGate of ["requirement", "implementation", "security", "threat-model"] as const) {
      if (!capability.gates.includes(requiredGate)) {
        issues.push({ path: `${base}.gates`, message: `${requiredGate} gate is required` });
      }
    }
    if (!capability.observability.correlationIdRequired) {
      issues.push({ path: `${base}.observability.correlationIdRequired`, message: "correlation id is required" });
    }
    for (const scenario of capability.scenarios) {
      if (scenario.harnesses.length === 0) {
        issues.push({ path: `${base}.scenarios.${scenario.id}.harnesses`, message: "scenario must select executable harnesses" });
      }
      for (const threatId of scenario.verifiesThreats) {
        if (!threatIds.has(threatId)) {
          issues.push({ path: `${base}.scenarios.${scenario.id}.verifiesThreats`, message: `unknown threat: ${threatId}` });
        }
      }
    }
  }

  for (const model of threatModels) {
    if (!capabilityIds.has(model.capabilityId)) {
      issues.push({ path: `threatModels.${model.id}.capabilityId`, message: `unknown capability: ${model.capabilityId}` });
    }
    for (const threat of model.threats) {
      if (threat.verifiedByScenarioIds.length === 0) {
        issues.push({ path: `threatModels.${model.id}.threats.${threat.id}.verifiedByScenarioIds`, message: "threat must be verified by executable scenario" });
      }
      for (const scenarioId of threat.verifiedByScenarioIds) {
        if (!scenarioIds.has(scenarioId)) {
          issues.push({ path: `threatModels.${model.id}.threats.${threat.id}.verifiedByScenarioIds`, message: `unknown scenario: ${scenarioId}` });
        }
      }
    }
  }

  return issues;
};

export const agentPolicyRule: ValidationRule = framework => {
  const issues: ValidationIssue[] = [];
  const policy = framework.agentPolicy;
  if (!policy.completionRequiresAllBlockingGates) {
    issues.push({ path: "agentPolicy.completionRequiresAllBlockingGates", message: "agent completion must require all blocking gates" });
  }
  if (!policy.requiredCommandsBeforeCompletion.includes("npm test")) {
    issues.push({ path: "agentPolicy.requiredCommandsBeforeCompletion", message: "npm test must be required before completion" });
  }
  if (!policy.deniedToModify.includes(".runspec/generated/**")) {
    issues.push({ path: "agentPolicy.deniedToModify", message: "agents must not edit generated artifacts" });
  }
  return issues;
};

export const validationRules: readonly ValidationRule[] = [
  sourceOfTruthRule,
  workspaceModesRule,
  serviceTargetsRule,
  infrastructureAdaptersRule,
  qualityGatesRule,
  harnessesRule,
  diagramTargetsRule,
  capabilitiesRule,
  agentPolicyRule,
];

export function validateRunSpecFramework(framework: RunSpecApplicationBuilder, plan?: WorkPlan): ValidationResult {
  const frameworkIssues = validationRules.flatMap(rule => rule(framework));
  const planIssues = plan === undefined ? [] : validateWorkPlan(plan).issues;
  const issues = [...frameworkIssues, ...planIssues];
  return { valid: issues.length === 0, issues };
}

export function validateWorkPlan(plan: WorkPlan): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (plan.id.length === 0) issues.push({ path: "plan.id", message: "plan id is required" });
  if (plan.title.length === 0) issues.push({ path: "plan.title", message: "plan title is required" });
  if (plan.thesis.length === 0) issues.push({ path: "plan.thesis", message: "plan thesis is required" });
  if (plan.pr.number <= 0) issues.push({ path: "plan.pr.number", message: "plan.pr.number must be positive" });
  if (plan.pr.branch.length === 0) issues.push({ path: "plan.pr.branch", message: "plan.pr.branch is required" });
  if (plan.commits.length === 0) issues.push({ path: "plan.commits", message: "plan must declare at least one commit" });

  const commitIds = new Set<string>();
  plan.commits.forEach((commit, index) => {
    const base = `plan.commits[${index}]`;
    if (commit.id.length === 0) {
      issues.push({ path: `${base}.id`, message: "commit id is required" });
    } else if (commitIds.has(commit.id)) {
      issues.push({ path: `${base}.id`, message: `duplicate commit id: ${commit.id}` });
    } else {
      commitIds.add(commit.id);
    }
    if (commit.subject.length === 0) issues.push({ path: `${base}.subject`, message: "commit subject is required" });
    if (commit.acceptance.length === 0) issues.push({ path: `${base}.acceptance`, message: "commit must declare at least one acceptance criterion" });

    const criterionIds = new Set<string>();
    commit.acceptance.forEach((criterion, ci) => {
      const cbase = `${base}.acceptance[${ci}]`;
      if (criterion.id.length === 0) {
        issues.push({ path: `${cbase}.id`, message: "acceptance criterion id is required" });
      } else if (criterionIds.has(criterion.id)) {
        issues.push({ path: `${cbase}.id`, message: `duplicate acceptance criterion id: ${criterion.id}` });
      } else {
        criterionIds.add(criterion.id);
      }
      if (criterion.description.length === 0) issues.push({ path: `${cbase}.description`, message: "acceptance criterion description is required" });
      if (!acceptancePredicateKinds.has(criterion.predicate.kind)) {
        issues.push({ path: `${cbase}.predicate.kind`, message: `unknown acceptance predicate kind: ${String(criterion.predicate.kind)}` });
      }
    });
  });

  const followUpIds = new Set<string>();
  plan.followUps.forEach((milestone, index) => {
    const base = `plan.followUps[${index}]`;
    if (milestone.id.length === 0) {
      issues.push({ path: `${base}.id`, message: "followUp id is required" });
    } else if (followUpIds.has(milestone.id)) {
      issues.push({ path: `${base}.id`, message: `duplicate followUp id: ${milestone.id}` });
    } else {
      followUpIds.add(milestone.id);
    }
    if (milestone.title.length === 0) issues.push({ path: `${base}.title`, message: "followUp title is required" });
    if (milestone.thesis.length === 0) issues.push({ path: `${base}.thesis`, message: "followUp thesis is required" });
  });

  plan.followUps.forEach((milestone, mi) => {
    milestone.blockedBy.forEach((blockerId, bi) => {
      if (!followUpIds.has(blockerId)) {
        issues.push({ path: `plan.followUps[${mi}].blockedBy[${bi}]`, message: `unknown blockedBy followUp id: ${blockerId}` });
      }
    });
  });

  plan.delivers.forEach((deliveredId, i) => {
    if (followUpIds.has(deliveredId)) {
      issues.push({ path: `plan.delivers[${i}]`, message: `id "${deliveredId}" cannot be both delivered and listed as remaining followUp` });
    }
  });

  return { valid: issues.length === 0, issues };
}
