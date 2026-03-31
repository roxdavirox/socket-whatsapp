# WhatsApp Agent Platform

Composable AI agent pipelines over WhatsApp multi-device. Functional architecture with zero classes, `Result` for errors, `Option` for nullability, and `pipe` for everything else.

Built on [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) for WhatsApp multi-device protocol and [`@tecnomancy/alchemy`](https://github.com/tecnomancy/alchemy) for functional control flow.

## Stack

| Layer | Tech |
|-------|------|
| WhatsApp | Baileys (multi-device) |
| Database | PostgreSQL + Drizzle ORM |
| API | Express + Socket.IO v4 |
| AI Agents | OpenAI / Anthropic / Ollama (composable pipeline) |
| Auth | argon2 + JWT (jose) |
| Validation | zod |
| FP Core | @tecnomancy/alchemy |

## Setup

```bash
cp .env.example .env   # configure DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## Agent Pipeline

Messages flow through a composable pipeline of AI agents:

```
incoming message → Guard → Conversation → Routing → Summary → action
```

Each agent is a pure function `AgentContext -> Promise<Result<AgentDecision>>` that can:
- **pass** — forward to next agent
- **respond** — auto-reply and short-circuit
- **block** — discard (spam, abuse)
- **route** — assign an operator
- **escalate** — flag for human review

The pipeline is fail-open: if an agent errors, it's skipped. Add custom agents by implementing the `Agent` type and appending to the pipeline.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/auth/login` | POST | Login |
| `/api/chats` | GET | List chats |
| `/api/chats/:id/messages` | GET | Chat messages |
| `/api/contacts` | GET | List contacts |
| `/api/messages/send` | POST | Send text |

WebSocket namespaces: `/qr` (session management), `/chat` (real-time messages).

## Credits

This project evolved from [`socket-whatsapp`](https://github.com/roxdavirox/socket-whatsapp) (2020), originally built as a WhatsApp Web gateway using the reverse-engineered protocol by [Sigalor](https://github.com/sigalor/whatsapp-web-reveng) and the Go reimplementation by [Rhymen](https://github.com/Rhymen/go-whatsapp). The protocol layer now uses [Baileys](https://github.com/WhiskeySockets/Baileys) by [@whiskeysockets](https://github.com/WhiskeySockets).

## License

MIT
