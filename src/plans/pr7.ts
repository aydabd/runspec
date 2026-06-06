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

const pr7: WorkPlan = defineWorkPlan({
  id: "pr-7-gate-executor",
  title: "Quality gate executor",
  thesis:
    "Run each QualityGate.command, store evidence at gate.evidence, exit non-zero when any blocking gate fails. Unifies the shared Command type so QualityGate and VerificationHarness use the same structured { program, args } shape; the runspec blueprint's 12 quality gates are populated with real commands (no more shell strings or fake `runspec verify X` placeholders).",
  pr: { number: 7, branch: "main" },
  constraints: [
    "no Claude/Anthropic attribution anywhere",
    "no filler comments — code self-explains via naming",
    "no markdown specifications",
    "no scope creep — only the Command type unification + gate executor + tests + docs",
    "security and safety always — commands spawn via shell=false, evidence paths cannot escape repo root",
    "core executor stays pure; spawn + fs live behind a GateEnvironment interface",
    "exit 1 when any blocking gate fails so CI catches regressions",
  ],
  commits: [
    plannedCommit({
      id: "c1-plan-pr7",
      subject: "feat(plans): src/plans/pr7.ts declares this PR as executable plan",
      rationale: "The plan IS code.",
      touches: ["src/plans/pr7.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [planSelfValidates],
    }),
    plannedCommit({
      id: "c2-shared-command-type",
      subject: "refactor(model): unify HarnessCommand → Command; QualityGate.command becomes structured",
      rationale: "Same anti-shell-string thesis applied to gates as to harnesses. Blueprint's 12 gates now declare program/args; legacy shell strings like \"runspec verify requirements\" replaced with real commands or node -e exit 0 placeholders.",
      touches: [
        "src/core/model.ts",
        "src/core/runner.ts",
        "src/cli.ts",
        "src/index.ts",
        "src/blueprint/runSpecFramework.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "verify-blueprint-still-passes-after-unification",
          description: "verify-blueprint exits 0 after the Command refactor",
          predicate: { kind: "cli-exit", argv: ["verify-blueprint"], expectedExit: 0 },
        }),
        acceptanceCriterion({
          id: "run-harnesses-still-works",
          description: "run-harnesses dry-run still exits 0 after the rename",
          predicate: { kind: "cli-exit", argv: ["run-harnesses", "--dry-run"], expectedExit: 0 },
        }),
      ],
    }),
    plannedCommit({
      id: "c3-gate-executor-module",
      subject: "feat(core): runGates + GateEnvironment + GateReport",
      rationale: "Pure dispatch over qualityGates with an injected environment; mirrors the harness runner.",
      touches: ["src/core/gate-executor.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "run-gates-exported",
          description: "runGates function is exported from core/gate-executor.js",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/gate-executor.ts",
            exportName: "runGates",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c4-cli-run-gates",
      subject: "feat(cli): run-gates command + default GateEnvironment + index export",
      rationale: "Wires the executor with a real spawn + evidence writer.",
      touches: ["src/cli.ts", "src/index.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "cli-run-gates-dry-run",
          description: "runspec run-gates --dry-run exits 0",
          predicate: {
            kind: "cli-exit",
            argv: ["run-gates", "--dry-run"],
            expectedExit: 0,
          },
        }),
        acceptanceCriterion({
          id: "index-exports-run-gates",
          description: "src/index.ts re-exports runGates",
          predicate: {
            kind: "module-export",
            modulePath: "src/index.ts",
            exportName: "runGates",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c5-tests",
      subject: "test: gate executor unit tests + cli run-gates integration",
      rationale: "Pure executor with stub env, CLI dry-run integration, blocking vs non-blocking gate behaviour.",
      touches: [
        "test/gate-executor.test.ts",
        "test/cli.run-gates.test.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "gate-executor-test-present",
          description: "test/gate-executor.test.ts exists",
          predicate: { kind: "file-present", path: "test/gate-executor.test.ts" },
        }),
        acceptanceCriterion({
          id: "cli-run-gates-test-present",
          description: "test/cli.run-gates.test.ts exists",
          predicate: { kind: "file-present", path: "test/cli.run-gates.test.ts" },
        }),
      ],
    }),
    plannedCommit({
      id: "c6-readme",
      subject: "docs(readme): document runspec run-gates",
      rationale: "Surface the new command; mark ci-coverage-gating ready (still has its own follow-up to enforce thresholds).",
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
          description: "verify-markdown still exits 0",
          predicate: { kind: "cli-exit", argv: ["verify-markdown"], expectedExit: 0 },
        }),
      ],
    }),
  ],
  delivers: ["gate-executor"],
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
      id: "frontend-coverage",
      title: "Frontend coverage in the model",
      thesis: "Extend ServiceTarget kinds and harness kinds so frontend apps are first-class.",
      outcomes: [
        "ServiceTarget supports typescript:react-spa, typescript:next, typescript:vue",
        "HarnessKind adds ui-component, accessibility, visual-regression, bundle-size",
        "GateKind adds accessibility and frontend-security (CSP/XSS/CORS)",
        "loanPlatform example or a new example demonstrates a frontend service",
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
      blockedBy: [],
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

export default pr7;
