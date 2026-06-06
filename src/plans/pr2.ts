import {
  acceptanceCriterion,
  defineWorkPlan,
  followUpMilestone,
  plannedCommit,
} from "../core/builders.js";
import type { AcceptanceCriterion, WorkPlan } from "../core/model.js";

const planSelfValidates: AcceptanceCriterion = acceptanceCriterion({
  id: "plan-self-validates",
  description: "plan parses and passes planRule validation",
  predicate: { kind: "plan-self-validates" },
});

const pr2: WorkPlan = defineWorkPlan({
  id: "pr-2-skeleton-generator-go",
  title: "Skeleton generator abstraction with Go reference implementation",
  thesis:
    "Turn the typed ProductCapability + ServiceTarget into real generated source code. PR #2 ships the SkeletonGenerator abstraction, the CLI `generate` command, and the Go-HTTP template as the reference. Java, Node, and React templates follow as sub-milestones declared in this plan's followUps.",
  pr: { number: 2, branch: "feat/skeleton-generator" },
  constraints: [
    "no Claude/Anthropic attribution anywhere",
    "no filler comments — code self-explains via naming",
    "no markdown specifications — generator output is treated as generated artifact",
    "no scope creep — Java/Node/React templates are explicit sub-milestones, not part of this PR",
    "security and safety always — generated paths are sanitised, no shell strings, no file overwrites without --force",
    "generator output is deterministic: same input always yields byte-identical files",
  ],
  commits: [
    plannedCommit({
      id: "c1-plan-pr2",
      subject: "feat(plans): src/plans/pr2.ts declares this PR as executable plan",
      rationale: "The plan IS code. This file is the source of truth for what PR #2 ships.",
      touches: ["src/plans/pr2.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [planSelfValidates],
    }),
    plannedCommit({
      id: "c2-generator-domain",
      subject: "feat(model): SkeletonGenerator domain types + identity builders",
      rationale: "Typed surface for a generator: language/framework discriminant, generate(capability, service) → GeneratedFile[].",
      touches: ["src/core/model.ts", "src/core/builders.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "builder-exists",
          description: "skeletonGenerator identity builder is exported from core/builders.js",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/builders.ts",
            exportName: "skeletonGenerator",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c3-generator-dispatch",
      subject: "feat(core): generator dispatch with injected file writer",
      rationale: "Pure function maps (framework, request, registry) → GenerationResult. CLI injects a real writer; tests inject a stub.",
      touches: ["src/core/generator.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "generate-exported",
          description: "generate function is exported from core/generator.js",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/generator.ts",
            exportName: "generate",
            check: "is-function",
          },
        }),
        acceptanceCriterion({
          id: "write-generation-result-exported",
          description: "writeGenerationResult function is exported from core/generator.js",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/generator.ts",
            exportName: "writeGenerationResult",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c4-go-http-template",
      subject: "feat(generators): Go HTTP service skeleton template",
      rationale: "First concrete generator. Emits domain/, usecases/, ports/, adapters/, http/, tests/, main.go, go.mod from capability + service-target.",
      touches: ["src/core/generators/go-http.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "go-http-generator-exported",
          description: "goHttpGenerator value is exported from generators/go-http.js",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/generators/go-http.ts",
            exportName: "goHttpGenerator",
            check: "is-object",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c5-cli-generate",
      subject: "feat(cli): generate command with --capability --service --output --dry-run",
      rationale: "User-facing entry point. Wires the dispatch and writer together.",
      touches: ["src/cli.ts", "src/index.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "generate-real-capability-dry-run",
          description: "runspec generate against the real blueprint capability+service exits 0 in --dry-run",
          predicate: {
            kind: "cli-exit",
            argv: ["generate", "--capability", "APPLICATION_BUILDER", "--service", "go-http-service", "--dry-run"],
            expectedExit: 0,
          },
        }),
        acceptanceCriterion({
          id: "generate-missing-capability-exits-two",
          description: "runspec generate without --capability exits 2 (usage error)",
          predicate: { kind: "cli-exit", argv: ["generate"], expectedExit: 2 },
        }),
        acceptanceCriterion({
          id: "index-exports-generate",
          description: "src/index.ts re-exports the generate function from core",
          predicate: {
            kind: "module-export",
            modulePath: "src/index.ts",
            exportName: "generate",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c6-tests",
      subject: "test: generator dispatch + Go template snapshot + cli generate integration",
      rationale: "Coverage for the new domain. Snapshot is deterministic; dispatcher errors are tested with stubs.",
      touches: ["test/generator.test.ts", "test/generators/go-http.test.ts", "test/cli.generate.test.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "generator-test-present",
          description: "test/generator.test.ts exists",
          predicate: { kind: "file-present", path: "test/generator.test.ts" },
        }),
        acceptanceCriterion({
          id: "go-http-test-present",
          description: "test/generators/go-http.test.ts exists",
          predicate: { kind: "file-present", path: "test/generators/go-http.test.ts" },
        }),
        acceptanceCriterion({
          id: "cli-generate-test-present",
          description: "test/cli.generate.test.ts exists",
          predicate: { kind: "file-present", path: "test/cli.generate.test.ts" },
        }),
      ],
    }),
    plannedCommit({
      id: "c7-readme",
      subject: "docs(readme): document runspec generate and skeleton-generator status",
      rationale: "Surface the new command and the language sub-milestone split.",
      touches: ["README.md"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "readme-preserves-mermaid-diagrams",
          description: "README retains the architecture mermaid diagrams from PR #1",
          predicate: { kind: "readme-mermaid-blocks", path: "README.md", min: 2 },
        }),
        acceptanceCriterion({
          id: "verify-markdown-still-passes",
          description: "verify-markdown still exits 0 after README edits",
          predicate: { kind: "cli-exit", argv: ["verify-markdown"], expectedExit: 0 },
        }),
      ],
    }),
  ],
  delivers: ["skeleton-generator"],
  followUps: [
    followUpMilestone({
      id: "skeleton-generator-spring-boot",
      title: "Spring Boot service skeleton template",
      thesis: "Add a Java Spring Boot generator that emits domain/, application-services/, repositories/, controllers/, messaging/, configuration/, tests/, pom.xml or build.gradle, application.yaml.",
      outcomes: [
        "springBootGenerator value exists in src/core/generators/spring-boot.ts",
        "generated Java compiles in a Spring Boot project",
        "snapshot test covers the a Spring Boot capability",
      ],
      nonGoals: ["picking between Maven and Gradle opinionatedly — start with one and document the choice"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "skeleton-generator-node-http",
      title: "Node.js HTTP service skeleton template",
      thesis: "Add a TypeScript Node.js HTTP generator that emits domain/, usecases/, repositories/, http/, messaging/, config/, tests/, package.json, tsconfig.json.",
      outcomes: [
        "nodeHttpGenerator value exists in src/core/generators/node-http.ts",
        "generated TS compiles standalone with tsc",
        "snapshot test covers the a Node HTTP capability",
      ],
      nonGoals: ["picking an HTTP framework opinionatedly — generator stays framework-light"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "skeleton-generator-react",
      title: "React UI skeleton template",
      thesis: "Add a frontend generator that emits components/, pages/, hooks/, contracts/, tests/, package.json, tsconfig.json, vite or next config.",
      outcomes: [
        "reactGenerator value exists in src/core/generators/react.ts",
        "generated TS+React compiles standalone",
        "snapshot test covers a UI capability",
      ],
      nonGoals: ["picking between Vite, Next, Remix opinionatedly"],
      blockedBy: ["frontend-coverage"],
    }),
    followUpMilestone({
      id: "skeleton-generator-go-worker",
      title: "Go worker skeleton template",
      thesis: "Add a Go worker (event-consumer) generator that emits handlers/, event-consumers/, event-producers/, idempotency/, config/, tests/, main.go, go.mod.",
      outcomes: [
        "goWorkerGenerator value exists in src/core/generators/go-worker.ts",
        "generated Go compiles and links Kafka or RabbitMQ libs as declared by the adapter",
        "snapshot test covers the a Go worker capability",
      ],
      nonGoals: ["choosing a Kafka client library opinionatedly"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "harness-runner",
      title: "Verification harness runner",
      thesis: "Execute scenario-declared harnesses; collect evidence under .runspec/generated/evidence/.",
      outcomes: [
        "runspec run-harnesses executes each declared harness",
        "evidence files written with scenario id and timestamp",
        "failed harnesses block the agent until fixed",
      ],
      nonGoals: ["replacing existing test frameworks"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "gate-executor",
      title: "Quality gate executor",
      thesis: "Run each QualityGate.command, store evidence at gate.evidence, block agent completion until all blocking gates pass.",
      outcomes: [
        "runspec run-gates exits 0 iff every blocking gate passes",
        "evidence written to gate.evidence path",
      ],
      nonGoals: ["bypassing blocking gates under any circumstance"],
      blockedBy: ["harness-runner"],
    }),
    followUpMilestone({
      id: "frontend-coverage",
      title: "Frontend coverage in the model",
      thesis: "Extend ServiceTarget kinds and harness kinds so frontend apps are first-class.",
      outcomes: [
        "ServiceTarget supports typescript:react-spa, typescript:next, typescript:vue",
        "HarnessKind adds ui-component, accessibility, visual-regression, bundle-size",
        "GateKind adds accessibility and frontend-security (CSP/XSS/CORS)",
        "an example demonstrates a frontend service",
      ],
      nonGoals: ["picking a frontend framework opinionatedly — generator stays pluggable"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "watch-mode",
      title: "Continuous validation in watch mode",
      thesis: "Re-run validators on every file change so the agent feedback loop is tight.",
      outcomes: [
        "runspec watch re-runs verify-blueprint and verify-plan on src/** changes",
        "pre-commit hook calls runspec verify-blueprint by default",
      ],
      nonGoals: ["replacing IDE diagnostics"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "npm-publish",
      title: "Publish runspec to npm",
      thesis: "Downstream consumers install via npm i runspec.",
      outcomes: [
        "package.json private flag removed when ready",
        "npm publish workflow under .github/workflows",
        "semver tagging on main",
      ],
      nonGoals: ["publishing before the public api is frozen"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "eslint-or-biome-config",
      title: "Linting beyond tsc",
      thesis: "Catch style/quality bugs the compiler can't.",
      outcomes: [
        "ESLint or Biome configured with project rules",
        "pre-commit invokes the linter",
      ],
      nonGoals: ["adopting a style guide the team hasn't approved"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "ci-coverage-gating",
      title: "Enforced test coverage in CI",
      thesis: "Promote informational coverage to a blocking gate.",
      outcomes: [
        "test:coverage runs c8 or node --experimental-test-coverage with a threshold",
        ".github/workflows/verify.yml fails the build below threshold",
      ],
      nonGoals: ["chasing 100 percent at the expense of meaningful tests"],
      blockedBy: ["harness-runner"],
    }),
    followUpMilestone({
      id: "makefile-language-adapters",
      title: "Language adapter Makefiles wired into the generator",
      thesis: "Each languages/<x>/Makefile is invoked by runspec generate to scaffold language-specific code.",
      outcomes: [
        "runspec generate dispatches to languages/<lang>/Makefile",
        "agnostic, golang, java, python, typescript adapters work end-to-end",
      ],
      nonGoals: ["forcing a build system on downstream projects"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "additional-agent-task-shapes",
      title: "Richer agent task derivation",
      thesis: "Beyond 'fix framework' and 'implement vertical slice': 'add capability', 'add scenario', 'add threat', 'tighten gate'.",
      outcomes: [
        "nextAgentTask handles each new task kind",
        "tasks are derived from a blueprint diff against the prior commit",
      ],
      nonGoals: ["task kinds the framework cannot verify"],
      blockedBy: [],
    }),
    followUpMilestone({
      id: "cross-agent-policy-export",
      title: "Cross-agent policy export",
      thesis: "Emit .cursor/, .aider/, Copilot Workspace, Codex configuration from one runspec AgentPolicy.",
      outcomes: [
        "runspec export-agent-policy writes per-tool config files",
        "agentPolicy.allowedToModify and deniedToModify map deterministically to each tool's syntax",
      ],
      nonGoals: ["maintaining tool-specific features outside the policy"],
      blockedBy: [],
    }),
  ],
});

export default pr2;
