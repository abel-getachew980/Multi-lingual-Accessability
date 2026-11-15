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
│   │   ├── storage/            # Teammate 6: Offline storage
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

| Teammate | Module | Files | Branch |
|----------|--------|-------|--------|
| 1 | Chat UI | `src/components/Chat/` | `feature/chat-ui` |
| 2 | AI Providers | `src/services/ai/`, `src/app/api/ai/`, `src/components/CourseUploader/`, `src/app/courses/` | `feature/ai-providers` |
| 3 | Telegram Bot | `telegram-bot/`, `src/app/api/telegram/` | `feature/telegram-bot` |
| 4 | SMS Gateway | `sms-gateway/`, `src/app/api/sms/` | `feature/sms-gateway` |
| 5 | Human Help | `src/components/HumanHelp/`, `src/services/webrtc/`, `src/app/api/help/` | `feature/human-help` |
| 6 | Offline Storage | `src/services/storage/` | `feature/offline-storage` |
| 7 | Accessibility Tests | `tests/accessibility/`, `src/utils/accessibility.ts` | `feature/accessibility-tests` |
| 8 | Settings UI | `src/components/Settings/` | `feature/settings-ui` |

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

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules + CSS Variables
- **PWA**: next-pwa for offline support
- **Testing**: Jest + @axe-core/react
- **Linting**: ESLint + jsx-a11y

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required for each module:
- **AI Providers**: `AI_PROVIDER`, `CLOUD_AI_API_KEY`
- **Telegram Bot**: `TELEGRAM_BOT_TOKEN`
- **SMS Gateway**: `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`
- **Human Help**: `WEBRTC_SIGNALING_SERVER`

## License

MIT

## Hackathon

Track 3: Assistant & Help  
Digital Bridge Accessibility Hackathon  
November 14-15, 2026  
ALX Tech Hub, Addis Ababa
