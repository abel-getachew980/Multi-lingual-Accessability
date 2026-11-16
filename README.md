# AI Tutor - የአማርኛ ቱቶር

Accessible AI Tutor with Amharic and English support for the Digital Bridge Accessibility Hackathon (November 14-15, 2026, ALX Tech Hub, Addis Ababa).

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run accessibility tests
npm run test:a11y

# Build for production
npm run build
```

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── ai/             # Teammate 2: AI query endpoint
│   │   │   ├── telegram/       # Teammate 3: Telegram webhook
│   │   │   ├── sms/            # Teammate 4: SMS webhook
│   │   │   └── help/           # Teammate 5: Human help API
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/             # React components
│   │   ├── Chat/               # Teammate 1: Chat UI
│   │   ├── HumanHelp/          # Teammate 5: Human help UI
│   │   ├── Settings/           # Teammate 8: Settings UI
│   │   └── UI/                 # Shared components
│   ├── context/                # React context
│   │   └── TutorContext.tsx    # Main state management
│   ├── hooks/                  # Custom hooks
│   ├── i18n/                   # Translations
│   │   └── translations.ts     # Amharic/English
│   ├── services/               # Business logic
│   │   ├── ai/                 # Teammate 2: AI providers
│   │   ├── help/               # Teammate 5: Help queue and signaling
│   │   ├── storage/            # Teammate 6: Offline storage
│   │   ├── telegram/           # Teammate 3: Webhook forwarding helpers
│   │   └── webrtc/             # Teammate 5: Screen sharing
│   ├── types/                  # TypeScript types
│   │   └── index.ts            # All type definitions
│   └── utils/                  # Utilities
│       └── accessibility.ts    # Teammate 7: A11y utils
├── telegram-bot/               # Teammate 3: Standalone Telegram bot
├── sms-gateway/                # Teammate 4: Standalone SMS gateway
├── tests/                      # Test suites
│   ├── accessibility/          # Teammate 7: A11y tests
│   ├── integration/            # Integration tests
│   └── unit/                   # Unit tests
└── public/                     # Static assets
    ├── icons/
    └── audio/
```

## Module Assignments

| Teammate | Module | Files | Status |
|----------|--------|-------|--------|
| 1 | Chat UI | `src/components/Chat/` | ✅ Done |
| 2 | AI Providers | `src/services/ai/`, `src/app/api/ai/`, `src/components/CourseUploader/`, `src/app/courses/` | ✅ Done |
| 3 | Telegram Bot | `telegram-bot/`, `src/app/api/telegram/` | ✅ Done |
| 4 | SMS Gateway | `sms-gateway/`, `src/app/api/sms/` | ✅ Done |
| 5 | Human Help | `src/components/HumanHelp/`, `src/services/webrtc/`, `src/services/help/`, `src/app/api/help/` | ✅ Done |
| 6 | Offline Storage | `src/services/storage/`, `public/sw.js` (built) | ✅ Done |
| 7 | Accessibility Tests | `tests/accessibility/`, `src/utils/accessibility.ts` | ✅ Done |
| 8 | Settings UI | `src/components/Settings/` | ✅ Done |

## Working with Feature Branches

Each teammate works on their own feature branch:

```bash
# Create your feature branch
git checkout -b feature/your-module-name

# Make changes
# ...

# Commit and push
git add .
git commit -m "Your changes"
git push origin feature/your-module-name

# Create pull request to main
```

## Accessibility Requirements

All modules must pass:

- ✅ NVDA screen reader compatibility
- ✅ TalkBack screen reader compatibility
- ✅ Keyboard-only navigation
- ✅ 200% zoom without horizontal scroll
- ✅ Sound-off usability (visual feedback)
- ✅ Zero critical/serious axe-core issues
- ✅ RTL support for Amharic text

### Automated checks

```bash
npm run test:a11y     # tests/accessibility only
npm test              # whole Jest suite
npm run typecheck
```

`tests/accessibility/` covers:

| File | What it protects |
|---|---|
| `axe.test.tsx` | jsdom + jest-axe audits of the composer, settings dialog, help dialog and live status |
| `keyboard-navigation.test.tsx` | Focus trap, Tab order, Enter/Shift+Enter, list keys, skip link |
| `screen-reader.test.ts` | Polite/assertive live regions, reuse, clearing and the legacy API |
| `contrast.test.ts` | Palette tokens read from `globals.css`, WCAG 2.1 ratios, high-contrast mode |
| `zoom.test.ts` | Viewport scaling, rem typography, reflow rules, reduced motion, skip target |
| `sound-notifications.test.ts` | Tone scheduling, volume clamping, autoplay failure and unsupported browsers |

The parts a machine cannot verify — NVDA/TalkBack speech, 200%/400% zoom,
sound-off use, offline behaviour and real help sessions — are in
[`tests/accessibility/manual-checklist.md`](tests/accessibility/manual-checklist.md).

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules + CSS Variables
- **PWA**: next-pwa for offline support
- **Testing**: Jest + jest-axe + Testing Library
- **Linting**: ESLint + jsx-a11y

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required for each module:
- **AI Providers**: `AI_PROVIDER`, `CLOUD_AI_API_KEY`
- **Telegram Bot**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`; set `TELEGRAM_BOT_URL` so `/api/telegram` can forward updates when the bot runs separately. See [`telegram-bot/README.md`](telegram-bot/README.md).
- **SMS Gateway**: `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`
- **Human Help**: optional `HELP_TUTOR_KEY` protects tutor-only actions; `NEXT_PUBLIC_WEBRTC_ICE_SERVERS` adds TURN servers
- **Voice notes**: optional `TRANSCRIPTION_API_URL` (Whisper-compatible)

## License

MIT

## Hackathon

Track 3: Assistant & Help  
Digital Bridge Accessibility Hackathon  
November 14-15, 2026  
ALX Tech Hub, Addis Ababa
