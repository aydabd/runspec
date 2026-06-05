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
  AcceptanceCriterion,
  PlanEnvironment,
  WorkPlan,
} from "../src/core/model.js";

const selfValidating: AcceptanceCriterion = acceptanceCriterion({
  id: "plan-parses",
  description: "plan validates against planRule",
  predicate: { kind: "plan-self-validates" },
});

function buildSamplePlan(): WorkPlan {
  return defineWorkPlan({
    id: "test-plan",
    title: "Test plan",
    thesis: "Validates plan domain.",
    pr: { number: 1, branch: "test-branch" },
    constraints: ["no shell strings"],
    commits: [
      plannedCommit({
        id: "c1",
        subject: "feat: thing one",
        rationale: "first commit",
        touches: ["src/**"],
        mustNotTouch: ["dist/**"],
        acceptance: [selfValidating],
      }),
      plannedCommit({
        id: "c2",
        subject: "feat: thing two",
        rationale: "second commit",
        touches: ["src/**"],
        mustNotTouch: ["dist/**"],
        acceptance: [
          acceptanceCriterion({
            id: "file-missing",
            description: "file does not exist",
            predicate: { kind: "file-present", path: "definitely-not-here.txt" },
          }),
        ],
      }),
    ],
    delivers: [],
    followUps: [
      followUpMilestone({
        id: "next-thing",
        title: "Do the next thing",
        thesis: "Next milestone",
        outcomes: ["something happens"],
        nonGoals: [],
        blockedBy: [],
      }),
    ],
  });
}

function stubEnvironment(plan: WorkPlan): PlanEnvironment {
  return {
    readFile: () => "",
    fileExists: () => false,
    importModule: async () => ({}),
    runCli: async () => ({ exitCode: 0 }),
    runNpmScript: async () => ({ exitCode: 0 }),
    validatePlan: () => validateWorkPlan(plan),
    cwd: process.cwd(),
  };
}

test("validateWorkPlan accepts a well-formed plan", () => {
  const plan = buildSamplePlan();
  const result = validateWorkPlan(plan);
  assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
});

test("validateWorkPlan reports duplicate commit ids", () => {
  const plan: WorkPlan = {
    ...buildSamplePlan(),
    commits: [
      plannedCommit({
        id: "dup",
        subject: "first",
        rationale: "",
        touches: [],
        mustNotTouch: [],
        acceptance: [selfValidating],
      }),
      plannedCommit({
        id: "dup",
        subject: "second",
        rationale: "",
        touches: [],
        mustNotTouch: [],
        acceptance: [selfValidating],
      }),
    ],
  };
  const result = validateWorkPlan(plan);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.path, "plan.commits[1].id");
});

test("validateWorkPlan rejects unknown blockedBy followUp id", () => {
  const plan: WorkPlan = {
    ...buildSamplePlan(),
    followUps: [
      followUpMilestone({
        id: "a",
        title: "A",
        thesis: "a",
        outcomes: [],
        nonGoals: [],
        blockedBy: ["does-not-exist"],
      }),
    ],
  };
  const result = validateWorkPlan(plan);
  assert.equal(result.valid, false);
  assert.equal(result.issues.some(issue => issue.path === "plan.followUps[0].blockedBy[0]"), true);
});

test("verifyPlan accepts plan-self-validates and reports file-present failure", async () => {
  const plan = buildSamplePlan();
  const status = await verifyPlan(plan, stubEnvironment(plan));
  assert.equal(status.commits[0]?.accepted, true);
  assert.equal(status.commits[1]?.accepted, false);
  assert.equal(status.commits[1]?.failures[0]?.predicateKind, "file-present");
});

test("nextPlanStep returns the first un-accepted commit", async () => {
  const plan = buildSamplePlan();
  const step = await nextPlanStep(plan, stubEnvironment(plan));
  assert.equal(step?.id, "c2");
});

test("listFollowUps returns plan followUps verbatim", () => {
  const plan = buildSamplePlan();
  assert.equal(listFollowUps(plan).length, 1);
  assert.equal(listFollowUps(plan)[0]?.id, "next-thing");
});
