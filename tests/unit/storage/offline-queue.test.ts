import { MemoryStore, OfflineQueue } from '@/services/storage';

/**
 * Minimal stand-in for `Response`: the jsdom test environment does not always
 * expose the Fetch API, and the queue only needs these three members.
 */
function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function setup(
  fetchImpl: typeof fetch,
  options: Partial<ConstructorParameters<typeof OfflineQueue>[1]> = {},
) {
  let now = 1_000;
  const store = new MemoryStore();
  const queue = new OfflineQueue(store, {
    fetchImpl,
    now: () => now,
    ...options,
  });

  return {
    queue,
    store,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('OfflineQueue', () => {
  it('enqueues requests with a stable shape and lists them oldest-first', async () => {
    const { queue, advance } = setup(jest.fn() as unknown as typeof fetch);

    const first = await queue.enqueue({ url: '/api/ai/query', body: '{"q":1}' });
    advance(10);
    const second = await queue.enqueue({ url: '/api/help', method: 'post' });

    expect(first.id).not.toEqual(second.id);
    expect(first.method).toBe('POST');
    expect(first.attempts).toBe(0);
    expect(second.method).toBe('POST');
    expect((await queue.list()).map((item) => item.id)).toEqual([first.id, second.id]);
    expect(await queue.size()).toBe(2);
  });

  it('sends queued requests, returns their bodies and removes them', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ answer: 'Saved answer' }));
    const { queue } = setup(fetchMock as unknown as typeof fetch);

    await queue.enqueue({
      url: '/api/ai/query',
      headers: { 'Content-Type': 'application/json' },
      body: '{"question":"hi"}',
    });

    const result = await queue.sync();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/query',
      expect.objectContaining({ method: 'POST', body: '{"question":"hi"}' }),
    );
    expect(result.sent).toHaveLength(1);
    expect(JSON.parse(result.sent[0].body)).toEqual({ answer: 'Saved answer' });
    expect(await queue.size()).toBe(0);
  });

  it('keeps a request and records the attempt after a server error', async () => {
    const { queue } = setup((async () => jsonResponse({}, 503)) as unknown as typeof fetch);

    const queued = await queue.enqueue({ url: '/api/ai/query', body: '{}' });
    const result = await queue.sync();

    const remaining = await queue.list();
    expect(result.failed).toEqual([queued.id]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].attempts).toBe(1);
    expect(remaining[0].lastError).toBe('HTTP 503');
  });

  it('drops a request the server permanently rejects', async () => {
    const { queue } = setup((async () => jsonResponse({}, 400)) as unknown as typeof fetch);

    const queued = await queue.enqueue({ url: '/api/ai/query', body: '{}' });
    const result = await queue.sync();

    expect(result.dropped).toEqual([queued.id]);
    expect(await queue.size()).toBe(0);
  });

  it('retries 429 instead of dropping it', async () => {
    const { queue } = setup((async () => jsonResponse({}, 429)) as unknown as typeof fetch);

    const queued = await queue.enqueue({ url: '/api/ai/query', body: '{}' });
    await queue.sync();

    expect(await queue.size()).toBe(1);
    expect((await queue.list())[0].id).toBe(queued.id);
  });

  it('drops a request after the attempt limit', async () => {
    let calls = 0;
    const { queue } = setup(
      (async () => {
        calls += 1;
        return jsonResponse({}, 500);
      }) as unknown as typeof fetch,
      { maxAttempts: 2 },
    );

    await queue.enqueue({ url: '/api/ai/query', body: '{}' });

    const first = await queue.sync();
    expect(first.failed).toHaveLength(1);

    const second = await queue.sync();
    expect(second.dropped).toHaveLength(1);
    expect(await queue.size()).toBe(0);
    expect(calls).toBe(2);
  });

  it('keeps the request when the network itself fails', async () => {
    const { queue } = setup(
      (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch,
    );

    await queue.enqueue({ url: '/api/ai/query', body: '{}' });
    const result = await queue.sync();

    expect(result.failed).toHaveLength(1);
    expect((await queue.list())[0].lastError).toBe('network down');
  });

  it('bounds the queue by dropping the oldest entries', async () => {
    const { queue, advance } = setup(jest.fn() as unknown as typeof fetch, { maxItems: 2 });

    const first = await queue.enqueue({ url: '/api/ai/query', body: '{"n":1}' });
    advance(1);
    const second = await queue.enqueue({ url: '/api/ai/query', body: '{"n":2}' });
    advance(1);
    const third = await queue.enqueue({ url: '/api/ai/query', body: '{"n":3}' });

    expect((await queue.list()).map((item) => item.id)).toEqual([second.id, third.id]);
    expect((await queue.list()).some((item) => item.id === first.id)).toBe(false);
  });

  it('clears the queue on request', async () => {
    const { queue } = setup(jest.fn() as unknown as typeof fetch);

    await queue.enqueue({ url: '/api/ai/query', body: '{}' });
    await queue.clear();

    expect(await queue.size()).toBe(0);
  });

  it('rejects requests without a URL', async () => {
    const { queue } = setup(jest.fn() as unknown as typeof fetch);
    await expect(queue.enqueue({ url: '' })).rejects.toThrow(/URL/);
  });
});
