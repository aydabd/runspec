import type {
  FileWriter,
  GenerationRequest,
  GenerationResult,
  RunSpecApplicationBuilder,
  SkeletonGenerator,
} from "./model.js";

export class GenerationError extends Error {}

export function generate(
  framework: RunSpecApplicationBuilder,
  request: GenerationRequest,
  registry: readonly SkeletonGenerator[],
): GenerationResult {
  const capability = framework.productCapabilities.find(entry => entry.id === request.capabilityId);
  if (capability === undefined) {
    throw new GenerationError(`capability "${request.capabilityId}" not found in blueprint`);
  }
  const service = framework.serviceTargets.find(entry => entry.id === request.serviceId);
  if (service === undefined) {
    throw new GenerationError(`service "${request.serviceId}" not found in blueprint`);
  }
  const generator = registry.find(entry => entry.language === service.language && entry.framework === service.framework);
  if (generator === undefined) {
    throw new GenerationError(`no skeleton generator registered for ${service.language}:${service.framework}`);
  }
  const files = generator.generate(capability, service);
  return { request, capability, service, generator, files };
}

export function writeGenerationResult(result: GenerationResult, writer: FileWriter): void {
  for (const file of result.files) {
    writer(result.request.outputRoot, file.path, file.content);
  }
}
