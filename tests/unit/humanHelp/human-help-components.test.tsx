/** @jest-environment jsdom */

import { useEffect, useRef } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TutorProvider, useTutor } from '@/context/TutorContext';
import { HumanHelpButton } from '@/components/HumanHelp/HumanHelpButton';
import { HumanHelpModal } from '@/components/HumanHelp/HumanHelpModal';
import { StatusNotifier } from '@/components/HumanHelp/StatusNotifier';

const pendingResponse = {
  ok: true,
  json: async () => ({
    success: true,
    requestId: 'help-1',
    status: 'pending',
    position: 1,
    estimatedWait: '2 minutes',
  }),
};

function mockHelpFetch() {
  return jest.fn()
    .mockResolvedValueOnce(pendingResponse)
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        status: 'pending',
        position: 1,
        estimatedWait: '2 minutes',
      }),
    });
}

function useEnglishTutor() {
  const { setLanguage } = useTutor();

  useEffect(() => {
    setLanguage('en');
  }, [setLanguage]);
}

function RequestHarness() {
  const { setLanguage, requestHumanHelp } = useTutor();
  const requested = useRef(false);

  useEffect(() => {
    setLanguage('en');
    if (!requested.current) {
      requested.current = true;
      requestHumanHelp();
    }
  }, [requestHumanHelp, setLanguage]);

  return (
    <>
      <StatusNotifier />
      <HumanHelpModal />
    </>
  );
}

function EnglishHelpButton() {
  useEnglishTutor();
  return (
    <>
      <HumanHelpButton />
      <HumanHelpModal />
    </>
  );
}

describe('HumanHelp components', () => {
  beforeEach(() => {
    global.fetch = mockHelpFetch() as unknown as typeof fetch;
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests help after confirmation and opens the help dialog', async () => {
    render(
      <TutorProvider>
        <EnglishHelpButton />
      </TutorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /request human help/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('does not request help when confirmation is declined', async () => {
    window.confirm = jest.fn(() => false);
    render(
      <TutorProvider>
        <EnglishHelpButton />
      </TutorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /request human help/i }));

    expect(screen.getByRole('button', { name: /request human help/i })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows queue status in an accessible dialog', async () => {
    render(
      <TutorProvider>
        <RequestHarness />
      </TutorProvider>,
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(await within(dialog).findByText(/position in queue/i)).toHaveTextContent('1');
    expect(within(dialog).getByRole('button', { name: /cancel request/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/waiting for a tutor/i);
  });

  it('closes the modal with Escape', async () => {
    render(
      <TutorProvider>
        <RequestHarness />
      </TutorProvider>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });


  it('deletes the server request when cancelled while creation is in flight', async () => {
    let resolveCreate!: (response: unknown) => void;
    const createResponse = new Promise((resolve) => {
      resolveCreate = resolve;
    });

    global.fetch = jest.fn()
      .mockImplementationOnce(() => createResponse)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }) as unknown as typeof fetch;

    render(
      <TutorProvider>
        <EnglishHelpButton />
      </TutorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /request human help/i }));
    fireEvent.click(await screen.findByRole('button', { name: /cancel request/i }));

    resolveCreate({
      ok: true,
      json: async () => ({
        success: true,
        requestId: 'server-help-1',
        status: 'pending',
        position: 1,
      }),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/help?id=server-help-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('cancels the request and closes the dialog', async () => {
    render(
      <TutorProvider>
        <RequestHarness />
      </TutorProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /cancel request/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
