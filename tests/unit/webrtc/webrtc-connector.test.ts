import {
  WebRTCConnector,
  defaultIceServers,
} from '@/services/webrtc';
import type { WebRTCConnectionState } from '@/services/webrtc';

interface FakeTrack {
  id: string;
}

class FakePeer {
  localDescription: RTCSessionDescriptionInit | null = null;
  connectionState: RTCPeerConnectionState = 'new';
  senders: Array<{ track: FakeTrack | null }> = [];

  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null = null;
  ontrack: ((event: { streams: MediaStream[]; track: FakeTrack }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  addTrack = jest.fn((track: FakeTrack) => {
    this.senders.push({ track });
  });

  getSenders = jest.fn(() => this.senders);

  createOffer = jest.fn(async () => ({ type: 'offer' as const, sdp: 'offer-sdp' }));

  createAnswer = jest.fn(async () => ({
    type: 'answer' as const,
    sdp: 'answer-sdp',
  }));

  setLocalDescription = jest.fn(
    async (description: RTCSessionDescriptionInit) => {
      this.localDescription = description;
    },
  );

  setRemoteDescription = jest.fn(async () => undefined);

  addIceCandidate = jest.fn(async () => undefined);

  close = jest.fn();

  changeConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

function makeStream(...ids: string[]) {
  const tracks = ids.map((id) => ({ id })) as unknown as MediaStreamTrack[];
  const stream = {
    getTracks: () => tracks,
  } as unknown as MediaStream;

  return { stream, tracks };
}

function makeConnector(peer = new FakePeer()) {
  const states: WebRTCConnectionState[] = [];
  const errors: Error[] = [];

  const connector = new WebRTCConnector({
    peerConnectionFactory: () => peer as unknown as RTCPeerConnection,
    iceServers: [{ urls: 'stun:test.invalid' }],
    onStateChange: (state) => states.push(state),
    onError: (error) => errors.push(error),
  });

  return { connector, peer, states, errors };
}

describe('defaultIceServers', () => {
  const original = process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS;
    } else {
      process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS = original;
    }
  });

  it('falls back to a public STUN server', () => {
    delete process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS;

    expect(defaultIceServers()).toEqual([
      { urls: 'stun:stun.l.google.com:19302' },
    ]);
  });

  it('reads a comma separated list, including TURN', () => {
    process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS =
      'stun:a.example, turn:turn.example:3478 ';

    expect(defaultIceServers()).toEqual([
      { urls: 'stun:a.example' },
      { urls: 'turn:turn.example:3478' },
    ]);
  });
});

describe('WebRTCConnector', () => {
  it('creates an offer, stores it locally and reports connecting', async () => {
    const { connector, peer, states } = makeConnector();

    const offer = await connector.createOffer();

    expect(peer.createOffer).toHaveBeenCalledTimes(1);
    expect(peer.setLocalDescription).toHaveBeenCalledWith(offer);
    expect(offer).toEqual({ type: 'offer', sdp: 'offer-sdp' });
    expect(states).toContain('connecting');
  });

  it('adds the screen share tracks once', async () => {
    const { connector, peer } = makeConnector();
    const { stream, tracks } = makeStream('video-1', 'audio-1');

    connector.addStream(stream);
    connector.addStream(stream);

    expect(peer.addTrack).toHaveBeenCalledTimes(2);
    expect(peer.addTrack).toHaveBeenNthCalledWith(1, tracks[0], stream);
    expect(peer.addTrack).toHaveBeenNthCalledWith(2, tracks[1], stream);
  });

  it('follows the peer connection state', async () => {
    const { connector, peer, states } = makeConnector();

    await connector.createOffer();
    peer.changeConnectionState('connected');
    peer.changeConnectionState('disconnected');
    peer.changeConnectionState('connected');

    expect(connector.getState()).toBe('connected');
    expect(states).toEqual(['connecting', 'connected', 'disconnected', 'connected']);
  });

  it('answers a remote offer', async () => {
    const { connector, peer } = makeConnector();

    await connector.acceptOffer({ type: 'offer', sdp: 'remote' });
    const answer = await connector.createAnswer();

    expect(peer.setRemoteDescription).toHaveBeenCalledWith({
      type: 'offer',
      sdp: 'remote',
    });
    expect(answer).toEqual({ type: 'answer', sdp: 'answer-sdp' });
    expect(peer.localDescription).toBe(answer);
  });

  it('accepts the remote answer', async () => {
    const { connector, peer } = makeConnector();

    await connector.acceptAnswer({ type: 'answer', sdp: 'remote-answer' });

    expect(peer.setRemoteDescription).toHaveBeenCalledWith({
      type: 'answer',
      sdp: 'remote-answer',
    });
  });

  it('passes local ICE candidates to the signaling callback', async () => {
    const candidate = {
      toJSON: () => ({ candidate: 'candidate:1', sdpMid: '0' }),
    } as unknown as RTCIceCandidate;
    const onIceCandidate = jest.fn();

    const connector = new WebRTCConnector({
      peerConnectionFactory: () => new FakePeer() as unknown as RTCPeerConnection,
      onIceCandidate,
    });

    await connector.createOffer();
    const peer = (connector as unknown as { peer: FakePeer }).peer;
    peer.onicecandidate?.({ candidate });

    expect(onIceCandidate).toHaveBeenCalledWith({
      candidate: 'candidate:1',
      sdpMid: '0',
    });
  });

  it('ignores a null ICE candidate and forwards remote tracks', async () => {
    const onRemoteStream = jest.fn();
    const connector = new WebRTCConnector({
      peerConnectionFactory: () => new FakePeer() as unknown as RTCPeerConnection,
      onRemoteStream,
    });

    await connector.createOffer();
    const peer = (connector as unknown as { peer: FakePeer }).peer;
    peer.onicecandidate?.({ candidate: null });

    const { stream } = makeStream('remote-video');
    peer.ontrack?.({ streams: [stream], track: { id: 'remote-video' } });

    expect(onRemoteStream).toHaveBeenCalledWith(stream);
  });

  it('treats a failed ICE candidate as non fatal', async () => {
    const { connector, peer, errors } = makeConnector();
    peer.addIceCandidate = jest.fn(async () => {
      throw new Error('too early');
    });

    await expect(
      connector.addIceCandidate({ candidate: 'candidate:1' }),
    ).resolves.toBeUndefined();

    expect(errors[0]?.message).toBe('too early');
  });

  it('reports a failed handshake and rethrows', async () => {
    const { connector, peer, states, errors } = makeConnector();
    peer.createOffer = jest.fn(async () => {
      throw new Error('no codec');
    });

    await expect(connector.createOffer()).rejects.toThrow('no codec');

    expect(connector.getState()).toBe('failed');
    expect(states).toContain('failed');
    expect(errors[0]?.message).toBe('no codec');
  });

  it('closes the peer connection only once', async () => {
    const { connector, peer, states } = makeConnector();

    await connector.createOffer();
    connector.close();
    connector.close();

    expect(peer.close).toHaveBeenCalledTimes(1);
    expect(peer.onicecandidate).toBeNull();
    expect(peer.ontrack).toBeNull();
    expect(peer.onconnectionstatechange).toBeNull();
    expect(states.filter((state) => state === 'closed')).toHaveLength(1);
  });
});
