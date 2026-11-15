'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { useTutor } from '@/context/TutorContext';
import { trapFocus } from '@/utils/accessibility';
import { ScreenShareControl } from './ScreenShareControl';
import { humanHelpCopy } from './copy';
import styles from './HumanHelp.module.css';

export function HumanHelpModal() {
  const {
    humanHelpRequest,
    humanHelpModalOpen,
    closeHumanHelpModal,
    cancelHumanHelp,
    preferences,
  } = useTutor();
  const copy = humanHelpCopy[preferences.language];
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = humanHelpModalOpen;

  const close = useCallback(() => {
    closeHumanHelpModal();
  }, [closeHumanHelpModal]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    dialog?.focus();
    const releaseFocus = dialog ? trapFocus(dialog) : undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      releaseFocus?.();
    };
  }, [close, open]);

  if (!open) return null;

  const status = humanHelpRequest ? copy.status[humanHelpRequest.status] : copy.noActive;
  const canCancel = humanHelpRequest
    && humanHelpRequest.status !== 'resolved'
    && humanHelpRequest.status !== 'cancelled';
  const canShare = humanHelpRequest?.status === 'connected'
    || humanHelpRequest?.status === 'in_progress';

  const handleCancel = () => {
    cancelHumanHelp();
    close();
  };

  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <h2 id={titleId} className={styles.modalTitle}>{copy.dialogTitle}</h2>

        <div
          id={descriptionId}
          className={styles.statusBlock}
          aria-live="polite"
          aria-atomic="true"
        >
          <p className={styles.statusLine}>
            <span className={styles.statusLabel}>{copy.statusLabel}:</span>{' '}
            <span>{status}</span>
          </p>
          {humanHelpRequest?.status === 'pending' && humanHelpRequest.queuePosition && (
            <p className={styles.statusDetail}>
              {copy.queuePosition(humanHelpRequest.queuePosition)}
            </p>
          )}
          {humanHelpRequest?.status === 'pending' && humanHelpRequest.estimatedWait && (
            <p className={styles.statusDetail}>
              {copy.estimatedWait(humanHelpRequest.estimatedWait)}
            </p>
          )}
          {humanHelpRequest?.assignedTutor && (
            <p className={styles.statusDetail}>{copy.tutor(humanHelpRequest.assignedTutor)}</p>
          )}
        </div>

        {canShare && <ScreenShareControl />}

        <div className={styles.actions}>
          {canCancel && (
            <button type="button" className={styles.cancelButton} onClick={handleCancel}>
              {copy.cancelRequest}
            </button>
          )}
          <button type="button" className={styles.secondaryButton} onClick={close}>
            {copy.close}
          </button>
        </div>
      </div>
    </div>
  );
}
