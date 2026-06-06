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

const pr6: WorkPlan = defineWorkPlan({
  id: "pr-6-harness-runner",
  title: "Verification harness runner",
  thesis:
    "Execute scenario-declared harnesses from the executable blueprint. Pure-function runHarnesses(framework, env) returns a HarnessReport; CLI runspec run-harnesses spawns each harness command, writes a JSON evidence file per result, and exits non-zero if any required harness fails so CI and agents detect failure deterministically.",
  pr: { number: 6, branch: "main" },
  constraints: [
    "no Claude/Anthropic attribution anywhere",
    "no filler comments — code self-explains via naming",
    "no markdown specifications",
    "no scope creep — only runner, model extension, CLI, tests, docs",
    "security and safety always — commands run via execFileSync-style spawn (no shell), evidence paths cannot escape evidenceDir",
    "core runner stays pure; spawn lives behind a HarnessEnvironment interface so tests inject a stub",
    "exit 1 when any required harness fails so CI catches the regression",
  ],
  commits: [
    plannedCommit({
      id: "c1-plan-pr6",
      subject: "feat(plans): src/plans/pr6.ts declares this PR as executable plan",
      rationale: "The plan IS code.",
      touches: ["src/plans/pr6.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [planSelfValidates],
    }),
    plannedCommit({
      id: "c2-harness-command-fields",
      subject: "feat(model): add command + evidenceDir to VerificationHarness + populate blueprint",
      rationale: "Harness becomes executable: declares the shell command that verifies it and the directory where evidence is written.",
      touches: [
        "src/core/model.ts",
        "src/blueprint/runSpecFramework.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "harness-has-command-field",
          description: "every harness in the blueprint declares a non-empty command",
          predicate: {
            kind: "cli-exit",
            argv: ["verify-blueprint"],
            expectedExit: 0,
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c3-runner-module",
      subject: "feat(core): runHarnesses + HarnessEnvironment + HarnessReport",
      rationale: "Pure dispatch over harness list with an injected environment; core stays free of node:child_process.",
      touches: ["src/core/runner.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "run-harnesses-exported",
          description: "runHarnesses function is exported from core/runner.js",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/runner.ts",
            exportName: "runHarnesses",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c4-cli-run-harnesses",
      subject: "feat(cli): run-harnesses command + default HarnessEnvironment + index export",
      rationale: "Wires the runner with a real spawn + evidence writer.",
      touches: ["src/cli.ts", "src/index.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "cli-run-harnesses-dry-run",
          description: "runspec run-harnesses --dry-run exits 0 (lists declared harnesses without spawning)",
          predicate: {
            kind: "cli-exit",
            argv: ["run-harnesses", "--dry-run"],
            expectedExit: 0,
          },
        }),
        acceptanceCriterion({
          id: "index-exports-run-harnesses",
          description: "src/index.ts re-exports runHarnesses",
          predicate: {
            kind: "module-export",
            modulePath: "src/index.ts",
            exportName: "runHarnesses",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c5-tests",
      subject: "test: runner unit tests + cli run-harnesses integration",
      rationale: "runHarnesses dispatch with stub env, evidence writer captures path+content, CLI dry-run exits 0.",
      touches: [
        "test/runner.test.ts",
        "test/cli.run-harnesses.test.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "runner-test-present",
          description: "test/runner.test.ts exists",
          predicate: { kind: "file-present", path: "test/runner.test.ts" },
        }),
        acceptanceCriterion({
          id: "cli-run-harnesses-test-present",
          description: "test/cli.run-harnesses.test.ts exists",
          predicate: { kind: "file-present", path: "test/cli.run-harnesses.test.ts" },
        }),
      ],
    }),
    plannedCommit({
      id: "c6-readme",
      subject: "docs(readme): document runspec run-harnesses",
      rationale: "Surface the new command; mark gate-executor and ci-coverage-gating as unblocked.",
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
  delivers: ["harness-runner"],
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
      id: "gate-executor",
      title: "Quality gate executor",
      thesis: "Run each QualityGate.command, store evidence at gate.evidence, block agent completion until all blocking gates pass.",
      outcomes: [
        "runspec run-gates exits 0 iff every blocking gate passes",
        "evidence written to gate.evidence path",
      ],
      nonGoals: ["bypassing blocking gates under any circumstance"],
      blockedBy: [],
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

export default pr6;
