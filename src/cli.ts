import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { runSpecFramework } from "./blueprint/runSpecFramework.js";
import { nextAgentTask } from "./core/agent.js";
import { validateRunSpecFramework } from "./core/validators.js";

type Command = "verify-markdown" | "verify-blueprint" | "agent-next" | "blueprint-print";

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
    .map(file => file.replace(`${root}/`, ""))
    .filter(file => !file.startsWith(".git/"))
    .filter(file => !file.startsWith("dist/"))
    .sort();

  const allowed = new Set(runSpecFramework.sourceOfTruth.handWrittenMarkdownFiles);
  const forbidden = markdownFiles.filter(file => !allowed.has(file));

  if (forbidden.length > 0) {
    printJson({ valid: false, forbidden });
    process.exitCode = 1;
    return;
  }

  printJson({ valid: true, markdownFiles });
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
