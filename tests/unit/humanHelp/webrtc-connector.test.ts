/** @jest-environment jsdom */

import { WebRTCConnector } from '@/services/webrtc/WebRTCConnector';
import type { SignalingClient } from '@/services/webrtc/SignalingClient';
import type { PeerConnectionLike } from '@/services/webrtc/WebRTCConnector';

function createPeerConnection() {
  const sender = { track: { stop: jest.fn() } };
  return {
    addTrack: jest.fn(() => sender),
    createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
    setLocalDescription: jest.fn().mockResolvedValue(undefined),
    setRemoteDescription: jest.fn().mockResolvedValue(undefined),
    addIceCandidate: jest.fn().mockResolvedValue(undefined),
    getSenders: jest.fn(() => [sender]),
    close: jest.fn(),
    onicecandidate: null as ((event: { candidate: RTCIceCandidateInit | null }) => void) | null,
  };
}

function createStream() {
  const track = { kind: 'video', stop: jest.fn(), onended: null as (() => void) | null };
  return {
    track,
    stream: {
      getVideoTracks: jest.fn(() => [track]),
      getTracks: jest.fn(() => [track]),
    } as unknown as MediaStream,
  };
}

describe('WebRTCConnector', () => {
  it('adds the screen track, creates an offer, and sends it', async () => {
    const peerConnection = createPeerConnection();
    const signaling = {
      sendOffer: jest.fn(),
      sendIceCandidate: jest.fn(),
      onMessage: jest.fn(() => jest.fn()),
    } as unknown as SignalingClient;
    const connector = new WebRTCConnector({
      signaling,
      peerConnectionFactory: () => peerConnection as unknown as PeerConnectionLike,
    });
    const { stream, track } = createStream();

    await connector.shareScreen(stream);

    expect(peerConnection.addTrack).toHaveBeenCalledWith(track, stream);
    expect(peerConnection.createOffer).toHaveBeenCalled();
    expect(peerConnection.setLocalDescription).toHaveBeenCalledWith({
      type: 'offer',
      sdp: 'offer-sdp',
    });
    expect(signaling.sendOffer).toHaveBeenCalledWith({ type: 'offer', sdp: 'offer-sdp' });
  });

  it('rejects sharing when the stream has no video track', async () => {
    const connector = new WebRTCConnector({
      signaling: {} as SignalingClient,
      peerConnectionFactory: () => createPeerConnection() as unknown as PeerConnectionLike,
    });
    const stream = { getVideoTracks: () => [] } as unknown as MediaStream;

    await expect(connector.shareScreen(stream)).rejects.toThrow(/video/i);
  });

  it('stops every sender track when sharing ends', async () => {
    const peerConnection = createPeerConnection();
    const connector = new WebRTCConnector({
      signaling: {} as SignalingClient,
      peerConnectionFactory: () => peerConnection as unknown as PeerConnectionLike,
    });

    connector.stopShare();

    expect(peerConnection.getSenders).toHaveBeenCalled();
    expect(peerConnection.getSenders()[0].track?.stop).toHaveBeenCalled();
  });
});
