import { announce, getAnnouncer, resetAnnouncer } from '@/utils/screenReader';
import { announceToScreenReader } from '@/utils/accessibility';

beforeEach(() => {
  resetAnnouncer();
  document.body.innerHTML = '';
});

afterEach(() => {
  resetAnnouncer();
  jest.useRealTimers();
});

describe('screen-reader announcements', () => {
  it('creates a hidden polite live region on demand', () => {
    announce('ተግባሩ ተጠናቅቋል');

    const region = getAnnouncer();
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('id', 'sr-announcer');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveClass('sr-only');
    expect(region).toHaveTextContent('ተጠናቅቋል');
  });

  it('reuses the region rendered by the root layout', () => {
    const existing = document.createElement('div');
    existing.id = 'sr-announcer';
    document.body.appendChild(existing);

    announce('Done');

    expect(document.querySelectorAll('#sr-announcer')).toHaveLength(1);
    expect(existing).toHaveTextContent('Done');
  });

  it('switches to an assertive alert for urgent messages', () => {
    announce('Connection lost', 'assertive');

    const region = getAnnouncer();
    expect(region).toHaveAttribute('role', 'alert');
    expect(region).toHaveAttribute('aria-live', 'assertive');
  });

  it('clears the message after a second so it can be announced again', () => {
    jest.useFakeTimers();

    announce('Saved');

    const region = getAnnouncer();
    expect(region).toHaveTextContent('Saved');

    jest.advanceTimersByTime(1_000);
    expect(region).toHaveTextContent('');

    announce('Saved');
    expect(region).toHaveTextContent('Saved');
  });

  it('trims long messages and ignores empty ones', () => {
    announce('   ');

    const region = getAnnouncer();
    expect(region).toHaveTextContent('');
  });

  it('trims surrounding whitespace', () => {
    announce('  A message  ');

    expect(getAnnouncer()).toHaveTextContent('A message');
  });

  it('keeps the existing announceToScreenReader API working', () => {
    announceToScreenReader('ቋንቋ ተቀይሯል', 'polite');

    expect(getAnnouncer()).toHaveTextContent('ቋንቋ ተቀይሯል');
    expect(getAnnouncer()).toHaveAttribute('aria-live', 'polite');
  });
});
