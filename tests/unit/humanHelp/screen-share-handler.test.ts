/** @jest-environment jsdom */

import { ScreenShareHandler } from '@/services/webrtc/ScreenShareHandler';

function createStream() {
  const track = { kind: 'video', stop: jest.fn(), onended: null as (() => void) | null };
  const stream = {
    getVideoTracks: jest.fn(() => [track]),
    getTracks: jest.fn(() => [track]),
  } as unknown as MediaStream;
  return { stream, track };
}

describe('ScreenShareHandler', () => {
  it('captures a display stream and stops it on demand', async () => {
    const { stream, track } = createStream();
    const mediaDevices = { getDisplayMedia: jest.fn().mockResolvedValue(stream) };
    const handler = new ScreenShareHandler(mediaDevices);

    await expect(handler.start()).resolves.toBe(stream);
    expect(mediaDevices.getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: false });

    handler.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(handler.currentStream).toBeNull();
  });

  it('notifies listeners when the browser ends sharing', async () => {
    const { stream, track } = createStream();
    const handler = new ScreenShareHandler({ getDisplayMedia: jest.fn().mockResolvedValue(stream) });
    const onEnded = jest.fn();
    handler.onEnded(onEnded);

    await handler.start();
    track.onended?.();

    expect(onEnded).toHaveBeenCalled();
    expect(handler.currentStream).toBeNull();
  });

  it('reports unsupported browsers clearly', async () => {
    const handler = new ScreenShareHandler(undefined);
    expect(handler.isSupported()).toBe(false);
    await expect(handler.start()).rejects.toThrow(/not supported/i);
  });
});
