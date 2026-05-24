# Templates

Starter scaffolds you can fork and ship from. Built by 2BFT (2 Boys From Town) for our own lab and shared openly.

| Template | Stack | What it gives you |
|---|---|---|
| [openclaw-skill](./openclaw-skill) | Python 3.11 | Manifest + handler + tests for an OpenClaw-style agent skill |
| [telegram-bot](./telegram-bot) | Node 20 + Telegraf | Telegram managed bot that routes messages to an OpenClaw skill |

The two compose: the Telegram bot calls the OpenClaw skill via a tiny shell-out adapter. Same pattern we use internally for distribution.

```
   Telegram user
        │
        ▼
   telegram-bot  ──(JSON over stdin/stdout)──▶  openclaw-skill
        │                                                │
        └────────── reply ◀──────── result ──────────────┘
```

## Conventions

- **Twelve-factor.** Config via env vars, never committed.
- **Logs to stdout.** Anything that runs in OpenClaw inherits structured logging.
- **Single responsibility.** Skills/handlers do one thing. Compose at the runtime layer.
