import type { RTCIceServer } from '@/types';
import type { WebRTCConnectionState } from './types';

export interface WebRTCConnectorOptions {
  /** Full configuration; takes precedence over `iceServers`. */
  rtcConfig?: RTCConfiguration;
  iceServers?: RTCIceServer[];
  /** Injectable for tests and for browsers with a prefixed implementation. */
  peerConnectionFactory?: (config: RTCConfiguration) => RTCPeerConnection;
  onStateChange?: (state: WebRTCConnectionState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };

/**
 * Reads comma separated STUN/TURN URLs from
 * `NEXT_PUBLIC_WEBRTC_ICE_SERVERS`. A TURN server is required when either
 * participant is behind a symmetric NAT, so deployments should set it.
 */
export function defaultIceServers(): RTCIceServer[] {
  const raw =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS : undefined;

  if (!raw) return [DEFAULT_STUN];

  const servers = raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((urls) => ({ urls }));

  return servers.length > 0 ? servers : [DEFAULT_STUN];
}

function mapConnectionState(state: RTCPeerConnectionState): WebRTCConnectionState {
  switch (state) {
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'disconnected':
      return 'disconnected';
    case 'failed':
      return 'failed';
    case 'closed':
      return 'closed';
    default:
      return 'idle';
  }
}

/**
 * Thin, testable wrapper around `RTCPeerConnection`.
 *
 * The connector owns the peer connection and the ICE/state plumbing; the
 * signaling channel and the UI stay separate. `close()` is safe to call more
 * than once, which matters when a learner closes the dialog mid-handshake.
 */
export class WebRTCConnector {
  private peer: RTCPeerConnection | null = null;
  private state: WebRTCConnectionState = 'idle';

  private readonly config: RTCConfiguration;
  private readonly factory: (config: RTCConfiguration) => RTCPeerConnection;
  private readonly options: WebRTCConnectorOptions;

  constructor(options: WebRTCConnectorOptions = {}) {
    this.options = options;
    this.config =
      options.rtcConfig ??
      ({
        iceServers: options.iceServers ?? defaultIceServers(),
      } as RTCConfiguration);

    this.factory =
      options.peerConnectionFactory ??
      ((config) => {
        if (typeof RTCPeerConnection === 'undefined') {
          throw new Error('WebRTC is not supported in this browser');
        }
        return new RTCPeerConnection(config);
      });
  }

  static isSupported(): boolean {
    return typeof RTCPeerConnection !== 'undefined';
  }

  getState(): WebRTCConnectionState {
    return this.state;
  }

  /** Adds the screen share tracks, without duplicating a track twice. */
  addStream(stream: MediaStream): void {
    const peer = this.ensurePeer();
    const senders = peer.getSenders();

    stream.getTracks().forEach((track) => {
      const alreadySending = senders.some((sender) => sender.track === track);
      if (!alreadySending) peer.addTrack(track, stream);
    });
  }

  async createOffer(stream?: MediaStream): Promise<RTCSessionDescriptionInit> {
    const peer = this.ensurePeer();
    if (stream) this.addStream(stream);

    this.updateState('connecting');

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      return peer.localDescription ?? offer;
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  async acceptOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.ensurePeer();
    this.updateState('connecting');

    try {
      await peer.setRemoteDescription(offer);
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    const peer = this.ensurePeer();

    try {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      return peer.localDescription ?? answer;
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.ensurePeer();

    try {
      await peer.setRemoteDescription(answer);
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.ensurePeer();

    try {
      await peer.addIceCandidate(candidate);
    } catch (error) {
      // A candidate that arrives before the remote description is a race, not
      // a fatal error: the rest of the handshake can still complete.
      this.options.onError?.(
        error instanceof Error ? error : new Error('Could not add an ICE candidate'),
      );
    }
  }

  close(): void {
    const peer = this.peer;
    this.peer = null;

    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;

      try {
        peer.close();
      } catch {
        // Already closed.
      }
    }

    this.updateState('closed');
  }

  private ensurePeer(): RTCPeerConnection {
    if (this.peer) return this.peer;

    const peer = this.factory(this.config);
    this.peer = peer;

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        this.options.onRemoteStream?.(stream);
      } else if (event.track) {
        this.options.onRemoteStream?.(new MediaStream([event.track]));
      }
    };

    peer.onconnectionstatechange = () => {
      this.updateState(mapConnectionState(peer.connectionState));
    };

    return peer;
  }

  private updateState(state: WebRTCConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.options.onStateChange?.(state);
  }

  private fail(error: unknown): void {
    this.updateState('failed');
    this.options.onError?.(
      error instanceof Error ? error : new Error('The WebRTC connection failed'),
    );
  }
}
