import test from "node:test";
import assert from "node:assert/strict";
import { runSpecFramework } from "../src/blueprint/runSpecFramework.js";
import { nextAgentTask } from "../src/core/agent.js";
import { validateRunSpecFramework } from "../src/core/validators.js";
import { loanPlatformExample } from "../src/examples/loanPlatform.js";

test("RunSpec enterprise blueprint is valid", () => {
  const result = validateRunSpecFramework(runSpecFramework);

  assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
});

test("RunSpec enforces executable source of truth", () => {
  assert.deepEqual(runSpecFramework.sourceOfTruth.handWrittenMarkdownFiles, ["README.md"]);
  assert.equal(runSpecFramework.sourceOfTruth.externalSpecFrameworksAllowed, false);
  assert.equal(runSpecFramework.sourceOfTruth.commentsAsSpecificationAllowed, false);
});

test("RunSpec provides an agent task from executable policy", () => {
  const task = nextAgentTask(runSpecFramework);

  assert.match(task.reason, /Blueprint/);
  assert.ok(task.commands.includes("npm test"));
  assert.equal(task.acceptance.includes("requirement gate passes"), true);
});

test("RunSpec example supports enterprise multi-service topology", () => {
  assert.equal(loanPlatformExample.workspaceMode, "monorepo");
  assert.equal(loanPlatformExample.services.length, 3);
  assert.deepEqual(loanPlatformExample.infrastructure, ["postgres", "rabbitmq", "kafka", "redis", "vault"]);
});
