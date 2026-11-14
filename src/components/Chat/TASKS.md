# Teammate 1 - Chat UI Components

## Overview
Build the complete chat interface for the AI Tutor. This is the main user-facing component that learners will interact with.

## Branch
```bash
git checkout -b feature/chat-ui
```

## Files to Create

### 1. `ChatContainer.tsx` - Main wrapper component
**Priority: HIGH**

```typescript
// TODO: Create ChatContainer.tsx
```

**Requirements:**
- Wrap all chat components (MessageList, MessageInput, etc.)
- Manage scroll position (auto-scroll to bottom on new message)
- Handle keyboard shortcuts:
  - `Enter` to send message
  - `Escape` to cancel/clear input
- Connect to `TutorContext` for state
- RTL support for Amharic (dir="rtl" when language="am")
- Loading state overlay

**Props:**
```typescript
interface ChatContainerProps {
  className?: string;
}
```

**Context Usage:**
```typescript
const {
  messages,
  isLoading,
  sendMessage,
  preferences,
  humanHelpRequest,
} = useTutor();
```

**Accessibility:**
- Role: `region`
- ARIA label: "Chat conversation"
- Focus management after send

---

### 2. `MessageList.tsx` - Scrollable message display
**Priority: HIGH**

```typescript
// TODO: Create MessageList.tsx
```

**Requirements:**
- Display all messages in scrollable container
- Auto-scroll to bottom when new message arrives
- Handle RTL for Amharic messages
- Empty state when no messages
- Maximum height with overflow scroll

**Props:**
```typescript
interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  language: Language;
}
```

**Accessibility:**
- Role: `log`
- ARIA live: `polite`
- Announce "X new messages" to screen readers
- Label: "Conversation history"

**Styling:**
```css
.message-list {
  max-height: 60vh;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.message-list[dir="rtl"] {
  /* RTL adjustments */
}
```

---

### 3. `MessageBubble.tsx` - Individual message component
**Priority: HIGH**

```typescript
// TODO: Create MessageBubble.tsx
```

**Requirements:**
- Different styles for user vs assistant vs system messages
- Display timestamp (relative time: "2 minutes ago")
- Show citation if present (expandable)
- Play voice button if voiceUrl exists
- Mark offline messages differently
- Copy message to clipboard button

**Props:**
```typescript
interface MessageBubbleProps {
  message: Message;
  onPlayVoice?: () => void;
  onCopy?: () => void;
}
```

**Accessibility:**
- Role: `article`
- ARIA label: "Message from [user/assistant] at [time]"
- For citations: `aria-details` pointing to citation element

**Styles:**
```css
.message-bubble {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: 8px;
}

.message-bubble.user {
  background: var(--color-primary);
  color: white;
  margin-left: 20%;
}

.message-bubble.assistant {
  background: var(--color-surface);
  margin-right: 20%;
}

.message-bubble[dir="rtl"].user {
  margin-left: 0;
  margin-right: 20%;
}
```

---

### 4. `MessageInput.tsx` - Text input with send button
**Priority: HIGH**

```typescript
// TODO: Create MessageInput.tsx
```

**Requirements:**
- Textarea that expands as user types (max 4 rows)
- Character counter (optional, show if > 500 chars)
- Send button (disabled when empty or loading)
- Clear button (X) to reset input
- Placeholder text in Amharic/English based on language
- Focus on mount
- Keyboard: Enter to send, Shift+Enter for new line

**Props:**
```typescript
interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  language: Language;
}
```

**Accessibility:**
- Label: "Type your message - መልእክትዎን ይጻፉ"
- Describe keyboard shortcut in label
- Focus outline clearly visible
- Aria-invalid if validation fails

**Example:**
```tsx
<div className="message-input-container">
  <textarea
    id="message-input"
    aria-label="Type your message"
    placeholder={language === 'am' ? 'መልእክትዎን ይጻፉ...' : 'Type your message...'}
    onKeyDown={handleKeyDown}
    rows={1}
  />
  <button
    onClick={handleSend}
    disabled={disabled || !inputText.trim()}
    aria-label="Send message"
  >
    Send
  </button>
</div>
```

---

### 5. `VoiceInputButton.tsx` - Speech-to-text button
**Priority: MEDIUM**

```typescript
// TODO: Create VoiceInputButton.tsx
```

**Requirements:**
- Use Web Speech API (`window.SpeechRecognition` or `webkitSpeechRecognition`)
- Show recording state visually (pulsing red dot)
- Transcribe speech to text
- Call onTranscript callback with text
- Handle permission denied gracefully
- Support both Amharic and English
- Fallback message if not supported

**Props:**
```typescript
interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  language: Language;
  disabled?: boolean;
}
```

**Accessibility:**
- Button label: "Voice input - Press to start recording"
- When recording: "Recording... Press to stop"
- Announce recording state change
- Announce transcription result

**Implementation:**
```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  // Not supported - show message or hide button
  return null;
}

const recognition = new SpeechRecognition();
recognition.lang = language === 'am' ? 'am-ET' : 'en-US';
recognition.continuous = false;
recognition.interimResults = false;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  onTranscript(transcript);
};
```

---

### 6. `TypingIndicator.tsx` - "Thinking" animation
**Priority: MEDIUM**

```typescript
// TODO: Create TypingIndicator.tsx
```

**Requirements:**
- Animated dots (bouncing)
- Text: "Thinking..." / "አስባለው..."
- Only show when isLoading is true

**Props:**
```typescript
interface TypingIndicatorProps {
  isLoading: boolean;
  language: Language;
}
```

**Accessibility:**
- Role: `status`
- Aria-live: `polite`
- Text for screen readers (not just animation)

**Example:**
```tsx
{isLoading && (
  <div role="status" aria-live="polite" className="typing-indicator">
    <span className="dots">
      <span>.</span><span>.</span><span>.</span>
    </span>
    <span className="sr-only">
      {language === 'am' ? 'አስባለው...' : 'Thinking...'}
    </span>
  </div>
)}
```

---

### 7. `CitationCard.tsx` - Source citation display
**Priority: LOW**

```typescript
// TODO: Create CitationCard.tsx
```

**Requirements:**
- Display source name, page, section
- Expandable/collapsible
- Link to original document (if url exists)
- Copy citation button

**Props:**
```typescript
interface CitationCardProps {
  citation: Citation;
  language: Language;
}
```

**Accessibility:**
- Role: `contentinfo`
- Aria-label: "Source citation"
- Collapsible: Use `aria-expanded`

---

### 8. `Chat.module.css` - Styles
**Priority: HIGH**

**Requirements:**
- Mobile-first responsive design
- Support 200% zoom (no horizontal scroll)
- RTL support for Amharic
- High contrast mode support
- Focus visible styles
- Reduced motion support

---

## API Routes to Use

### POST /api/ai/query
**Used by:** ChatContainer → sendMessage()

```typescript
// Already handled in TutorContext, but here's the endpoint:
const response = await fetch('/api/ai/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: content,
    language: preferences.language,
    provider: preferences.preferredAIProvider,
  }),
});

// Response:
{
  answer: string,
  citation?: Citation,
  provider: string
}
```

---

## Dependencies to Import

```typescript
// Types
import { Message, Language, Citation } from '@/types';

// Context
import { useTutor } from '@/context/TutorContext';

// Utils
import { announceToScreenReader } from '@/utils/accessibility';

// Translations
import { translations } from '@/i18n/translations';
```

---

## Testing Checklist

Before creating PR, verify:

- [ ] All components render without errors
- [ ] Messages display correctly (user, assistant, system)
- [ ] Can send message with Enter key
- [ ] Can send message with button click
- [ ] Auto-scrolls to bottom on new message
- [ ] RTL works for Amharic
- [ ] Screen reader announces new messages
- [ ] Focus management works (focus returns to input after send)
- [ ] Loading state shows typing indicator
- [ ] Voice input works (if supported)
- [ ] Citation displays correctly
- [ ] No horizontal scroll at 200% zoom
- [ ] Works with keyboard only (Tab, Enter, Escape)
- [ ] Passes axe-core audit (npm run test:a11y)

---

## Implementation Order

1. **Start with:** ChatContainer.tsx (basic structure)
2. **Then:** MessageInput.tsx (can send messages)
3. **Then:** MessageList.tsx (display messages)
4. **Then:** MessageBubble.tsx (individual messages)
5. **Then:** TypingIndicator.tsx (loading state)
6. **Then:** VoiceInputButton.tsx (optional, speech input)
7. **Finally:** CitationCard.tsx (optional, citations)

---

## Example Integration

```tsx
// In src/app/page.tsx, replace the placeholder with:

import { ChatContainer } from '@/components/Chat';

export default function Home() {
  return (
    <TutorProvider>
      <main id="main-content">
        <ChatContainer />
      </main>
    </TutorProvider>
  );
}
```

---

## Need Help?

- Check `src/types/index.ts` for all type definitions
- Check `src/context/TutorContext.tsx` for available state/actions
- Check `src/utils/accessibility.ts` for a11y utilities
- Check `src/i18n/translations.ts` for text in Amharic/English

---

## Commit Message Format

```
feat(chat): implement MessageInput component

- Add textarea with auto-expand
- Add send button with keyboard support
- Add RTL support for Amharic
- Add accessibility labels and focus management

Refs: #1
```
