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

const pr1: WorkPlan = defineWorkPlan({
  id: "pr-1-bootstrap-runspec",
  title: "Bootstrap runspec ground base",
  thesis:
    "Replace markdown specs with executable typed runspec values. AI agents read deterministic AgentTask JSON and cannot drift because there is no markdown spec to drift against.",
  pr: { number: 1, branch: "feat/bootstrap-runspec-framework" },
  constraints: [
    "no Claude/Anthropic attribution anywhere",
    "no filler comments — code self-explains via naming",
    "no markdown specifications — markdown allowed only for human onboarding and AI tool runtime config",
    "no back-compat shims — pre-release, zero external consumers",
    "no scope creep — each commit changes only its declared scope",
    "security and safety always — symlink refusal, bounded recursion, validated CLI input, strict exit codes",
  ],
  commits: [
    plannedCommit({
      id: "c1-workplan-domain",
      subject: "feat(plan): WorkPlan domain model, validator, and plan helpers",
      rationale: "Bootstraps the typed plan ADT so PRs are declared as code, not markdown.",
      touches: ["src/core/model.ts", "src/core/builders.ts", "src/core/validators.ts", "src/core/plan.ts", "test/plan.smoke.test.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [planSelfValidates],
    }),
    plannedCommit({
      id: "c2-cli-plan-commands",
      subject: "feat(cli): plan commands verify-plan, next-plan-step, list-followups, plan-status",
      rationale: "Lets agents drive the plan from a CLI without re-reading chat history.",
      touches: ["src/cli.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [planSelfValidates],
    }),
    plannedCommit({
      id: "c3-plan-pr1",
      subject: "feat(plans): src/plans/pr1.ts declares this PR as executable plan",
      rationale: "The plan IS code: this file IS the source of truth for what PR #1 ships.",
      touches: ["src/plans/pr1.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [planSelfValidates],
    }),
    plannedCommit({
      id: "c4-markdown-policy",
      subject: "refactor(policy): markdownPolicy with humanOnboarding / agentRuntimeConfiguration / excludedDirectories",
      rationale: "Replace the broken 'only README.md' invariant with categorised reality.",
      touches: [
        "src/core/model.ts",
        "src/core/validators.ts",
        "src/blueprint/runSpecFramework.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "blueprint-has-markdown-policy-shape",
          description: "runSpecFramework.sourceOfTruth.markdownPolicy.humanOnboarding starts with README.md",
          predicate: {
            kind: "module-property-equals",
            modulePath: "src/blueprint/runSpecFramework.ts",
            exportName: "runSpecFramework",
            path: ["sourceOfTruth", "markdownPolicy", "humanOnboarding", "0"],
            expected: "README.md",
          },
        }),
        acceptanceCriterion({
          id: "verify-blueprint-still-passes",
          description: "verify-blueprint still exits 0 after model change",
          predicate: { kind: "cli-exit", argv: ["verify-blueprint"], expectedExit: 0 },
        }),
        acceptanceCriterion({
          id: "verify-markdown-still-passes",
          description: "verify-markdown still exits 0 after policy refactor",
          predicate: { kind: "cli-exit", argv: ["verify-markdown"], expectedExit: 0 },
        }),
      ],
    }),
    plannedCommit({
      id: "c5-cli-classify-from-policy",
      subject: "refactor(cli): classifyMarkdown reads from policy, remove hardcoded constants",
      rationale: "Source of truth is the policy in code, not constants in the CLI.",
      touches: ["src/cli.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "cli-exposes-classify-markdown",
          description: "cli.js exports classifyMarkdown as a function",
          predicate: {
            kind: "module-export",
            modulePath: "src/cli.ts",
            exportName: "classifyMarkdown",
            check: "is-function",
          },
        }),
        acceptanceCriterion({
          id: "verify-markdown-still-passes",
          description: "verify-markdown still exits 0 after classifier refactor",
          predicate: { kind: "cli-exit", argv: ["verify-markdown"], expectedExit: 0 },
        }),
      ],
    }),
    plannedCommit({
      id: "c6-rule-registry",
      subject: "refactor(validators): rule registry strategy",
      rationale: "Pure-function rule composition; each rule independently testable.",
      touches: ["src/core/validators.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "validation-rules-exported-as-array",
          description: "validators.js exports validationRules as a non-empty array",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/validators.ts",
            exportName: "validationRules",
            check: "is-array",
          },
        }),
        acceptanceCriterion({
          id: "validate-runspec-framework-still-callable",
          description: "validators.js still exports validateRunSpecFramework as a function",
          predicate: {
            kind: "module-export",
            modulePath: "src/core/validators.ts",
            exportName: "validateRunSpecFramework",
            check: "is-function",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c7-cli-hardening",
      subject: "feat(cli): hardened argv parsing, exit codes, safe fs walk",
      rationale: "Security and safety: symlink refusal, bounded recursion, distinct exit codes, --help.",
      touches: ["src/cli.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "help-exits-zero",
          description: "runspec --help exits 0",
          predicate: { kind: "cli-exit", argv: ["--help"], expectedExit: 0 },
        }),
        acceptanceCriterion({
          id: "unknown-command-exits-two",
          description: "runspec bogus exits 2",
          predicate: { kind: "cli-exit", argv: ["bogus"], expectedExit: 2 },
        }),
      ],
    }),
    plannedCommit({
      id: "c8-public-api",
      subject: "feat: publish public api surface (src/index.ts, exports, bin)",
      rationale: "Downstream consumers can import runspec and run the cli as a binary.",
      touches: ["src/index.ts", "package.json"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "index-exports-defineRunSpecFramework",
          description: "src/index.ts exports defineRunSpecFramework",
          predicate: {
            kind: "module-export",
            modulePath: "src/index.ts",
            exportName: "defineRunSpecFramework",
            check: "is-function",
          },
        }),
        acceptanceCriterion({
          id: "index-exports-defineWorkPlan",
          description: "src/index.ts exports defineWorkPlan",
          predicate: {
            kind: "module-export",
            modulePath: "src/index.ts",
            exportName: "defineWorkPlan",
            check: "is-function",
          },
        }),
        acceptanceCriterion({
          id: "package-json-bin-runspec",
          description: "package.json declares bin.runspec",
          predicate: {
            kind: "package-json-field",
            path: ["bin", "runspec"],
            expected: "dist/src/cli.js",
          },
        }),
        acceptanceCriterion({
          id: "package-json-files-dist",
          description: "package.json declares files: ['dist']",
          predicate: {
            kind: "package-json-field",
            path: ["files"],
            expected: ["dist"],
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c9-types-node",
      subject: "chore(types): replace hand-rolled node shim with @types/node",
      rationale: "Remove a maintenance trap; use the canonical Node typings.",
      touches: ["package.json", "package-lock.json"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "shim-removed",
          description: "src/types/node.d.ts is gone",
          predicate: { kind: "file-absent", path: "src/types/node.d.ts" },
        }),
      ],
    }),
    plannedCommit({
      id: "c10-tsconfig-strict-plus",
      subject: "chore(tsconfig): enable strict-plus checks",
      rationale: "Catch latent nullability and unused-symbol bugs at compile time.",
      touches: ["tsconfig.json"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "tsconfig-noUncheckedIndexedAccess",
          description: "noUncheckedIndexedAccess enabled",
          predicate: { kind: "tsconfig-flag", flag: "noUncheckedIndexedAccess", expected: true },
        }),
        acceptanceCriterion({
          id: "tsconfig-exactOptionalPropertyTypes",
          description: "exactOptionalPropertyTypes enabled",
          predicate: { kind: "tsconfig-flag", flag: "exactOptionalPropertyTypes", expected: true },
        }),
        acceptanceCriterion({
          id: "tsconfig-noPropertyAccessFromIndexSignature",
          description: "noPropertyAccessFromIndexSignature enabled",
          predicate: { kind: "tsconfig-flag", flag: "noPropertyAccessFromIndexSignature", expected: true },
        }),
        acceptanceCriterion({
          id: "tsconfig-noUnusedLocals",
          description: "noUnusedLocals enabled",
          predicate: { kind: "tsconfig-flag", flag: "noUnusedLocals", expected: true },
        }),
        acceptanceCriterion({
          id: "tsconfig-noUnusedParameters",
          description: "noUnusedParameters enabled",
          predicate: { kind: "tsconfig-flag", flag: "noUnusedParameters", expected: true },
        }),
        acceptanceCriterion({
          id: "tsconfig-noImplicitOverride",
          description: "noImplicitOverride enabled",
          predicate: { kind: "tsconfig-flag", flag: "noImplicitOverride", expected: true },
        }),
        acceptanceCriterion({
          id: "tsconfig-noFallthroughCasesInSwitch",
          description: "noFallthroughCasesInSwitch enabled",
          predicate: { kind: "tsconfig-flag", flag: "noFallthroughCasesInSwitch", expected: true },
        }),
      ],
    }),
    plannedCommit({
      id: "c11-tests",
      subject: "test: per-rule validators + cli integration + plan runner",
      rationale: "Coverage on every rule, predicate, and command path.",
      touches: ["test/**", "package.json"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "validators-rules-test-present",
          description: "test/validators.rules.test.ts exists",
          predicate: { kind: "file-present", path: "test/validators.rules.test.ts" },
        }),
        acceptanceCriterion({
          id: "cli-test-present",
          description: "test/cli.test.ts exists",
          predicate: { kind: "file-present", path: "test/cli.test.ts" },
        }),
        acceptanceCriterion({
          id: "plan-test-present",
          description: "test/plan.test.ts exists",
          predicate: { kind: "file-present", path: "test/plan.test.ts" },
        }),
      ],
    }),
    plannedCommit({
      id: "c12-readme",
      subject: "docs(readme): thesis, architecture diagrams, downstream guide",
      rationale: "Pitch the thesis; show the agent loop; document downstream usage.",
      touches: ["README.md"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "readme-has-two-mermaid-blocks",
          description: "README.md contains at least two mermaid diagrams",
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
  delivers: [],
  followUps: [
    followUpMilestone({
      id: "skeleton-generator",
      title: "Service skeleton generator",
      thesis: "Read ProductCapability and ServiceTarget; emit Go/Java/TypeScript/React source files satisfying the implementation contract.",
      outcomes: [
        "runspec generate <capability> <service> writes files under src/generated/",
        "generated code compiles in the target service",
        "scenarios reference real Go/Spring/Node/React code paths",
      ],
      nonGoals: ["modifying capability definitions at generation time", "running the generated code"],
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
      blockedBy: ["skeleton-generator"],
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
      blockedBy: ["skeleton-generator"],
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

export default pr1;
