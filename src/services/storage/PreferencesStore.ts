import type { AIProvider, Language, SettingsUpdate, UserPreferences } from '@/types';
import { DEFAULT_PREFERENCES } from './types';

const STORAGE_KEY = 'ai-tutor:preferences:v1';

const LANGUAGES: Language[] = ['am', 'en'];
const PROVIDERS: AIProvider[] = ['cloud', 'local', 'offline'];
const FONT_SIZES: UserPreferences['fontSize'][] = ['normal', 'large', 'xlarge'];

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type PreferencesListener = (preferences: UserPreferences) => void;

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    // Private mode or a blocked storage policy.
    return null;
  }
}

/**
 * Validates one preference. Corrupted or hand-edited storage should never put
 * the UI into an impossible state (e.g. `fontSize: "huge"`), so every field is
 * checked instead of being spread blindly.
 */
function sanitize<K extends keyof UserPreferences>(
  key: K,
  value: unknown,
): UserPreferences[K] | undefined {
  switch (key) {
    case 'language':
      return LANGUAGES.includes(value as Language) ? (value as UserPreferences[K]) : undefined;
    case 'preferredAIProvider':
      return PROVIDERS.includes(value as AIProvider) ? (value as UserPreferences[K]) : undefined;
    case 'fontSize':
      return FONT_SIZES.includes(value as UserPreferences['fontSize'])
        ? (value as UserPreferences[K])
        : undefined;
    default:
      return typeof value === 'boolean' ? (value as UserPreferences[K]) : undefined;
  }
}

export function sanitizePreferences(
  input: unknown,
  defaults: UserPreferences = DEFAULT_PREFERENCES,
): UserPreferences {
  const merged: UserPreferences = { ...defaults };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return merged;

  const record = input as Record<string, unknown>;

  for (const key of Object.keys(defaults) as Array<keyof UserPreferences>) {
    const clean = sanitize(key, record[key]);
    if (clean !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = clean;
    }
  }

  return merged;
}

/**
 * Preferences persistence (localStorage, so it survives a closed tab and is
 * readable before any network call).
 */
export class PreferencesStore {
  private readonly listeners = new Set<PreferencesListener>();
  /** Session fallback when storage is missing or blocked. */
  private memory: UserPreferences | null = null;

  constructor(
    private readonly storage: StorageLike | null = browserStorage(),
    private readonly defaults: UserPreferences = DEFAULT_PREFERENCES,
  ) {}

  get(): UserPreferences {
    if (!this.storage) return { ...(this.memory ?? this.defaults) };

    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return { ...this.defaults };
      return sanitizePreferences(JSON.parse(raw), this.defaults);
    } catch {
      return { ...this.defaults };
    }
  }

  set(patch: SettingsUpdate): UserPreferences {
    const next = sanitizePreferences({ ...this.get(), ...patch }, this.defaults);
    this.memory = next;

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Quota exceeded or storage disabled: keep the in-memory value anyway.
      }
    }

    this.emit(next);
    return next;
  }

  reset(): UserPreferences {
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore: the defaults below are still returned.
      }
    }

    const next = { ...this.defaults };
    this.memory = next;
    this.emit(next);
    return next;
  }

  subscribe(listener: PreferencesListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(preferences: UserPreferences): void {
    this.listeners.forEach((listener) => listener(preferences));
  }
}
