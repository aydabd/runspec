export type WorkspaceMode = "single-service" | "monorepo" | "multi-repo" | "hybrid";
export type ServiceLanguage = "go" | "java" | "typescript";
export type ServiceFramework = "go-http" | "spring-boot" | "node-http" | "worker";
export type InfrastructureKind = "postgres" | "kafka" | "rabbitmq" | "redis" | "vault" | "object-storage";
export type GateKind = "requirement" | "implementation" | "architecture" | "api" | "messaging" | "database" | "security" | "threat-model" | "observability" | "integration" | "report" | "repository-hygiene";
export type HarnessKind = "unit" | "domain" | "api" | "contract" | "event-producer" | "event-consumer" | "database" | "security" | "threat-model" | "architecture" | "observability" | "integration" | "e2e";
export type DiagramKind = "flowchart" | "sequence" | "component" | "deployment" | "threat-model";
export type DeliveryGuarantee = "at-most-once" | "at-least-once" | "exactly-once";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export type RunSpecApplicationBuilder = {
  readonly name: string;
  readonly purpose: string;
  readonly sourceOfTruth: SourceOfTruthPolicy;
  readonly workspaceCapabilities: readonly WorkspaceCapability[];
  readonly serviceTargets: readonly ServiceTarget[];
  readonly infrastructureAdapters: readonly InfrastructureAdapter[];
  readonly productCapabilities: readonly ProductCapability[];
  readonly flows: readonly ProductFlow[];
  readonly threatModels: readonly ThreatModel[];
  readonly qualityGates: readonly QualityGate[];
  readonly harnesses: readonly VerificationHarness[];
  readonly diagramTargets: readonly DiagramTarget[];
  readonly agentPolicy: AgentPolicy;
};

export type SourceOfTruthPolicy = {
  readonly executableDefinitionsOnly: boolean;
  readonly markdownPolicy: MarkdownPolicy;
  readonly generatedArtifactDirectory: string;
  readonly generatedArtifactsAreReadOnlyForAgents: boolean;
  readonly commentsAsSpecificationAllowed: boolean;
  readonly externalSpecFrameworksAllowed: boolean;
};

export type MarkdownPolicy = {
  readonly humanOnboarding: readonly string[];
  readonly agentRuntimeConfiguration: readonly string[];
  readonly excludedDirectories: readonly string[];
};

export type WorkspaceCapability = {
  readonly mode: WorkspaceMode;
  readonly supportsMultipleServices: boolean;
  readonly supportsSharedLibraries: boolean;
  readonly supportsIndependentServiceVerification: boolean;
  readonly supportsCrossServiceVerification: boolean;
  readonly supportsGeneratedCiTopology: boolean;
};

export type ServiceTarget = {
  readonly id: string;
  readonly language: ServiceLanguage;
  readonly framework: ServiceFramework;
  readonly layers: readonly string[];
  readonly generatedCodeAreas: readonly string[];
  readonly requiredHarnesses: readonly HarnessKind[];
  readonly requiredGates: readonly GateKind[];
};

export type InfrastructureAdapter = {
  readonly kind: InfrastructureKind;
  readonly generatedAssets: readonly string[];
  readonly harnesses: readonly HarnessKind[];
  readonly gates: readonly GateKind[];
};

export type ProductCapability = {
  readonly id: string;
  readonly title: string;
  readonly actor: string;
  readonly businessOutcome: string;
  readonly ownerService: string;
  readonly implementation: ImplementationContract;
  readonly scenarios: readonly Scenario[];
  readonly contracts: CapabilityContracts;
  readonly security: CapabilitySecurity;
  readonly observability: CapabilityObservability;
  readonly gates: readonly GateKind[];
};

export type ImplementationContract = {
  readonly domainObjects: readonly string[];
  readonly useCases: readonly string[];
  readonly ports: readonly string[];
  readonly adapters: readonly string[];
  readonly repositories: readonly string[];
  readonly generatedSkeletonRequired: boolean;
};

export type Scenario = {
  readonly id: string;
  readonly title: string;
  readonly given: readonly string[];
  readonly when: string;
  readonly then: readonly string[];
  readonly verifiesThreats: readonly string[];
  readonly harnesses: readonly HarnessKind[];
};

export type CapabilityContracts = {
  readonly http: readonly HttpContract[];
  readonly events: readonly EventContract[];
  readonly data: readonly DataEntity[];
};

export type HttpContract = {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly successStatus: number;
  readonly errorModel: string;
  readonly authenticated: boolean;
};

export type EventContract = {
  readonly name: string;
  readonly producer: string;
  readonly consumers: readonly string[];
  readonly schema: string;
  readonly delivery: DeliveryGuarantee;
  readonly idempotencyKey: string;
  readonly deadLetterPolicy: string;
};

export type DataEntity = {
  readonly name: string;
  readonly store: InfrastructureKind;
  readonly classification: DataClassification;
  readonly fields: readonly DataField[];
  readonly migrationRequired: boolean;
};

export type DataField = {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly pii: boolean;
};

export type CapabilitySecurity = {
  readonly authentication: string;
  readonly authorization: readonly string[];
  readonly validation: readonly string[];
  readonly sensitiveDataRules: readonly string[];
};

export type CapabilityObservability = {
  readonly traces: readonly string[];
  readonly metrics: readonly string[];
  readonly logs: readonly string[];
  readonly correlationIdRequired: boolean;
};

export type ProductFlow = {
  readonly id: string;
  readonly title: string;
  readonly capabilityId: string;
  readonly participants: readonly string[];
  readonly steps: readonly FlowStep[];
};

export type FlowStep = {
  readonly from: string;
  readonly to: string;
  readonly action: string;
  readonly contract?: string;
};

export type ThreatModel = {
  readonly id: string;
  readonly capabilityId: string;
  readonly assets: readonly string[];
  readonly entrypoints: readonly string[];
  readonly threats: readonly Threat[];
};

export type Threat = {
  readonly id: string;
  readonly category: "spoofing" | "tampering" | "repudiation" | "information-disclosure" | "denial-of-service" | "elevation-of-privilege";
  readonly scenario: string;
  readonly mitigations: readonly string[];
  readonly verifiedByScenarioIds: readonly string[];
};

export type QualityGate = {
  readonly kind: GateKind;
  readonly name: string;
  readonly blocking: boolean;
  readonly command: Command;
  readonly evidence: string;
};

export type Command = {
  readonly program: string;
  readonly args: readonly string[];
};

export type VerificationHarness = {
  readonly kind: HarnessKind;
  readonly name: string;
  readonly generatedFor: readonly string[];
  readonly requiredForProduction: boolean;
  readonly command: Command;
  readonly evidenceDir: string;
};

export type DiagramTarget = {
  readonly kind: DiagramKind;
  readonly source: "workspace" | "capability" | "flow" | "threat-model";
  readonly outputFormat: "mermaid" | "plantuml" | "json";
  readonly generatedOnly: boolean;
};

export type AgentPolicy = {
  readonly agentReads: readonly string[];
  readonly allowedToModify: readonly string[];
  readonly deniedToModify: readonly string[];
  readonly requiredCommandsBeforeCompletion: readonly string[];
  readonly completionRequiresAllBlockingGates: boolean;
  readonly nextTaskStrategy: "first-failing-gate" | "highest-risk-first" | "capability-order";
};

export type EnterpriseApplicationExample = {
  readonly name: string;
  readonly workspaceMode: WorkspaceMode;
  readonly services: readonly ExampleService[];
  readonly infrastructure: readonly InfrastructureKind[];
  readonly capabilities: readonly string[];
};

export type ExampleService = {
  readonly id: string;
  readonly language: ServiceLanguage;
  readonly framework: ServiceFramework;
  readonly ownsCapabilities: readonly string[];
  readonly consumesEvents: readonly string[];
  readonly publishesEvents: readonly string[];
  readonly storesDataIn: readonly InfrastructureKind[];
};

export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
};

export type ValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
};

export type GeneratedFile = {
  readonly path: string;
  readonly content: string;
};

export type SkeletonGenerator = {
  readonly id: string;
  readonly description: string;
  readonly language: ServiceLanguage;
  readonly framework: ServiceFramework;
  readonly generate: (capability: ProductCapability, service: ServiceTarget) => readonly GeneratedFile[];
};

export type GenerationRequest = {
  readonly capabilityId: string;
  readonly serviceId: string;
  readonly outputRoot: string;
};

export type GenerationResult = {
  readonly request: GenerationRequest;
  readonly capability: ProductCapability;
  readonly service: ServiceTarget;
  readonly generator: SkeletonGenerator;
  readonly files: readonly GeneratedFile[];
};

export type FileWriter = (outputRoot: string, relativePath: string, content: string) => void;

export type HarnessRunOutcome = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
};

export type HarnessEnvironment = {
  readonly run: (command: Command, cwd: string) => HarnessRunOutcome;
  readonly writeEvidence: (evidenceDir: string, fileName: string, content: string) => string;
  readonly now: () => string;
  readonly cwd: string;
};

export type HarnessResult = {
  readonly kind: HarnessKind;
  readonly name: string;
  readonly command: Command;
  readonly exitCode: number;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly evidencePath: string;
};

export type HarnessReport = {
  readonly results: readonly HarnessResult[];
  readonly passed: boolean;
};

export type HarnessRunOptions = {
  readonly scenarioId?: string;
  readonly dryRun?: boolean;
};

export type WorkPlan = {
  readonly id: string;
  readonly title: string;
  readonly thesis: string;
  readonly pr: PullRequestReference;
  readonly constraints: readonly string[];
  readonly commits: readonly PlannedCommit[];
  readonly delivers: readonly string[];
  readonly followUps: readonly FollowUpMilestone[];
};

export type PullRequestReference = {
  readonly number: number;
  readonly branch: string;
};

export type PlannedCommit = {
  readonly id: string;
  readonly subject: string;
  readonly rationale: string;
  readonly touches: readonly string[];
  readonly mustNotTouch: readonly string[];
  readonly acceptance: readonly AcceptanceCriterion[];
};

export type AcceptanceCriterion = {
  readonly id: string;
  readonly description: string;
  readonly predicate: AcceptancePredicate;
};

export type AcceptancePredicate =
  | ModuleExportPredicate
  | ModulePropertyEqualsPredicate
  | FilePresentPredicate
  | FileAbsentPredicate
  | TsconfigFlagPredicate
  | PackageJsonFieldPredicate
  | NpmScriptPassesPredicate
  | CliExitPredicate
  | ReadmeMermaidBlocksPredicate
  | PlanSelfValidatesPredicate;

export type ModuleExportPredicate = {
  readonly kind: "module-export";
  readonly modulePath: string;
  readonly exportName: string;
  readonly check: "is-function" | "is-array" | "is-object";
};

export type ModulePropertyEqualsPredicate = {
  readonly kind: "module-property-equals";
  readonly modulePath: string;
  readonly exportName: string;
  readonly path: readonly string[];
  readonly expected: unknown;
};

export type FilePresentPredicate = {
  readonly kind: "file-present";
  readonly path: string;
};

export type FileAbsentPredicate = {
  readonly kind: "file-absent";
  readonly path: string;
};

export type TsconfigFlagPredicate = {
  readonly kind: "tsconfig-flag";
  readonly flag: string;
  readonly expected: boolean;
};

export type PackageJsonFieldPredicate = {
  readonly kind: "package-json-field";
  readonly path: readonly string[];
  readonly expected: unknown;
};

export type NpmScriptPassesPredicate = {
  readonly kind: "npm-script-passes";
  readonly script: string;
};

export type CliExitPredicate = {
  readonly kind: "cli-exit";
  readonly argv: readonly string[];
  readonly cwd?: string;
  readonly expectedExit: number;
};

export type ReadmeMermaidBlocksPredicate = {
  readonly kind: "readme-mermaid-blocks";
  readonly path: string;
  readonly min: number;
};

export type PlanSelfValidatesPredicate = {
  readonly kind: "plan-self-validates";
};

export const acceptancePredicateKinds = [
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
] as const;

type _NoMissingPredicateKinds = Exclude<AcceptancePredicate["kind"], typeof acceptancePredicateKinds[number]> extends never ? true : false;
type _NoExtraPredicateKinds = typeof acceptancePredicateKinds[number] extends AcceptancePredicate["kind"] ? true : false;
export const acceptancePredicateKindsAreExhaustive: _NoMissingPredicateKinds & _NoExtraPredicateKinds = true;

export type FollowUpMilestone = {
  readonly id: string;
  readonly title: string;
  readonly thesis: string;
  readonly outcomes: readonly string[];
  readonly nonGoals: readonly string[];
  readonly blockedBy: readonly string[];
};

export type AcceptancePredicateFailure = {
  readonly predicateKind: AcceptancePredicate["kind"];
  readonly criterionId: string;
  readonly message: string;
};

export type CommitAcceptanceStatus = {
  readonly id: string;
  readonly accepted: boolean;
  readonly failures: readonly AcceptancePredicateFailure[];
};

export type PlanStatus = {
  readonly planId: string;
  readonly commits: readonly CommitAcceptanceStatus[];
  readonly followUps: readonly FollowUpSummary[];
  readonly delivers: readonly string[];
};

export type FollowUpSummary = {
  readonly id: string;
  readonly title: string;
  readonly blockedBy: readonly string[];
};

export type PlanStepTask = {
  readonly id: string;
  readonly subject: string;
  readonly rationale: string;
  readonly touches: readonly string[];
  readonly mustNotTouch: readonly string[];
  readonly acceptance: readonly AcceptanceCriterion[];
  readonly failures: readonly AcceptancePredicateFailure[];
};

export type PlanEnvironment = {
  readonly readFile: (path: string) => string;
  readonly fileExists: (path: string) => boolean;
  readonly importModule: (modulePath: string) => Promise<Record<string, unknown>>;
  readonly runCli: (argv: readonly string[], cwd: string) => Promise<{ readonly exitCode: number }>;
  readonly runNpmScript: (script: string, cwd: string) => Promise<{ readonly exitCode: number }>;
  readonly validatePlan: (plan: WorkPlan) => ValidationResult;
  readonly cwd: string;
};
