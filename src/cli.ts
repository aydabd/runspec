import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { runSpecFramework } from "./blueprint/runSpecFramework.js";
import { nextAgentTask } from "./core/agent.js";
import { validateRunSpecFramework } from "./core/validators.js";

type Command = "verify-markdown" | "verify-blueprint" | "agent-next" | "blueprint-print";

const legacyMarkdownDirectories = [".claude/", ".github/", "languages/"] as const;

const legacyMarkdownFiles = new Set([
  "AGENT.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
]);

function main(argv: readonly string[]): void {
  const command = argv[2] as Command | undefined;

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
    default:
      throw new Error(`Unsupported command: ${command ?? "<missing>"}`);
  }
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

  const allowed = new Set(runSpecFramework.sourceOfTruth.handWrittenMarkdownFiles);
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

main(process.argv);
