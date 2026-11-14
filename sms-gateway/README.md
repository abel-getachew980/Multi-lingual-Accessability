# AI Tutor SMS Gateway

Standalone Express service for the low-bandwidth SMS route. It accepts inbound
messages from Twilio (or any provider that posts `from`/`text`), forwards the
question to the AI Tutor app, and replies with SMS-sized segments and a
citation.

## Why a separate process?

- SMS traffic keeps working when the Next.js app is redeployed.
- Provider SDKs and retry queues stay out of the serverless bundle.
- The Next.js route (`src/app/api/sms/route.ts`) can stay a thin forwarder.

## Setup

```bash
cd sms-gateway
npm install
cp .env.example .env    # then edit
npm run dev             # http://localhost:3001
```

The AI app must be running too (`npm run dev` in the repo root) because the
gateway calls `POST /api/ai`.

### Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Gateway port |
| `SMS_PROVIDER` | `console` | `console` (logs messages) or `twilio` |
| `SMS_REPLY_MODE` | `twiml` | `twiml` replies in the webhook response; `api` answers immediately and sends via the provider API |
| `AI_API_URL` | `http://localhost:3000` | Base URL of the AI app |
| `AI_PROVIDER` | unset | Passed through to the app (`cloud`, `local`, `offline`) |
| `AI_TIMEOUT_MS` | `8000` | AI request timeout |
| `SMS_DEFAULT_LANGUAGE` | `am` | Language for new numbers (`am`/`en`) |
| `SMS_MAX_SEGMENTS` | `3` | Maximum SMS parts per reply |
| `SMS_MAX_QUESTION_LENGTH` | `500` | Longer messages are rejected |
| `SMS_RATE_LIMIT_MAX` | `10` | Messages allowed per window |
| `SMS_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `SMS_SESSION_TTL_MS` | `86400000` | Session lifetime |
| `SMS_ACCOUNT_SID` | – | Twilio credentials (required for `SMS_PROVIDER=twilio`) |
| `SMS_AUTH_TOKEN` | – | Twilio auth token; also used to verify webhook signatures |
| `SMS_FROM_NUMBER` | – | Twilio sender number |
| `TWILIO_WEBHOOK_URL` | – | Public URL Twilio calls; required to verify signatures |

## Webhook configuration

Two deployment styles work:

1. **Direct** – point Twilio at the gateway: `https://gateway.example.com/sms`.
2. **Through the app** – point Twilio at `https://app.example.com/api/sms` and
   set `SMS_GATEWAY_URL` in the app's environment. The Next.js route forwards
   the request (and signature) to the gateway.

When `SMS_AUTH_TOKEN` and `TWILIO_WEBHOOK_URL` are both set, requests without a
valid `X-Twilio-Signature` are rejected with `403`.

## Commands

| Message | Effect |
|---|---|
| Any text | Question to the AI, answered with a citation when available |
| `LANG AM` / `LANG EN` | Switch language |
| `HELP` / `START` | Request a human tutor / show help |
| `MORE` | Continue an answer that was split across several SMS |
| `RESET` / `CLEAR` | Clear the conversation |

Amharic equivalents (`ቋንቋ አማርኛ`, `እርዳታ`, `ተጨማሪ`, `አጽዳ`) are accepted too.

`HELP` records `helpRequestedAt` on the session and tells the learner a tutor
has been notified. Wiring that into the human-help queue (`POST /api/help`) is
the next integration step.

## Message sizing

- Latin/GSM-7 text: 160 characters per SMS.
- Amharic/Ethiopic text: 70 characters per SMS (UCS-2).
- Replies never contain emoji, because one emoji would force the whole message
  into UCS-2 and triple the number of billable segments.
- Long answers are capped at `SMS_MAX_SEGMENTS`; the remainder is stored in the
  session and served on `MORE`.

## Development

```bash
# simulate an inbound SMS (console provider)
curl -X POST http://localhost:3001/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=+251911111111" \
  --data-urlencode "Body=LANG EN"

npm test        # unit tests (node:test + ts-node)
npm run build   # compile to dist/
npm start       # run the compiled server
```

`GET /health` reports uptime, provider, reply mode and queue size.

## Known limits

- Sessions, rate-limit counters and the send queue are in-memory. Use Redis (or
  a database) before running multiple instances.
- `HELP` does not yet create a ticket in the human-help API.
- Twilio signatures are verified against `TWILIO_WEBHOOK_URL`; if a proxy
  rewrites the public URL, update that variable to the URL Twilio signed.
