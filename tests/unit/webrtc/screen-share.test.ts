import { ScreenShareError, ScreenShareHandler } from '@/services/webrtc';
import type { DisplayMediaDevices } from '@/services/webrtc';

function makeStream() {
  const listeners: Record<string, Array<() => void>> = {};

  const track = {
    stop: jest.fn(),
    addEventListener: jest.fn((event: string, listener: () => void) => {
      listeners[event] = [...(listeners[event] ?? []), listener];
    }),
  };

  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;

  return {
    stream,
    track,
    emitEnded: () => listeners.ended?.forEach((listener) => listener()),
  };
}

function devicesWith(
  getDisplayMedia: jest.Mock,
): DisplayMediaDevices {
  return { getDisplayMedia } as DisplayMediaDevices;
}

describe('ScreenShareHandler', () => {
  it('reports whether the device supports screen sharing', () => {
    expect(ScreenShareHandler.isSupported(devicesWith(jest.fn()))).toBe(true);
    expect(ScreenShareHandler.isSupported({})).toBe(false);
    expect(ScreenShareHandler.isSupported(null)).toBe(false);
  });

  it('requests display media and keeps the stream', async () => {
    const { stream } = makeStream();
    const getDisplayMedia = jest.fn().mockResolvedValue(stream);
    const handler = new ScreenShareHandler({
      mediaDevices: devicesWith(getDisplayMedia),
    });

    const started = await handler.start();

    expect(started).toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: false });
    expect(handler.isActive()).toBe(true);
    expect(handler.getStream()).toBe(stream);
  });

  it('asks for audio only when requested', async () => {
    const { stream } = makeStream();
    const getDisplayMedia = jest.fn().mockResolvedValue(stream);
    const handler = new ScreenShareHandler({
      mediaDevices: devicesWith(getDisplayMedia),
    });

    await handler.start({ includeAudio: true });

    expect(getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: true });
  });

  it('returns the existing stream when started twice', async () => {
    const { stream } = makeStream();
    const getDisplayMedia = jest.fn().mockResolvedValue(stream);
    const handler = new ScreenShareHandler({
      mediaDevices: devicesWith(getDisplayMedia),
    });

    await handler.start();
    const second = await handler.start();

    expect(second).toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });

  it('stops every track and forgets the stream', async () => {
    const { stream, track } = makeStream();
    const handler = new ScreenShareHandler({
      mediaDevices: devicesWith(jest.fn().mockResolvedValue(stream)),
    });

    await handler.start();
    handler.stop();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(handler.isActive()).toBe(false);
    expect(handler.getStream()).toBeNull();

    // Stopping an already stopped handler is harmless.
    handler.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('releases the stream when the learner stops sharing in the browser', async () => {
    const { stream, emitEnded } = makeStream();
    const onEnded = jest.fn();
    const handler = new ScreenShareHandler({
      mediaDevices: devicesWith(jest.fn().mockResolvedValue(stream)),
      onEnded,
    });

    await handler.start();
    emitEnded();

    expect(handler.isActive()).toBe(false);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported devices without calling the browser', async () => {
    const handler = new ScreenShareHandler({ mediaDevices: {} });

    await expect(handler.start()).rejects.toMatchObject({
      code: 'unsupported',
    });
  });

  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['AbortError', 'cancelled'],
    ['NotFoundError', 'no-display'],
    ['NotReadableError', 'no-display'],
    ['SomethingElse', 'unknown'],
  ])('maps %s to the %s code', async (name, code) => {
    const error = new Error('failed');
    error.name = name;

    const handler = new ScreenShareHandler({
      mediaDevices: devicesWith(jest.fn().mockRejectedValue(error)),
    });

    await expect(handler.start()).rejects.toMatchObject({
      name: 'ScreenShareError',
      code,
    });
  });

  it('keeps an already translated error', async () => {
    const original = new ScreenShareError('nope', 'cancelled');
    const handler = new ScreenShareHandler({
      mediaDevices: devicesWith(jest.fn().mockRejectedValue(original)),
    });

    await expect(handler.start()).rejects.toBe(original);
  });
});
