# RunSpec

RunSpec is an executable enterprise application builder for complex production systems.

The source of truth is code. Product capabilities, service topology, infrastructure, threat models, flows, verification harnesses, and agent rules are expressed as typed executable definitions.

Markdown is not used as a specification format. This repository allows only this `README.md` as hand-written markdown. Generated reports, diagrams, and evidence must be produced under `.runspec/generated/`.

## Goal

Build enterprise applications without OpenSpec, Spec Kit, or markdown requirement files.

RunSpec lets agents and developers define a product in code, generate implementation skeletons, implement production code, execute verification harnesses, and accept work only when all gates pass.

## Core loop

```bash
npm test
npm run agent:next
```

The agent loop is:

```text
Executable product definition -> generated skeleton -> implementation -> verification gates -> generated evidence
```

## Repository rules

```text
Only README.md may be hand-written markdown.
Executable definitions live in TypeScript files.
Generated documentation lives under .runspec/generated/.
Agents may not manually edit generated output.
Agents must run npm test before claiming completion.
Application code is accepted only through executable verification gates.
```

## Commands

```bash
npm run build
npm run verify:markdown
npm run verify:blueprint
npm test
npm run agent:next
npm run blueprint:print
```

## Main executable files

```text
src/blueprint/runSpecFramework.ts
src/examples/loanPlatform.ts
src/core/model.ts
src/core/builders.ts
src/core/validators.ts
src/core/agent.ts
src/cli.ts
```

## What this blueprint covers

```text
multi-service monorepo
multi-repo systems
Go services
Spring Boot services
Node/TypeScript services
Postgres
Kafka
RabbitMQ
Redis
HTTP APIs
event contracts
repositories
migrations
security policies
threat modeling
architecture gates
observability gates
sequence and flow diagram targets
AI agent execution policy
```
