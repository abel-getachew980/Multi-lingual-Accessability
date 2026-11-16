import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpTelegramApi,
  TELEGRAM_MAX_MESSAGE_LENGTH,
  splitMessage,
} from './telegramClient';
import { TelegramApiError } from './types';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

type Call = { url: string; init: RequestInit | undefined };

function fakeFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch & { calls: Call[] } {
  const calls: Call[] = [];

  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch & { calls: Call[] };

  impl.calls = calls;
  return impl;
}

function makeApi(fetchImpl: typeof fetch, maxMessageLength?: number) {
  return new HttpTelegramApi({
    token: '123:abc',
    baseUrl: 'https://api.telegram.org/',
    fetchImpl,
    maxMessageLength,
    timeoutMs: 1_000,
  });
}

function bodyOf(call: Call): Record<string, unknown> {
  return JSON.parse(String(call.init?.body));
}

test('splitMessage leaves short text alone', () => {
  assert.deepEqual(splitMessage('ሰላም!'), ['ሰላም!']);
  assert.deepEqual(splitMessage('  hello  '), ['hello']);
  assert.deepEqual(splitMessage('   '), []);
});

test('splitMessage respects the maximum length', () => {
  const text = Array.from({ length: 200 }, (_, index) => `word${index}`).join(' ');

  const chunks = splitMessage(text, 100);

  assert.ok(chunks.length > 1);
  chunks.forEach((chunk) => assert.ok(chunk.length <= 100));
  assert.equal(chunks.join(' '), text);
});

test('splitMessage prefers paragraph breaks', () => {
  const text = `${'a'.repeat(60)}\n\n${'b'.repeat(60)}`;

  const chunks = splitMessage(text, 100);

  assert.deepEqual(chunks, ['a'.repeat(60), 'b'.repeat(60)]);
});

test('splitMessage still splits a single very long word', () => {
  const chunks = splitMessage('x'.repeat(250), 100);

  assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 100, 50]);
});

test('sendMessage posts once per chunk and keeps the markup on the last one', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ ok: true, result: {} }));
  const api = makeApi(fetchImpl, 12);

  await api.sendMessage(42, 'one two three four five', {
    reply_markup: { inline_keyboard: [[{ text: 'Menu', callback_data: 'menu:ask' }]] },
  });

  assert.ok(fetchImpl.calls.length > 1);
  fetchImpl.calls.forEach((call) => {
    assert.equal(call.url, 'https://api.telegram.org/bot123:abc/sendMessage');
    assert.equal(call.init?.method, 'POST');
    assert.equal(bodyOf(call).chat_id, 42);
  });

  const bodies = fetchImpl.calls.map(bodyOf);
  bodies.slice(0, -1).forEach((body) => assert.equal(body.reply_markup, undefined));
  assert.deepEqual(bodies[bodies.length - 1].reply_markup, {
    inline_keyboard: [[{ text: 'Menu', callback_data: 'menu:ask' }]],
  });
});

test('sendMessage does nothing for empty text', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ ok: true }));
  const api = makeApi(fetchImpl);

  await api.sendMessage(42, '   ');

  assert.equal(fetchImpl.calls.length, 0);
});

test('sendMessage forwards the silent notification flag', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ ok: true }));
  const api = makeApi(fetchImpl);

  await api.sendMessage(42, 'hi', { disable_notification: true });

  assert.equal(bodyOf(fetchImpl.calls[0]).disable_notification, true);
});

test('a Telegram error body becomes a TelegramApiError', async () => {
  const fetchImpl = fakeFetch(() =>
    jsonResponse(
      {
        ok: false,
        error_code: 400,
        description: 'Bad Request: chat not found',
      },
      true,
      200,
    ),
  );
  const api = makeApi(fetchImpl);

  await assert.rejects(
    () => api.sendMessage(42, 'hi'),
    (error: unknown) => {
      assert.ok(error instanceof TelegramApiError);
      assert.equal(error.method, 'sendMessage');
      assert.equal(error.status, 400);
      assert.match(error.message, /chat not found/);
      return true;
    },
  );
});

test('a non-JSON failure still surfaces the status', async () => {
  const fetchImpl = fakeFetch(
    () =>
      ({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      }) as unknown as Response,
  );
  const api = makeApi(fetchImpl);

  await assert.rejects(
    () => api.sendMessage(42, 'hi'),
    /responded with 502/,
  );
});

test('getUpdates uses a long-poll timeout', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ ok: true, result: [] }));
  const api = makeApi(fetchImpl);

  const updates = await api.getUpdates(17, 30);

  assert.deepEqual(updates, []);
  assert.equal(fetchImpl.calls[0].url, 'https://api.telegram.org/bot123:abc/getUpdates');
  assert.deepEqual(bodyOf(fetchImpl.calls[0]), {
    offset: 17,
    timeout: 30,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
  });
});

test('getUpdates returns the result array', async () => {
  const fetchImpl = fakeFetch(() =>
    jsonResponse({
      ok: true,
      result: [{ update_id: 3, message: null }],
    }),
  );
  const api = makeApi(fetchImpl);

  const updates = await api.getUpdates(0, 1);

  assert.equal(updates.length, 1);
  assert.equal(updates[0].update_id, 3);
});

test('setWebhook includes the secret only when configured', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ ok: true }));
  const api = makeApi(fetchImpl);

  await api.setWebhook('https://example.com/telegram', 'shh');
  await api.setWebhook('https://example.com/telegram');

  assert.deepEqual(bodyOf(fetchImpl.calls[0]), {
    url: 'https://example.com/telegram',
    allowed_updates: ['message', 'edited_message', 'callback_query'],
    secret_token: 'shh',
  });
  assert.equal(bodyOf(fetchImpl.calls[1]).secret_token, undefined);
});

test('deleteWebhook, setMyCommands and callback answers reach the API', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ ok: true }));
  const api = makeApi(fetchImpl);

  await api.deleteWebhook(true);
  await api.setMyCommands([{ command: 'start', description: 'Start' }]);
  await api.answerCallbackQuery('cb-1', 'Done');
  await api.sendChatAction(42, 'typing');

  assert.equal(
    fetchImpl.calls[0].url,
    'https://api.telegram.org/bot123:abc/deleteWebhook',
  );
  assert.deepEqual(bodyOf(fetchImpl.calls[0]), { drop_pending_updates: true });
  assert.equal(
    fetchImpl.calls[1].url,
    'https://api.telegram.org/bot123:abc/setMyCommands',
  );
  assert.deepEqual(bodyOf(fetchImpl.calls[2]), {
    callback_query_id: 'cb-1',
    text: 'Done',
  });
  assert.deepEqual(bodyOf(fetchImpl.calls[3]), {
    chat_id: 42,
    action: 'typing',
  });
});

test('getFile and downloadFile build the documented URLs', async () => {
  const audio = Buffer.from('ogg-data');
  const fetchImpl = fakeFetch((url) => {
    if (url.includes('/getFile')) {
      return jsonResponse({
        ok: true,
        result: { file_id: 'f1', file_unique_id: 'u1', file_path: 'voice/file_1.ogg' },
      });
    }

    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength,
      ),
    } as unknown as Response;
  });
  const api = makeApi(fetchImpl);

  const file = await api.getFile('f1');
  const downloaded = await api.downloadFile('/voice/file_1.ogg');

  assert.equal(file.file_path, 'voice/file_1.ogg');
  assert.equal(downloaded.toString(), 'ogg-data');
  assert.equal(
    fetchImpl.calls[1].url,
    'https://api.telegram.org/file/bot123:abc/voice/file_1.ogg',
  );
});

test('a failed download is a TelegramApiError', async () => {
  const fetchImpl = fakeFetch(
    () => ({ ok: false, status: 404 }) as unknown as Response,
  );
  const api = makeApi(fetchImpl);

  await assert.rejects(
    () => api.downloadFile('missing.ogg'),
    (error: unknown) => {
      assert.ok(error instanceof TelegramApiError);
      assert.equal(error.status, 404);
      return true;
    },
  );
});

test('an aborted call is reported as a timeout', async () => {
  const fetchImpl = fakeFetch(() => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });
  const api = makeApi(fetchImpl);

  await assert.rejects(() => api.sendMessage(42, 'hi'), /timed out/);
});

test('the default message limit matches Telegram', () => {
  assert.equal(TELEGRAM_MAX_MESSAGE_LENGTH, 4_096);
});
