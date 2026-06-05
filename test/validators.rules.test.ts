import test from "node:test";
import assert from "node:assert/strict";
import { runSpecFramework } from "../src/blueprint/runSpecFramework.js";
import {
  agentPolicyRule,
  capabilitiesRule,
  diagramTargetsRule,
  harnessesRule,
  infrastructureAdaptersRule,
  qualityGatesRule,
  serviceTargetsRule,
  sourceOfTruthRule,
  validateRunSpecFramework,
  validationRules,
  workspaceModesRule,
} from "../src/core/validators.js";
import type { RunSpecApplicationBuilder } from "../src/core/model.js";

function override(partial: Partial<RunSpecApplicationBuilder>): RunSpecApplicationBuilder {
  return { ...runSpecFramework, ...partial };
}

test("sourceOfTruthRule accepts the real blueprint", () => {
  assert.deepEqual(sourceOfTruthRule(runSpecFramework), []);
});

test("sourceOfTruthRule rejects missing README in humanOnboarding", () => {
  const broken = override({
    sourceOfTruth: {
      ...runSpecFramework.sourceOfTruth,
      markdownPolicy: {
        ...runSpecFramework.sourceOfTruth.markdownPolicy,
        humanOnboarding: ["CONTRIBUTING.md"],
      },
    },
  });
  const issues = sourceOfTruthRule(broken);
  assert.ok(issues.some(issue => issue.path === "sourceOfTruth.markdownPolicy.humanOnboarding"));
});

test("sourceOfTruthRule rejects directory-like agent-runtime entry missing trailing slash", () => {
  const broken = override({
    sourceOfTruth: {
      ...runSpecFramework.sourceOfTruth,
      markdownPolicy: {
        ...runSpecFramework.sourceOfTruth.markdownPolicy,
        agentRuntimeConfiguration: ["AGENT.md", "CLAUDE.md", "nested/dir", ".github/"],
      },
    },
  });
  const issues = sourceOfTruthRule(broken);
  assert.ok(issues.some(issue => issue.message.includes("must end with")));
});

test("sourceOfTruthRule accepts nested file paths and dotfiles in agent-runtime entries", () => {
  const ok = override({
    sourceOfTruth: {
      ...runSpecFramework.sourceOfTruth,
      markdownPolicy: {
        ...runSpecFramework.sourceOfTruth.markdownPolicy,
        agentRuntimeConfiguration: [
          "AGENT.md",
          "CLAUDE.md",
          ".github/pull_request_template.md",
          ".github/.gitignore",
          ".claude/",
          ".github/",
        ],
      },
    },
  });
  assert.deepEqual(sourceOfTruthRule(ok), []);
});

test("sourceOfTruthRule rejects when .git missing from excludedDirectories", () => {
  const broken = override({
    sourceOfTruth: {
      ...runSpecFramework.sourceOfTruth,
      markdownPolicy: {
        ...runSpecFramework.sourceOfTruth.markdownPolicy,
        excludedDirectories: ["node_modules"],
      },
    },
  });
  assert.ok(sourceOfTruthRule(broken).some(issue => issue.path === "sourceOfTruth.markdownPolicy.excludedDirectories"));
});

test("sourceOfTruthRule rejects wrong generated artifact directory", () => {
  const broken = override({
    sourceOfTruth: { ...runSpecFramework.sourceOfTruth, generatedArtifactDirectory: "/tmp/elsewhere" },
  });
  assert.ok(sourceOfTruthRule(broken).some(issue => issue.path === "sourceOfTruth.generatedArtifactDirectory"));
});

test("workspaceModesRule accepts the real blueprint", () => {
  assert.deepEqual(workspaceModesRule(runSpecFramework), []);
});

test("workspaceModesRule rejects when monorepo missing", () => {
  const broken = override({
    workspaceCapabilities: runSpecFramework.workspaceCapabilities.filter(capability => capability.mode !== "monorepo"),
  });
  assert.equal(workspaceModesRule(broken).length, 1);
});

test("serviceTargetsRule accepts the real blueprint", () => {
  assert.deepEqual(serviceTargetsRule(runSpecFramework), []);
});

test("serviceTargetsRule rejects when typescript:node-http missing", () => {
  const broken = override({
    serviceTargets: runSpecFramework.serviceTargets.filter(target => !(target.language === "typescript" && target.framework === "node-http")),
  });
  assert.equal(serviceTargetsRule(broken).length, 1);
});

test("infrastructureAdaptersRule accepts the real blueprint", () => {
  assert.deepEqual(infrastructureAdaptersRule(runSpecFramework), []);
});

test("infrastructureAdaptersRule reports each missing adapter", () => {
  const broken = override({
    infrastructureAdapters: runSpecFramework.infrastructureAdapters.filter(adapter => adapter.kind !== "postgres" && adapter.kind !== "kafka"),
  });
  const issues = infrastructureAdaptersRule(broken);
  assert.ok(issues.some(issue => issue.path === "infrastructureAdapters.postgres"));
  assert.ok(issues.some(issue => issue.path === "infrastructureAdapters.kafka"));
});

test("qualityGatesRule rejects empty gates", () => {
  const broken = override({ qualityGates: [] });
  assert.equal(qualityGatesRule(broken)[0]?.path, "qualityGates");
});

test("qualityGatesRule rejects non-blocking gates", () => {
  const broken = override({
    qualityGates: runSpecFramework.qualityGates.map(gate => ({ ...gate, blocking: false })),
  });
  assert.equal(qualityGatesRule(broken).length, 1);
});

test("harnessesRule rejects empty harnesses", () => {
  const broken = override({ harnesses: [] });
  assert.equal(harnessesRule(broken).length, 1);
});

test("diagramTargetsRule rejects empty targets", () => {
  const broken = override({ diagramTargets: [] });
  assert.equal(diagramTargetsRule(broken).length, 1);
});

test("capabilitiesRule rejects scenario without harnesses", () => {
  const broken = override({
    productCapabilities: runSpecFramework.productCapabilities.map(capability => ({
      ...capability,
      scenarios: capability.scenarios.map(scenario => ({ ...scenario, harnesses: [] })),
    })),
  });
  const issues = capabilitiesRule(broken);
  assert.ok(issues.some(issue => issue.path.endsWith(".harnesses")));
});

test("capabilitiesRule rejects unknown threat referenced by scenario", () => {
  const broken = override({
    productCapabilities: runSpecFramework.productCapabilities.map(capability => ({
      ...capability,
      scenarios: capability.scenarios.map(scenario => ({ ...scenario, verifiesThreats: ["DOES-NOT-EXIST"] })),
    })),
  });
  const issues = capabilitiesRule(broken);
  assert.ok(issues.some(issue => issue.message.includes("unknown threat")));
});

test("agentPolicyRule rejects missing npm test", () => {
  const broken = override({
    agentPolicy: { ...runSpecFramework.agentPolicy, requiredCommandsBeforeCompletion: [] },
  });
  assert.ok(agentPolicyRule(broken).some(issue => issue.path === "agentPolicy.requiredCommandsBeforeCompletion"));
});

test("agentPolicyRule rejects missing denied generated path", () => {
  const broken = override({
    agentPolicy: { ...runSpecFramework.agentPolicy, deniedToModify: [] },
  });
  assert.ok(agentPolicyRule(broken).some(issue => issue.path === "agentPolicy.deniedToModify"));
});

test("validationRules registry contains all expected rules", () => {
  assert.equal(validationRules.length, 9);
});

test("validateRunSpecFramework aggregates rule output and returns ValidationResult", () => {
  const result = validateRunSpecFramework(runSpecFramework);
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("validateRunSpecFramework includes plan issues when plan provided and invalid", () => {
  const result = validateRunSpecFramework(runSpecFramework, {
    id: "",
    title: "",
    thesis: "",
    pr: { number: 0, branch: "" },
    constraints: [],
    commits: [],
    delivers: [],
    followUps: [],
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => issue.path === "plan.id"));
});
