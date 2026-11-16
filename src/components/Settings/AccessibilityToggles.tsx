'use client';

import type { Language, UserPreferences } from '@/types';
import { translations } from '@/i18n/translations';
import styles from './Settings.module.css';

type ToggleKey =
  | 'soundEnabled'
  | 'highContrast'
  | 'keyboardOnlyMode'
  | 'screenReaderOptimized'
  | 'autoPlayVoiceResponses'
  | 'reduceMotion';

interface AccessibilityTogglesProps {
  value: UserPreferences;
  language: Language;
  onChange: (update: Partial<Pick<UserPreferences, ToggleKey>>) => void;
}

interface ToggleDefinition {
  key: ToggleKey;
  label: string;
  description: string;
}

/**
 * Each option is a real checkbox: screen readers announce the label, the
 * checked state and the description, and Space toggles it.
 */
export function AccessibilityToggles({ value, language, onChange }: AccessibilityTogglesProps) {
  const t = translations[language];

  const toggles: ToggleDefinition[] = [
    {
      key: 'screenReaderOptimized',
      label: t.screenReaderMode,
      description:
        language === 'am'
          ? 'ለስክሪን አንባቢ የተሻሻሉ ማስታወቂያዎች።'
          : 'Clearer announcements and labels for screen readers.',
    },
    {
      key: 'keyboardOnlyMode',
      label: t.keyboardMode,
      description:
        language === 'am'
          ? 'ሁሉንም በቁልፍ ሰሌዳ ለመጠቀም የተሻሻለ የትኩረት ማያ።'
          : 'Stronger focus indicators and no mouse-only actions.',
    },
    {
      key: 'highContrast',
      label: t.highContrast,
      description:
        language === 'am'
          ? 'ጠንካራ ቀለሞች እና ድንበሮች።'
          : 'Stronger colours and borders for low vision.',
    },
    {
      key: 'soundEnabled',
      label: t.soundEnabled,
      description:
        language === 'am'
          ? 'አዲስ መልእክት ሲመጣ አጭር ድምጽ ይሰጣል።'
          : 'Play a short sound when a new answer arrives.',
    },
    {
      key: 'autoPlayVoiceResponses',
      label: t.autoPlayVoice,
      description:
        language === 'am'
          ? 'መልሶችን በድምጽ ያንብባል።'
          : 'Read answers aloud when the device supports it.',
    },
    {
      key: 'reduceMotion',
      label: t.reduceMotion,
      description:
        language === 'am'
          ? 'እንቅስቃሴን እና ሽግግሮችን ያጠፋል።'
          : 'Turn off animations and transitions.',
    },
  ];

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>
        {language === 'am' ? 'ተደራሽነት' : 'Accessibility'}
      </legend>

      <div className={styles.stackedOptions}>
        {toggles.map((toggle) => {
          const id = `settings-toggle-${toggle.key}`;
          const labelId = `${id}-label`;
          const descriptionId = `${id}-description`;

          return (
            <label key={toggle.key} className={`${styles.option} ${styles.optionStacked}`}>
              <input
                id={id}
                type="checkbox"
                checked={value[toggle.key]}
                onChange={(event) =>
                  onChange({ [toggle.key]: event.target.checked } as Partial<
                    Pick<UserPreferences, ToggleKey>
                  >)
                }
                className={styles.checkbox}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
              />
              <span className={styles.optionText}>
                <span id={labelId} className={styles.optionLabel}>
                  {toggle.label}
                </span>
                <span id={descriptionId} className={styles.optionDescription}>
                  {toggle.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
