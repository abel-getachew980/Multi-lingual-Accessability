import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpHelpClient } from './helpClient';

const URL = 'http://localhost:3000/api/help';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fakeFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;
}

const input = {
  phoneNumber: '+251911111111',
  language: 'am' as const,
  conversationHistory: [
    { role: 'user' as const, content: 'ሕዋስ ምንድን ነው?' },
    { role: 'assistant' as const, content: 'የሕይወት መሠረታዊ አሃድ ነው።' },
  ],
};

test('posts the help request with channel, language and history', async () => {
  let captured: { url: string; init?: RequestInit } | undefined;

  const client = new HttpHelpClient({
    url: URL,
    timeoutMs: 1_000,
    fetchImpl: fakeFetch(async (url, init) => {
      captured = { url, init };
      return jsonResponse({ requestId: 'help-42', status: 'pending' });
    }),
  });

  const result = await client.requestHelp(input);

  assert.equal(captured?.url, URL);
  assert.equal(captured?.init?.method, 'POST');
  assert.equal(
    (captured?.init?.headers as Record<string, string>)['Content-Type'],
    'application/json',
  );

  const body = JSON.parse(String(captured?.init?.body));
  assert.equal(body.userId, 'sms:+251911111111');
  assert.equal(body.channel, 'sms');
  assert.equal(body.phoneNumber, '+251911111111');
  assert.equal(body.language, 'am');
  assert.deepEqual(body.conversationHistory, input.conversationHistory);

  assert.deepEqual(result, { requestId: 'help-42', status: 'pending' });
});

test('accepts an id field as the request identifier', async () => {
  const client = new HttpHelpClient({
    url: URL,
    timeoutMs: 1_000,
    fetchImpl: fakeFetch(async () => jsonResponse({ id: 'ticket-7' })),
  });

  const result = await client.requestHelp(input);
  assert.equal(result.requestId, 'ticket-7');
});

test('generates a fallback request id when the API omits one', async () => {
  const client = new HttpHelpClient({
    url: URL,
    timeoutMs: 1_000,
    fetchImpl: fakeFetch(async () => jsonResponse({ success: true })),
  });

  const result = await client.requestHelp(input);
  assert.match(result.requestId, /^sms-help-\d+$/);
});

test('throws when the help API responds with an error status', async () => {
  const client = new HttpHelpClient({
    url: URL,
    timeoutMs: 1_000,
    fetchImpl: fakeFetch(async () => jsonResponse({}, 503)),
  });

  await assert.rejects(() => client.requestHelp(input), /responded with 503/);
});

test('throws when the help API rejects the request', async () => {
  const client = new HttpHelpClient({
    url: URL,
    timeoutMs: 1_000,
    fetchImpl: fakeFetch(async () => jsonResponse({ success: false })),
  });

  await assert.rejects(() => client.requestHelp(input), /rejected/);
});

test('aborts and reports a timeout', async () => {
  const client = new HttpHelpClient({
    url: URL,
    timeoutMs: 20,
    fetchImpl: fakeFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    ),
  });

  await assert.rejects(() => client.requestHelp(input), /timed out/);
});
