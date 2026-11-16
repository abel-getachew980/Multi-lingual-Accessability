'use client';

import type { Language } from '@/types';
import { translations } from '@/i18n/translations';
import styles from './Settings.module.css';

interface SettingsButtonProps {
  language: Language;
  isOpen: boolean;
  onClick: () => void;
}

export function SettingsButton({ language, isOpen, onClick }: SettingsButtonProps) {
  const t = translations[language];

  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.settingsButton}
      aria-label={t.settings}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls="settings-panel"
    >
      <span aria-hidden="true">⚙️</span>{' '}
      <span className={styles.settingsButtonLabel}>{t.settings}</span>
    </button>
  );
}
