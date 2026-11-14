'use client';

import { Message, Language, Citation } from '@/types';
import { CitationCard } from './CitationCard';
import { translations } from '@/i18n/translations';
import styles from './Chat.module.css';

/**
 * MessageBubble - Individual message component
 * 
 * Responsibilities:
 * - Display message content
 * - Show timestamp
 * - Show citation if present
 * - Mark offline messages
 * - Different styles for user/assistant/system
 */

interface MessageBubbleProps {
  message: Message;
  language: Language;
  onPlayVoice?: () => void;
  onCopy?: () => void;
}

export function MessageBubble({
  message,
  language,
  onPlayVoice,
  onCopy,
}: MessageBubbleProps) {
  const t = translations[language];
  
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return t.justNow;
    if (minutes < 60) return `${minutes} ${t.minutesAgo}`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours} ${t.hoursAgo}`;
  };

  const roleLabels = {
    user: language === 'am' ? 'እርስዎ' : 'You',
    assistant: language === 'am' ? 'AI ቱቶር' : 'AI Tutor',
    system: language === 'am' ? 'ስርዓት' : 'System',
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    onCopy?.();
  };

  return (
    <article
      className={`${styles.messageBubble} ${styles[message.role]}`}
      role="article"
      aria-label={`${roleLabels[message.role]} at ${formatTime(message.timestamp)}`}
    >
      {/* Role indicator */}
      <div className={styles.messageHeader}>
        <span className={styles.messageRole}>
          {roleLabels[message.role]}
        </span>
        
        <span className={styles.messageTime}>
          {formatTime(message.timestamp)}
        </span>
        
        {message.isOffline && (
          <span className={styles.offlineIndicator} title={t.offlineMode}>
            📴
          </span>
        )}
      </div>

      {/* Message content */}
      <div className={styles.messageContent}>
        {message.content}
      </div>

      {/* Citation */}
      {message.citation && (
        <CitationCard
          citation={message.citation}
          language={language}
        />
      )}

      {/* Voice play button */}
      {message.voiceUrl && (
        <button
          onClick={onPlayVoice}
          className={styles.playVoiceButton}
          aria-label={language === 'am' ? 'ድምጽ አጫውት' : 'Play voice'}
        >
          🔊 {language === 'am' ? 'ድምጽ አጫውት' : 'Play voice'}
        </button>
      )}

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={styles.copyButton}
        aria-label={language === 'am' ? 'ቅዳ' : 'Copy'}
      >
        📋
      </button>
    </article>
  );
}
