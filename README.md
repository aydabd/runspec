# RunSpec

> **Spec-driven development is broken when the spec is markdown.**
> RunSpec inverts the loop: **the spec IS the code.** Services, capabilities,
> scenarios, gates, threats, agent policies, and even PR plans are typed
> immutable TypeScript values. The validator runs on every change. AI agents
> read deterministic task JSON and cannot drift because there is no separate
> document to drift against.

RunSpec is an executable enterprise application builder. It replaces OpenSpec,
Spec Kit, and markdown requirement files for any application type — backend
services, frontend apps, microservices, workers.

Markdown in this repository is allowed only for:

- **Human onboarding:** `README.md`, `CONTRIBUTING.md`, `SECURITY.md`
- **AI tool runtime configuration:** `CLAUDE.md`, `AGENT.md`, `.claude/`, `.github/`

Anything describing product behaviour, requirements, design, scenarios, or
threats lives in TypeScript. Generated reports, diagrams, and evidence are
produced under `.runspec/generated/`.

## Why runspec

Spec-driven dev fails because markdown specs drift, contradict each other,
and silently let AI agents hallucinate. RunSpec eliminates that gap:

- The product is declared in code via `defineRunSpecFramework({ ... })`.
- A validator runs on every commit; rules are pure functions in a registry.
- `nextAgentTask` reads the same code and emits the agent's next task as JSON
  with explicit `allowedFiles`, `deniedFiles`, `commands`, and `acceptance`.
- Plans for each PR are themselves executable values declared under
  `src/plans/pr*.ts`; `runspec verify-plan` is the source of truth for "is
  this PR done?".

Any AI agent (Claude, Copilot, Cursor, Aider, Codex) reads the same JSON and
cannot exceed the allowed/denied surface.

## Architecture

The agent loop, closed by self-verification:

```mermaid
sequenceDiagram
    actor Dev as Developer + AI Agent
    participant Spec as TypeScript blueprint + plan
    participant CLI as runspec cli
    participant V as validator
    participant A as nextAgentTask / nextPlanStep
    participant Code as implementation + tests

    Dev->>Spec: edit blueprint, plan, or implementation
    Dev->>CLI: runspec agent-next  OR  runspec next-plan-step
    CLI->>V: validate(blueprint, plan)
    V-->>CLI: { valid, issues }
    CLI->>A: choose next task
    alt blueprint or plan invalid
        A-->>Dev: task: fix it (allowed/denied/commands)
        Dev->>Spec: fix
    else valid
        A-->>Dev: task: implement next commit (allowed/denied/commands)
        Dev->>Code: implement + run npm test
        Code->>V: re-validate
    end
```

Task selection as a state machine:

```mermaid
stateDiagram-v2
    [*] --> Validating
    Validating --> Invalid: issues.length > 0
    Validating --> Valid: issues.length == 0
    Invalid --> FixFramework: emit "Fix executable RunSpec framework"
    Valid --> NextPlanStep: emit next PlannedCommit
    NextPlanStep --> Validating: rerun after commit
    Valid --> AllCommitsDone: every PlannedCommit accepted
    AllCommitsDone --> NextMilestone: emit first FollowUpMilestone
    NextMilestone --> [*]: hand off to next PR
```

## Core loop

```bash
npm test
runspec agent-next        # next capability-level task
runspec next-plan-step    # next PR-meta task
```

## Repository rules

```text
Executable definitions live in TypeScript files.
Markdown is allowed only for human onboarding (README, CONTRIBUTING, SECURITY)
and AI tool runtime configuration (CLAUDE.md, AGENT.md, .claude/, .github/).
Generated documentation lives under .runspec/generated/.
Agents may not manually edit generated output.
Agents must run npm test before claiming completion.
Application code is accepted only through executable verification gates.
```

## Commands

```bash
npm run build
runspec --help
runspec --version
runspec verify-markdown
runspec verify-blueprint
runspec verify-plan --plan src/plans/pr1.ts
runspec next-plan-step --plan src/plans/pr1.ts
runspec list-followups --plan src/plans/pr1.ts
runspec agent-next
runspec blueprint-print
```

Exit codes: `0` success, `1` policy or validation failure, `2` usage error or
repository safety check failed.

## Use runspec in your project

```ts
import {
  acceptanceCriterion,
  defineRunSpecFramework,
  defineWorkPlan,
  followUpMilestone,
  plannedCommit,
  qualityGate,
  serviceTarget,
  sourceOfTruthPolicy,
} from "runspec";

export const myApp = defineRunSpecFramework({
  name: "MyApp",
  purpose: "Issue and service loans through executable definitions.",
  sourceOfTruth: sourceOfTruthPolicy({
    executableDefinitionsOnly: true,
    markdownPolicy: {
      humanOnboarding: ["README.md", "CONTRIBUTING.md", "SECURITY.md"],
      agentRuntimeConfiguration: [".claude/", ".github/"],
      excludedDirectories: [".git", "node_modules", "dist", "build"],
    },
    generatedArtifactDirectory: ".runspec/generated",
    generatedArtifactsAreReadOnlyForAgents: true,
    commentsAsSpecificationAllowed: false,
    externalSpecFrameworksAllowed: false,
  }),
  // ...workspaceCapabilities, serviceTargets, productCapabilities,
  // threatModels, qualityGates, harnesses, diagramTargets, agentPolicy
});

export const pr1 = defineWorkPlan({
  id: "pr-1-initial",
  title: "First PR",
  thesis: "Bootstrap the project.",
  pr: { number: 1, branch: "main" },
  constraints: ["no markdown specs", "tests pass"],
  commits: [
    plannedCommit({
      id: "c1",
      subject: "feat: initial scaffold",
      rationale: "lay the ground base",
      touches: ["src/**"],
      mustNotTouch: ["dist/**"],
      acceptance: [
        acceptanceCriterion({
          id: "build-passes",
          description: "npm test exits 0",
          predicate: { kind: "npm-script-passes", script: "test" },
        }),
      ],
    }),
  ],
  delivers: [],
  followUps: [
    followUpMilestone({
      id: "auth",
      title: "Add authentication",
      thesis: "OAuth2 flow with refresh tokens.",
      outcomes: ["users can sign in"],
      nonGoals: ["passwordless"],
      blockedBy: [],
    }),
  ],
});
```

## Plans live in code, too

Each PR is declared as an executable `WorkPlan` under `src/plans/pr<N>.ts`.
Acceptance criteria use typed predicates (`module-export`, `tsconfig-flag`,
`cli-exit`, `package-json-field`, `npm-script-passes`, `file-present`,
`file-absent`, `readme-mermaid-blocks`, `module-property-equals`,
`plan-self-validates`) — never shell strings, so verification is portable and
hard for an AI agent to fake.

`runspec verify-plan` reports per-commit status. `runspec list-followups`
prints the remaining milestones with their `blockedBy` graph; the next-round
agent picks the first unblocked entry and creates `src/plans/pr<N+1>.ts`.
Nothing depends on chat history or markdown — the plan IS code.

## What runs today, what is next

**Today (PR #1):** typed domain model, identity builders, validator with a
rule registry, agent-task emitter, hardened CLI (strict argv parsing, safe
fs walk, distinct exit codes), public API surface, WorkPlan domain, the
self-verifying executable plan in `src/plans/pr1.ts`.

**Next milestones** (see `runspec list-followups`):
skeleton-generator, harness-runner, gate-executor, frontend-coverage,
watch-mode, npm-publish, eslint-or-biome-config, ci-coverage-gating,
makefile-language-adapters, additional-agent-task-shapes,
cross-agent-policy-export.

## Main executable files

```text
src/blueprint/runSpecFramework.ts
src/plans/pr1.ts
src/examples/loanPlatform.ts
src/core/model.ts
src/core/builders.ts
src/core/validators.ts
src/core/agent.ts
src/core/plan.ts
src/cli.ts
src/index.ts
```

## What this blueprint covers

```text
multi-service monorepo
multi-repo systems
Go services
Spring Boot services
Node/TypeScript services
event workers
Postgres, Kafka, RabbitMQ, Redis, Vault, object storage
HTTP APIs, event contracts, data entities
repositories, migrations
security policies, STRIDE threat modeling
architecture, observability, integration, security gates
sequence and flow diagram targets
AI agent execution policy
executable PR plans with typed acceptance predicates
```
