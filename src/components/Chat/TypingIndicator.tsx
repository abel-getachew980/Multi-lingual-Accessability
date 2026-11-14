'use client';

import { Language } from '@/types';
import { translations } from '@/i18n/translations';
import styles from './Chat.module.css';

/**
 * TypingIndicator - "Thinking" animation
 * 
 * Responsibilities:
 * - Animated dots
 * - Text for screen readers
 * - Only show when loading
 */

interface TypingIndicatorProps {
  isLoading: boolean;
  language: Language;
}

export function TypingIndicator({ isLoading, language }: TypingIndicatorProps) {
  const t = translations[language];

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={styles.typingIndicator}
    >
      {/* Animated dots */}
      <span className={styles.typingDots} aria-hidden="true">
        <span className={styles.dot}>•</span>
        <span className={styles.dot}>•</span>
        <span className={styles.dot}>•</span>
      </span>

      {/* Screen reader text */}
      <span className="sr-only">
        {language === 'am' ? 'አስባለው...' : 'Thinking...'}
      </span>

      {/* Visible text */}
      <span className={styles.typingText}>
        {language === 'am' ? 'አስባለው...' : 'Thinking...'}
      </span>
    </div>
  );
}
