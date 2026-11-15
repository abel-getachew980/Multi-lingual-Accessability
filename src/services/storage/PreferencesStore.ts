/**
 * PreferencesStore - User preferences in localStorage
 *
 * Simple key-value store for user preferences.
 * Syncs with TutorContext and provides defaults.
 */

import { UserPreferences, Language } from '@/types';

const PREFS_KEY = 'ai-tutor-preferences';

const defaultPreferences: UserPreferences = {
  language: 'am',
  soundEnabled: true,
  highContrast: false,
  fontSize: 'normal',
  keyboardOnlyMode: false,
  preferredAIProvider: 'offline',
  screenReaderOptimized: true,
  autoPlayVoiceResponses: false,
  reduceMotion: false,
};

export class PreferencesStore {
  /**
   * Get current preferences
   */
  get(): UserPreferences {
    if (typeof window === 'undefined') {
      return { ...defaultPreferences };
    }

    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new fields
        return { ...defaultPreferences, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }

    return { ...defaultPreferences };
  }

  /**
   * Update preferences
   */
  set(prefs: Partial<UserPreferences>): UserPreferences {
    const current = this.get();
    const updated = { ...current, ...prefs };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save preferences:', error);

        // Handle quota exceeded
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded, clearing old data');
          // Try to clear some space
          this.clearOldEntries();
          // Try again
          try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
          } catch {
            console.error('Still cannot save preferences after cleanup');
          }
        }
      }
    }

    return updated;
  }

  /**
   * Reset to defaults
   */
  reset(): UserPreferences {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PREFS_KEY);
    }
    return { ...defaultPreferences };
  }

  /**
   * Validate preferences object
   */
  validate(prefs: Partial<UserPreferences>): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    const validLanguages: Language[] = ['am', 'en'];
    const validFontSizes = ['normal', 'large', 'xlarge'];
    const validProviders = ['cloud', 'local', 'offline'];

    if (prefs.language && !validLanguages.includes(prefs.language)) {
      errors.language = `Invalid language: ${prefs.language}`;
    }

    if (prefs.fontSize && !validFontSizes.includes(prefs.fontSize)) {
      errors.fontSize = `Invalid font size: ${prefs.fontSize}`;
    }

    if (prefs.preferredAIProvider && !validProviders.includes(prefs.preferredAIProvider)) {
      errors.preferredAIProvider = `Invalid provider: ${prefs.preferredAIProvider}`;
    }

    if (prefs.fontSize && typeof prefs.fontSize !== 'string') {
      errors.fontSize = 'Font size must be a string';
    }

    if (prefs.soundEnabled !== undefined && typeof prefs.soundEnabled !== 'boolean') {
      errors.soundEnabled = 'Sound enabled must be a boolean';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Get a single preference value
   */
  getValue<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    const prefs = this.get();
    return prefs[key];
  }

  /**
   * Set a single preference value
   */
  setValue<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): UserPreferences {
    return this.set({ [key]: value });
  }

  /**
   * Check if preferences exist
   */
  exists(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(PREFS_KEY) !== null;
  }

  /**
   * Export preferences as JSON string
   */
  export(): string {
    return JSON.stringify(this.get(), null, 2);
  }

  /**
   * Import preferences from JSON string
   */
  import(jsonString: string): UserPreferences {
    try {
      const prefs = JSON.parse(jsonString);
      const validation = this.validate(prefs);

      if (!validation.isValid) {
        throw new Error(`Invalid preferences: ${JSON.stringify(validation.errors)}`);
      }

      return this.set(prefs);
    } catch (error) {
      console.error('Failed to import preferences:', error);
      throw error;
    }
  }

  /**
   * Clear old entries to free space (private helper)
   */
  private clearOldEntries(): void {
    // Clear non-essential localStorage entries
    const keysToKeep = [PREFS_KEY, 'theme'];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    }
  }
}
