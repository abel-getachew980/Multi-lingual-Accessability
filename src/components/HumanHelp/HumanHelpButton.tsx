'use client';

import { useTutor } from '@/context/TutorContext';
import { humanHelpCopy } from './copy';
import styles from './HumanHelp.module.css';

export function HumanHelpButton() {
  const {
    requestHumanHelp,
    humanHelpRequest,
    openHumanHelpModal,
    preferences,
  } = useTutor();
  const copy = humanHelpCopy[preferences.language];

  const handleClick = () => {
    if (humanHelpRequest) {
      openHumanHelpModal();
      return;
    }

    const confirmed = typeof window === 'undefined' || window.confirm(copy.confirm);
    if (confirmed) requestHumanHelp();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={styles.helpButton}
      aria-label={humanHelpRequest ? copy.viewRequest : copy.request}
      aria-pressed={!!humanHelpRequest}
    >
      {humanHelpRequest ? `💬 ${copy.viewRequest}` : `🙋 ${copy.request}`}
    </button>
  );
}
