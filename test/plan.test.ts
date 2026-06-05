import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptanceCriterion,
  defineWorkPlan,
  followUpMilestone,
  plannedCommit,
} from "../src/core/builders.js";
import { listFollowUps, nextPlanStep, verifyPlan } from "../src/core/plan.js";
import { validateWorkPlan } from "../src/core/validators.js";
import type {
  AcceptancePredicate,
  PlanEnvironment,
  WorkPlan,
} from "../src/core/model.js";

const planSelfValidates = acceptanceCriterion({
  id: "plan-self-validates",
  description: "plan validates against planRule",
  predicate: { kind: "plan-self-validates" },
});

function commitWith(id: string, predicate: AcceptancePredicate): ReturnType<typeof plannedCommit> {
  return plannedCommit({
    id,
    subject: `feat: ${id}`,
    rationale: "stub rationale",
    touches: [],
    mustNotTouch: [],
    acceptance: [acceptanceCriterion({ id: `${id}-criterion`, description: "stub", predicate })],
  });
}

function buildPlan(extraCommits: ReturnType<typeof plannedCommit>[] = []): WorkPlan {
  return defineWorkPlan({
    id: "test-plan",
    title: "Test plan",
    thesis: "Validates plan domain end-to-end.",
    pr: { number: 99, branch: "test-branch" },
    constraints: [],
    commits: [
      plannedCommit({
        id: "c-bootstrap",
        subject: "feat: bootstrap",
        rationale: "first",
        touches: ["src/**"],
        mustNotTouch: ["dist/**"],
        acceptance: [planSelfValidates],
      }),
      ...extraCommits,
    ],
    delivers: [],
    followUps: [
      followUpMilestone({
        id: "next-thing",
        title: "Do the next thing",
        thesis: "Next milestone",
        outcomes: ["happens"],
        nonGoals: [],
        blockedBy: [],
      }),
    ],
  });
}

function stubEnvironment(plan: WorkPlan, overrides: Partial<PlanEnvironment> = {}): PlanEnvironment {
  return {
    readFile: () => "",
    fileExists: () => false,
    importModule: async () => ({}),
    runCli: async () => ({ exitCode: 0 }),
    runNpmScript: async () => ({ exitCode: 0 }),
    validatePlan: () => validateWorkPlan(plan),
    cwd: "/tmp",
    ...overrides,
  };
}

test("validateWorkPlan accepts the bootstrap plan", () => {
  const plan = buildPlan();
  const result = validateWorkPlan(plan);
  assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
});

test("validateWorkPlan reports duplicate commit ids", () => {
  const plan: WorkPlan = {
    ...buildPlan(),
    commits: [
      plannedCommit({ id: "dup", subject: "a", rationale: "", touches: [], mustNotTouch: [], acceptance: [planSelfValidates] }),
      plannedCommit({ id: "dup", subject: "b", rationale: "", touches: [], mustNotTouch: [], acceptance: [planSelfValidates] }),
    ],
  };
  const result = validateWorkPlan(plan);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.path, "plan.commits[1].id");
});

test("validateWorkPlan rejects unknown blockedBy followUp id", () => {
  const plan: WorkPlan = {
    ...buildPlan(),
    followUps: [
      followUpMilestone({ id: "a", title: "A", thesis: "a", outcomes: [], nonGoals: [], blockedBy: ["nope"] }),
    ],
  };
  const result = validateWorkPlan(plan);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => issue.path === "plan.followUps[0].blockedBy[0]"));
});

test("validateWorkPlan rejects id that is both delivered and remaining", () => {
  const plan: WorkPlan = {
    ...buildPlan(),
    delivers: ["next-thing"],
  };
  const result = validateWorkPlan(plan);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.path, "plan.delivers[0]");
});

test("verifyPlan accepts plan-self-validates against a valid plan", async () => {
  const plan = buildPlan();
  const status = await verifyPlan(plan, stubEnvironment(plan));
  assert.equal(status.commits[0]?.accepted, true);
});

test("verifyPlan reports file-present failure when fileExists is false", async () => {
  const plan = buildPlan([commitWith("c-file", { kind: "file-present", path: "nope" })]);
  const status = await verifyPlan(plan, stubEnvironment(plan));
  const failure = status.commits[1]?.failures[0];
  assert.equal(failure?.predicateKind, "file-present");
});

test("verifyPlan accepts file-absent when fileExists is false", async () => {
  const plan = buildPlan([commitWith("c-absent", { kind: "file-absent", path: "nope" })]);
  const status = await verifyPlan(plan, stubEnvironment(plan));
  assert.equal(status.commits[1]?.accepted, true);
});

test("verifyPlan reports tsconfig-flag failure when flag missing", async () => {
  const plan = buildPlan([commitWith("c-ts", { kind: "tsconfig-flag", flag: "noUncheckedIndexedAccess", expected: true })]);
  const env = stubEnvironment(plan, {
    readFile: () => JSON.stringify({ compilerOptions: {} }),
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, false);
  assert.equal(status.commits[1]?.failures[0]?.predicateKind, "tsconfig-flag");
});

test("verifyPlan accepts tsconfig-flag when flag present and matches", async () => {
  const plan = buildPlan([commitWith("c-ts", { kind: "tsconfig-flag", flag: "noUncheckedIndexedAccess", expected: true })]);
  const env = stubEnvironment(plan, {
    readFile: () => JSON.stringify({ compilerOptions: { noUncheckedIndexedAccess: true } }),
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, true);
});

test("verifyPlan checks package-json-field nested path", async () => {
  const plan = buildPlan([commitWith("c-pkg", { kind: "package-json-field", path: ["bin", "runspec"], expected: "dist/src/cli.js" })]);
  const env = stubEnvironment(plan, {
    readFile: () => JSON.stringify({ bin: { runspec: "dist/src/cli.js" } }),
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, true);
});

test("verifyPlan dispatches npm-script-passes through runNpmScript", async () => {
  const plan = buildPlan([commitWith("c-npm", { kind: "npm-script-passes", script: "test" })]);
  let captured = "";
  const env = stubEnvironment(plan, {
    runNpmScript: async script => {
      captured = script;
      return { exitCode: 0 };
    },
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, true);
  assert.equal(captured, "test");
});

test("verifyPlan dispatches cli-exit through runCli with expected exit code", async () => {
  const plan = buildPlan([commitWith("c-cli", { kind: "cli-exit", argv: ["--help"], expectedExit: 0 })]);
  let receivedArgv: readonly string[] = [];
  const env = stubEnvironment(plan, {
    runCli: async argv => {
      receivedArgv = argv;
      return { exitCode: 0 };
    },
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, true);
  assert.deepEqual(receivedArgv, ["--help"]);
});

test("verifyPlan reports readme-mermaid-blocks failure when count below min", async () => {
  const plan = buildPlan([commitWith("c-md", { kind: "readme-mermaid-blocks", path: "README.md", min: 2 })]);
  const env = stubEnvironment(plan, {
    readFile: () => "# README\n\n```mermaid\nflowchart TD\n```\n",
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, false);
});

test("verifyPlan accepts readme-mermaid-blocks when count meets min", async () => {
  const plan = buildPlan([commitWith("c-md", { kind: "readme-mermaid-blocks", path: "README.md", min: 2 })]);
  const env = stubEnvironment(plan, {
    readFile: () => "```mermaid\nA\n```\n```mermaid\nB\n```\n",
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, true);
});

test("verifyPlan checks module-export against importModule", async () => {
  const plan = buildPlan([commitWith("c-mod", { kind: "module-export", modulePath: "fake", exportName: "foo", check: "is-function" })]);
  const env = stubEnvironment(plan, {
    importModule: async () => ({ foo: () => "bar" }),
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, true);
});

test("verifyPlan reports module-export failure when export missing", async () => {
  const plan = buildPlan([commitWith("c-mod", { kind: "module-export", modulePath: "fake", exportName: "foo", check: "is-function" })]);
  const env = stubEnvironment(plan, {
    importModule: async () => ({}),
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, false);
});

test("verifyPlan dispatches module-property-equals through importModule", async () => {
  const plan = buildPlan([commitWith("c-prop", {
    kind: "module-property-equals",
    modulePath: "fake",
    exportName: "config",
    path: ["nested", "value"],
    expected: 42,
  })]);
  const env = stubEnvironment(plan, {
    importModule: async () => ({ config: { nested: { value: 42 } } }),
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, true);
});

test("nextPlanStep returns the first un-accepted commit", async () => {
  const plan = buildPlan([commitWith("c-fail", { kind: "file-present", path: "definitely-nope" })]);
  const step = await nextPlanStep(plan, stubEnvironment(plan));
  assert.equal(step?.id, "c-fail");
});

test("nextPlanStep returns null when all commits accepted", async () => {
  const plan = buildPlan();
  const step = await nextPlanStep(plan, stubEnvironment(plan));
  assert.equal(step, null);
});

test("listFollowUps returns the plan followUps", () => {
  const plan = buildPlan();
  assert.equal(listFollowUps(plan).length, 1);
  assert.equal(listFollowUps(plan)[0]?.id, "next-thing");
});

test("verifyPlan reports thrown predicate as a failure with message", async () => {
  const plan = buildPlan([commitWith("c-boom", { kind: "module-export", modulePath: "fake", exportName: "x", check: "is-function" })]);
  const env = stubEnvironment(plan, {
    importModule: async () => {
      throw new Error("module boom");
    },
  });
  const status = await verifyPlan(plan, env);
  assert.equal(status.commits[1]?.accepted, false);
  assert.match(status.commits[1]?.failures[0]?.message ?? "", /predicate threw/);
});
