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

const pr4: WorkPlan = defineWorkPlan({
  id: "pr-4-skeleton-generator-node-http",
  title: "Node.js HTTP TypeScript service skeleton template",
  thesis:
    "Add the TypeScript Node.js HTTP generator to the skeleton-generator registry, mirroring the Go and Spring Boot references. Emits a TypeScript project using only the node:http standard library (framework-light), with domain/usecases/ports/adapters/repositories packages and one node:test stub per scenario. Also extracts the duplicated comment-sanitisation and pascalCase helpers from go-http.ts and spring-boot.ts into a single shared module.",
  pr: { number: 4, branch: "main" },
  constraints: [
    "no Claude/Anthropic attribution anywhere",
    "no filler comments — code self-explains via naming",
    "no markdown specifications — generator output is treated as generated artifact",
    "no scope creep — only Node HTTP template plus the helper extraction it shares with the other generators",
    "security and safety always — control chars sanitised in headers, identifiers guarded against digit leading, paths cannot escape outputRoot",
    "generator output is deterministic: same input always yields byte-identical files",
    "latest stable language version — TypeScript 5.x, Node >=24",
  ],
  commits: [
    plannedCommit({
      id: "c1-plan-pr4",
      subject: "feat(plans): src/plans/pr4.ts declares this PR as executable plan",
      rationale: "The plan IS code. This file is the source of truth for what PR #4 ships.",
      touches: ["src/plans/pr4.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [planSelfValidates],
    }),
    plannedCommit({
      id: "c2-shared-helpers",
      subject: "refactor(generators): extract sanitiseForComment + pascalCase into _shared.ts",
      rationale: "Three generators is two too many copies. Single source of truth for control-char sanitisation and identifier hardening; go-http and spring-boot import from the new module.",
      touches: [
        "src/core/generators/_shared.ts",
        "src/core/generators/go-http.ts",
        "src/core/generators/spring-boot.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "shared-sanitise-for-comment-exported",
          description: "_shared.ts exports sanitiseForComment",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/generators/_shared.ts",
            exportName: "sanitiseForComment",
            check: "is-function",
          },
        }),
        acceptanceCriterion({
          id: "shared-pascal-case-exported",
          description: "_shared.ts exports pascalCase",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/generators/_shared.ts",
            exportName: "pascalCase",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c3-node-http-template",
      subject: "feat(generators): Node.js HTTP TypeScript skeleton template + CLI registry wiring",
      rationale: "Third generator. Emits a framework-light TypeScript service using only node:http and node:test.",
      touches: [
        "src/core/generators/node-http.ts",
        "src/cli.ts",
        "src/index.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "node-http-generator-exported",
          description: "nodeHttpGenerator is exported from generators/node-http.js",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/generators/node-http.ts",
            exportName: "nodeHttpGenerator",
            check: "is-object",
          },
        }),
        acceptanceCriterion({
          id: "index-exports-node-http-generator",
          description: "src/index.ts re-exports nodeHttpGenerator",
          predicate: {
            kind: "module-export",
            modulePath: "src/index.ts",
            exportName: "nodeHttpGenerator",
            check: "is-object",
          },
        }),
        acceptanceCriterion({
          id: "cli-generate-node-http-dry-run",
          description: "runspec generate against typescript-node-service exits 0 in --dry-run",
          predicate: {
            kind: "cli-exit",
            argv: ["generate", "--capability", "APPLICATION_BUILDER", "--service", "typescript-node-service", "--dry-run"],
            expectedExit: 0,
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c4-tests",
      subject: "test: Node HTTP generator snapshot + shared helper tests",
      rationale: "Per-file shape tests for the TS output and unit tests for the new shared helpers.",
      touches: [
        "test/generators/node-http.test.ts",
        "test/generators/shared.test.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "node-http-test-present",
          description: "test/generators/node-http.test.ts exists",
          predicate: { kind: "file-present", path: "test/generators/node-http.test.ts" },
        }),
        acceptanceCriterion({
          id: "shared-test-present",
          description: "test/generators/shared.test.ts exists",
          predicate: { kind: "file-present", path: "test/generators/shared.test.ts" },
        }),
      ],
    }),
    plannedCommit({
      id: "c5-readme",
      subject: "docs(readme): document Node HTTP template availability",
      rationale: "Surface the new language target alongside Go and Spring Boot.",
      touches: ["README.md"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "readme-preserves-mermaid-diagrams",
          description: "README retains the architecture mermaid diagrams",
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
  delivers: ["skeleton-generator-node-http"],
  followUps: [
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

export default pr4;
