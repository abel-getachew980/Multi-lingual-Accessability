import { DEFAULT_PREFERENCES } from '@/services/storage';
import { applyPreferences } from '@/components/Settings';

describe('applyPreferences', () => {
  it('mirrors preferences onto the document root', () => {
    const root = document.createElement('html');

    applyPreferences(
      {
        ...DEFAULT_PREFERENCES,
        fontSize: 'large',
        highContrast: true,
        reduceMotion: true,
        keyboardOnlyMode: true,
        language: 'en',
      },
      root,
    );

    expect(root.dataset.fontSize).toBe('large');
    expect(root.dataset.reduceMotion).toBe('true');
    expect(root.dataset.keyboardOnly).toBe('true');
    expect(root.classList.contains('high-contrast')).toBe(true);
    expect(root.lang).toBe('en');
  });

  it('removes high contrast when it is turned off again', () => {
    const root = document.createElement('html');

    applyPreferences({ ...DEFAULT_PREFERENCES, highContrast: true }, root);
    applyPreferences({ ...DEFAULT_PREFERENCES, highContrast: false }, root);

    expect(root.classList.contains('high-contrast')).toBe(false);
    expect(root.dataset.fontSize).toBe('normal');
    expect(root.dataset.reduceMotion).toBe('false');
    expect(root.dataset.keyboardOnly).toBe('false');
  });
});
