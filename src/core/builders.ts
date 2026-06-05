import type {
  AcceptanceCriterion,
  AgentPolicy,
  DiagramTarget,
  EnterpriseApplicationExample,
  FollowUpMilestone,
  InfrastructureAdapter,
  PlannedCommit,
  ProductCapability,
  ProductFlow,
  QualityGate,
  RunSpecApplicationBuilder,
  ServiceTarget,
  SkeletonGenerator,
  SourceOfTruthPolicy,
  ThreatModel,
  VerificationHarness,
  WorkPlan,
  WorkspaceCapability,
} from "./model.js";

export function defineRunSpecFramework(builder: RunSpecApplicationBuilder): RunSpecApplicationBuilder {
  return builder;
}

export function sourceOfTruthPolicy(policy: SourceOfTruthPolicy): SourceOfTruthPolicy {
  return policy;
}

export function workspaceCapability(capability: WorkspaceCapability): WorkspaceCapability {
  return capability;
}

export function serviceTarget(target: ServiceTarget): ServiceTarget {
  return target;
}

export function infrastructureAdapter(adapter: InfrastructureAdapter): InfrastructureAdapter {
  return adapter;
}

export function productCapability(capability: ProductCapability): ProductCapability {
  return capability;
}

export function productFlow(flow: ProductFlow): ProductFlow {
  return flow;
}

export function threatModel(model: ThreatModel): ThreatModel {
  return model;
}

export function qualityGate(gate: QualityGate): QualityGate {
  return gate;
}

export function verificationHarness(harness: VerificationHarness): VerificationHarness {
  return harness;
}

export function diagramTarget(target: DiagramTarget): DiagramTarget {
  return target;
}

export function agentPolicy(policy: AgentPolicy): AgentPolicy {
  return policy;
}

export function enterpriseApplicationExample(example: EnterpriseApplicationExample): EnterpriseApplicationExample {
  return example;
}

export function defineWorkPlan(plan: WorkPlan): WorkPlan {
  return plan;
}

export function plannedCommit(commit: PlannedCommit): PlannedCommit {
  return commit;
}

export function acceptanceCriterion(criterion: AcceptanceCriterion): AcceptanceCriterion {
  return criterion;
}

export function followUpMilestone(milestone: FollowUpMilestone): FollowUpMilestone {
  return milestone;
}

export function skeletonGenerator(generator: SkeletonGenerator): SkeletonGenerator {
  return generator;
}
