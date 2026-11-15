'use client';

import { useTutor } from '@/context/TutorContext';
import { humanHelpCopy } from './copy';
import styles from './HumanHelp.module.css';

export function StatusNotifier() {
  const { humanHelpRequest, humanHelpModalOpen, preferences } = useTutor();

  if (!humanHelpRequest) return null;

  const copy = humanHelpCopy[preferences.language];
  const status = copy.status[humanHelpRequest.status];
  const queue = humanHelpRequest.status === 'pending' && humanHelpRequest.queuePosition
    ? ` · ${copy.queuePosition(humanHelpRequest.queuePosition)}`
    : '';

  return (
    <span
      className={styles.statusBadge}
      role="status"
      aria-live={humanHelpModalOpen ? 'off' : 'polite'}
    >
      {preferences.language === 'am' ? 'እርዳታ' : 'Help'}: {status}{queue}
    </span>
  );
}
