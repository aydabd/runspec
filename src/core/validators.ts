import type {
  ProductCapability,
  RunSpecApplicationBuilder,
  ThreatModel,
  ValidationIssue,
  ValidationResult,
} from "./model.js";

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
  require(policy.handWrittenMarkdownFiles.length === 1 && policy.handWrittenMarkdownFiles[0] === "README.md", "sourceOfTruth.handWrittenMarkdownFiles", "only README.md may be hand-written markdown", issues);
}

function validateCollections(framework: RunSpecApplicationBuilder, issues: ValidationIssue[]): void {
  require(framework.workspaceCapabilities.length >= 3, "workspaceCapabilities", "single-service, monorepo, and multi-repo modes must be modeled", issues);
  require(framework.serviceTargets.length >= 3, "serviceTargets", "Go, Spring Boot, and TypeScript service targets must be modeled", issues);
  require(framework.infrastructureAdapters.some(adapter => adapter.kind === "postgres"), "infrastructureAdapters.postgres", "Postgres adapter is required", issues);
  require(framework.infrastructureAdapters.some(adapter => adapter.kind === "kafka"), "infrastructureAdapters.kafka", "Kafka adapter is required", issues);
  require(framework.infrastructureAdapters.some(adapter => adapter.kind === "rabbitmq"), "infrastructureAdapters.rabbitmq", "RabbitMQ adapter is required", issues);
  require(framework.qualityGates.every(gate => gate.blocking), "qualityGates", "all initial quality gates must be blocking", issues);
  require(framework.harnesses.length > 0, "harnesses", "verification harnesses are required", issues);
  require(framework.diagramTargets.length > 0, "diagramTargets", "diagram generation targets are required", issues);
}

function validateCapabilities(capabilities: readonly ProductCapability[], threatModels: readonly ThreatModel[], issues: ValidationIssue[]): void {
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
