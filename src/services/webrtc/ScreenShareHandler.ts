import { ScreenShareError, type DisplayMediaDevices } from './types';

export interface ScreenShareHandlerOptions {
  mediaDevices?: DisplayMediaDevices | null;
  /** Called when the learner stops sharing from the browser UI. */
  onEnded?: () => void;
}

function toScreenShareError(error: unknown): ScreenShareError {
  if (error instanceof ScreenShareError) return error;

  const name = error instanceof Error ? error.name : '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new ScreenShareError(
      'Screen sharing permission was denied',
      'permission-denied',
    );
  }

  if (name === 'AbortError') {
    return new ScreenShareError('Screen sharing was cancelled', 'cancelled');
  }

  if (name === 'NotFoundError' || name === 'NotReadableError') {
    return new ScreenShareError('No screen could be shared', 'no-display');
  }

  return new ScreenShareError('Screen sharing could not start', 'unknown');
}

/**
 * Wraps `getDisplayMedia`.
 *
 * Browsers hand the learner a permission prompt; we never start sharing
 * without it. When the learner uses the browser's own "Stop sharing" button
 * the track ends and `onEnded` lets the UI reset its state instead of showing
 * a stale "sharing" badge.
 */
export class ScreenShareHandler {
  private stream: MediaStream | null = null;
  private readonly onEnded?: () => void;
  private readonly mediaDevices?: DisplayMediaDevices | null;

  constructor(options: ScreenShareHandlerOptions = {}) {
    this.onEnded = options.onEnded;
    this.mediaDevices =
      options.mediaDevices !== undefined
        ? options.mediaDevices
        : typeof navigator !== 'undefined'
          ? (navigator.mediaDevices as DisplayMediaDevices | undefined)
          : undefined;
  }

  static isSupported(mediaDevices?: DisplayMediaDevices | null): boolean {
    const devices =
      mediaDevices !== undefined
        ? mediaDevices
        : typeof navigator !== 'undefined'
          ? (navigator.mediaDevices as DisplayMediaDevices | undefined)
          : undefined;

    return typeof devices?.getDisplayMedia === 'function';
  }

  isSupported(): boolean {
    return ScreenShareHandler.isSupported(this.mediaDevices);
  }

  isActive(): boolean {
    return this.stream !== null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async start(options: { includeAudio?: boolean } = {}): Promise<MediaStream> {
    if (this.stream) return this.stream;

    const getDisplayMedia = this.mediaDevices?.getDisplayMedia;
    if (typeof getDisplayMedia !== 'function') {
      throw new ScreenShareError(
        'Screen sharing is not supported on this device',
        'unsupported',
      );
    }

    try {
      const stream = await getDisplayMedia.call(this.mediaDevices, {
        video: true,
        audio: options.includeAudio === true,
      });

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          this.release();
          this.onEnded?.();
        });
      });

      this.stream = stream;
      return stream;
    } catch (error) {
      throw toScreenShareError(error);
    }
  }

  stop(): void {
    this.release();
  }

  private release(): void {
    if (!this.stream) return;

    this.stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Already stopped by the browser.
      }
    });

    this.stream = null;
  }
}
