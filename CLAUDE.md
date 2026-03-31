# CLAUDE.md — WhatsApp Agent Platform

## Architecture

Functional-first, zero classes. Every error is a `Result`, every nullable is `Option`, every flow is `pipe`/`pipeAsync`.

### Layers

```
domain/     → Pure types, entities, value objects, port interfaces
application/→ Use cases, agent pipeline, event bus, services
infra/      → DB (Drizzle/Postgres), Baileys, storage, AI providers, auth
interface/  → HTTP (Express) + WebSocket (Socket.IO v4)
config/     → Env validation (zod), logger (pino), DI container
```

### Core Principles

1. **Zero classes** — functions, factories, closures
2. **Result everywhere** — no try/catch, no throw
3. **Option for nullable** — no `if (x != null)`, use `fromNullable`/`mapOption`
4. **pipe/pipeAsync** — composable data flow
5. **Agents as functions** — `AgentContext -> Promise<Result<AgentDecision, Error>>`
6. **Side effects at the border** — domain is pure, IO lives in infra

### AI Agent Pipeline

Agents compose via `createPipeline(agents, logger)`. Each agent returns a `Result<AgentDecision>`:
- `pass` → next agent
- `respond` → auto-reply, short-circuit
- `block` → discard message
- `route` → assign operator
- `escalate` → flag for review

Pipeline is fail-open: if an agent errors, it's skipped.

### Dependencies

Manual functional DI via `config/container.ts`. No IoC framework — just a `createContainer(env)` that wires everything.

## Commands

```bash
npm run dev        # tsx watch
npm run build      # tsc
npm start          # production
npm run db:generate # drizzle migrations
npm run db:migrate  # apply migrations
npm test           # vitest
```

## Rules

- `@tecnomancy/alchemy` for all control flow
- No `try/catch`, no `throw`, no `class`
- Commit messages in Portuguese
- Never commit `.env` or `auth_sessions/`
