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
| `HELP_API_URL` | `${AI_API_URL}/api/help` | Help desk endpoint |
| `HELP_TIMEOUT_MS` | `5000` | Help desk request timeout |
| `HELP_REQUEST_COOLDOWN_MS` | `600000` | Repeated `HELP` reuses the open ticket inside this window |
| `SMS_DEFAULT_LANGUAGE` | `am` | Language for new numbers (`am`/`en`) |
| `SMS_MAX_SEGMENTS` | `3` | Maximum SMS parts per reply |
| `SMS_MAX_QUESTION_LENGTH` | `500` | Longer messages are rejected |
| `SMS_MAX_HISTORY_TURNS` | `6` | Conversation turns kept for follow-ups and help tickets |
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
| `HELP` / `እርዳታ` | Create a help-desk ticket and tell the learner a tutor will follow up |
| `MORE` | Continue an answer that was split across several SMS |
| `RESET` / `CLEAR` | Clear the conversation |
| `STOP` / `UNSUBSCRIBE` | Opt out; the number is silenced until it sends `START` |
| `START` / `UNSTOP` | Re-subscribe and show the welcome message |

Amharic equivalents (`ቋንቋ አማርኛ`, `ተጨማሪ`, `አጽዳ`, `አቁም`, `ጀምር`) are accepted too.

### Human help

`HELP` posts to the app's `/api/help` endpoint with:

```json
{
  "userId": "sms:+251911111111",
  "channel": "sms",
  "phoneNumber": "+251911111111",
  "language": "am",
  "conversationHistory": [{ "role": "user", "content": "..." }]
}
```

The last `SMS_MAX_HISTORY_TURNS` turns are included so the tutor has context.
If the help desk cannot be reached the learner gets an honest "try again"
message instead of a fake confirmation. Repeating `HELP` inside
`HELP_REQUEST_COOLDOWN_MS` reuses the open ticket rather than creating another.

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

- Sessions, rate-limit counters, the send queue and the opt-out registry are
  in-memory. Use Redis (or a database) before running multiple instances - and
  before production, because opt-outs must survive restarts.
- Twilio signatures are verified against `TWILIO_WEBHOOK_URL`; if a proxy
  rewrites the public URL, update that variable to the URL Twilio signed.
- `STOP`/`START` and `HELP` bypass the rate limit. `HELP` tickets require the
  app's help API to be deployed; until then the learner receives the
  "couldn't reach the help desk" fallback.
