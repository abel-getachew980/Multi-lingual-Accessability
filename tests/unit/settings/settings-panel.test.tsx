import { fireEvent, render, screen } from '@testing-library/react';
import type { UserPreferences } from '@/types';
import { DEFAULT_PREFERENCES } from '@/services/storage';
import { SettingsPanel } from '@/components/Settings';

function setup(overrides: Partial<UserPreferences> = {}) {
  const onChange = jest.fn();
  const onClose = jest.fn();
  const onReset = jest.fn();
  const preferences: UserPreferences = { ...DEFAULT_PREFERENCES, ...overrides };

  const utils = render(
    <SettingsPanel
      isOpen
      preferences={preferences}
      onChange={onChange}
      onClose={onClose}
      onReset={onReset}
    />,
  );

  return { ...utils, onChange, onClose, onReset };
}

describe('SettingsPanel', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <SettingsPanel
        isOpen={false}
        preferences={DEFAULT_PREFERENCES}
        onChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a labelled modal dialog', () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'ቅንብሮች' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(/የእርስዎን ተሞክሮ/);
  });

  it('focuses the close button when it opens', () => {
    setup();

    expect(screen.getByRole('button', { name: 'ቅንብሮችን ዝጋ' })).toHaveFocus();
  });

  it('changes the language', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));

    expect(onChange).toHaveBeenCalledWith({ language: 'en' });
  });

  it('changes the font size token', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('radio', { name: 'ትልቅ' }));

    expect(onChange).toHaveBeenCalledWith({ fontSize: 'large' });
  });

  it('changes the AI provider', () => {
    const { onChange } = setup({ preferredAIProvider: 'cloud' });

    fireEvent.click(screen.getByRole('radio', { name: 'ከኢንተርኔት ውጭ' }));

    expect(onChange).toHaveBeenCalledWith({ preferredAIProvider: 'offline' });
  });

  it('toggles accessibility options', () => {
    const { onChange } = setup();

    const highContrast = screen.getByRole('checkbox', { name: 'ከፍተኛ ንጽጽን' });
    expect(highContrast).not.toBeChecked();

    fireEvent.click(highContrast);

    expect(onChange).toHaveBeenCalledWith({ highContrast: true });
  });

  it('reflects the current preferences in the controls', () => {
    setup({ language: 'en', fontSize: 'xlarge', highContrast: true, reduceMotion: true });

    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Extra large' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'High contrast' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Reduce motion' })).toBeChecked();
  });

  it('closes with Escape', () => {
    const { onClose } = setup();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with the close button', () => {
    const { onClose } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'ቅንብሮችን ዝጋ' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers a reset action only when a handler is provided', () => {
    const { onReset } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'ወደ ነባሪ መልስ' }));
    expect(onReset).toHaveBeenCalledTimes(1);

    render(
      <SettingsPanel
        isOpen
        preferences={DEFAULT_PREFERENCES}
        onChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.queryAllByRole('button', { name: 'ወደ ነባሪ መልስ' }),
    ).toHaveLength(1);
  });

  it('labels every control in the current language', () => {
    setup({ language: 'en' });

    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Font size' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'AI Provider' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Accessibility' })).toBeInTheDocument();
  });
});
