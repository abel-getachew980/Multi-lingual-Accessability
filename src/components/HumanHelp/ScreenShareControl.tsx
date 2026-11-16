'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from '@/types';
import {
  ScreenShareError,
  ScreenShareHandler,
  type DisplayMediaDevices,
} from '@/services/webrtc';
import { announceToScreenReader } from '@/utils/accessibility';
import { helpStrings } from './strings';
import styles from './HumanHelp.module.css';

interface ScreenShareControlProps {
  language: Language;
  /** Mirrors the shared context state so the button never lies. */
  active: boolean;
  onActiveChange: (active: boolean) => void;
  /** Injectable for tests; defaults to `navigator.mediaDevices`. */
  mediaDevices?: DisplayMediaDevices | null;
}

/**
 * Starts and stops screen sharing.
 *
 * The stream never leaves the browser unless the learner accepts the browser's
 * own picker. When the picker is dismissed, or the learner stops sharing from
 * the browser toolbar, the control resets and announces the change.
 */
export function ScreenShareControl({
  language,
  active,
  onActiveChange,
  mediaDevices,
}: ScreenShareControlProps) {
  const s = helpStrings[language];
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handlerRef = useRef<ScreenShareHandler | null>(null);

  useEffect(() => {
    setSupported(ScreenShareHandler.isSupported(mediaDevices));
  }, [mediaDevices]);

  // Stop the stream when the parent ends the session (cancel, resolve, unmount).
  useEffect(() => {
    if (active) return;

    handlerRef.current?.stop();
    handlerRef.current = null;
  }, [active]);

  useEffect(() => {
    return () => {
      handlerRef.current?.stop();
      handlerRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);

    const handler = new ScreenShareHandler({
      mediaDevices,
      onEnded: () => {
        handlerRef.current = null;
        onActiveChange(false);
        announceToScreenReader(
          language === 'am' ? 'የመስኮት ማጋራት ቆሟል' : 'Screen sharing stopped',
          'polite',
        );
      },
    });

    handlerRef.current = handler;

    try {
      await handler.start();
      onActiveChange(true);
      announceToScreenReader(
        language === 'am' ? 'የመስኮት ማጋራት ተጀምሯል' : 'Screen sharing started',
        'polite',
      );
    } catch (caught) {
      handlerRef.current?.stop();
      handlerRef.current = null;

      if (caught instanceof ScreenShareError) {
        if (caught.code === 'unsupported') {
          setSupported(false);
          setError(s.shareUnsupported);
        } else if (caught.code === 'permission-denied') {
          setError(s.sharePermissionDenied);
        } else if (caught.code === 'cancelled') {
          setError(s.shareCancelled);
        } else {
          setError(s.shareFailed);
        }
      } else {
        setError(s.shareFailed);
      }
    } finally {
      setBusy(false);
    }
  }, [language, mediaDevices, onActiveChange, s]);

  const stop = useCallback(() => {
    handlerRef.current?.stop();
    handlerRef.current = null;
    onActiveChange(false);
    announceToScreenReader(
      language === 'am' ? 'የመስኮት ማጋራት ቆሟል' : 'Screen sharing stopped',
      'polite',
    );
  }, [language, onActiveChange]);

  if (!supported) {
    return (
      <p className={styles.note} role="note">
        {s.shareUnsupported}
      </p>
    );
  }

  return (
    <section className={styles.screenShare} aria-labelledby="screen-share-title">
      <h3 id="screen-share-title" className={styles.sectionTitle}>
        {s.screenShareTitle}
      </h3>
      <p className={styles.note}>{active ? s.sharingNow : s.screenShareBody}</p>

      <button
        type="button"
        onClick={active ? stop : start}
        disabled={busy}
        aria-pressed={active}
        className={active ? styles.shareStopButton : styles.shareStartButton}
      >
        {busy ? s.starting : active ? s.stopSharing : s.startSharing}
      </button>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
