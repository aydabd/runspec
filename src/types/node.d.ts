declare const process: {
  argv: readonly string[];
  cwd(): string;
  exitCode?: number;
  stdout: { write(value: string): void };
};

declare module "node:fs" {
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
}

declare module "node:path" {
  export function extname(path: string): string;
  export function join(...paths: readonly string[]): string;
}

declare module "node:test" {
  const test: (name: string, fn: () => void) => void;
  export default test;
}

declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    match(value: string, regexp: RegExp, message?: string): void;
  };
  export default assert;
}
