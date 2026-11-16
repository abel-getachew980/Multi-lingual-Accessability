import { fireEvent, render, screen, within } from '@testing-library/react';
import type { HumanHelpRequest } from '@/types';
import { HumanHelpModal, StatusNotifier } from '@/components/HumanHelp';

function makeRequest(overrides: Partial<HumanHelpRequest> = {}): HumanHelpRequest {
  return {
    id: 'help-1',
    userId: 'learner-1',
    conversationHistory: [],
    timestamp: new Date('2026-01-01T10:00:00Z'),
    status: 'pending',
    screenShareEnabled: false,
    position: 2,
    estimatedWaitMinutes: 4,
    ...overrides,
  };
}

function setup(props: Partial<React.ComponentProps<typeof HumanHelpModal>> = {}) {
  const handlers = {
    onRequest: jest.fn(),
    onCancel: jest.fn(),
    onClose: jest.fn(),
    onScreenShareChange: jest.fn(),
  };

  const utils = render(
    <HumanHelpModal
      isOpen
      request={null}
      language="en"
      isRequesting={false}
      error={null}
      screenShareActive={false}
      {...handlers}
      {...props}
    />,
  );

  return { ...utils, ...handlers };
}

describe('HumanHelpModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <HumanHelpModal
        isOpen={false}
        request={null}
        language="am"
        isRequesting={false}
        error={null}
        screenShareActive={false}
        onRequest={jest.fn()}
        onCancel={jest.fn()}
        onClose={jest.fn()}
        onScreenShareChange={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('asks for confirmation before contacting a tutor', () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'Human help' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByText('Request a human tutor?'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Only the last 20 messages are sent.'),
    ).toBeInTheDocument();
  });

  it('does not claim a tutor was contacted before the request is made', () => {
    setup();

    expect(screen.queryByText(/Waiting for a tutor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tutor connected/i)).not.toBeInTheDocument();
  });

  it('requests help only when the learner confirms', () => {
    const { onRequest } = setup();

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Request help',
      }),
    );

    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it('shows progress and disables the button while requesting', () => {
    setup({ isRequesting: true });

    const button = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Requesting...',
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('shows an error with an alert role', () => {
    setup({ error: 'Could not request help. Please try again.' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not request help. Please try again.',
    );
  });

  it('shows the queue position while waiting and allows cancelling', () => {
    const { onCancel } = setup({ request: makeRequest() });

    expect(
      screen.getByText(/Waiting for a tutor\. Position 2 in the queue/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Estimated wait 4 minutes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('only offers screen sharing once a tutor has joined', () => {
    const pending = setup({ request: makeRequest() });
    expect(
      screen.getByText('You can share your screen once a tutor joins.'),
    ).toBeInTheDocument();
    pending.unmount();

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia: jest.fn() },
    });

    setup({ request: makeRequest({ status: 'connected', position: 0 }) });

    expect(screen.getByText('Tutor connected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Share screen' }),
    ).toBeInTheDocument();
  });

  it('explains that a resolved session is over', () => {
    setup({
      request: makeRequest({
        status: 'resolved',
        position: 0,
        assignedTutor: 'Sara',
      }),
    });

    expect(
      screen.getByText('This help session is complete.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The tutor has finished. You can request help again if needed.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel request' }),
    ).not.toBeInTheDocument();
  });

  it('closes with Escape and with the close button', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButtons = within(dialog).getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('labels the dialog in Amharic', () => {
    setup({ language: 'am' });

    expect(
      screen.getByRole('dialog', { name: 'የሰው እርዳታ' }),
    ).toBeInTheDocument();
  });
});

describe('StatusNotifier', () => {
  it('announces changes in the queue', () => {
    render(<StatusNotifier request={makeRequest()} language="en" />);

    const region = screen.getByTestId('help-status-announcer');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Waiting for a tutor');
  });

  it('announces a connected tutor by name', () => {
    render(
      <StatusNotifier
        request={makeRequest({
          status: 'connected',
          assignedTutor: 'Sara',
          position: 0,
        })}
        language="en"
      />,
    );

    expect(screen.getByTestId('help-status-announcer')).toHaveTextContent(
      'Tutor connected - Sara',
    );
  });

  it('is silent without a request', () => {
    render(<StatusNotifier request={null} language="am" />);

    expect(screen.getByTestId('help-status-announcer')).toBeEmptyDOMElement();
  });
});
