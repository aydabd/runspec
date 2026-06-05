import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runSpecFramework } from "./blueprint/runSpecFramework.js";
import { nextAgentTask } from "./core/agent.js";
import { listFollowUps, nextPlanStep, verifyPlan } from "./core/plan.js";
import { validateRunSpecFramework, validateWorkPlan } from "./core/validators.js";
import type { PlanEnvironment, WorkPlan } from "./core/model.js";

type Command =
  | "verify-markdown"
  | "verify-blueprint"
  | "agent-next"
  | "blueprint-print"
  | "verify-plan"
  | "next-plan-step"
  | "list-followups"
  | "plan-status";

const legacyMarkdownDirectories = [".claude/", ".github/", "languages/"] as const;

const legacyMarkdownFiles = new Set([
  "AGENT.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
]);

const defaultPlanSourcePath = "src/plans/pr1.ts";

async function main(argv: readonly string[]): Promise<void> {
  const command = argv[2] as Command | undefined;
  const options = parseOptions(argv.slice(3));

  switch (command) {
    case "verify-markdown":
      verifyMarkdownPolicy(process.cwd());
      return;
    case "verify-blueprint":
      verifyBlueprint();
      return;
    case "agent-next":
      printJson(nextAgentTask(runSpecFramework));
      return;
    case "blueprint-print":
      printJson(runSpecFramework);
      return;
    case "verify-plan":
    case "plan-status":
      await runVerifyPlan(options);
      return;
    case "next-plan-step":
      await runNextPlanStep(options);
      return;
    case "list-followups":
      await runListFollowUps(options);
      return;
    default:
      throw new Error(`Unsupported command: ${command ?? "<missing>"}`);
  }
}

type CliOptions = {
  readonly planPath: string;
};

function parseOptions(args: readonly string[]): CliOptions {
  let planPath = defaultPlanSourcePath;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--plan") {
      const value = args[i + 1];
      if (value === undefined) {
        throw new Error("--plan requires a path argument");
      }
      planPath = value;
      i += 1;
    }
  }
  return { planPath };
}

async function runVerifyPlan(options: CliOptions): Promise<void> {
  const plan = await loadPlan(options.planPath);
  const env = createDefaultPlanEnvironment(process.cwd());
  const status = await verifyPlan(plan, env);
  printJson(status);
  if (status.commits.some(commit => !commit.accepted)) {
    process.exitCode = 1;
  }
}

async function runNextPlanStep(options: CliOptions): Promise<void> {
  const plan = await loadPlan(options.planPath);
  const env = createDefaultPlanEnvironment(process.cwd());
  const step = await nextPlanStep(plan, env);
  if (step === null) {
    printJson({ done: true });
    return;
  }
  printJson(step);
}

async function runListFollowUps(options: CliOptions): Promise<void> {
  const plan = await loadPlan(options.planPath);
  printJson({ followUps: listFollowUps(plan), delivers: plan.delivers });
}

async function loadPlan(sourcePath: string): Promise<WorkPlan> {
  const cwd = process.cwd();
  const moduleUrl = resolvePlanModuleUrl(sourcePath, cwd);
  const moduleExports = await import(moduleUrl);
  const planExport = (moduleExports as { default?: unknown }).default ?? (moduleExports as { plan?: unknown }).plan;
  if (planExport === undefined) {
    throw new Error(`plan module "${sourcePath}" must export the plan as default export or as "plan"`);
  }
  const plan = planExport as WorkPlan;
  const validation = validateWorkPlan(plan);
  if (!validation.valid) {
    printJson({ valid: false, issues: validation.issues });
    process.exitCode = 1;
    throw new PlanValidationError(`plan "${sourcePath}" failed planRule validation`);
  }
  return plan;
}

class PlanValidationError extends Error {}

function resolvePlanModuleUrl(sourcePath: string, cwd: string): string {
  const jsRelative = sourcePath.endsWith(".ts") ? sourcePath.replace(/\.ts$/, ".js") : sourcePath;
  const distRelative = jsRelative.startsWith("dist/") ? jsRelative : `dist/${jsRelative}`;
  const absolute = resolve(cwd, distRelative);
  if (!existsSync(absolute)) {
    throw new Error(`plan module not found at ${absolute}. Run "npm run build" first.`);
  }
  return pathToFileURL(absolute).href;
}

function createDefaultPlanEnvironment(cwd: string): PlanEnvironment {
  return {
    cwd,
    readFile: path => readFileSync(resolve(cwd, path), "utf8"),
    fileExists: path => existsSync(resolve(cwd, path)),
    importModule: async modulePath => {
      const moduleUrl = resolvePlanModuleUrl(modulePath, cwd);
      return (await import(moduleUrl)) as Record<string, unknown>;
    },
    runCli: async (argv, runCwd) => {
      const cliPath = resolveCurrentCliPath();
      const result = spawnSync(process.execPath, [cliPath, ...argv], { cwd: runCwd, encoding: "utf8" });
      return { exitCode: result.status ?? 1 };
    },
    runNpmScript: async (script, runCwd) => {
      const npm = process.platform === "win32" ? "npm.cmd" : "npm";
      const result = spawnSync(npm, ["run", script], { cwd: runCwd, encoding: "utf8" });
      return { exitCode: result.status ?? 1 };
    },
    validatePlan: validateWorkPlan,
  };
}

function resolveCurrentCliPath(): string {
  const scriptArg = process.argv[1];
  if (scriptArg === undefined) {
    throw new Error("cannot resolve current cli path: process.argv[1] missing");
  }
  return scriptArg;
}

function verifyBlueprint(): void {
  const result = validateRunSpecFramework(runSpecFramework);

  if (!result.valid) {
    printJson(result);
    process.exitCode = 1;
    return;
  }

  printJson(result);
}

function verifyMarkdownPolicy(root: string): void {
  const markdownFiles = findFiles(root, file => extname(file) === ".md")
    .map(file => normalizeRepositoryPath(root, file))
    .filter(file => !file.startsWith(".git/"))
    .filter(file => !file.startsWith("dist/"))
    .sort();

  const allowed = new Set(runSpecFramework.sourceOfTruth.markdownPolicy.humanOnboarding);
  const forbidden = markdownFiles.filter(
    file => !allowed.has(file) && !isLegacyBootstrapMarkdown(file),
  );

  if (forbidden.length > 0) {
    printJson({ valid: false, forbidden });
    process.exitCode = 1;
    return;
  }

  printJson({ valid: true, markdownFiles });
}

function normalizeRepositoryPath(root: string, file: string): string {
  const normalizedRoot = root.split("\\").join("/");
  const normalizedFile = file.split("\\").join("/");
  const prefix = `${normalizedRoot}/`;

  return normalizedFile.startsWith(prefix) ? normalizedFile.slice(prefix.length) : normalizedFile;
}

function isLegacyBootstrapMarkdown(file: string): boolean {
  return (
    legacyMarkdownFiles.has(file) ||
    legacyMarkdownDirectories.some(directory => file.startsWith(directory))
  );
}

function findFiles(root: string, predicate: (path: string) => boolean): string[] {
  const result: string[] = [];
  const entries = readdirSync(root);

  for (const entry of entries) {
    if ([".git", "node_modules", "build"].includes(entry)) {
      continue;
    }

    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      result.push(...findFiles(path, predicate));
      continue;
    }

    if (stats.isFile() && predicate(path)) {
      result.push(path);
    }
  }

  return result;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

main(process.argv).catch(error => {
  if (error instanceof PlanValidationError) {
    return;
  }
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
