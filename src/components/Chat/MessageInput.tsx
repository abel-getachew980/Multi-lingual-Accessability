'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Language } from '@/types';
import { VoiceInputButton } from './VoiceInputButton';
import { translations } from '@/i18n/translations';
import styles from './Chat.module.css';

/**
 * MessageInput - Text input with send button
 * 
 * Responsibilities:
 * - Textarea that expands as user types
 * - Send button (disabled when empty or loading)
 * - Clear button
 * - Keyboard: Enter to send, Shift+Enter for new line
 * - Voice input button
 */

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  language: Language;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  language,
  placeholder,
}: MessageInputProps) {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = translations[language];

  const defaultPlaceholder = language === 'am'
    ? 'መልእክትዎን ይጻፉ...'
    : 'Type your message...';

  // Auto-resize textarea
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  const handleInput = () => {
    adjustHeight();
  };

  const handleSend = () => {
    if (!inputText.trim() || disabled) return;
    
    onSend(inputText.trim());
    setInputText('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setInputText(text);
    adjustHeight();
    textareaRef.current?.focus();
  };

  return (
    <div className={styles.messageInputContainer}>
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          disabled={disabled}
          className={styles.messageTextarea}
          aria-label={language === 'am' ? 'መልእክትዎን ይጻፉ' : 'Type your message'}
          rows={1}
          maxLength={2000}
        />

        {/* Character counter (show if > 500) */}
        {inputText.length > 500 && (
          <span className={styles.characterCounter} aria-live="polite">
            {inputText.length} / 2000
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className={styles.inputActions}>
        {/* Clear button */}
        {inputText && (
          <button
            onClick={handleClear}
            className={styles.clearButton}
            aria-label={language === 'am' ? 'አጽዳ' : 'Clear'}
            type="button"
          >
            ✕
          </button>
        )}

        {/* Voice input */}
        <VoiceInputButton
          onTranscript={handleVoiceTranscript}
          language={language}
          disabled={disabled}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !inputText.trim()}
          className={styles.sendButton}
          aria-label={language === 'am' ? 'ላክ' : 'Send'}
          type="button"
        >
          {language === 'am' ? 'ላክ' : 'Send'}
        </button>
      </div>
    </div>
  );
}
