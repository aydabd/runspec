import test from "node:test";
import assert from "node:assert/strict";
import { runSpecFramework } from "../src/blueprint/runSpecFramework.js";
import { acceptanceForBlockingGates, nextAgentTask } from "../src/core/agent.js";
import { enterpriseApplicationExample } from "../src/core/builders.js";
import { validateRunSpecFramework } from "../src/core/validators.js";

test("RunSpec enterprise blueprint is valid", () => {
  const result = validateRunSpecFramework(runSpecFramework);

  assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
});

test("RunSpec enforces executable source of truth", () => {
  const policy = runSpecFramework.sourceOfTruth.markdownPolicy;
  assert.ok(policy.humanOnboarding.includes("README.md"));
  assert.ok(policy.humanOnboarding.includes("CONTRIBUTING.md"));
  assert.ok(policy.humanOnboarding.includes("SECURITY.md"));
  assert.ok(policy.agentRuntimeConfiguration.includes(".claude/"));
  assert.ok(policy.agentRuntimeConfiguration.includes(".github/"));
  assert.equal(runSpecFramework.sourceOfTruth.externalSpecFrameworksAllowed, false);
  assert.equal(runSpecFramework.sourceOfTruth.commentsAsSpecificationAllowed, false);
});

test("RunSpec provides an agent task from executable policy", () => {
  const task = nextAgentTask(runSpecFramework);

  assert.match(task.reason, /Blueprint/);
  assert.ok(task.commands.includes("npm test"));
  assert.equal(task.acceptance.includes("requirement gate passes"), true);
});

test("acceptanceForBlockingGates filters non-blocking gates", () => {
  const result = acceptanceForBlockingGates([
    { kind: "requirement", name: "req", blocking: true, command: { program: "true", args: [] }, evidence: "" },
    { kind: "report", name: "informational", blocking: false, command: { program: "true", args: [] }, evidence: "" },
    { kind: "security", name: "sec", blocking: true, command: { program: "true", args: [] }, evidence: "" },
  ]);
  assert.deepEqual(result, ["requirement gate passes", "security gate passes"]);
});

test("enterpriseApplicationExample accepts multi-service monorepos including frontend", () => {
  const sample = enterpriseApplicationExample({
    name: "sample-app",
    workspaceMode: "monorepo",
    infrastructure: ["postgres", "kafka"],
    capabilities: ["SUBMIT", "DECIDE"],
    services: [
      {
        id: "api",
        language: "java",
        framework: "spring-boot",
        ownsCapabilities: ["SUBMIT"],
        consumesEvents: [],
        publishesEvents: ["submit.created"],
        storesDataIn: ["postgres"],
      },
      {
        id: "worker",
        language: "go",
        framework: "worker",
        ownsCapabilities: ["DECIDE"],
        consumesEvents: ["submit.created"],
        publishesEvents: ["decide.completed"],
        storesDataIn: ["postgres"],
      },
      {
        id: "ui",
        language: "typescript",
        framework: "react-spa",
        ownsCapabilities: ["SUBMIT"],
        consumesEvents: [],
        publishesEvents: [],
        storesDataIn: [],
      },
    ],
  });
  assert.equal(sample.workspaceMode, "monorepo");
  assert.equal(sample.services.length, 3);
  assert.ok(sample.services.some(service => service.framework === "react-spa"));
});
