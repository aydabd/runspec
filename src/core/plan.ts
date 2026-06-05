import type {
  AcceptanceCriterion,
  AcceptancePredicate,
  AcceptancePredicateFailure,
  CommitAcceptanceStatus,
  FollowUpMilestone,
  FollowUpSummary,
  PlanEnvironment,
  PlanStatus,
  PlanStepTask,
  PlannedCommit,
  WorkPlan,
} from "./model.js";

export function listFollowUps(plan: WorkPlan): readonly FollowUpMilestone[] {
  return plan.followUps;
}

export async function verifyPlan(plan: WorkPlan, env: PlanEnvironment): Promise<PlanStatus> {
  const commits = await Promise.all(plan.commits.map(commit => evaluateCommit(plan, commit, env)));
  const followUps: readonly FollowUpSummary[] = plan.followUps.map(milestone => ({
    id: milestone.id,
    title: milestone.title,
    blockedBy: milestone.blockedBy,
  }));
  return {
    planId: plan.id,
    commits,
    followUps,
    delivers: plan.delivers,
  };
}

export async function nextPlanStep(plan: WorkPlan, env: PlanEnvironment): Promise<PlanStepTask | null> {
  const status = await verifyPlan(plan, env);
  const firstUnaccepted = status.commits.find(commit => !commit.accepted);
  if (firstUnaccepted === undefined) {
    return null;
  }
  const planned = plan.commits.find(commit => commit.id === firstUnaccepted.id);
  if (planned === undefined) {
    return null;
  }
  return {
    id: planned.id,
    subject: planned.subject,
    rationale: planned.rationale,
    touches: planned.touches,
    mustNotTouch: planned.mustNotTouch,
    acceptance: planned.acceptance,
    failures: firstUnaccepted.failures,
  };
}

async function evaluateCommit(plan: WorkPlan, commit: PlannedCommit, env: PlanEnvironment): Promise<CommitAcceptanceStatus> {
  const failures: AcceptancePredicateFailure[] = [];
  for (const criterion of commit.acceptance) {
    const failure = await evaluateCriterion(plan, criterion, env);
    if (failure !== null) {
      failures.push(failure);
    }
  }
  return {
    id: commit.id,
    accepted: failures.length === 0,
    failures,
  };
}

async function evaluateCriterion(
  plan: WorkPlan,
  criterion: AcceptanceCriterion,
  env: PlanEnvironment,
): Promise<AcceptancePredicateFailure | null> {
  const predicate = criterion.predicate;
  try {
    const message = await dispatchPredicate(plan, predicate, env);
    if (message === null) {
      return null;
    }
    return { predicateKind: predicate.kind, criterionId: criterion.id, message };
  } catch (error) {
    return {
      predicateKind: predicate.kind,
      criterionId: criterion.id,
      message: `predicate threw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function dispatchPredicate(
  plan: WorkPlan,
  predicate: AcceptancePredicate,
  env: PlanEnvironment,
): Promise<string | null> {
  switch (predicate.kind) {
    case "module-export":
      return checkModuleExport(predicate, env);
    case "module-property-equals":
      return checkModulePropertyEquals(predicate, env);
    case "file-present":
      return env.fileExists(predicate.path) ? null : `expected file present: ${predicate.path}`;
    case "file-absent":
      return env.fileExists(predicate.path) ? `expected file absent but found: ${predicate.path}` : null;
    case "tsconfig-flag":
      return checkTsconfigFlag(predicate, env);
    case "package-json-field":
      return checkPackageJsonField(predicate, env);
    case "npm-script-passes": {
      const result = await env.runNpmScript(predicate.script, env.cwd);
      return result.exitCode === 0 ? null : `npm script "${predicate.script}" exited ${result.exitCode}`;
    }
    case "cli-exit": {
      const result = await env.runCli(predicate.argv, predicate.cwd ?? env.cwd);
      return result.exitCode === predicate.expectedExit
        ? null
        : `cli ${predicate.argv.join(" ")} exited ${result.exitCode}, expected ${predicate.expectedExit}`;
    }
    case "readme-mermaid-blocks":
      return checkReadmeMermaidBlocks(predicate.path, predicate.min, env);
    case "plan-self-validates": {
      const result = env.validatePlan(plan);
      return result.valid
        ? null
        : `plan self-validation failed: ${result.issues.map(issue => `${issue.path}: ${issue.message}`).join("; ")}`;
    }
  }
}

async function checkModuleExport(
  predicate: Extract<AcceptancePredicate, { kind: "module-export" }>,
  env: PlanEnvironment,
): Promise<string | null> {
  const moduleExports = await env.importModule(predicate.modulePath);
  if (!(predicate.exportName in moduleExports)) {
    return `module "${predicate.modulePath}" does not export "${predicate.exportName}"`;
  }
  const value = moduleExports[predicate.exportName];
  switch (predicate.check) {
    case "is-function":
      return typeof value === "function" ? null : `export "${predicate.exportName}" is not a function`;
    case "is-array":
      return Array.isArray(value) ? null : `export "${predicate.exportName}" is not an array`;
    case "is-object":
      return typeof value === "object" && value !== null ? null : `export "${predicate.exportName}" is not an object`;
  }
}

async function checkModulePropertyEquals(
  predicate: Extract<AcceptancePredicate, { kind: "module-property-equals" }>,
  env: PlanEnvironment,
): Promise<string | null> {
  const moduleExports = await env.importModule(predicate.modulePath);
  if (!(predicate.exportName in moduleExports)) {
    return `module "${predicate.modulePath}" does not export "${predicate.exportName}"`;
  }
  const exportRoot = moduleExports[predicate.exportName];
  const actual = readPath(exportRoot, predicate.path);
  return deepEqual(actual, predicate.expected)
    ? null
    : `module "${predicate.modulePath}" export "${predicate.exportName}".${predicate.path.join(".")} expected ${JSON.stringify(predicate.expected)} but was ${JSON.stringify(actual)}`;
}

function checkTsconfigFlag(
  predicate: Extract<AcceptancePredicate, { kind: "tsconfig-flag" }>,
  env: PlanEnvironment,
): string | null {
  const raw = env.readFile("tsconfig.json");
  const parsed = parseJsonSafely(raw, "tsconfig.json");
  if (typeof parsed === "string") {
    return parsed;
  }
  const compilerOptions = (parsed as { compilerOptions?: Record<string, unknown> }).compilerOptions;
  if (compilerOptions === undefined) {
    return `tsconfig.json has no compilerOptions`;
  }
  const actual = compilerOptions[predicate.flag];
  return actual === predicate.expected
    ? null
    : `tsconfig.json compilerOptions.${predicate.flag} expected ${String(predicate.expected)} but was ${String(actual)}`;
}

function checkPackageJsonField(
  predicate: Extract<AcceptancePredicate, { kind: "package-json-field" }>,
  env: PlanEnvironment,
): string | null {
  const raw = env.readFile("package.json");
  const parsed = parseJsonSafely(raw, "package.json");
  if (typeof parsed === "string") {
    return parsed;
  }
  const actual = readPath(parsed, predicate.path);
  return deepEqual(actual, predicate.expected)
    ? null
    : `package.json ${predicate.path.join(".")} expected ${JSON.stringify(predicate.expected)} but was ${JSON.stringify(actual)}`;
}

function checkReadmeMermaidBlocks(path: string, min: number, env: PlanEnvironment): string | null {
  const raw = env.readFile(path);
  const matches = raw.match(/```mermaid\b/g);
  const count = matches === null ? 0 : matches.length;
  return count >= min ? null : `${path} contains ${count} mermaid block(s), expected at least ${min}`;
}

function parseJsonSafely(raw: string, label: string): unknown | string {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function readPath(root: unknown, path: readonly string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!deepEqual(ao[key], bo[key])) {
      return false;
    }
  }
  return true;
}
