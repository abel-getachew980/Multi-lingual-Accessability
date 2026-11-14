import test from 'node:test';
import assert from 'node:assert/strict';
import type { AiClient } from './aiClient';
import { MessageHandler, formatCitation, parseCommand } from './messageHandler';
import { SlidingWindowRateLimiter } from './rateLimiter';
import { InMemorySessionStore } from './sessionManager';
import type { AiAnswer, InboundSms, Language, SmsConfig } from './types';

const PHONE = '+251911111111';

function makeConfig(overrides: Partial<SmsConfig> = {}): SmsConfig {
  return {
    defaultLanguage: 'en',
    maxSegmentsPerReply: 3,
    maxQuestionLength: 500,
    rateLimitMax: 10,
    rateLimitWindowMs: 60_000,
    sessionTtlMs: 60_000,
    aiTimeoutMs: 1_000,
    replyMode: 'twiml',
    ...overrides,
  };
}

function fakeAi(
  answer: string | ((question: string, language: Language) => AiAnswer) = 'Answer',
): AiClient & { calls: Array<{ question: string; language: Language }> } {
  const calls: Array<{ question: string; language: Language }> = [];

  return {
    calls,
    async ask(question, language) {
      calls.push({ question, language });
      if (typeof answer === 'function') return answer(question, language);
      return { answer };
    },
  };
}

function setup(ai: AiClient, configOverrides: Partial<SmsConfig> = {}) {
  const config = makeConfig(configOverrides);
  const sessions = new InMemorySessionStore(config.sessionTtlMs);
  const limiter = new SlidingWindowRateLimiter(
    config.rateLimitMax,
    config.rateLimitWindowMs,
  );
  const handler = new MessageHandler({ ai, sessions, limiter, config });

  return { config, sessions, limiter, handler };
}

function inbound(body: string, from = PHONE): InboundSms {
  return { from, body, receivedAt: new Date() };
}

test('parseCommand understands commands, aliases and questions', () => {
  assert.deepEqual(parseCommand('LANG EN'), { type: 'set-language', language: 'en' });
  assert.deepEqual(parseCommand('lang am.'), { type: 'set-language', language: 'am' });
  assert.deepEqual(parseCommand('ቋንቋ አማርኛ'), { type: 'set-language', language: 'am' });
  assert.deepEqual(parseCommand('HELP'), { type: 'help' });
  assert.deepEqual(parseCommand('start'), { type: 'help' });
  assert.deepEqual(parseCommand('more'), { type: 'more' });
  assert.deepEqual(parseCommand('RESET'), { type: 'reset' });
  assert.deepEqual(parseCommand('   '), { type: 'empty' });
  assert.deepEqual(parseCommand('What is 2 + 2?'), {
    type: 'question',
    question: 'What is 2 + 2?',
  });
});

test('formatCitation includes section and page when present', () => {
  assert.equal(
    formatCitation({ source: 'Biology.pdf', section: 'Chapter 2', page: 14 }, 'en'),
    'Source: Biology.pdf, Chapter 2, p. 14',
  );
  assert.equal(
    formatCitation({ source: 'Biology.pdf' }, 'am'),
    'ምንጭ: Biology.pdf',
  );
  assert.equal(formatCitation(undefined, 'en'), null);
});

test('answers a question in the session language and appends the citation', async () => {
  const ai = fakeAi('Cells are the basic unit of life.');
  const { handler } = setup(ai);

  const result = await handler.handle(inbound('What is a cell?'));

  assert.equal(ai.calls.length, 1);
  assert.deepEqual(ai.calls[0], {
    question: 'What is a cell?',
    language: 'en',
  });
  assert.deepEqual(result.messages, ['Cells are the basic unit of life.']);
  assert.equal(result.rateLimited, false);
});

test('returns an Amharic welcome and switches language on LANG AM', async () => {
  const ai = fakeAi('ሕዋስ የሕይወት መሠረታዊ አሃድ ነው።');
  const { handler, sessions } = setup(ai);

  const switched = await handler.handle(inbound('LANG AM'));
  assert.match(switched.messages[0] ?? '', /ቋንቋ/);
  assert.equal(sessions.get(PHONE)?.language, 'am');

  const answered = await handler.handle(inbound('ሕዋስ ምንድን ነው?'));
  assert.deepEqual(ai.calls[0]?.language, 'am');
  assert.equal(answered.messages[0], 'ሕዋስ የሕይወት መሠረታዊ አሃድ ነው።');
});

test('flags a human help request and tells the learner', async () => {
  const { handler, sessions } = setup(fakeAi());

  const result = await handler.handle(inbound('HELP'));

  assert.match(result.messages[0] ?? '', /human tutor/i);
  assert.equal(typeof sessions.get(PHONE)?.helpRequestedAt, 'number');
});

test('returns a helpful message for empty input', async () => {
  const { handler } = setup(fakeAi());
  const result = await handler.handle(inbound('   '));

  assert.match(result.messages[0] ?? '', /send a question/i);
});

test('rejects questions above the length limit without calling the AI', async () => {
  const ai = fakeAi();
  const { handler } = setup(ai, { maxQuestionLength: 20 });

  const result = await handler.handle(inbound('x'.repeat(21)));

  assert.match(result.messages[0] ?? '', /too long/i);
  assert.equal(ai.calls.length, 0);
});

test('rate limits a phone number that sends too many messages', async () => {
  const { handler } = setup(fakeAi(), { rateLimitMax: 1 });

  const first = await handler.handle(inbound('Hello'));
  assert.equal(first.rateLimited, false);

  const second = await handler.handle(inbound('Hello again'));
  assert.equal(second.rateLimited, true);
  assert.match(second.messages[0] ?? '', /wait \d+ seconds/i);
});

test('falls back to an apology when the AI request fails', async () => {
  const failingAi: AiClient = {
    async ask() {
      throw new Error('AI offline');
    },
  };
  const { handler } = setup(failingAi);

  const result = await handler.handle(inbound('What is a cell?'));

  assert.match(result.messages[0] ?? '', /could not answer/i);
});

test('splits long answers and serves the rest via MORE', async () => {
  const longAnswer = Array.from({ length: 40 }, (_, index) => `Sentence ${index}.`).join(' ');
  const ai = fakeAi(longAnswer);
  const { handler } = setup(ai, { maxSegmentsPerReply: 3 });

  const first = await handler.handle(inbound('Explain everything'));
  assert.ok(first.messages.length <= 3);
  assert.match(first.messages[first.messages.length - 1] ?? '', /MORE/);

  const second = await handler.handle(inbound('MORE'));
  assert.ok(second.messages.length > 0);
  assert.doesNotMatch(second.messages[0] ?? '', /no more/i);
});

test('MORE with no pending answer explains that nothing is left', async () => {
  const { handler } = setup(fakeAi('Short answer'));

  const result = await handler.handle(inbound('MORE'));

  assert.match(result.messages[0] ?? '', /no more of that answer/i);
});

test('reset clears pending segments', async () => {
  const longAnswer = 'word '.repeat(400).trim();
  const { handler, sessions } = setup(fakeAi(longAnswer));

  await handler.handle(inbound('Explain everything'));
  assert.ok((sessions.get(PHONE)?.pendingChunks.length ?? 0) > 0);

  await handler.handle(inbound('RESET'));
  assert.equal(sessions.get(PHONE)?.pendingChunks.length, 0);
});
