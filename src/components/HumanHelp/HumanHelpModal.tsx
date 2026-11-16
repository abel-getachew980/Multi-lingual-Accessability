'use client';

import { useEffect, useRef } from 'react';
import type { HumanHelpRequest, HumanHelpStatus, Language } from '@/types';
import { trapFocus } from '@/utils/accessibility';
import { ScreenShareControl } from './ScreenShareControl';
import { describeHelpRequest, helpStrings } from './strings';
import styles from './HumanHelp.module.css';

export interface HumanHelpModalProps {
  isOpen: boolean;
  request: HumanHelpRequest | null;
  language: Language;
  isRequesting: boolean;
  error: string | null;
  screenShareActive: boolean;
  onRequest: () => void;
  onCancel: () => void;
  onClose: () => void;
  onScreenShareChange: (active: boolean) => void;
}

const ACTIVE_STATUSES: HumanHelpStatus[] = ['pending', 'connected', 'in_progress'];

/**
 * Confirmation and status dialog for human help.
 *
 * Nothing is requested until the learner presses "Request help", and the
 * dialog only claims a tutor was contacted after the API confirms it.
 */
export function HumanHelpModal({
  isOpen,
  request,
  language,
  isRequesting,
  error,
  screenShareActive,
  onRequest,
  onCancel,
  onClose,
  onScreenShareChange,
}: HumanHelpModalProps) {
  const s = helpStrings[language];
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const releaseFocusTrap = panel ? trapFocus(panel) : undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    closeButtonRef.current?.focus();

    return () => {
      releaseFocusTrap?.();
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const canCancel = request !== null && ACTIVE_STATUSES.includes(request.status);
  const canShareScreen =
    request !== null && (request.status === 'connected' || request.status === 'in_progress');

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        id="human-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="human-help-title"
        aria-describedby="human-help-description"
        className={styles.panel}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className={styles.header}>
          <h2 id="human-help-title" className={styles.title}>
            {request ? s.statusTitle : s.dialogTitle}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label={s.close}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {!request ? (
          <div className={styles.content}>
            <h3 className={styles.sectionTitle}>{s.confirmTitle}</h3>
            <p id="human-help-description">{s.confirmBody}</p>
            <p className={styles.note}>{s.privacyNote}</p>

            <div className={styles.actions}>
              <button
                type="button"
                onClick={onRequest}
                disabled={isRequesting}
                aria-busy={isRequesting}
                className={styles.primaryButton}
              >
                {isRequesting ? s.requesting : s.request}
              </button>
              <button type="button" onClick={onClose} className={styles.secondaryButton}>
                {s.close}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.content}>
            <p id="human-help-description" className={styles.statusText}>
              {describeHelpRequest(request, language)}
            </p>

            {request.assignedTutor && (
              <p className={styles.note}>
                {language === 'am' ? 'አማካሪ' : 'Tutor'}: {request.assignedTutor}
              </p>
            )}

            {request.status === 'resolved' && (
              <p className={styles.note}>{s.resolvedHint}</p>
            )}

            {canShareScreen && (
              <ScreenShareControl
                language={language}
                active={screenShareActive}
                onActiveChange={onScreenShareChange}
              />
            )}

            {request.status === 'pending' && (
              <p className={styles.note}>
                {language === 'am'
                  ? 'አማካሪ ሲቀላቀል መስኮትዎን ማጋራት ይችላሉ።'
                  : 'You can share your screen once a tutor joins.'}
              </p>
            )}

            <div className={styles.actions}>
              {canCancel && (
                <button type="button" onClick={onCancel} className={styles.secondaryButton}>
                  {s.cancelRequest}
                </button>
              )}
              <button type="button" onClick={onClose} className={styles.primaryButton}>
                {s.close}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
