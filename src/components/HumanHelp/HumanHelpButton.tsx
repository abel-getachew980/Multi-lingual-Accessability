'use client';

import { useTutor } from '@/context/TutorContext';
import styles from './HumanHelp.module.css';

/**
 * HumanHelpButton - One-click help button
 * 
 * PLACEHOLDER - Teammate 5 will implement the full version
 * 
 * Responsibilities:
 * - One-click request for human help
 * - Show confirmation dialog
 * - Connect to TutorContext
 */

export function HumanHelpButton() {
  const { requestHumanHelp, humanHelpRequest, cancelHumanHelp } = useTutor();

  const handleClick = () => {
    if (humanHelpRequest) {
      cancelHumanHelp();
    } else {
      requestHumanHelp();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={styles.helpButton}
      aria-label={
        humanHelpRequest
          ? 'Cancel human help request'
          : 'Request human help - የሰው እርዳታ ጠይቅ'
      }
      aria-pressed={!!humanHelpRequest}
    >
      {humanHelpRequest ? '❌ Cancel Help' : '🙋 Request Help'}
    </button>
  );
}
