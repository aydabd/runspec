import test from "node:test";
import assert from "node:assert/strict";
import { runSpecFramework } from "../../src/blueprint/runSpecFramework.js";
import { springBootGenerator } from "../../src/core/generators/spring-boot.js";

const capability = runSpecFramework.productCapabilities.find(entry => entry.id === "APPLICATION_BUILDER");
const service = runSpecFramework.serviceTargets.find(entry => entry.id === "spring-boot-service");
if (capability === undefined || service === undefined) {
  throw new Error("test fixture missing APPLICATION_BUILDER or spring-boot-service");
}

test("springBootGenerator emits a deterministic file set", () => {
  const a = springBootGenerator.generate(capability, service);
  const b = springBootGenerator.generate(capability, service);
  assert.deepEqual(a, b);
});

test("springBootGenerator emits a Gradle Kotlin DSL build file with Spring Boot 4.0 and Java 25", () => {
  const files = springBootGenerator.generate(capability, service);
  const buildGradle = files.find(file => file.path === "build.gradle.kts");
  assert.ok(buildGradle);
  assert.match(buildGradle.content, /id\("org\.springframework\.boot"\) version "4\.0\.0"/);
  assert.match(buildGradle.content, /id\("io\.spring\.dependency-management"\) version "[\d.]+"/);
  assert.match(buildGradle.content, /JavaLanguageVersion\.of\(25\)/);
  assert.match(buildGradle.content, /implementation\("org\.springframework\.boot:spring-boot-starter-web"\)/);
  assert.match(buildGradle.content, /testImplementation\("org\.springframework\.boot:spring-boot-starter-test"\)/);
  assert.match(buildGradle.content, /useJUnitPlatform\(\)/);
});

test("springBootGenerator emits a settings.gradle.kts with the normalised project name", () => {
  const files = springBootGenerator.generate(capability, service);
  const settings = files.find(file => file.path === "settings.gradle.kts");
  assert.ok(settings);
  assert.match(settings.content, /rootProject\.name = "spring-boot-service"/);
});

test("springBootGenerator emits the @SpringBootApplication entry point with the service-derived class", () => {
  const files = springBootGenerator.generate(capability, service);
  const app = files.find(file => file.path.endsWith("SpringBootServiceApplication.java"));
  assert.ok(app);
  assert.match(app.content, /package com\.example\.springbootservice;/);
  assert.match(app.content, /@SpringBootApplication/);
  assert.match(app.content, /public class SpringBootServiceApplication \{/);
  assert.match(app.content, /SpringApplication\.run\(SpringBootServiceApplication\.class, args\)/);
});

test("springBootGenerator emits one Java class per domain object", () => {
  const files = springBootGenerator.generate(capability, service);
  const domainFiles = files.filter(file => file.path.includes("/domain/"));
  assert.equal(domainFiles.length, capability.implementation.domainObjects.length);
  assert.ok(domainFiles.some(file => file.path.endsWith("/domain/ProductCapability.java")));
  assert.ok(domainFiles.some(file => file.path.endsWith("/domain/ImplementationContract.java")));
});

test("springBootGenerator preserves PascalCase identifiers from blueprint", () => {
  const files = springBootGenerator.generate(capability, service);
  const productCapability = files.find(file => file.path.endsWith("/domain/ProductCapability.java"));
  assert.ok(productCapability);
  assert.match(productCapability.content, /public class ProductCapability \{/);
});

test("springBootGenerator emits a use case interface with the execute method", () => {
  const files = springBootGenerator.generate(capability, service);
  const useCase = files.find(file => file.path.endsWith("/application/GenerateServiceSlice.java"));
  assert.ok(useCase);
  assert.match(useCase.content, /public interface GenerateServiceSlice \{/);
  assert.match(useCase.content, /void execute\(\);/);
});

test("springBootGenerator emits a HelloController with @RestController and @GetMapping", () => {
  const files = springBootGenerator.generate(capability, service);
  const controller = files.find(file => file.path.endsWith("/controllers/HelloController.java"));
  assert.ok(controller);
  assert.match(controller.content, /@RestController/);
  assert.match(controller.content, /@GetMapping\("\/"\)/);
});

test("springBootGenerator emits a JUnit 5 @Disabled test class per scenario", () => {
  const files = springBootGenerator.generate(capability, service);
  const testFiles = files.filter(file => file.path.startsWith("src/test/java/"));
  assert.equal(testFiles.length, capability.scenarios.length);
  for (const testFile of testFiles) {
    assert.match(testFile.content, /import org\.junit\.jupiter\.api\.Disabled;/);
    assert.match(testFile.content, /@Disabled\("runspec scenario not yet implemented:/);
    assert.match(testFile.content, /public class \w+Test \{/);
  }
});

test("springBootGenerator includes a generated-by header citing capability and service in every file", () => {
  const files = springBootGenerator.generate(capability, service);
  const expectedCitation = `capability "${capability.id}", service "${service.id}"`;
  for (const file of files) {
    assert.match(file.content, /Code generated by runspec\. DO NOT EDIT\./);
    assert.ok(file.content.includes(expectedCitation), `missing citation in ${file.path}`);
  }
});

test("springBootGenerator normalises hostile service ids to a Gradle-safe project name", () => {
  const hostileService = { ...service, id: "../etc passwd!" };
  const files = springBootGenerator.generate(capability, hostileService);
  const settings = files.find(file => file.path === "settings.gradle.kts");
  assert.ok(settings);
  const nameMatch = settings.content.match(/rootProject\.name = "([^"]+)"/);
  assert.ok(nameMatch);
  const projectName = nameMatch[1]!;
  assert.match(projectName, /^[a-z0-9._-]+$/);
  assert.ok(!projectName.startsWith("."));
  assert.ok(!projectName.startsWith("-"));
  assert.ok(!projectName.endsWith("-"));
});

test("springBootGenerator falls back to project name 'service' when service id has no safe characters", () => {
  const hostileService = { ...service, id: "!!!" };
  const files = springBootGenerator.generate(capability, hostileService);
  const settings = files.find(file => file.path === "settings.gradle.kts");
  assert.ok(settings);
  assert.match(settings.content, /rootProject\.name = "service"/);
});

test("springBootGenerator prefixes digit-leading class names so they are valid Java identifiers", () => {
  const capabilityWithDigitName = {
    ...capability,
    implementation: {
      ...capability.implementation,
      domainObjects: ["123Numeric", "ValidName"],
    },
  };
  const files = springBootGenerator.generate(capabilityWithDigitName, service);
  const domainFiles = files.filter(file => file.path.includes("/domain/"));
  for (const file of domainFiles) {
    const basename = file.path.slice(file.path.lastIndexOf("/") + 1).replace(/\.java$/, "");
    assert.match(basename, /^[A-Za-z_][A-Za-z0-9_]*$/, `invalid Java identifier in filename ${file.path}`);
  }
});

test("springBootGenerator escapes newlines and tabs in scenario titles", () => {
  const scenarioWithControls = {
    ...capability,
    scenarios: [
      {
        ...capability.scenarios[0]!,
        id: "CONTROL_TEST",
        title: "scenario with\nnewline\tand tab",
      },
    ],
  };
  const files = springBootGenerator.generate(scenarioWithControls, service);
  const testFile = files.find(file => file.path.startsWith("src/test/java/"));
  assert.ok(testFile);
  assert.ok(!testFile.content.includes("\nnewline"), "raw newline leaked into generated Java");
  assert.ok(!testFile.content.includes("\tand"), "raw tab leaked into generated Java");
  assert.match(testFile.content, /\\n/);
  assert.match(testFile.content, /\\t/);
});

test("springBootGenerator sanitises hostile identifiers in package and class names", () => {
  const hostileService = {
    ...service,
    id: "../etc/passwd",
  };
  const files = springBootGenerator.generate(capability, hostileService);
  for (const file of files) {
    assert.ok(!file.path.includes(".."), `path contains ..: ${file.path}`);
    assert.ok(!file.path.startsWith("/"), `path is absolute: ${file.path}`);
  }
});

test("springBootGenerator escapes backslashes in scenario titles", () => {
  const scenarioWithBackslash = {
    ...capability,
    scenarios: [
      {
        ...capability.scenarios[0]!,
        id: "BACKSLASH_TEST",
        title: 'scenario with \\backslash and "quote"',
      },
    ],
  };
  const files = springBootGenerator.generate(scenarioWithBackslash, service);
  const testFile = files.find(file => file.path.startsWith("src/test/java/"));
  assert.ok(testFile);
  assert.ok(!/[^\\]\\[^\\"]/.test(testFile.content), "generated test file contains an unescaped backslash");
});
