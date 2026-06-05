import type {
  AcceptancePredicate,
  ProductCapability,
  RunSpecApplicationBuilder,
  ThreatModel,
  ValidationIssue,
  ValidationResult,
  WorkPlan,
} from "./model.js";

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

export function validateRunSpecFramework(framework: RunSpecApplicationBuilder): ValidationResult {
  const issues: ValidationIssue[] = [];

  validateSourceOfTruth(framework, issues);
  validateCollections(framework, issues);
  validateCapabilities(framework.productCapabilities, framework.threatModels, issues);
  validateAgentPolicy(framework, issues);

  return { valid: issues.length === 0, issues };
}

function validateSourceOfTruth(framework: RunSpecApplicationBuilder, issues: ValidationIssue[]): void {
  const policy = framework.sourceOfTruth;

  require(policy.executableDefinitionsOnly, "sourceOfTruth.executableDefinitionsOnly", "source of truth must be executable definitions", issues);
  require(!policy.commentsAsSpecificationAllowed, "sourceOfTruth.commentsAsSpecificationAllowed", "comments cannot be accepted as specifications", issues);
  require(!policy.externalSpecFrameworksAllowed, "sourceOfTruth.externalSpecFrameworksAllowed", "external markdown-first spec frameworks cannot be source of truth", issues);
  require(policy.generatedArtifactsAreReadOnlyForAgents, "sourceOfTruth.generatedArtifactsAreReadOnlyForAgents", "generated artifacts must be read-only for agents", issues);
  require(policy.generatedArtifactDirectory === ".runspec/generated", "sourceOfTruth.generatedArtifactDirectory", "generated artifacts must live under .runspec/generated", issues);
  const md = policy.markdownPolicy;
  require(md.humanOnboarding.includes("README.md"), "sourceOfTruth.markdownPolicy.humanOnboarding", "README.md must be declared as a human-onboarding markdown file", issues);
  require(md.humanOnboarding.every(path => path.length > 0 && !path.endsWith("/")), "sourceOfTruth.markdownPolicy.humanOnboarding", "human-onboarding entries must be non-empty file paths", issues);
  require(md.agentRuntimeConfiguration.every(path => path.length > 0), "sourceOfTruth.markdownPolicy.agentRuntimeConfiguration", "agent-runtime-configuration entries must be non-empty", issues);
  require(md.excludedDirectories.includes(".git") && md.excludedDirectories.includes("node_modules"), "sourceOfTruth.markdownPolicy.excludedDirectories", ".git and node_modules must be excluded from markdown scanning", issues);
}

function validateCollections(framework: RunSpecApplicationBuilder, issues: ValidationIssue[]): void {
  const workspaceModes = new Set(framework.workspaceCapabilities.map(capability => capability.mode));
  const serviceTargets = new Set(framework.serviceTargets.map(target => `${target.language}:${target.framework}`));

  require(workspaceModes.has("single-service") && workspaceModes.has("monorepo") && workspaceModes.has("multi-repo"), "workspaceCapabilities", "single-service, monorepo, and multi-repo modes must be modeled", issues);
  require(serviceTargets.has("go:go-http") && serviceTargets.has("java:spring-boot") && serviceTargets.has("typescript:node-http"), "serviceTargets", "Go, Spring Boot, and TypeScript service targets must be modeled", issues);
  require(framework.infrastructureAdapters.some(adapter => adapter.kind === "postgres"), "infrastructureAdapters.postgres", "Postgres adapter is required", issues);
  require(framework.infrastructureAdapters.some(adapter => adapter.kind === "kafka"), "infrastructureAdapters.kafka", "Kafka adapter is required", issues);
  require(framework.infrastructureAdapters.some(adapter => adapter.kind === "rabbitmq"), "infrastructureAdapters.rabbitmq", "RabbitMQ adapter is required", issues);
  require(framework.qualityGates.length > 0, "qualityGates", "at least one quality gate is required", issues);
  require(framework.qualityGates.length > 0 && framework.qualityGates.every(gate => gate.blocking), "qualityGates", "all initial quality gates must be blocking", issues);
  require(framework.harnesses.length > 0, "harnesses", "verification harnesses are required", issues);
  require(framework.diagramTargets.length > 0, "diagramTargets", "diagram generation targets are required", issues);
}

function validateCapabilities(capabilities: readonly ProductCapability[], threatModels: readonly ThreatModel[], issues: ValidationIssue[]): void {
  const capabilityIds = new Set(capabilities.map(capability => capability.id));
  const threatIds = new Set(threatModels.flatMap(model => model.threats.map(threat => threat.id)));
  const scenarioIds = new Set(capabilities.flatMap(capability => capability.scenarios.map(scenario => scenario.id)));

  for (const capability of capabilities) {
    require(capability.id.length > 0, `productCapabilities.${capability.id}.id`, "capability id is required", issues);
    require(capability.implementation.generatedSkeletonRequired, `productCapabilities.${capability.id}.implementation.generatedSkeletonRequired`, "implementation skeleton must be generated from executable capability", issues);
    require(capability.scenarios.length > 0, `productCapabilities.${capability.id}.scenarios`, "capability must define executable scenarios", issues);
    require(capability.gates.includes("requirement"), `productCapabilities.${capability.id}.gates`, "requirement gate is required", issues);
    require(capability.gates.includes("implementation"), `productCapabilities.${capability.id}.gates`, "implementation gate is required", issues);
    require(capability.gates.includes("security"), `productCapabilities.${capability.id}.gates`, "security gate is required", issues);
    require(capability.gates.includes("threat-model"), `productCapabilities.${capability.id}.gates`, "threat-model gate is required", issues);
    require(capability.observability.correlationIdRequired, `productCapabilities.${capability.id}.observability.correlationIdRequired`, "correlation id is required", issues);

    for (const scenario of capability.scenarios) {
      require(scenario.harnesses.length > 0, `productCapabilities.${capability.id}.scenarios.${scenario.id}.harnesses`, "scenario must select executable harnesses", issues);
      for (const threatId of scenario.verifiesThreats) {
        require(threatIds.has(threatId), `productCapabilities.${capability.id}.scenarios.${scenario.id}.verifiesThreats`, `unknown threat: ${threatId}`, issues);
      }
    }
  }

  for (const model of threatModels) {
    require(capabilityIds.has(model.capabilityId), `threatModels.${model.id}.capabilityId`, `unknown capability: ${model.capabilityId}`, issues);

    for (const threat of model.threats) {
      require(threat.verifiedByScenarioIds.length > 0, `threatModels.${model.id}.threats.${threat.id}.verifiedByScenarioIds`, "threat must be verified by executable scenario", issues);
      for (const scenarioId of threat.verifiedByScenarioIds) {
        require(scenarioIds.has(scenarioId), `threatModels.${model.id}.threats.${threat.id}.verifiedByScenarioIds`, `unknown scenario: ${scenarioId}`, issues);
      }
    }
  }
}

function validateAgentPolicy(framework: RunSpecApplicationBuilder, issues: ValidationIssue[]): void {
  const policy = framework.agentPolicy;

  require(policy.completionRequiresAllBlockingGates, "agentPolicy.completionRequiresAllBlockingGates", "agent completion must require all blocking gates", issues);
  require(policy.requiredCommandsBeforeCompletion.includes("npm test"), "agentPolicy.requiredCommandsBeforeCompletion", "npm test must be required before completion", issues);
  require(policy.deniedToModify.includes(".runspec/generated/**"), "agentPolicy.deniedToModify", "agents must not edit generated artifacts", issues);
}

function require(condition: boolean, path: string, message: string, issues: ValidationIssue[]): void {
  if (!condition) {
    issues.push({ path, message });
  }
}

export function validateWorkPlan(plan: WorkPlan): ValidationResult {
  const issues: ValidationIssue[] = [];

  require(plan.id.length > 0, "plan.id", "plan id is required", issues);
  require(plan.title.length > 0, "plan.title", "plan title is required", issues);
  require(plan.thesis.length > 0, "plan.thesis", "plan thesis is required", issues);
  require(plan.pr.number > 0, "plan.pr.number", "plan.pr.number must be positive", issues);
  require(plan.pr.branch.length > 0, "plan.pr.branch", "plan.pr.branch is required", issues);
  require(plan.commits.length > 0, "plan.commits", "plan must declare at least one commit", issues);

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
    require(commit.subject.length > 0, `${base}.subject`, "commit subject is required", issues);
    require(commit.acceptance.length > 0, `${base}.acceptance`, "commit must declare at least one acceptance criterion", issues);

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
      require(criterion.description.length > 0, `${cbase}.description`, "acceptance criterion description is required", issues);
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
    require(milestone.title.length > 0, `${base}.title`, "followUp title is required", issues);
    require(milestone.thesis.length > 0, `${base}.thesis`, "followUp thesis is required", issues);
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
