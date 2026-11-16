import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpAiClient } from './aiClient';

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
  return new HttpAiClient({
    url: 'http://localhost:3000/api/ai',
    provider: 'offline',
    timeoutMs: 1_000,
    fetchImpl,
  });
}

test('posts the question, language and provider', async () => {
  const fetchImpl = fakeFetch(() =>
    jsonResponse({ answer: ' A cell is the unit of life. ', provider: 'offline' }),
  );
  const client = makeClient(fetchImpl);

  const answer = await client.ask('What is a cell?', 'en');

  assert.equal(answer.answer, 'A cell is the unit of life.');
  assert.equal(answer.provider, 'offline');

  const init = fetchImpl.calls[0].init;
  assert.equal(fetchImpl.calls[0].url, 'http://localhost:3000/api/ai');
  assert.equal(init?.method, 'POST');
  assert.equal((init?.headers as Record<string, string>)['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(String(init?.body)), {
    question: 'What is a cell?',
    language: 'en',
    provider: 'offline',
  });
});

test('turns history into timestamped conversation turns', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ answer: 'Yes.' }));
  const client = makeClient(fetchImpl);

  await client.ask('And the nucleus?', 'am', [
    { role: 'user', content: 'ሴል ምንድን ነው?' },
    { role: 'assistant', content: 'የሕይወት መሠረታዊ አካል ነው።' },
  ]);

  const body = JSON.parse(String(fetchImpl.calls[0].init?.body));
  assert.equal(body.conversationHistory.length, 2);
  assert.deepEqual(
    body.conversationHistory.map((turn: Record<string, unknown>) => ({
      role: turn.role,
      content: turn.content,
      language: turn.language,
    })),
    [
      { role: 'user', content: 'ሴል ምንድን ነው?', language: 'am' },
      { role: 'assistant', content: 'የሕይወት መሠረታዊ አካል ነው።', language: 'am' },
    ],
  );
  body.conversationHistory.forEach((turn: Record<string, unknown>) => {
    assert.equal(typeof turn.id, 'string');
    assert.equal(typeof turn.timestamp, 'string');
  });
});

test('omits the history field when there is no history', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ answer: 'Yes.' }));
  const client = makeClient(fetchImpl);

  await client.ask('Question', 'en', []);

  const body = JSON.parse(String(fetchImpl.calls[0].init?.body));
  assert.equal('conversationHistory' in body, false);
});

test('keeps the citation returned by the API', async () => {
  const citation = { source: 'Biology Grade 9.pdf', page: 12 };
  const fetchImpl = fakeFetch(() => jsonResponse({ answer: 'Answer', citation }));
  const client = makeClient(fetchImpl);

  const answer = await client.ask('Question', 'en');

  assert.deepEqual(answer.citation, citation);
});

test('rejects a failed API response', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({}, false, 500));
  const client = makeClient(fetchImpl);

  await assert.rejects(() => client.ask('Question', 'en'), /responded with 500/);
});

test('rejects an empty answer instead of sending a blank bubble', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ answer: '   ' }));
  const client = makeClient(fetchImpl);

  await assert.rejects(() => client.ask('Question', 'en'), /empty answer/);
});

test('rejects a response without an answer field', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ success: true }));
  const client = makeClient(fetchImpl);

  await assert.rejects(() => client.ask('Question', 'en'), /empty answer/);
});

test('reports an aborted request as a timeout', async () => {
  const fetchImpl = fakeFetch(() => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });
  const client = makeClient(fetchImpl);

  await assert.rejects(() => client.ask('Question', 'en'), /timed out after 1000 ms/);
});
