/** Shared WebRTC and screen sharing types. */

export type WebRTCConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export type ScreenShareErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'cancelled'
  | 'no-display'
  | 'unknown';

export class ScreenShareError extends Error {
  constructor(
    message: string,
    readonly code: ScreenShareErrorCode,
  ) {
    super(message);
    this.name = 'ScreenShareError';
  }
}

/** The small part of `navigator.mediaDevices` screen sharing needs. */
export interface DisplayMediaDevices {
  getDisplayMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
}
