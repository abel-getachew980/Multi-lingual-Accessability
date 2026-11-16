import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config';

const TOKEN = '123456789:AAHtest-token_value';

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { TELEGRAM_BOT_TOKEN: TOKEN, ...overrides };
}

test('requires a bot token', () => {
  assert.throws(
    () => loadConfig({}),
    /TELEGRAM_BOT_TOKEN is required/,
  );
});

test('rejects a token that cannot be a real bot token', () => {
  assert.throws(
    () => loadConfig({ TELEGRAM_BOT_TOKEN: 'your-telegram-bot-token' }),
    /does not look like a bot token/,
  );
});

test('uses safe polling defaults', () => {
  const config = loadConfig(env());

  assert.equal(config.mode, 'polling');
  assert.equal(config.port, 3002);
  assert.equal(config.webhookPath, '/telegram');
  assert.equal(config.apiBaseUrl, 'https://api.telegram.org');
  assert.equal(config.ai.url, 'http://localhost:3000/api/ai');
  assert.equal(config.help.url, 'http://localhost:3000/api/help');
  assert.equal(config.behaviour.defaultLanguage, 'am');
  assert.equal(config.behaviour.maxQuestionLength, 1_000);
  assert.equal(config.behaviour.maxHistoryTurns, 8);
  assert.equal(config.behaviour.rateLimitMax, 20);
  assert.equal(config.behaviour.rateLimitWindowMs, 60_000);
  assert.equal(config.behaviour.maxVoiceBytes, 5 * 1024 * 1024);
  assert.equal(config.transcription, undefined);
});

test('normalises the webhook path', () => {
  assert.equal(loadConfig(env({ TELEGRAM_WEBHOOK_PATH: 'hook' })).webhookPath, '/hook');
  assert.equal(loadConfig(env({ TELEGRAM_WEBHOOK_PATH: '/hook/' })).webhookPath, '/hook');
  assert.equal(loadConfig(env({ TELEGRAM_WEBHOOK_PATH: '/' })).webhookPath, '/telegram');
});

test('webhook mode requires a secret', () => {
  assert.throws(
    () => loadConfig(env({ TELEGRAM_MODE: 'webhook' })),
    /TELEGRAM_WEBHOOK_SECRET is required/,
  );

  const config = loadConfig(
    env({ TELEGRAM_MODE: 'webhook', TELEGRAM_WEBHOOK_SECRET: 'shh' }),
  );
  assert.equal(config.mode, 'webhook');
  assert.equal(config.webhookSecret, 'shh');
});

test('rejects an unknown mode instead of silently polling', () => {
  assert.throws(
    () => loadConfig(env({ TELEGRAM_MODE: 'carrier-pigeon' })),
    /Unsupported TELEGRAM_MODE/,
  );
});

test('reads URLs, provider and transcription settings', () => {
  const config = loadConfig(
    env({
      APP_BASE_URL: 'https://tutor.example/',
      AI_API_URL: 'https://tutor.example/api/ai',
      HELP_API_URL: 'https://tutor.example/api/help',
      AI_PROVIDER: 'local',
      TRANSCRIPTION_API_URL: 'https://asr.example/v1/audio/transcriptions',
      TRANSCRIPTION_MODEL: 'whisper-large',
      TRANSCRIPTION_LANGUAGE: 'am',
      TRANSCRIPTION_TIMEOUT_MS: '12000',
      TELEGRAM_API_BASE_URL: 'https://tg.example/',
      TELEGRAM_DEFAULT_LANGUAGE: 'en',
    }),
  );

  assert.equal(config.app.baseUrl, 'https://tutor.example');
  assert.equal(config.ai.url, 'https://tutor.example/api/ai');
  assert.equal(config.ai.provider, 'local');
  assert.equal(config.help.url, 'https://tutor.example/api/help');
  assert.equal(config.apiBaseUrl, 'https://tg.example');
  assert.equal(config.behaviour.defaultLanguage, 'en');
  assert.deepEqual(config.transcription, {
    url: 'https://asr.example/v1/audio/transcriptions',
    model: 'whisper-large',
    language: 'am',
    timeoutMs: 12_000,
  });
});

test('ignores invalid numbers rather than starting with NaN', () => {
  const config = loadConfig(
    env({
      TELEGRAM_BOT_PORT: 'not-a-port',
      TELEGRAM_RATE_LIMIT_MAX: '-4',
      TELEGRAM_MAX_HISTORY_TURNS: '0',
    }),
  );

  assert.equal(config.port, 3002);
  assert.equal(config.behaviour.rateLimitMax, 20);
  assert.equal(config.behaviour.maxHistoryTurns, 8);
});
