'use client';

import type { Language, UserPreferences } from '@/types';
import { translations } from '@/i18n/translations';
import styles from './Settings.module.css';

type FontSize = UserPreferences['fontSize'];

interface FontSizeAdjusterProps {
  value: FontSize;
  language: Language;
  onChange: (fontSize: FontSize) => void;
}

const OPTIONS: FontSize[] = ['normal', 'large', 'xlarge'];

/**
 * Font size is stored as a token (`normal`/`large`/`xlarge`) rather than a
 * pixel value, so the same choice maps to `--font-size-*` on `<html>` and
 * respects the browser's own text scaling.
 */
export function FontSizeAdjuster({ value, language, onChange }: FontSizeAdjusterProps) {
  const t = translations[language];

  const labels: Record<FontSize, string> = {
    normal: t.fontSizeNormal,
    large: t.fontSizeLarge,
    xlarge: t.fontSizeXLarge,
  };

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t.fontSize}</legend>

      <div className={styles.inlineOptions}>
        {OPTIONS.map((option) => (
          <label
            key={option}
            className={`${styles.option} ${value === option ? styles.optionSelected : ''}`}
          >
            <input
              type="radio"
              name="settings-font-size"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className={styles.radio}
            />
            <span className={styles.optionLabel}>{labels[option]}</span>
          </label>
        ))}
      </div>

      <p
        className={`${styles.fontPreview} ${styles[`preview_${value}`]}`}
        aria-hidden="true"
      >
        Aa · ሰላም · ትምህርት
      </p>
    </fieldset>
  );
}
