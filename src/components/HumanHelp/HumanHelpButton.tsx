'use client';

import { useEffect, useRef, useState } from 'react';
import type { HumanHelpStatus } from '@/types';
import { useTutor } from '@/context/TutorContext';
import { HumanHelpModal } from './HumanHelpModal';
import { StatusNotifier } from './StatusNotifier';
import { helpStrings } from './strings';
import styles from './HumanHelp.module.css';

const ACTIVE_STATUSES: HumanHelpStatus[] = ['pending', 'connected', 'in_progress'];

/**
 * Header entry point for human help.
 *
 * Opening the dialog is not a request: the learner confirms first, and the
 * button only changes to "Help status" after the API accepted the ticket.
 */
export function HumanHelpButton() {
  const {
    humanHelpRequest,
    isRequestingHelp,
    humanHelpError,
    requestHumanHelp,
    cancelHumanHelp,
    clearHumanHelpError,
    screenShareActive,
    setScreenShareActive,
    preferences,
  } = useTutor();

  const [isOpen, setIsOpen] = useState(false);
  const wasActiveRef = useRef(false);
  const s = helpStrings[preferences.language];
  const isActive =
    humanHelpRequest !== null && ACTIVE_STATUSES.includes(humanHelpRequest.status);

  // When a request is cancelled (or expires), close the dialog. When it turns
  // from null to active, keep it open so the queue position is visible.
  useEffect(() => {
    if (humanHelpRequest) {
      wasActiveRef.current = true;
      return;
    }

    if (wasActiveRef.current) {
      wasActiveRef.current = false;
      setIsOpen(false);
    }
  }, [humanHelpRequest]);

  const open = () => {
    clearHumanHelpError();
    setIsOpen(true);
  };

  return (
    <>
      <StatusNotifier request={humanHelpRequest} language={preferences.language} />

      <button
        type="button"
        onClick={open}
        className={`${styles.helpButton} ${isActive ? styles.helpButtonActive : ''}`}
        aria-label={isActive ? s.activeButton : s.request}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="human-help-panel"
      >
        <span aria-hidden="true">{isActive ? '🟢' : '🙋'}</span>{' '}
        <span>{isActive ? s.activeButton : s.request}</span>
      </button>

      <HumanHelpModal
        isOpen={isOpen}
        request={humanHelpRequest}
        language={preferences.language}
        isRequesting={isRequestingHelp}
        error={humanHelpError}
        screenShareActive={screenShareActive}
        onRequest={() => {
          void requestHumanHelp();
        }}
        onCancel={() => {
          void cancelHumanHelp();
        }}
        onClose={() => setIsOpen(false)}
        onScreenShareChange={setScreenShareActive}
      />
    </>
  );
}
