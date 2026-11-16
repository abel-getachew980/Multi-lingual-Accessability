import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_PREFERENCES } from '@/services/storage';
import { SettingsDialog } from '@/components/Settings';

const mockUpdatePreferences = jest.fn();
const mockUseTutor = jest.fn();

jest.mock('@/context/TutorContext', () => ({
  useTutor: () => mockUseTutor(),
}));

beforeEach(() => {
  mockUpdatePreferences.mockReset();
  mockUseTutor.mockReturnValue({
    preferences: { ...DEFAULT_PREFERENCES },
    updatePreferences: mockUpdatePreferences,
  });
});

describe('SettingsDialog', () => {
  it('opens from the header button and returns focus to it on close', () => {
    render(<SettingsDialog />);

    const trigger = screen.getByRole('button', { name: 'ቅንብሮች' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    trigger.focus();
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'ቅንብሮች' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('forwards preference changes to the tutor context', () => {
    render(<SettingsDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'ቅንብሮች' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'ከፍተኛ ንጽጽን' }));
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ highContrast: true });

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ language: 'en' });
  });

  it('resets the preferences to the defaults', () => {
    render(<SettingsDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'ቅንብሮች' }));

    fireEvent.click(screen.getByRole('button', { name: 'ወደ ነባሪ መልስ' }));

    expect(mockUpdatePreferences).toHaveBeenCalledWith(DEFAULT_PREFERENCES);
  });

  it('applies the preferences to the document root', () => {
    mockUseTutor.mockReturnValue({
      preferences: {
        ...DEFAULT_PREFERENCES,
        fontSize: 'xlarge',
        highContrast: true,
        reduceMotion: true,
        keyboardOnlyMode: true,
        language: 'en',
      },
      updatePreferences: mockUpdatePreferences,
    });

    const { unmount } = render(<SettingsDialog />);

    expect(document.documentElement.dataset.fontSize).toBe('xlarge');
    expect(document.documentElement.dataset.reduceMotion).toBe('true');
    expect(document.documentElement.dataset.keyboardOnly).toBe('true');
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    expect(document.documentElement.lang).toBe('en');

    unmount();
  });
});
