# Amharic/English AI Tutor - አማርኛ/English AI Tutor

A voice and text tutor built for the Digital Bridge Accessibility Hackathon (November 14-15, 2026, ALX Tech Hub, Addis Ababa).

## Core Features

### Multi-Platform Access
- **Web Embed**: Accessible web interface with full screen reader support
- **Telegram Bot**: Chat-based learning via Telegram
- **SMS/Text Route**: Low-bandwidth option for 3G networks

### Bilingual AI Tutor
- **Amharic/English**: Full support for both languages
- **Voice & Text Input**: Speak or type your questions
- **Course Content Only**: Answers only from uploaded course materials with citations
- **RTL Support**: Proper right-to-left text handling for Ethiopic script

### Accessibility-First
- **Screen Reader Optimized**: NVDA, TalkBack, VoiceOver compatible
- **Keyboard Navigation**: Full keyboard-only operation
- **Visual + Audio Announcements**: New message alerts with sound and visual cues
- **200% Zoom Support**: Responsive layout that works at high zoom
- **Sound-Off Mode**: Visual-only feedback option

### Human Help Integration
- **One-Click Human Help**: Instantly connect to a human tutor
- **Learner-Controlled Screen Sharing**: User initiates and controls screen sharing
- **Context Preservation**: Human sees conversation history

### Flexible AI Backend
- **Pluggable AI Layer**: Switch between:
  - Cloud AI (e.g., OpenAI, Claude)
  - Local Open Model (e.g., LLaMA, Mistral)
  - Offline FAQ System (no internet required)

## Accessibility Requirements

This project is built accessibility-first and must pass:

- [x] NVDA screen reader compatibility
- [x] TalkBack screen reader compatibility
- [x] Keyboard-only navigation
- [x] 200% zoom without horizontal scroll
- [x] Sound-off usability (visual feedback for all audio)
- [x] Zero critical/serious axe-core issues
- [x] RTL text support for Amharic

## Tech Stack

- React with TypeScript
- Vite (build tool)
- PWA with service worker for offline
- Telegram Bot API
- SMS gateway integration
- axe-core for accessibility testing
- Pluggable AI adapters

## Getting Started

```bash
npm install
npm run dev
```

## Testing

```bash
npm run test:a11y
```

## License

MIT

## Hackathon Track

Track 3: Assistant & Help
