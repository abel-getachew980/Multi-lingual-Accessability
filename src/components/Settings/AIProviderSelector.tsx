'use client';

import type { AIProvider, Language } from '@/types';
import { translations } from '@/i18n/translations';
import styles from './Settings.module.css';

interface AIProviderSelectorProps {
  value: AIProvider;
  language: Language;
  onChange: (provider: AIProvider) => void;
}

const OPTIONS: AIProvider[] = ['cloud', 'local', 'offline'];

export function AIProviderSelector({ value, language, onChange }: AIProviderSelectorProps) {
  const t = translations[language];

  const labels: Record<AIProvider, string> = {
    cloud: t.cloudAI,
    local: t.localAI,
    offline: t.offlineAI,
  };

  const descriptions: Record<AIProvider, string> = {
    cloud:
      language === 'am'
        ? 'ከመስመር ላይ ያለ አገልግሎት - አዲስ መልእክት ይሰጣል።'
        : 'Online service with the most complete answers.',
    local:
      language === 'am'
        ? 'በዚህ መሣሪያ ላይ የሚሠራ - ኢንተርኔት ባይኖርም ይሞክራል።'
        : 'Runs on this device and still tries when the network is slow.',
    offline:
      language === 'am'
        ? 'ከኢንተርኔት ውጭ - ከተቀመጡ ትምህርቶች ይመልሳል።'
        : 'Works without internet using the materials saved on this device.',
  };

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t.aiProvider}</legend>

      <div className={styles.stackedOptions}>
        {OPTIONS.map((option) => {
          const labelId = `settings-ai-${option}-label`;
          const descriptionId = `settings-ai-${option}-description`;

          return (
            <label
              key={option}
              className={`${styles.option} ${styles.optionStacked} ${
                value === option ? styles.optionSelected : ''
              }`}
            >
              <input
                type="radio"
                name="settings-ai-provider"
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className={styles.radio}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
              />
              <span className={styles.optionText}>
                <span id={labelId} className={styles.optionLabel}>
                  {labels[option]}
                </span>
                <span id={descriptionId} className={styles.optionDescription}>
                  {descriptions[option]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
