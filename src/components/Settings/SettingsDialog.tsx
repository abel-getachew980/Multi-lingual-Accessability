'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SettingsUpdate } from '@/types';
import { useTutor } from '@/context/TutorContext';
import { DEFAULT_PREFERENCES } from '@/services/storage';
import { announceToScreenReader } from '@/utils/accessibility';
import { applyPreferences } from './applyPreferences';
import { SettingsButton } from './SettingsButton';
import { SettingsPanel } from './SettingsPanel';

/**
 * Connected settings surface: the header button plus the dialog.
 *
 * Keeping the trigger and the dialog together means the focus trap can always
 * return focus to the right control, even though the panel itself unmounts.
 */
export function SettingsDialog() {
  const { preferences, updatePreferences } = useTutor();
  const [isOpen, setIsOpen] = useState(false);

  // Preferences are the single source of truth for the presentation hooks on
  // <html>, so the whole page follows a change immediately.
  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  const handleChange = useCallback(
    (update: SettingsUpdate) => {
      updatePreferences(update);
    },
    [updatePreferences],
  );

  const handleReset = useCallback(() => {
    updatePreferences(DEFAULT_PREFERENCES);
    announceToScreenReader(
      preferences.language === 'am'
        ? 'ቅንብሮች ወደ ነባሪ ተመልሰዋል'
        : 'Settings reset to defaults',
      'polite',
    );
  }, [preferences.language, updatePreferences]);

  return (
    <>
      <SettingsButton
        language={preferences.language}
        isOpen={isOpen}
        onClick={() => setIsOpen(true)}
      />
      <SettingsPanel
        isOpen={isOpen}
        preferences={preferences}
        onChange={handleChange}
        onClose={() => setIsOpen(false)}
        onReset={handleReset}
      />
    </>
  );
}
