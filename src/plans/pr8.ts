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

const pr8: WorkPlan = defineWorkPlan({
  id: "pr-8-frontend-coverage",
  title: "Frontend coverage in the model",
  thesis:
    "Extend ServiceFramework, HarnessKind, and GateKind unions so frontend apps are first-class in the runspec model. Add a borrower-portal frontend service to the loanPlatform example. This unblocks skeleton-generator-react which can land as its own follow-up PR.",
  pr: { number: 8, branch: "main" },
  constraints: [
    "no Claude/Anthropic attribution anywhere",
    "no filler comments",
    "no markdown specifications",
    "no scope creep — only model union additions, loanPlatform frontend service, tests, docs. No React generator here.",
    "purely additive: existing validators and tests remain green",
  ],
  commits: [
    plannedCommit({
      id: "c1-plan-pr8",
      subject: "feat(plans): src/plans/pr8.ts declares this PR as executable plan",
      rationale: "The plan IS code.",
      touches: ["src/plans/pr8.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [planSelfValidates],
    }),
    plannedCommit({
      id: "c2-frontend-unions",
      subject: "feat(model): extend ServiceFramework / HarnessKind / GateKind with frontend kinds",
      rationale: "Add typescript:react-spa, typescript:next, typescript:vue service frameworks; ui-component, accessibility, visual-regression, bundle-size harnesses; accessibility, frontend-security gates.",
      touches: [
        "src/core/model.ts",
        "src/examples/loanPlatform.ts",
      ],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "verify-blueprint-still-passes",
          description: "verify-blueprint exits 0 after model union expansion",
          predicate: { kind: "cli-exit", argv: ["verify-blueprint"], expectedExit: 0 },
        }),
        acceptanceCriterion({
          id: "loanplatform-has-frontend-service",
          description: "loanPlatform example exports a service with framework react-spa or next",
          predicate: {
            kind: "module-property-equals",
            modulePath: "src/examples/loanPlatform.ts",
            exportName: "loanPlatformExample",
            path: ["services", "3", "framework"],
            expected: "react-spa",
          },
        }),
      ],
    }),
    plannedCommit({
      id: "c3-tests",
      subject: "test: loanPlatform fixture expanded with frontend service",
      rationale: "Existing tests assert services.length === 3; bump to 4 and add the borrower-portal assertion.",
      touches: ["test/blueprint.test.ts"],
      mustNotTouch: ["dist/**", "node_modules/**", ".runspec/generated/**"],
      acceptance: [
        acceptanceCriterion({
          id: "npm-test-passes",
          description: "npm test exits 0 after fixture expansion",
          predicate: { kind: "cli-exit", argv: ["verify-blueprint"], expectedExit: 0 },
        }),
      ],
    }),
    plannedCommit({
      id: "c4-readme",
      subject: "docs(readme): mark frontend coverage delivered",
      rationale: "Update milestone status; React generator is now unblocked.",
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
  delivers: ["frontend-coverage"],
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

export default pr8;
