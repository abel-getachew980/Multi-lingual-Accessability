import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceHandler } from './voiceHandler';
import type { TelegramFile, TelegramVoice } from './types';

const VOICE: TelegramVoice = {
  file_id: 'voice-1',
  file_unique_id: 'unique-1',
  duration: 5,
  mime_type: 'audio/ogg',
  file_size: 1_024,
};

function fakeDownloader(file: TelegramFile = {
  file_id: 'voice-1',
  file_unique_id: 'unique-1',
  file_path: 'voice/file_1.ogg',
  file_size: 1_024,
}) {
  const calls = { getFile: 0, downloadFile: [] as string[] };

  return {
    calls,
    client: {
      async getFile() {
        calls.getFile += 1;
        return file;
      },
      async downloadFile(path: string) {
        calls.downloadFile.push(path);
        return Buffer.from('audio-bytes');
      },
    },
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

function makeHandler(
  options: {
    client?: ReturnType<typeof fakeDownloader>['client'];
    fetchImpl?: typeof fetch;
    transcription?: { url: string; model?: string; language?: string; timeoutMs: number };
    maxSeconds?: number;
    maxBytes?: number;
    onError?: (error: unknown, voice: TelegramVoice) => void;
  } = {},
) {
  const downloader = options.client ? { client: options.client } : fakeDownloader();

  const handler = new VoiceHandler({
    client: options.client ?? downloader.client,
    transcription: options.transcription,
    maxSeconds: options.maxSeconds ?? 120,
    maxBytes: options.maxBytes ?? 5 * 1024 * 1024,
    fetchImpl: options.fetchImpl,
    onError: options.onError,
  });

  return { handler, client: options.client ?? downloader.client };
}

test('reports when transcription is not configured', async () => {
  const { handler } = makeHandler();

  assert.equal(handler.isConfigured(), false);
  assert.deepEqual(await handler.transcribe(VOICE, 'am'), {
    ok: false,
    reason: 'unavailable',
  });
});

test('rejects a voice note that is too long before downloading it', async () => {
  let calls = 0;
  const tracked = {
    async getFile() {
      calls += 1;
      return {
        file_id: 'voice-1',
        file_unique_id: 'unique-1',
        file_path: 'voice/file_1.ogg',
      };
    },
    async downloadFile() {
      throw new Error('should not download');
    },
  };

  const { handler } = makeHandler({
    client: tracked,
    transcription: { url: 'https://asr.example/v1', timeoutMs: 1_000 },
    maxSeconds: 10,
  });

  const result = await handler.transcribe({ ...VOICE, duration: 11 }, 'en');

  assert.deepEqual(result, { ok: false, reason: 'too-long' });
  assert.equal(calls, 0);
});

test('rejects a voice note that is too large', async () => {
  const { handler } = makeHandler({
    transcription: { url: 'https://asr.example/v1', timeoutMs: 1_000 },
    maxBytes: 500,
  });

  assert.deepEqual(await handler.transcribe(VOICE, 'en'), {
    ok: false,
    reason: 'too-large',
  });
});

test('rejects a file that grew after the update', async () => {
  const downloader = fakeDownloader({
    file_id: 'voice-1',
    file_unique_id: 'unique-1',
    file_path: 'voice/file_1.ogg',
    file_size: 10_000,
  });
  const { handler } = makeHandler({
    client: downloader.client,
    transcription: { url: 'https://asr.example/v1', timeoutMs: 1_000 },
    maxBytes: 5_000,
  });

  assert.deepEqual(await handler.transcribe(VOICE, 'en'), {
    ok: false,
    reason: 'too-large',
  });
  assert.deepEqual(downloader.calls.downloadFile, []);
});

test('fails cleanly when Telegram returns no file path', async () => {
  const errors: unknown[] = [];
  const downloader = fakeDownloader({
    file_id: 'voice-1',
    file_unique_id: 'unique-1',
  });
  const { handler } = makeHandler({
    client: downloader.client,
    transcription: { url: 'https://asr.example/v1', timeoutMs: 1_000 },
    onError: (error) => errors.push(error),
  });

  assert.deepEqual(await handler.transcribe(VOICE, 'am'), {
    ok: false,
    reason: 'failed',
  });
  assert.equal(errors.length, 1);
});

test('transcribes a downloaded voice note', async () => {
  const downloader = fakeDownloader();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return jsonResponse({ text: ' ሴል ምንድን ነው? ' });
  }) as typeof fetch;

  const { handler } = makeHandler({
    client: downloader.client,
    transcription: {
      url: 'https://asr.example/v1/audio/transcriptions',
      model: 'whisper-1',
      timeoutMs: 1_000,
    },
    fetchImpl,
  });

  const result = await handler.transcribe(VOICE, 'am');

  assert.deepEqual(result, { ok: true, text: 'ሴል ምንድን ነው?' });
  assert.deepEqual(downloader.calls.downloadFile, ['voice/file_1.ogg']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://asr.example/v1/audio/transcriptions');
  assert.equal(calls[0].init?.method, 'POST');

  const form = calls[0].init?.body as FormData;
  assert.ok(form instanceof FormData);
  assert.equal(form.get('model'), 'whisper-1');
  assert.equal(form.get('language'), 'am');
  assert.equal(form.get('response_format'), 'json');
});

test('uses the configured language hint over the chat language', async () => {
  const calls: RequestInit[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    calls.push(init ?? {});
    return jsonResponse({ text: 'ok' });
  }) as typeof fetch;

  const { handler } = makeHandler({
    transcription: {
      url: 'https://asr.example/v1',
      language: 'en',
      timeoutMs: 1_000,
    },
    fetchImpl,
  });

  await handler.transcribe(VOICE, 'am');

  assert.equal((calls[0].body as FormData).get('language'), 'en');
});

test('accepts a transcript field and rejects an empty transcript', async () => {
  const transcripts = ['From the transcript', '   '];
  const fetchImpl = (async () =>
    jsonResponse({ transcript: transcripts.shift() })) as typeof fetch;

  const { handler } = makeHandler({
    transcription: { url: 'https://asr.example/v1', timeoutMs: 1_000 },
    fetchImpl,
  });

  assert.deepEqual(await handler.transcribe(VOICE, 'en'), {
    ok: true,
    text: 'From the transcript',
  });
  assert.deepEqual(await handler.transcribe(VOICE, 'en'), {
    ok: false,
    reason: 'empty',
  });
});

test('turns a failed transcription request into a failure result', async () => {
  const errors: unknown[] = [];
  const fetchImpl = (async () => jsonResponse({}, false, 500)) as typeof fetch;

  const { handler } = makeHandler({
    transcription: { url: 'https://asr.example/v1', timeoutMs: 1_000 },
    fetchImpl,
    onError: (error) => errors.push(error),
  });

  assert.deepEqual(await handler.transcribe(VOICE, 'en'), {
    ok: false,
    reason: 'failed',
  });
  assert.match(String((errors[0] as Error).message), /responded with 500/);
});
