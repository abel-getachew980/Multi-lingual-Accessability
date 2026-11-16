import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpHelpClient } from './helpClient';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

type Call = { url: string; init: RequestInit | undefined };

function fakeFetch(
  handler: () => Response | Promise<Response>,
): typeof fetch & { calls: Call[] } {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler();
  }) as typeof fetch & { calls: Call[] };

  impl.calls = calls;
  return impl;
}

function makeClient(fetchImpl: typeof fetch) {
  return new HttpHelpClient({
    url: 'http://localhost:3000/api/help',
    timeoutMs: 1_000,
    fetchImpl,
  });
}

test('requests help with the telegram channel and chat id', async () => {
  const fetchImpl = fakeFetch(() =>
    jsonResponse({
      success: true,
      requestId: 'help-1',
      status: 'pending',
      position: 2,
      estimatedWaitMinutes: 4,
    }),
  );
  const client = makeClient(fetchImpl);

  const result = await client.requestHelp({
    chatId: '99',
    language: 'am',
    conversationHistory: [{ role: 'user', content: 'ሰላም' }],
  });

  assert.deepEqual(result, {
    requestId: 'help-1',
    status: 'pending',
    position: 2,
    estimatedWaitMinutes: 4,
  });

  const init = fetchImpl.calls[0].init;
  assert.equal(fetchImpl.calls[0].url, 'http://localhost:3000/api/help');
  assert.equal(init?.method, 'POST');
  assert.equal(init?.cache, 'no-store');
  assert.deepEqual(JSON.parse(String(init?.body)), {
    userId: 'telegram:99',
    channel: 'telegram',
    language: 'am',
    conversationHistory: [{ role: 'user', content: 'ሰላም' }],
  });
});

test('accepts the legacy id field as the request id', async () => {
  const fetchImpl = fakeFetch(() =>
    jsonResponse({ success: true, id: 'help-legacy', status: 'pending' }),
  );
  const client = makeClient(fetchImpl);

  const result = await client.requestHelp({
    chatId: '99',
    language: 'en',
    conversationHistory: [],
  });

  assert.equal(result.requestId, 'help-legacy');
});

test('fails when the help desk returns no request id', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ success: true }));
  const client = makeClient(fetchImpl);

  await assert.rejects(
    () =>
      client.requestHelp({ chatId: '99', language: 'en', conversationHistory: [] }),
    /did not return a request id/,
  );
});

test('fails when the help desk rejects the request', async () => {
  const fetchImpl = fakeFetch(() =>
    jsonResponse({ success: false, error: { message: 'cooldown' } }),
  );
  const client = makeClient(fetchImpl);

  await assert.rejects(
    () =>
      client.requestHelp({ chatId: '99', language: 'en', conversationHistory: [] }),
    /rejected the request/,
  );
});

test('reads the status by id', async () => {
  const fetchImpl = fakeFetch(() =>
    jsonResponse({
      success: true,
      id: 'help 1',
      status: 'connected',
      position: 0,
    }),
  );
  const client = makeClient(fetchImpl);

  const result = await client.getStatus('help 1');

  assert.deepEqual(result, {
    requestId: 'help 1',
    status: 'connected',
    position: 0,
    estimatedWaitMinutes: undefined,
  });
  assert.equal(
    fetchImpl.calls[0].url,
    'http://localhost:3000/api/help?id=help%201',
  );
  assert.equal(fetchImpl.calls[0].init?.method, 'GET');
});

test('cancels by id', async () => {
  const fetchImpl = fakeFetch(() =>
    jsonResponse({ success: true, id: 'help-1', status: 'cancelled' }),
  );
  const client = makeClient(fetchImpl);

  const result = await client.cancel('help-1');

  assert.equal(result.status, 'cancelled');
  assert.equal(fetchImpl.calls[0].init?.method, 'DELETE');
});

test('rejects a status response without an id', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ success: true }));
  const client = makeClient(fetchImpl);

  await assert.rejects(() => client.getStatus('help-1'), /did not return a status/);
});

test('rejects a non-ok response', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({}, false, 503));
  const client = makeClient(fetchImpl);

  await assert.rejects(() => client.cancel('help-1'), /responded with 503/);
});

test('reports an aborted request as a timeout', async () => {
  const fetchImpl = fakeFetch(() => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });
  const client = makeClient(fetchImpl);

  await assert.rejects(
    () =>
      client.requestHelp({ chatId: '1', language: 'en', conversationHistory: [] }),
    /timed out after 1000 ms/,
  );
});
