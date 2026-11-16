'use client';

import { useTutor } from '@/context/TutorContext';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { HumanHelpButton } from '@/components/HumanHelp/HumanHelpButton';
import { SettingsDialog } from '@/components/Settings';
import styles from './Chat.module.css';

/**
 * ChatContainer - Main wrapper for the chat interface
 * 
 * Responsibilities:
 * - Wrap all chat components
 * - Manage scroll position
 * - Handle keyboard shortcuts
 * - Connect to TutorContext
 * - RTL support for Amharic
 */

interface ChatContainerProps {
  className?: string;
}

export function ChatContainer({ className }: ChatContainerProps) {
  const {
    messages,
    isLoading,
    sendMessage,
    preferences,
    humanHelpRequest,
    isOffline,
  } = useTutor();

  const handleSend = async (content: string) => {
    if (!content.trim()) return;
    await sendMessage(content);
  };

  const isRTL = preferences.language === 'am';
  const isHelpActive =
    humanHelpRequest !== null &&
    ['pending', 'connected', 'in_progress'].includes(humanHelpRequest.status);

  return (
    <main
      id="main-content"
      className={`${styles.chatContainer} ${className || ''}`}
      aria-label="Chat conversation"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header className={styles.chatHeader}>
        <h1>AI Tutor - የአማርኛ ቱቶር</h1>
        
        {/* Status indicators */}
        <div className={styles.statusIndicators}>
          {isOffline && (
            <span className={styles.offlineBadge} role="status">
              {preferences.language === 'am' ? 'ከኢንተርኔት ውጭ' : 'Offline'}
            </span>
          )}
          
          {isHelpActive && (
            <span className={styles.helpActiveBadge} role="status">
              {preferences.language === 'am' ? 'እርዳታ ንቁ' : 'Help Active'}
            </span>
          )}
        </div>
        
        {/* Human help button */}
        <HumanHelpButton />

        {/* Settings dialog and its trigger */}
        <SettingsDialog />
      </header>

      {/* Message list */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        language={preferences.language}
      />

      {/* Typing indicator */}
      <TypingIndicator
        isLoading={isLoading}
        language={preferences.language}
      />

      {/* Input area */}
      <MessageInput
        onSend={handleSend}
        disabled={isLoading}
        language={preferences.language}
      />
    </main>
  );
}
