'use client';

import type { Language } from '@/types';
import { translations } from '@/i18n/translations';
import styles from './Settings.module.css';

interface LanguageSelectorProps {
  value: Language;
  /** Language the labels are written in. */
  language: Language;
  onChange: (language: Language) => void;
}

const OPTIONS: Array<{ value: Language; label: string; lang: Language }> = [
  { value: 'am', label: 'አማርኛ', lang: 'am' },
  { value: 'en', label: 'English', lang: 'en' },
];

/**
 * Language choice as a native radio group: arrow keys, Tab and Enter all work
 * without any custom key handling.
 */
export function LanguageSelector({ value, language, onChange }: LanguageSelectorProps) {
  const t = translations[language];

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t.language}</legend>

      <div className={styles.inlineOptions}>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`${styles.option} ${value === option.value ? styles.optionSelected : ''}`}
          >
            <input
              type="radio"
              name="settings-language"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className={styles.radio}
            />
            <span lang={option.lang} className={styles.optionLabel}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
