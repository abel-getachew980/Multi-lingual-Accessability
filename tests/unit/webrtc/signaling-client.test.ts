import { SignalingClient } from '@/services/webrtc';

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function makeClient(overrides: Partial<ConstructorParameters<typeof SignalingClient>[0]> = {}) {
  const fetchImpl = jest.fn();
  const onSignal = jest.fn();
  const onError = jest.fn();

  const client = new SignalingClient({
    requestId: 'help-1',
    role: 'learner',
    baseUrl: 'http://localhost/',
    fetchImpl: fetchImpl as unknown as typeof fetch,
    onSignal,
    onError,
    pollIntervalMs: 1_000,
    ...overrides,
  });

  return { client, fetchImpl, onSignal, onError };
}

describe('SignalingClient', () => {
  it('posts a signal with the request id and role', async () => {
    const { client, fetchImpl } = makeClient();
    fetchImpl.mockResolvedValue(response({ success: true, id: 1 }));

    await client.send('offer', { sdp: 'v=0' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost/api/help/signal');
    expect(init).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual({
      requestId: 'help-1',
      role: 'learner',
      type: 'offer',
      payload: { sdp: 'v=0' },
    });
  });

  it('throws when the signal cannot be sent', async () => {
    const { client, fetchImpl } = makeClient();
    fetchImpl.mockResolvedValue(response({}, false, 403));

    await expect(client.send('answer', {})).rejects.toThrow('403');
  });

  it('reads new signals and advances the cursor', async () => {
    const { client, fetchImpl, onSignal } = makeClient();
    fetchImpl.mockResolvedValue(
      response({
        success: true,
        messages: [
          {
            id: 4,
            role: 'tutor',
            type: 'answer',
            payload: { sdp: 'answer' },
            createdAt: 1,
          },
          {
            id: 6,
            role: 'tutor',
            type: 'ice-candidate',
            payload: { candidate: 'abc' },
            createdAt: 2,
          },
        ],
        nextSince: 6,
      }),
    );

    const messages = await client.pollOnce();

    expect(onSignal).toHaveBeenCalledTimes(2);
    expect(messages.map((message) => message.id)).toEqual([4, 6]);
    expect(client.getNextSince()).toBe(6);

    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain('requestId=help-1');
    expect(url).toContain('role=learner');
    expect(url).toContain('since=0');
  });

  it('keeps the cursor when the response is empty or malformed', async () => {
    const { client, fetchImpl, onSignal } = makeClient();
    fetchImpl.mockResolvedValue(response({ success: true }));

    expect(await client.pollOnce()).toEqual([]);
    expect(onSignal).not.toHaveBeenCalled();
    expect(client.getNextSince()).toBe(0);
  });

  it('reports poll failures without throwing', async () => {
    const { client, fetchImpl, onError } = makeClient();
    fetchImpl.mockRejectedValue(new Error('offline'));

    await expect(client.pollOnce()).resolves.toEqual([]);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('offline');
  });

  it('reports a non-ok poll response', async () => {
    const { client, fetchImpl, onError } = makeClient();
    fetchImpl.mockResolvedValue(response({}, false, 500));

    await client.pollOnce();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toContain('500');
  });

  it('does not poll after stop', async () => {
    jest.useFakeTimers();
    const { client, fetchImpl } = makeClient();
    fetchImpl.mockResolvedValue(response({ success: true, messages: [] }));

    try {
      client.start();
      client.stop();
      jest.advanceTimersByTime(10_000);

      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
