'use client';

import { useEffect, useRef, useState } from 'react';
import { Language } from '@/types';
import { translations } from '@/i18n/translations';
import styles from './Chat.module.css';

/**
 * VoiceInputButton - Speech-to-text button
 *
 * Responsibilities:
 * - Use Web Speech API
 * - Show recording state
 * - Handle permission denied
 * - Support Amharic and English
 *
 * The Web Speech API is still not part of the TypeScript DOM lib, so the
 * minimum shape we use is declared here instead of casting `window` to `any`.
 */

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;

  const speechWindow = window as unknown as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  language: Language;
  disabled?: boolean;
}

export function VoiceInputButton({
  onTranscript,
  language,
  disabled = false,
}: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const t = translations[language];

  useEffect(() => {
    if (!getSpeechRecognition()) {
      setIsSupported(false);
    }

    return () => {
      // Stop a recording that is still running when the component unmounts.
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  };

  const startRecording = () => {
    setError(null);

    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setError(language === 'am' ? 'የድምጽ ግብዓት አይደገፍም' : 'Voice input not supported');
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = language === 'am' ? 'am-ET' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);

      if (event.error === 'not-allowed') {
        setError(
          language === 'am'
            ? 'የማይክሮፎን ፈቃድ ተከልክሏል'
            : 'Microphone permission denied'
        );
      } else {
        setError(
          language === 'am'
            ? 'የድምጽ ግብዓት አልተሳካም'
            : 'Voice input failed'
        );
      }

      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError(t.errorVoice);
      setIsRecording(false);
      recognitionRef.current = null;
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  return (
    <div className={styles.voiceInputWrapper}>
      <button
        onClick={handleToggleRecording}
        disabled={disabled}
        className={`${styles.voiceInputButton} ${isRecording ? styles.recording : ''}`}
        aria-label={
          isRecording
            ? (language === 'am' ? 'ማቆም' : 'Stop recording')
            : (language === 'am' ? 'የድምጽ ግብዓት' : 'Voice input')
        }
        aria-pressed={isRecording}
        type="button"
      >
        {isRecording ? '⏹️' : '🎤'}
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <span
          className={styles.recordingIndicator}
          role="status"
          aria-live="polite"
        >
          {language === 'am' ? 'በመቅረዝ ላይ...' : 'Recording...'}
        </span>
      )}

      {/* Error message */}
      {error && (
        <span
          className={styles.voiceError}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
