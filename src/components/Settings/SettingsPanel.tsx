'use client';

import { useEffect, useRef } from 'react';
import type { Language, SettingsUpdate, UserPreferences } from '@/types';
import { translations } from '@/i18n/translations';
import { announceToScreenReader, trapFocus } from '@/utils/accessibility';
import { LanguageSelector } from './LanguageSelector';
import { FontSizeAdjuster } from './FontSizeAdjuster';
import { AIProviderSelector } from './AIProviderSelector';
import { AccessibilityToggles } from './AccessibilityToggles';
import styles from './Settings.module.css';

export interface SettingsPanelProps {
  isOpen: boolean;
  preferences: UserPreferences;
  onChange: (update: SettingsUpdate) => void;
  onClose: () => void;
  /** Optional: restoring the defaults is offered only when a handler exists. */
  onReset?: () => void;
}

function describeChange(update: SettingsUpdate, language: Language): string {
  const t = translations[language];

  if (update.language) {
    return language === 'am' ? 'ቋንቋ ተቀይሯል' : 'Language changed';
  }

  if (update.fontSize) {
    const labels: Record<UserPreferences['fontSize'], string> = {
      normal: t.fontSizeNormal,
      large: t.fontSizeLarge,
      xlarge: t.fontSizeXLarge,
    };
    return `${t.fontSize}: ${labels[update.fontSize]}`;
  }

  if (update.preferredAIProvider) {
    const labels: Record<UserPreferences['preferredAIProvider'], string> = {
      cloud: t.cloudAI,
      local: t.localAI,
      offline: t.offlineAI,
    };
    return `${t.aiProvider}: ${labels[update.preferredAIProvider]}`;
  }

  return t.settingsChanged;
}

/**
 * Settings dialog.
 *
 * Presentational on purpose: `SettingsDialog` owns the connection to the
 * tutor context, which keeps this component trivially testable and lets the
 * same panel be reused for onboarding later.
 */
export function SettingsPanel({
  isOpen,
  preferences,
  onChange,
  onClose,
  onReset,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const language = preferences.language;
  const t = translations[language];

  // Trap focus, lock background scrolling and give focus back to the trigger
  // when the dialog closes.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const releaseFocusTrap = panel ? trapFocus(panel) : undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the close button once the panel is in the DOM. Doing it here (and
    // not with `autoFocus`) keeps `previouslyFocused` pointing at the trigger.
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

  const emitChange = (update: SettingsUpdate) => {
    onChange(update);
    announceToScreenReader(describeChange(update, language), 'polite');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        // Only a click on the backdrop itself closes the dialog; clicks that
        // start inside the panel are left alone.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        id="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby="settings-description"
        className={styles.panel}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <h2 id="settings-title" className={styles.title}>
            {t.settings}
          </h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className={styles.closeButton}
            aria-label={t.closeSettings}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <p id="settings-description" className={styles.description}>
          {t.settingsDescription}
        </p>

        <div className={styles.body}>
          <LanguageSelector
            value={preferences.language}
            language={language}
            onChange={(next) => emitChange({ language: next })}
          />

          <FontSizeAdjuster
            value={preferences.fontSize}
            language={language}
            onChange={(fontSize) => emitChange({ fontSize })}
          />

          <AIProviderSelector
            value={preferences.preferredAIProvider}
            language={language}
            onChange={(preferredAIProvider) => emitChange({ preferredAIProvider })}
          />

          <AccessibilityToggles
            value={preferences}
            language={language}
            onChange={emitChange}
          />
        </div>

        <footer className={styles.footer}>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className={styles.secondaryButton}
            >
              {t.resetSettings}
            </button>
          )}
          <button type="button" onClick={onClose} className={styles.primaryButton}>
            {t.done}
          </button>
        </footer>
      </div>
    </div>
  );
}
