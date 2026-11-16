import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScreenShareControl } from '@/components/HumanHelp/ScreenShareControl';

function makeStream() {
  const track = {
    stop: jest.fn(),
    addEventListener: jest.fn(),
  };

  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;

  return { stream, track };
}

function setup(props: Partial<React.ComponentProps<typeof ScreenShareControl>> = {}) {
  const onActiveChange = jest.fn();

  const utils = render(
    <ScreenShareControl
      language="en"
      active={false}
      onActiveChange={onActiveChange}
      {...props}
    />,
  );

  return { ...utils, onActiveChange };
}

describe('ScreenShareControl', () => {
  it('asks for permission and reports success', async () => {
    const { stream, track } = makeStream();
    const getDisplayMedia = jest.fn().mockResolvedValue(stream);
    const { onActiveChange } = setup({ mediaDevices: { getDisplayMedia } });

    fireEvent.click(screen.getByRole('button', { name: 'Share screen' }));

    await waitFor(() => expect(onActiveChange).toHaveBeenCalledWith(true));
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(track.stop).not.toHaveBeenCalled();
  });

  it('explains why a denied permission blocked sharing', async () => {
    const error = new Error('denied');
    error.name = 'NotAllowedError';
    const getDisplayMedia = jest.fn().mockRejectedValue(error);

    setup({ mediaDevices: { getDisplayMedia } });

    fireEvent.click(screen.getByRole('button', { name: 'Share screen' }));

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Screen sharing permission was denied.');
    expect(screen.queryByRole('button', { name: 'Stop sharing' })).not.toBeInTheDocument();
  });

  it('reports a dismissed picker as a cancellation', async () => {
    const error = new Error('cancelled');
    error.name = 'AbortError';
    const getDisplayMedia = jest.fn().mockRejectedValue(error);

    setup({ mediaDevices: { getDisplayMedia } });
    fireEvent.click(screen.getByRole('button', { name: 'Share screen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Screen sharing was cancelled.',
    );
  });

  it('stops sharing when the learner presses stop', async () => {
    const { stream, track } = makeStream();
    const getDisplayMedia = jest.fn().mockResolvedValue(stream);
    const { onActiveChange, rerender } = setup({
      mediaDevices: { getDisplayMedia },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Share screen' }));
    await waitFor(() => expect(onActiveChange).toHaveBeenCalledWith(true));

    rerender(
      <ScreenShareControl
        language="en"
        active
        onActiveChange={onActiveChange}
        mediaDevices={{ getDisplayMedia }}
      />,
    );

    const stop = screen.getByRole('button', { name: 'Stop sharing' });
    expect(stop).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(stop);

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it('shows a note when the browser cannot share screens', async () => {
    setup({ mediaDevices: {} });

    expect(
      await screen.findByText('This browser does not support screen sharing.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('mirrors the active state in the visible text', () => {
    setup({ active: true, mediaDevices: { getDisplayMedia: jest.fn() } });

    expect(screen.getByText('Your screen is being shared.')).toBeInTheDocument();
  });

  it('is labelled in Amharic', () => {
    setup({ language: 'am', mediaDevices: { getDisplayMedia: jest.fn() } });

    expect(
      screen.getByRole('button', { name: 'መስኮት አጋራ' }),
    ).toBeInTheDocument();
  });
});
