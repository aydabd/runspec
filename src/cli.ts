#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { runSpecFramework } from "./blueprint/runSpecFramework.js";
import { nextAgentTask } from "./core/agent.js";
import { generate, writeGenerationResult } from "./core/generator.js";
import { runGates } from "./core/gate-executor.js";
import type { GateEnvironment, GateRunOutcome } from "./core/gate-executor.js";
import { runHarnesses } from "./core/runner.js";
import { goHttpGenerator } from "./core/generators/go-http.js";
import { goWorkerGenerator } from "./core/generators/go-worker.js";
import { nodeHttpGenerator } from "./core/generators/node-http.js";
import { springBootGenerator } from "./core/generators/spring-boot.js";
import { listFollowUps, nextPlanStep, verifyPlan } from "./core/plan.js";
import { validateRunSpecFramework, validateWorkPlan } from "./core/validators.js";
import type {
  Command,
  FileWriter,
  HarnessEnvironment,
  HarnessRunOutcome,
  MarkdownPolicy,
  PlanEnvironment,
  SkeletonGenerator,
  WorkPlan,
} from "./core/model.js";

const allowedCommands = [
  "verify-markdown",
  "verify-blueprint",
  "agent-next",
  "blueprint-print",
  "verify-plan",
  "next-plan-step",
  "list-followups",
  "plan-status",
  "generate",
  "run-harnesses",
  "run-gates",
] as const;

const defaultGeneratorRegistry: readonly SkeletonGenerator[] = [goHttpGenerator, goWorkerGenerator, springBootGenerator, nodeHttpGenerator];

type CliCommand = typeof allowedCommands[number];

export type MarkdownClassification = "human-onboarding" | "agent-runtime" | "forbidden";

const defaultPlanSourcePath = "src/plans/pr1.ts";
const maxWalkDepth = 32;
const exitCodePolicyFailure = 1;
const exitCodeUsageError = 2;

class UsageError extends Error {}
class PlanValidationError extends Error {}

export function classifyMarkdown(relativePath: string, policy: MarkdownPolicy): MarkdownClassification {
  if (policy.humanOnboarding.includes(relativePath)) {
    return "human-onboarding";
  }
  for (const entry of policy.agentRuntimeConfiguration) {
    if (entry.endsWith("/")) {
      if (relativePath.startsWith(entry)) {
        return "agent-runtime";
      }
    } else if (entry === relativePath) {
      return "agent-runtime";
    }
  }
  return "forbidden";
}

type ParsedCli =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
  | { readonly kind: "command"; readonly command: CliCommand; readonly options: CliOptions }
  | { readonly kind: "missing" }
  | { readonly kind: "unknown"; readonly raw: string };

type CliOptions = {
  readonly planPath: string;
  readonly capabilityId?: string;
  readonly serviceId?: string;
  readonly scenarioId?: string;
  readonly outputRoot?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
};

function parseCli(argv: readonly string[]): ParsedCli {
  const rest = argv.slice(2);
  if (rest.includes("--help") || rest.includes("-h")) {
    return { kind: "help" };
  }
  if (rest.includes("--version") || rest.includes("-v")) {
    return { kind: "version" };
  }
  const head = rest[0];
  if (head === undefined) {
    return { kind: "missing" };
  }
  if (!isCommand(head)) {
    return { kind: "unknown", raw: head };
  }
  return { kind: "command", command: head, options: parseOptions(rest.slice(1)) };
}

function isCommand(value: string): value is CliCommand {
  return (allowedCommands as readonly string[]).includes(value);
}

function parseOptions(args: readonly string[]): CliOptions {
  let planPath = defaultPlanSourcePath;
  let capabilityId: string | undefined;
  let serviceId: string | undefined;
  let scenarioId: string | undefined;
  let outputRoot: string | undefined;
  let dryRun = false;
  let force = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--plan") {
      const value = args[i + 1];
      if (value === undefined) {
        throw new UsageError("--plan requires a path argument");
      }
      planPath = value;
      i += 1;
    } else if (arg === "--capability") {
      const value = args[i + 1];
      if (value === undefined) {
        throw new UsageError("--capability requires a capability id");
      }
      capabilityId = value;
      i += 1;
    } else if (arg === "--service") {
      const value = args[i + 1];
      if (value === undefined) {
        throw new UsageError("--service requires a service id");
      }
      serviceId = value;
      i += 1;
    } else if (arg === "--scenario") {
      const value = args[i + 1];
      if (value === undefined) {
        throw new UsageError("--scenario requires a scenario id");
      }
      scenarioId = value;
      i += 1;
    } else if (arg === "--output") {
      const value = args[i + 1];
      if (value === undefined) {
        throw new UsageError("--output requires a directory path");
      }
      outputRoot = value;
      i += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    } else {
      throw new UsageError(`unknown option: ${arg}`);
    }
  }
  const options: CliOptions = { planPath, dryRun, force };
  return {
    ...options,
    ...(capabilityId !== undefined ? { capabilityId } : {}),
    ...(serviceId !== undefined ? { serviceId } : {}),
    ...(scenarioId !== undefined ? { scenarioId } : {}),
    ...(outputRoot !== undefined ? { outputRoot } : {}),
  };
}

async function main(argv: readonly string[]): Promise<void> {
  const parsed = parseCli(argv);
  switch (parsed.kind) {
    case "help":
      process.stdout.write(usageText());
      return;
    case "version":
      process.stdout.write(`${readPackageVersion()}\n`);
      return;
    case "missing":
      process.stderr.write(`runspec: missing command\n${usageText()}`);
      process.exitCode = exitCodeUsageError;
      return;
    case "unknown":
      process.stderr.write(`runspec: unknown command "${parsed.raw}"\n${usageText()}`);
      process.exitCode = exitCodeUsageError;
      return;
    case "command":
      await runCommand(parsed.command, parsed.options);
      return;
  }
}

async function runCommand(command: CliCommand, options: CliOptions): Promise<void> {
  switch (command) {
    case "verify-markdown":
      verifyMarkdownPolicy();
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
    case "generate":
      runGenerate(options);
      return;
    case "run-harnesses":
      runHarnessesCommand(options);
      return;
    case "run-gates":
      runGatesCommand(options);
      return;
  }
}

function runGatesCommand(options: CliOptions): void {
  const env = createDefaultGateEnvironment(process.cwd());
  const report = runGates(
    runSpecFramework,
    { dryRun: options.dryRun },
    env,
  );
  printJson(report);
  if (!report.passed) {
    process.exitCode = exitCodePolicyFailure;
  }
}

function createDefaultGateEnvironment(cwd: string): GateEnvironment {
  return {
    cwd,
    run: (command: Command): GateRunOutcome => {
      const started = Date.now();
      const result = spawnSync(command.program, [...command.args], { cwd, encoding: "utf8" });
      return {
        exitCode: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        durationMs: Date.now() - started,
      };
    },
    writeEvidence: (evidencePath, content) => {
      const absoluteOutputRoot = resolve(cwd);
      const absolutePath = resolve(cwd, evidencePath);
      const relativeFromRoot = relative(absoluteOutputRoot, absolutePath);
      if (relativeFromRoot.startsWith("..") || isAbsolute(relativeFromRoot)) {
        throw new UsageError(`gate evidence path "${evidencePath}" escapes the repository root`);
      }
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, content);
      return absolutePath;
    },
    now: () => new Date().toISOString().replace(/[:.]/g, "-"),
  };
}

function runHarnessesCommand(options: CliOptions): void {
  const env = createDefaultHarnessEnvironment(process.cwd());
  const report = runHarnesses(
    runSpecFramework,
    {
      ...(options.scenarioId !== undefined ? { scenarioId: options.scenarioId } : {}),
      dryRun: options.dryRun,
    },
    env,
  );
  printJson(report);
  if (!report.passed) {
    process.exitCode = exitCodePolicyFailure;
  }
}

function createDefaultHarnessEnvironment(cwd: string): HarnessEnvironment {
  return {
    cwd,
    run: (command: Command): HarnessRunOutcome => {
      const started = Date.now();
      const result = spawnSync(command.program, [...command.args], { cwd, encoding: "utf8" });
      return {
        exitCode: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        durationMs: Date.now() - started,
      };
    },
    writeEvidence: (evidenceDir, fileName, content) => {
      const absoluteDir = resolve(cwd, evidenceDir);
      const absoluteOutputRoot = resolve(cwd);
      const relativeDirFromRoot = relative(absoluteOutputRoot, absoluteDir);
      if (relativeDirFromRoot.startsWith("..") || isAbsolute(relativeDirFromRoot)) {
        throw new UsageError(`harness evidenceDir "${evidenceDir}" escapes the repository root`);
      }
      const absolutePath = resolve(absoluteDir, fileName);
      mkdirSync(absoluteDir, { recursive: true });
      writeFileSync(absolutePath, content);
      return absolutePath;
    },
    now: () => new Date().toISOString().replace(/[:.]/g, "-"),
  };
}

export function runGenerate(options: CliOptions): void {
  if (options.capabilityId === undefined) {
    throw new UsageError("generate requires --capability <id>");
  }
  if (options.serviceId === undefined) {
    throw new UsageError("generate requires --service <id>");
  }
  const outputRoot = options.outputRoot ?? `.runspec/generated/${options.capabilityId}-${options.serviceId}`;
  const result = generate(runSpecFramework, {
    capabilityId: options.capabilityId,
    serviceId: options.serviceId,
    outputRoot,
  }, defaultGeneratorRegistry);

  const summary = {
    capability: result.capability.id,
    service: result.service.id,
    generator: result.generator.id,
    outputRoot,
    files: result.files.map(file => file.path),
    dryRun: options.dryRun,
  };

  if (options.dryRun) {
    printJson(summary);
    return;
  }

  const cwd = process.cwd();
  writeGenerationResult(result, createFileWriter(cwd, options.force));
  printJson(summary);
}

export function createFileWriter(cwd: string, force: boolean): FileWriter {
  return (outputRoot, relativePath, content) => {
    const absoluteOutputRoot = resolve(cwd, outputRoot);
    const absolutePath = resolve(absoluteOutputRoot, relativePath);
    const relativeFromRoot = relative(absoluteOutputRoot, absolutePath);
    if (relativeFromRoot.startsWith("..") || isAbsolute(relativeFromRoot)) {
      throw new UsageError(`generator path "${relativePath}" escapes the output directory`);
    }
    if (!force && existsSync(absolutePath)) {
      throw new UsageError(`refusing to overwrite existing file: ${absolutePath} (pass --force to overwrite)`);
    }
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  };
}

function usageText(): string {
  return [
    "Usage: runspec <command> [options]",
    "",
    "Commands:",
    "  verify-markdown    Verify markdown files match the source-of-truth policy",
    "  verify-blueprint   Validate the executable runspec blueprint",
    "  agent-next         Print the next agent task derived from the blueprint",
    "  blueprint-print    Print the blueprint as JSON",
    "  verify-plan        Verify every PlannedCommit acceptance predicate",
    "  next-plan-step     Print the next un-accepted PlannedCommit as a task",
    "  list-followups     Print the remaining FollowUpMilestones as JSON",
    "  plan-status        Alias for verify-plan",
    "  generate           Emit a service skeleton from a capability + service-target",
    "  run-harnesses      Run every declared VerificationHarness and write evidence",
    "  run-gates          Run every declared QualityGate and write evidence",
    "",
    "Options:",
    "  --plan <path>      Path to the plan source file (default: src/plans/pr1.ts)",
    "  --capability <id>  Capability id (required for generate)",
    "  --service <id>     Service target id (required for generate)",
    "  --scenario <id>    Filter run-harnesses to a single scenario",
    "  --output <dir>     Output directory (default: .runspec/generated/<cap>-<svc>)",
    "  --dry-run          Print the generation plan without writing files",
    "  --force            Allow overwriting existing files during generate",
    "  --help, -h         Show this help and exit",
    "  --version, -v      Show the runspec version and exit",
    "",
    "Exit codes:",
    "  0  success",
    "  1  policy or validation failure",
    "  2  usage error or repository safety check failed",
    "",
  ].join("\n");
}

function readPackageVersion(): string {
  const candidate = resolveRepoRelativePath("package.json");
  const raw = readFileSync(candidate, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}

async function runVerifyPlan(options: CliOptions): Promise<void> {
  const plan = await loadPlan(options.planPath);
  const env = createDefaultPlanEnvironment(process.cwd());
  const status = await verifyPlan(plan, env);
  printJson(status);
  if (status.commits.some(commit => !commit.accepted)) {
    process.exitCode = exitCodePolicyFailure;
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
    throw new UsageError(`plan module "${sourcePath}" must export the plan as default export or as "plan"`);
  }
  const plan = planExport as WorkPlan;
  const validation = validateWorkPlan(plan);
  if (!validation.valid) {
    printJson({ valid: false, issues: validation.issues });
    process.exitCode = exitCodePolicyFailure;
    throw new PlanValidationError(`plan "${sourcePath}" failed planRule validation`);
  }
  return plan;
}

function resolvePlanModuleUrl(sourcePath: string, cwd: string): string {
  const jsRelative = sourcePath.endsWith(".ts") ? sourcePath.replace(/\.ts$/, ".js") : sourcePath;
  const distRelative = jsRelative.startsWith("dist/") ? jsRelative : `dist/${jsRelative}`;
  const absolute = resolve(cwd, distRelative);
  if (!existsSync(absolute)) {
    throw new UsageError(`plan module not found at ${absolute}. Run "npm run build" first.`);
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
    throw new UsageError("cannot resolve current cli path: process.argv[1] missing");
  }
  return scriptArg;
}

function verifyBlueprint(): void {
  const result = validateRunSpecFramework(runSpecFramework);
  printJson(result);
  if (!result.valid) {
    process.exitCode = exitCodePolicyFailure;
  }
}

function verifyMarkdownPolicy(): void {
  const root = discoverRepositoryRoot(process.cwd());
  const policy = runSpecFramework.sourceOfTruth.markdownPolicy;
  const markdownFiles = walkRepositoryFiles(root, file => extname(file) === ".md", policy.excludedDirectories)
    .map(file => normalizeRepositoryPath(root, file))
    .sort();

  const forbidden = markdownFiles.filter(file => classifyMarkdown(file, policy) === "forbidden");

  if (forbidden.length > 0) {
    printJson({ valid: false, forbidden });
    process.exitCode = exitCodePolicyFailure;
    return;
  }

  printJson({ valid: true, markdownFiles });
}

function discoverRepositoryRoot(cwd: string): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new UsageError(
      `runspec requires a git working tree for safe file-system walks. cwd "${cwd}" is not inside a git repository.`,
    );
  }
  return result.stdout.trim();
}

function walkRepositoryFiles(
  root: string,
  predicate: (path: string) => boolean,
  excludedDirectories: readonly string[],
): string[] {
  const result: string[] = [];
  walk(root, root, predicate, excludedDirectories, 0, result);
  return result;
}

function walk(
  root: string,
  current: string,
  predicate: (path: string) => boolean,
  excludedDirectories: readonly string[],
  depth: number,
  collector: string[],
): void {
  if (depth > maxWalkDepth) {
    throw new UsageError(`directory depth exceeded ${maxWalkDepth} under ${root} — refusing to descend further`);
  }
  const entries = readdirSync(current);
  for (const entry of entries) {
    if (excludedDirectories.includes(entry)) {
      continue;
    }
    const childPath = join(current, entry);
    const stats = lstatSync(childPath);
    if (stats.isSymbolicLink()) {
      continue;
    }
    if (stats.isDirectory()) {
      walk(root, childPath, predicate, excludedDirectories, depth + 1, collector);
      continue;
    }
    if (stats.isFile() && predicate(childPath)) {
      collector.push(childPath);
    }
  }
}

function resolveRepoRelativePath(relativePath: string): string {
  const here = fileURLToPath(import.meta.url);
  const distRoot = resolve(here, "..", "..", "..");
  return resolve(distRoot, relativePath);
}

function normalizeRepositoryPath(root: string, file: string): string {
  const normalizedRoot = root.split("\\").join("/");
  const normalizedFile = file.split("\\").join("/");
  const prefix = `${normalizedRoot}/`;

  return normalizedFile.startsWith(prefix) ? normalizedFile.slice(prefix.length) : normalizedFile;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function isEntrypoint(): boolean {
  const scriptArg = process.argv[1];
  if (scriptArg === undefined) {
    return false;
  }
  return pathToFileURL(scriptArg).href === import.meta.url;
}

if (isEntrypoint()) {
  main(process.argv).catch(error => {
    if (error instanceof PlanValidationError) {
      return;
    }
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = exitCodeUsageError;
      return;
    }
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = exitCodePolicyFailure;
  });
}
