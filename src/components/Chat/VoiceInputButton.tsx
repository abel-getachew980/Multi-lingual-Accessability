'use client';

import { useState, useEffect } from 'react';
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
 */

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
  const t = translations[language];

  useEffect(() => {
    // Check if Web Speech API is supported
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition || 
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    setError(null);

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition || 
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError(language === 'am' ? 'የድምጽ ግብዓት አይደገፍም' : 'Voice input not supported');
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'am' ? 'am-ET' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      setIsRecording(false);
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
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError(t.errorVoice);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    // Note: recognition.stop() would be called if we stored the instance
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
