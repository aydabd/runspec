import test from "node:test";
import assert from "node:assert/strict";
import { runSpecFramework } from "../src/blueprint/runSpecFramework.js";
import { generate, writeGenerationResult, GenerationError } from "../src/core/generator.js";
import { goHttpGenerator } from "../src/core/generators/go-http.js";
import { skeletonGenerator } from "../src/core/builders.js";
import type { RunSpecApplicationBuilder } from "../src/core/model.js";

const stubGenerator = skeletonGenerator({
  id: "stub",
  description: "stub generator",
  language: "typescript",
  framework: "node-http",
  generate: () => [{ path: "stub.ts", content: "export {}" }],
});

test("generate returns a GenerationResult for a valid capability+service", () => {
  const result = generate(
    runSpecFramework,
    {
      capabilityId: "APPLICATION_BUILDER",
      serviceId: "go-http-service",
      outputRoot: "/tmp/runspec-gen-test",
    },
    [goHttpGenerator],
  );
  assert.equal(result.capability.id, "APPLICATION_BUILDER");
  assert.equal(result.service.id, "go-http-service");
  assert.equal(result.generator.id, "go-http");
  assert.ok(result.files.length > 0);
  assert.ok(result.files.some(file => file.path === "go.mod"));
  assert.ok(result.files.some(file => file.path === "main.go"));
});

test("generate throws GenerationError for unknown capability", () => {
  assert.throws(
    () =>
      generate(
        runSpecFramework,
        { capabilityId: "DOES_NOT_EXIST", serviceId: "go-http-service", outputRoot: "/tmp/x" },
        [goHttpGenerator],
      ),
    (error: Error) => error instanceof GenerationError && /capability "DOES_NOT_EXIST"/.test(error.message),
  );
});

test("generate throws GenerationError for unknown service", () => {
  assert.throws(
    () =>
      generate(
        runSpecFramework,
        { capabilityId: "APPLICATION_BUILDER", serviceId: "no-such-service", outputRoot: "/tmp/x" },
        [goHttpGenerator],
      ),
    (error: Error) => error instanceof GenerationError && /service "no-such-service"/.test(error.message),
  );
});

test("generate throws GenerationError when no generator matches the service framework", () => {
  assert.throws(
    () =>
      generate(
        runSpecFramework,
        { capabilityId: "APPLICATION_BUILDER", serviceId: "spring-boot-service", outputRoot: "/tmp/x" },
        [goHttpGenerator],
      ),
    (error: Error) => error instanceof GenerationError && /no skeleton generator registered/.test(error.message),
  );
});

test("generate dispatches to the matching generator from the registry", () => {
  const fakeFramework: RunSpecApplicationBuilder = {
    ...runSpecFramework,
    serviceTargets: [
      {
        id: "stub-service",
        language: "typescript",
        framework: "node-http",
        layers: [],
        generatedCodeAreas: [],
        requiredHarnesses: [],
        requiredGates: [],
      },
      ...runSpecFramework.serviceTargets,
    ],
  };
  const result = generate(
    fakeFramework,
    { capabilityId: "APPLICATION_BUILDER", serviceId: "stub-service", outputRoot: "/tmp/x" },
    [stubGenerator, goHttpGenerator],
  );
  assert.equal(result.generator.id, "stub");
  assert.deepEqual(result.files, [{ path: "stub.ts", content: "export {}" }]);
});

test("writeGenerationResult forwards each file to the injected FileWriter", () => {
  const captured: Array<{ root: string; path: string; content: string }> = [];
  const result = generate(
    runSpecFramework,
    {
      capabilityId: "APPLICATION_BUILDER",
      serviceId: "go-http-service",
      outputRoot: "/tmp/write-test",
    },
    [goHttpGenerator],
  );
  writeGenerationResult(result, (root, path, content) => {
    captured.push({ root, path, content });
  });
  assert.equal(captured.length, result.files.length);
  assert.ok(captured.every(entry => entry.root === "/tmp/write-test"));
  assert.deepEqual(
    captured.map(entry => entry.path).sort(),
    result.files.map(file => file.path).slice().sort(),
  );
});
