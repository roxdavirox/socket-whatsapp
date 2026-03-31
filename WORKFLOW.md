---
tracker:
  kind: custom
  active_states: [Todo, In Progress]
  terminal_states: [Done, Cancelled]
polling:
  interval_ms: 30000
workspace:
  root: /tmp/symphony-whatsapp
agent:
  max_concurrent_agents: 3
  max_turns: 15
  max_retry_backoff_ms: 120000
codex:
  command: echo "using anthropic agent"
  approval_policy: auto-edit
hooks:
  after_create: |
    git clone $REPO_URL . 2>/dev/null || true
    npm install
  before_run: |
    git checkout -b {{ issue.branchName }} 2>/dev/null || git checkout {{ issue.branchName }}
    git pull origin master --rebase 2>/dev/null || true
  after_run: |
    npm run build 2>/dev/null
    npx tsc --noEmit
---

You are an expert TypeScript developer working on a WhatsApp Agent Platform.

## Issue
**{{ issue.identifier }}**: {{ issue.title }}

{{ issue.description }}

{% if issue.labels.size > 0 %}
**Labels**: {{ issue.labels | join: ", " }}
{% endif %}

## Architecture Rules

This project follows strict functional programming:
- **Zero classes** — functions, factories, closures only
- **Result everywhere** — use `tryCatch`/`tryCatchAsync` from `@tecnomancy/alchemy`, never try/catch
- **Option for nullable** — `fromNullable`/`mapOption`, never `if (x != null)`
- **pipe/pipeAsync** — composable data flow, tacit/point-free style
- **No for loops** — use `map`/`filter`/`reduce`
- **No let** — prefer const with Result chains

## Project Structure

```
src/
  domain/     → Pure types, entities, value objects, port interfaces
  application/→ Use cases, agent pipeline, event bus, services
  infra/      → DB (Drizzle/Postgres), Baileys, storage, AI providers
  interface/  → HTTP (Express) + WebSocket (Socket.IO v4)
  config/     → Env validation (zod), logger (pino), DI container
```

## Alchemy API

```ts
// Result: Ok(v), Err(e), isOk(r), mapResult(fn)(r), flatMap(fn)(r), tryCatch(fn)(...args), tryCatchAsync(fn)(...args)
// Option: Some(v), None, fromNullable(v), mapOption(fn)(opt), toNullable(opt), isSome(opt)
// Composition: pipe(value, fn1, fn2), pipeAsync(value, fn1, fn2)
```

## Instructions

1. Implement only what the issue asks for
2. Follow the architecture rules strictly
3. Run `npx tsc --noEmit` before finishing — code must compile
4. Write tests if the issue involves business logic
5. Commit messages in Portuguese: `tipo(escopo): descrição`

{% if attempt > 1 %}
## Retry Context
This is attempt {{ attempt }}. Previous attempt failed — check CI output and fix the specific failure.
{% endif %}
