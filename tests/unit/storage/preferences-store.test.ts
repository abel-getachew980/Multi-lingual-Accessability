import {
  DEFAULT_PREFERENCES,
  PreferencesStore,
  sanitizePreferences,
} from '@/services/storage';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));

  return {
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      data.delete(key);
    }),
    dump: () => Object.fromEntries(data),
  };
}

describe('PreferencesStore', () => {
  it('returns the defaults when nothing has been saved', () => {
    const store = new PreferencesStore(fakeStorage());
    expect(store.get()).toEqual(DEFAULT_PREFERENCES);
  });

  it('persists a patch and reads it back', () => {
    const storage = fakeStorage();
    const store = new PreferencesStore(storage);

    const saved = store.set({ language: 'en', fontSize: 'large', highContrast: true });

    expect(saved.language).toBe('en');
    expect(saved.fontSize).toBe('large');
    expect(saved.highContrast).toBe(true);
    expect(store.get()).toMatchObject({ language: 'en', fontSize: 'large', highContrast: true });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('ignores corrupted JSON instead of crashing the app', () => {
    const storage = fakeStorage({ 'ai-tutor:preferences:v1': '{not json' });
    const store = new PreferencesStore(storage);

    expect(store.get()).toEqual(DEFAULT_PREFERENCES);
  });

  it('rejects values that would put the UI in an impossible state', () => {
    const storage = fakeStorage({
      'ai-tutor:preferences:v1': JSON.stringify({
        language: 'fr',
        fontSize: 'huge',
        preferredAIProvider: 'quantum',
        soundEnabled: 'yes',
        highContrast: true,
        unknownKey: 'ignored',
      }),
    });

    const preferences = new PreferencesStore(storage).get();

    expect(preferences.language).toBe('am');
    expect(preferences.fontSize).toBe('normal');
    expect(preferences.preferredAIProvider).toBe('offline');
    expect(preferences.soundEnabled).toBe(true);
    expect(preferences.highContrast).toBe(true);
    expect(preferences).not.toHaveProperty('unknownKey');
  });

  it('resets back to the defaults and removes the stored key', () => {
    const storage = fakeStorage();
    const store = new PreferencesStore(storage);

    store.set({ language: 'en' });
    const reset = store.reset();

    expect(reset).toEqual(DEFAULT_PREFERENCES);
    expect(storage.removeItem).toHaveBeenCalledWith('ai-tutor:preferences:v1');
    expect(storage.dump()).toEqual({});
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const store = new PreferencesStore(fakeStorage());
    const listener = jest.fn();

    const unsubscribe = store.subscribe(listener);
    store.set({ reduceMotion: true });
    unsubscribe();
    store.set({ reduceMotion: false });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ reduceMotion: true }));
  });

  it('works without any storage (server rendering, blocked storage)', () => {
    const store = new PreferencesStore(null);

    expect(store.get()).toEqual(DEFAULT_PREFERENCES);
    expect(() => store.set({ language: 'en' })).not.toThrow();
    expect(store.get().language).toBe('en');
  });
});

describe('sanitizePreferences', () => {
  it('merges known keys and drops the rest', () => {
    const result = sanitizePreferences({ language: 'en', extra: true }, DEFAULT_PREFERENCES);

    expect(result.language).toBe('en');
    expect(result).not.toHaveProperty('extra');
  });

  it('falls back to defaults for non-objects', () => {
    expect(sanitizePreferences(null, DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences([], DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences('en', DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
  });
});
