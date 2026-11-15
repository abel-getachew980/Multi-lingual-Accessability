import type { SignalingClient, SignalingMessage } from './SignalingClient';

export interface PeerConnectionLike {
  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender;
  createOffer(): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  getSenders(): RTCRtpSender[];
  close(): void;
  onicecandidate: ((event: { candidate: RTCIceCandidateInit | null }) => void) | null;
}

export interface WebRTCConnectorOptions {
  signaling: SignalingClient;
  peerConnectionFactory?: (config: RTCConfiguration) => PeerConnectionLike;
  config?: RTCConfiguration;
}

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function defaultPeerConnectionFactory(config: RTCConfiguration): PeerConnectionLike {
  if (typeof RTCPeerConnection === 'undefined') {
    throw new Error('WebRTC is not supported in this browser');
  }

  return new RTCPeerConnection(config) as unknown as PeerConnectionLike;
}

export class WebRTCConnector {
  private readonly peerConnection: PeerConnectionLike;
  private readonly signaling: SignalingClient;
  private readonly unsubscribe: () => void;

  constructor({
    signaling,
    peerConnectionFactory = defaultPeerConnectionFactory,
    config = DEFAULT_RTC_CONFIG,
  }: WebRTCConnectorOptions) {
    this.signaling = signaling;
    this.peerConnection = peerConnectionFactory(config);
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(event.candidate);
      }
    };
    this.unsubscribe = typeof signaling.onMessage === 'function'
      ? signaling.onMessage((message) => void this.handleSignal(message))
      : () => undefined;
  }

  async shareScreen(stream: MediaStream): Promise<void> {
    const [track] = stream.getVideoTracks();
    if (!track) {
      throw new Error('The selected stream has no video track');
    }

    this.peerConnection.addTrack(track, stream);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.signaling.sendOffer(offer);
  }

  stopShare(): void {
    for (const sender of this.peerConnection.getSenders()) {
      sender.track?.stop();
    }
  }

  disconnect(): void {
    this.stopShare();
    this.unsubscribe();
    this.peerConnection.close();
  }

  private async handleSignal(message: SignalingMessage): Promise<void> {
    if (message.type === 'answer') {
      await this.peerConnection.setRemoteDescription(message.sdp);
    } else if (message.type === 'ice-candidate') {
      await this.peerConnection.addIceCandidate(message.candidate);
    }
  }
}
