import test from "node:test";
import assert from "node:assert/strict";
import { pascalCase, sanitiseForComment } from "../../src/core/generators/_shared.js";

test("sanitiseForComment collapses CR / LF / TAB runs into a single space", () => {
  assert.equal(sanitiseForComment("a\nb"), "a b");
  assert.equal(sanitiseForComment("a\r\nb"), "a b");
  assert.equal(sanitiseForComment("a\t\tb"), "a b");
  assert.equal(sanitiseForComment("a\n\n\nb"), "a b");
});

test("sanitiseForComment preserves benign text untouched", () => {
  assert.equal(sanitiseForComment("APPLICATION_BUILDER"), "APPLICATION_BUILDER");
  assert.equal(sanitiseForComment("go-http-service"), "go-http-service");
});

test("pascalCase preserves already-PascalCase identifiers", () => {
  assert.equal(pascalCase("ProductCapability"), "ProductCapability");
  assert.equal(pascalCase("ServiceTarget"), "ServiceTarget");
});

test("pascalCase converts snake_case and kebab-case", () => {
  assert.equal(pascalCase("APPLICATION_BUILDER-001"), "ApplicationBuilder001");
  assert.equal(pascalCase("submit_application"), "SubmitApplication");
});

test("pascalCase strips non-alphanumeric characters", () => {
  assert.equal(pascalCase("../etc/passwd"), "EtcPasswd");
  assert.equal(pascalCase("hello.world.foo"), "HelloWorldFoo");
});

test("pascalCase prefixes digit-leading candidates with S", () => {
  assert.equal(pascalCase("123abc"), "S123abc");
  assert.equal(pascalCase("1"), "S1");
});

test("pascalCase returns the fallback when input has no alphanumerics", () => {
  assert.equal(pascalCase("..."), "Unnamed");
  assert.equal(pascalCase("!!!", "Custom"), "Custom");
});
