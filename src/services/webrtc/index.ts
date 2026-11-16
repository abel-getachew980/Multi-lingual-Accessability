/**
 * WebRTC services for human help screen sharing.
 *
 * - `ScreenShareHandler` wraps `getDisplayMedia` and its permissions.
 * - `WebRTCConnector` owns the peer connection and ICE plumbing.
 * - `SignalingClient` exchanges SDP/ICE messages through `/api/help/signal`.
 */

export { ScreenShareHandler, type ScreenShareHandlerOptions } from './ScreenShareHandler';
export {
  WebRTCConnector,
  defaultIceServers,
  type WebRTCConnectorOptions,
} from './WebRTCConnector';
export {
  SignalingClient,
  type IncomingSignal,
  type SignalingClientOptions,
} from './SignalingClient';
export {
  ScreenShareError,
  type DisplayMediaDevices,
  type ScreenShareErrorCode,
  type WebRTCConnectionState,
} from './types';
