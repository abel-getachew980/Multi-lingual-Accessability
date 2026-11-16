import { fireEvent, render, screen, within } from '@testing-library/react';
import type { HumanHelpRequest, UserPreferences } from '@/types';
import { DEFAULT_PREFERENCES } from '@/services/storage';
import { HumanHelpButton } from '@/components/HumanHelp';

const mockRequestHumanHelp = jest.fn();
const mockCancelHumanHelp = jest.fn();
const mockClearHumanHelpError = jest.fn();
const mockSetScreenShareActive = jest.fn();
const mockUseTutor = jest.fn();

jest.mock('@/context/TutorContext', () => ({
  useTutor: () => mockUseTutor(),
}));

function context(overrides: Record<string, unknown> = {}) {
  return {
    humanHelpRequest: null,
    isRequestingHelp: false,
    humanHelpError: null,
    requestHumanHelp: mockRequestHumanHelp,
    cancelHumanHelp: mockCancelHumanHelp,
    clearHumanHelpError: mockClearHumanHelpError,
    screenShareActive: false,
    setScreenShareActive: mockSetScreenShareActive,
    preferences: { ...DEFAULT_PREFERENCES } as UserPreferences,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<HumanHelpRequest> = {}): HumanHelpRequest {
  return {
    id: 'help-1',
    userId: 'learner-1',
    conversationHistory: [],
    timestamp: new Date('2026-01-01T10:00:00Z'),
    status: 'pending',
    screenShareEnabled: false,
    position: 1,
    estimatedWaitMinutes: 2,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTutor.mockReturnValue(context());
});

describe('HumanHelpButton', () => {
  it('uses the language from the preferences', () => {
    mockUseTutor.mockReturnValue(
      context({
        preferences: { ...DEFAULT_PREFERENCES, language: 'en' },
      }),
    );

    render(<HumanHelpButton />);

    expect(
      screen.getByRole('button', { name: 'Request help' }),
    ).toBeInTheDocument();
  });

  it('opens a confirmation dialog without requesting help', () => {
    mockUseTutor.mockReturnValue(
      context({
        preferences: { ...DEFAULT_PREFERENCES, language: 'en' },
      }),
    );

    render(<HumanHelpButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Request help' }));

    const dialog = screen.getByRole('dialog', { name: 'Human help' });
    expect(
      within(dialog).getByText('Request a human tutor?'),
    ).toBeInTheDocument();
    expect(mockRequestHumanHelp).not.toHaveBeenCalled();
    expect(mockClearHumanHelpError).toHaveBeenCalled();
  });

  it('requests help after confirmation', () => {
    mockUseTutor.mockReturnValue(
      context({
        preferences: { ...DEFAULT_PREFERENCES, language: 'en' },
      }),
    );

    render(<HumanHelpButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Request help' }));

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Request help',
      }),
    );

    expect(mockRequestHumanHelp).toHaveBeenCalledTimes(1);
  });

  it('shows the queue status while a request is active', () => {
    mockUseTutor.mockReturnValue(
      context({
        humanHelpRequest: makeRequest(),
        preferences: { ...DEFAULT_PREFERENCES, language: 'en' },
      }),
    );

    render(<HumanHelpButton />);

    const trigger = screen.getByRole('button', { name: 'Help status' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

    fireEvent.click(trigger);

    expect(
      within(screen.getByRole('dialog')).getByText(/Waiting for a tutor/),
    ).toBeInTheDocument();
    expect(mockRequestHumanHelp).not.toHaveBeenCalled();
  });

  it('keeps announcing the status while the dialog is closed', () => {
    mockUseTutor.mockReturnValue(
      context({ humanHelpRequest: makeRequest() }),
    );

    render(<HumanHelpButton />);

    expect(screen.getByTestId('help-status-announcer')).toHaveTextContent(
      'በመጠባበቅ ላይ',
    );
  });

  it('returns to the request button after the session ends', () => {
    mockUseTutor.mockReturnValue(
      context({
        humanHelpRequest: makeRequest({ status: 'resolved' }),
        preferences: { ...DEFAULT_PREFERENCES, language: 'en' },
      }),
    );

    render(<HumanHelpButton />);

    expect(
      screen.getByRole('button', { name: 'Request help' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Help status' })).not.toBeInTheDocument();
  });
});
