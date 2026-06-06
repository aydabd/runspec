import { enterpriseApplicationExample } from "../core/builders.js";

export const loanPlatformExample = enterpriseApplicationExample({
  name: "loan-platform",
  workspaceMode: "monorepo",
  infrastructure: ["postgres", "rabbitmq", "kafka", "redis", "vault"],
  capabilities: ["SUBMIT_APPLICATION", "DECIDE_APPLICATION", "CREATE_DISBURSEMENT"],
  services: [
    {
      id: "application-api",
      language: "java",
      framework: "spring-boot",
      ownsCapabilities: ["SUBMIT_APPLICATION"],
      consumesEvents: [],
      publishesEvents: ["application.submitted"],
      storesDataIn: ["postgres"],
    },
    {
      id: "decision-worker",
      language: "go",
      framework: "worker",
      ownsCapabilities: ["DECIDE_APPLICATION"],
      consumesEvents: ["application.submitted"],
      publishesEvents: ["application.decision.completed"],
      storesDataIn: ["postgres", "redis"],
    },
    {
      id: "disbursement-api",
      language: "typescript",
      framework: "node-http",
      ownsCapabilities: ["CREATE_DISBURSEMENT"],
      consumesEvents: ["application.decision.completed"],
      publishesEvents: ["disbursement.created"],
      storesDataIn: ["postgres"],
    },
    {
      id: "borrower-portal",
      language: "typescript",
      framework: "react-spa",
      ownsCapabilities: ["SUBMIT_APPLICATION", "VIEW_DECISION"],
      consumesEvents: [],
      publishesEvents: [],
      storesDataIn: [],
    },
  ],
});
