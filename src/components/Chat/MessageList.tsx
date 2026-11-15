'use client';

import { useEffect, useRef } from 'react';
import { Message, Language } from '@/types';
import { MessageBubble } from './MessageBubble';
import { translations } from '@/i18n/translations';
import styles from './Chat.module.css';

/**
 * MessageList - Scrollable list of messages
 * 
 * Responsibilities:
 * - Display all messages
 * - Auto-scroll to bottom on new message
 * - Handle RTL for Amharic
 * - Empty state
 */

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  language: Language;
}

export function MessageList({ messages, isLoading, language }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const t = translations[language];

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div
        className={styles.messageListEmpty}
        role="log"
        aria-label="Conversation history"
      >
        <p>
          {language === 'am'
            ? 'ጥያቄዎን ይጻፉ ለመጀመር...'
            : 'Type your question to get started...'}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={styles.messageList}
      role="log"
      aria-label="Conversation history"
      aria-live="polite"
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          language={language}
        />
      ))}
    </div>
  );
}
