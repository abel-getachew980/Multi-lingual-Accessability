/** @jest-environment jsdom */

import { SignalingClient, type SignalingSocket } from '@/services/webrtc/SignalingClient';

function createSocket() {
  const socket: SignalingSocket = {
    readyState: 0,
    send: jest.fn(),
    close: jest.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  };
  return socket;
}

describe('SignalingClient', () => {
  it('opens a websocket and resolves when connected', async () => {
    const socket = createSocket();
    const client = new SignalingClient('ws://localhost:3001', () => socket);

    const connected = client.connect();
    socket.readyState = 1;
    socket.onopen?.(new Event('open'));

    await expect(connected).resolves.toBeUndefined();
  });

  it('serializes offer and ICE messages', async () => {
    const socket = createSocket();
    socket.readyState = 1;
    const client = new SignalingClient('ws://localhost:3001', () => socket);
    await client.connect();

    client.sendOffer({ type: 'offer', sdp: 'offer-sdp' });
    client.sendIceCandidate({ candidate: 'candidate-1' });

    expect(socket.send).toHaveBeenNthCalledWith(1, JSON.stringify({
      type: 'offer',
      sdp: { type: 'offer', sdp: 'offer-sdp' },
    }));
    expect(socket.send).toHaveBeenNthCalledWith(2, JSON.stringify({
      type: 'ice-candidate',
      candidate: { candidate: 'candidate-1' },
    }));
  });

  it('delivers parsed incoming messages', async () => {
    const socket = createSocket();
    socket.readyState = 1;
    const client = new SignalingClient('ws://localhost:3001', () => socket);
    await client.connect();
    const listener = jest.fn();
    client.onMessage(listener);

    socket.onmessage?.({ data: JSON.stringify({ type: 'answer', sdp: { type: 'answer', sdp: 'x' } }) } as MessageEvent);

    expect(listener).toHaveBeenCalledWith({ type: 'answer', sdp: { type: 'answer', sdp: 'x' } });
  });
});
