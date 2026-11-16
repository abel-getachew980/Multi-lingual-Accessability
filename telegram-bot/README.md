# AI Tutor Telegram Bot

Standalone Telegram bot for the low-bandwidth chat route. It answers text and
voice questions through the app's AI endpoint, keeps a short conversation, and
opens real human-help tickets in the same queue the web app uses.

The bot talks to the Telegram Bot API over `fetch`, so it has no runtime
dependencies (no grammy/telegraf, no `node_modules` of its own).

## Why a separate process?

- Telegram updates can keep flowing while the Next.js app is redeployed.
- Long polling needs no public URL or TLS for local development.
- The Next.js route (`src/app/api/telegram/route.ts`) can stay a thin forwarder
  that verifies Telegram's secret header.

## Setup

Install once at the repository root:

```bash
npm install
```

Then run the bot:

```bash
cd telegram-bot
cp .env.example .env    # add the token from @BotFather
npm run dev             # long polling by default
```

The Next.js app must also be running (`npm run dev` in the repo root) because
the bot calls `POST /api/ai` and `POST/GET/DELETE /api/help`.

### Environment

| Variable | Default | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | – | **Required.** Token from @BotFather |
| `TELEGRAM_MODE` | `polling` | `polling` (local) or `webhook` (public) |
| `TELEGRAM_BOT_PORT` | `3002` | Webhook server port |
| `TELEGRAM_WEBHOOK_PATH` | `/telegram` | Path the bot listens on |
| `TELEGRAM_WEBHOOK_SECRET` | – | **Required in webhook mode.** Echoed by Telegram in `X-Telegram-Bot-Api-Secret-Token` |
| `TELEGRAM_BOT_WEBHOOK_URL` | – | Public URL registered with Telegram on startup |
| `TELEGRAM_API_BASE_URL` | `https://api.telegram.org` | Bot API base (override for a local mock) |
| `APP_BASE_URL` | `http://localhost:3000` | Base URL of the Next.js app |
| `AI_API_URL` | `${APP_BASE_URL}/api/ai` | AI endpoint |
| `AI_PROVIDER` | unset | Passed through (`cloud`, `local`, `offline`) |
| `AI_TIMEOUT_MS` | `15000` | AI request timeout |
| `HELP_API_URL` | `${APP_BASE_URL}/api/help` | Help desk endpoint |
| `HELP_TIMEOUT_MS` | `5000` | Help desk request timeout |
| `HELP_REQUEST_COOLDOWN_MS` | `600000` | Repeated `/tutor` reuses the open ticket inside this window |
| `TELEGRAM_DEFAULT_LANGUAGE` | `am` | Language for new chats (`am`/`en`) |
| `TELEGRAM_MAX_QUESTION_LENGTH` | `1000` | Longer messages are rejected |
| `TELEGRAM_MAX_HISTORY_TURNS` | `8` | Turns kept for follow-ups and help tickets |
| `TELEGRAM_RATE_LIMIT_MAX` | `20` | Messages allowed per window |
| `TELEGRAM_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `TELEGRAM_SESSION_TTL_MS` | `86400000` | Session lifetime |
| `TELEGRAM_MAX_VOICE_SECONDS` | `120` | Longer voice notes are rejected before download |
| `TELEGRAM_MAX_VOICE_BYTES` | `5242880` | Larger voice files are rejected |
| `TRANSCRIPTION_API_URL` | – | Whisper-compatible multipart endpoint; unset means voice is honestly reported as unavailable |
| `TRANSCRIPTION_MODEL` | `whisper-1` | Model sent to the transcription API |
| `TRANSCRIPTION_LANGUAGE` | chat language | Optional fixed language hint |
| `TRANSCRIPTION_TIMEOUT_MS` | `20000` | Transcription timeout |

## Commands

| Message | Effect |
|---|---|
| Any text | Question to the AI, with a citation when available |
| Any voice note | Transcribed, then answered like text (when transcription is configured) |
| `/start` | Welcome message and the main menu |
| `/help` | How to use the bot |
| `/language` | Choose Amharic or English |
| `/language am` / `/language en` | Switch directly; clears the old-language history |
| `/tutor` | Create a help-desk ticket |
| `/status` | Queue position, estimated wait, or the tutor's state |
| `/cancel` | Cancel the open help ticket |
| `/clear` | Clear the conversation but keep any open ticket |

Inline buttons mirror the commands. While a ticket is open the help menu shows
status and cancel instead of another request, so a learner cannot queue twice.

## Human help

`/tutor` posts to the app's `/api/help` with:

```json
{
  "userId": "telegram:<chatId>",
  "channel": "telegram",
  "language": "am",
  "conversationHistory": [{ "role": "user", "content": "…" }]
}
```

The bot only tells the learner the request is registered after the API returns
an id. `/status` and `/cancel` reuse `GET` and `DELETE /api/help?id=…`, so the
web app, SMS gateway and Telegram share one queue. If the help desk is
unreachable the bot says so instead of inventing a ticket.

## Voice notes

Telegram delivers voice notes as OGG/Opus and does not transcribe them. Set
`TRANSCRIPTION_API_URL` to a Whisper-compatible endpoint that accepts
`multipart/form-data` with a `file` field. Without it the bot replies that voice
is unavailable and asks for text; it never pretends to have heard a question.

## Deployment

### Long polling (development)

`TELEGRAM_MODE=polling` (default) removes any leftover webhook, then calls
`getUpdates`. No public URL is needed.

### Webhook (production)

Two layouts work:

1. **Direct** – Telegram calls the bot:
   set `TELEGRAM_MODE=webhook`, `TELEGRAM_WEBHOOK_SECRET`, and optionally
   `TELEGRAM_BOT_WEBHOOK_URL` so the bot registers itself on startup.
   Expose `http://bot-host:3002/telegram`.

2. **Through the app** – Telegram calls `https://app.example.com/api/telegram`.
   Set `TELEGRAM_BOT_URL=http://bot-host:3002` and the same
   `TELEGRAM_WEBHOOK_SECRET` in the app's environment. The route checks the
   secret, then forwards the raw update to the bot.

The bot rejects webhook requests whose secret is missing or wrong, and refuses
to start in webhook mode without `TELEGRAM_WEBHOOK_SECRET`. Health checks are
available at `GET /health`.

## Tests

From the repository root:

```bash
npx tsc -p telegram-bot --noEmit
cd telegram-bot && npm test
```

The suite covers configuration, sessions, rate limits, keyboards, the AI/help
clients, message splitting, the Bot API wrapper, voice handling, every command
and callback, and the webhook forwarding route in the app.
