import test from 'node:test';
import assert from 'node:assert/strict';
import type { AiClient } from './aiClient';
import type { HelpClient, HelpRequestInput } from './helpClient';
import { MessageHandler, formatCitation, parseCommand } from './messageHandler';
import { InMemoryOptOutStore } from './optOutStore';
import { SlidingWindowRateLimiter } from './rateLimiter';
import { InMemorySessionStore } from './sessionManager';
import type {
  ConversationTurn,
  InboundSms,
  Language,
  SmsConfig,
} from './types';

const PHONE = '+251911111111';

function makeConfig(overrides: Partial<SmsConfig> = {}): SmsConfig {
  return {
    defaultLanguage: 'en',
    maxSegmentsPerReply: 3,
    maxQuestionLength: 500,
    maxHistoryTurns: 6,
    helpRequestCooldownMs: 10 * 60_000,
    rateLimitMax: 10,
    rateLimitWindowMs: 60_000,
    sessionTtlMs: 60_000,
    aiTimeoutMs: 1_000,
    replyMode: 'twiml',
    ...overrides,
  };
}

type AiCall = {
  question: string;
  language: Language;
  history: ConversationTurn[];
};

function fakeAi(
  answer: string | ((question: string, language: Language) => string) = 'Answer',
): AiClient & { calls: AiCall[] } {
  const calls: AiCall[] = [];

  return {
    calls,
    async ask(question, language, history = []) {
      calls.push({ question, language, history });
      return {
        answer: typeof answer === 'function' ? answer(question, language) : answer,
        citation: { source: 'Biology Grade 9.pdf', section: 'Unit 2', page: 14 },
      };
    },
  };
}

function failingAi(message = 'AI offline'): AiClient {
  return {
    async ask() {
      throw new Error(message);
    },
  };
}

function fakeHelp(): HelpClient & { calls: HelpRequestInput[]; fail: boolean } {
  const calls: HelpRequestInput[] = [];

  return {
    calls,
    fail: false,
    async requestHelp(input) {
      calls.push(input);
      if (this.fail) throw new Error('help desk offline');
      return { requestId: `help-${calls.length}`, status: 'pending' };
    },
  };
}

function setup(
  ai: AiClient,
  options: { help?: ReturnType<typeof fakeHelp>; config?: Partial<SmsConfig> } = {},
) {
  const config = makeConfig(options.config);
  const help = options.help ?? fakeHelp();
  const optOuts = new InMemoryOptOutStore();
  const sessions = new InMemorySessionStore(config.sessionTtlMs);
  const limiter = new SlidingWindowRateLimiter(
    config.rateLimitMax,
    config.rateLimitWindowMs,
  );
  const handler = new MessageHandler({
    ai,
    help,
    optOuts,
    sessions,
    limiter,
    config,
  });

  return { config, sessions, limiter, optOuts, help, handler };
}

function inbound(body: string, from = PHONE): InboundSms {
  return { from, body, receivedAt: new Date() };
}

test('parseCommand understands commands, aliases and questions', () => {
  assert.deepEqual(parseCommand('LANG EN'), { type: 'set-language', language: 'en' });
  assert.deepEqual(parseCommand('lang am.'), { type: 'set-language', language: 'am' });
  assert.deepEqual(parseCommand('ቋንቋ አማርኛ'), { type: 'set-language', language: 'am' });
  assert.deepEqual(parseCommand('HELP'), { type: 'help' });
  assert.deepEqual(parseCommand('እርዳታ'), { type: 'help' });
  assert.deepEqual(parseCommand('more'), { type: 'more' });
  assert.deepEqual(parseCommand('RESET'), { type: 'reset' });
  assert.deepEqual(parseCommand('STOP'), { type: 'stop' });
  assert.deepEqual(parseCommand('unsubscribe'), { type: 'stop' });
  assert.deepEqual(parseCommand('START'), { type: 'start' });
  assert.deepEqual(parseCommand('ጀምር'), { type: 'start' });
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
    history: [],
  });
  assert.deepEqual(result.messages, [
    'Cells are the basic unit of life.\nSource: Biology Grade 9.pdf, Unit 2, p. 14',
  ]);
  assert.equal(result.rateLimited, false);
});

test('sends previous turns as conversation history', async () => {
  const ai = fakeAi('First answer');
  const { handler, sessions } = setup(ai);

  await handler.handle(inbound('First question'));
  await handler.handle(inbound('Second question'));

  assert.equal(ai.calls.length, 2);
  assert.deepEqual(ai.calls[1]?.history, [
    { role: 'user', content: 'First question' },
    { role: 'assistant', content: 'First answer' },
  ]);
  assert.equal(sessions.get(PHONE)?.history.length, 4);
});

test('caps conversation history to the configured number of turns', async () => {
  const ai = fakeAi('Answer');
  const { handler, sessions } = setup(ai, { config: { maxHistoryTurns: 2 } });

  await handler.handle(inbound('One'));
  await handler.handle(inbound('Two'));
  await handler.handle(inbound('Three'));

  assert.equal(sessions.get(PHONE)?.history.length, 2);
  assert.deepEqual(
    ai.calls[2]?.history.map((turn) => turn.content),
    ['Two', 'Answer'],
  );
});

test('keeps the learner question in history when the AI fails', async () => {
  const { handler, sessions } = setup(failingAi());

  await handler.handle(inbound('What is a cell?'));

  assert.deepEqual(sessions.get(PHONE)?.history, [
    { role: 'user', content: 'What is a cell?' },
  ]);
});

test('returns an Amharic welcome and switches language on LANG AM', async () => {
  const ai = fakeAi('ሕዋስ የሕይወት መሠረታዊ አሃድ ነው።');
  const { handler, sessions } = setup(ai);

  const switched = await handler.handle(inbound('LANG AM'));
  assert.match(switched.messages[0] ?? '', /ቋንቋ/);
  assert.equal(sessions.get(PHONE)?.language, 'am');

  const answered = await handler.handle(inbound('ሕዋስ ምንድን ነው?'));
  assert.deepEqual(ai.calls[0]?.language, 'am');
  assert.match(answered.messages[0] ?? '', /^ሕዋስ የሕይወት መሠረታዊ አሃድ ነው።/);
});

test('registers a help ticket with the conversation history', async () => {
  const ai = fakeAi('A cell is the basic unit of life.');
  const help = fakeHelp();
  const { handler, sessions } = setup(ai, { help });

  await handler.handle(inbound('What is a cell?'));
  const result = await handler.handle(inbound('HELP'));

  assert.equal(help.calls.length, 1);
  assert.equal(help.calls[0]?.phoneNumber, PHONE);
  assert.equal(help.calls[0]?.language, 'en');
  assert.deepEqual(help.calls[0]?.conversationHistory, [
    { role: 'user', content: 'What is a cell?' },
    { role: 'assistant', content: 'A cell is the basic unit of life.' },
  ]);
  assert.match(result.messages[0] ?? '', /help request has been registered/i);
  assert.equal(typeof sessions.get(PHONE)?.helpRequestedAt, 'number');
});

test('does not create a second help ticket inside the cooldown', async () => {
  const help = fakeHelp();
  const { handler } = setup(fakeAi(), { help });

  await handler.handle(inbound('HELP'));
  const second = await handler.handle(inbound('HELP'));

  assert.equal(help.calls.length, 1);
  assert.match(second.messages[0] ?? '', /already registered/i);
});

test('allows a new help ticket after the cooldown', async () => {
  let now = 0;
  const help = fakeHelp();
  const config = makeConfig({ helpRequestCooldownMs: 1_000 });
  const sessions = new InMemorySessionStore(config.sessionTtlMs);
  const handler = new MessageHandler({
    ai: fakeAi(),
    help,
    optOuts: new InMemoryOptOutStore(),
    sessions,
    limiter: new SlidingWindowRateLimiter(config.rateLimitMax, config.rateLimitWindowMs),
    config,
    now: () => now,
  });

  await handler.handle(inbound('HELP'));
  now = 1_001;
  await handler.handle(inbound('HELP'));

  assert.equal(help.calls.length, 2);
});

test('explains when the help desk cannot be reached', async () => {
  const help = fakeHelp();
  help.fail = true;
  const { handler, sessions } = setup(fakeAi(), { help });

  const result = await handler.handle(inbound('HELP'));

  assert.match(result.messages[0] ?? '', /could not reach the help desk/i);
  assert.equal(sessions.get(PHONE)?.helpRequestedAt, undefined);
});

test('HELP is never rate limited', async () => {
  const help = fakeHelp();
  const { handler } = setup(fakeAi(), {
    help,
    config: { rateLimitMax: 1 },
  });

  await handler.handle(inbound('First question'));
  const result = await handler.handle(inbound('HELP'));

  assert.equal(help.calls.length, 1);
  assert.match(result.messages[0] ?? '', /registered/i);
});

test('STOP unsubscribes, silences questions and START resubscribes', async () => {
  const ai = fakeAi('Answer');
  const { handler, sessions, optOuts } = setup(ai);

  const stopped = await handler.handle(inbound('STOP'));
  assert.match(stopped.messages[0] ?? '', /unsubscribed/i);
  assert.equal(optOuts.isOptedOut(PHONE), true);
  assert.deepEqual(sessions.get(PHONE)?.history, []);

  const ignored = await handler.handle(inbound('What is a cell?'));
  assert.deepEqual(ignored.messages, []);
  assert.equal(ai.calls.length, 0);

  const started = await handler.handle(inbound('START'));
  assert.match(started.messages[0] ?? '', /welcome/i);
  assert.equal(optOuts.isOptedOut(PHONE), false);

  await handler.handle(inbound('What is a cell?'));
  assert.equal(ai.calls.length, 1);
});

test('contracts: stop confirmation is repeated without extra side effects', async () => {
  const { handler, optOuts } = setup(fakeAi());

  await handler.handle(inbound('STOP'));
  const again = await handler.handle(inbound('stop'));

  assert.match(again.messages[0] ?? '', /unsubscribed/i);
  assert.equal(optOuts.isOptedOut(PHONE), true);
});

test('returns a helpful message for empty input', async () => {
  const { handler } = setup(fakeAi());
  const result = await handler.handle(inbound('   '));

  assert.match(result.messages[0] ?? '', /send a question/i);
});

test('rejects questions above the length limit without calling the AI', async () => {
  const ai = fakeAi();
  const { handler } = setup(ai, { config: { maxQuestionLength: 20 } });

  const result = await handler.handle(inbound('x'.repeat(21)));

  assert.match(result.messages[0] ?? '', /too long/i);
  assert.equal(ai.calls.length, 0);
});

test('rate limits a phone number that sends too many messages', async () => {
  const { handler } = setup(fakeAi(), { config: { rateLimitMax: 1 } });

  const first = await handler.handle(inbound('Hello'));
  assert.equal(first.rateLimited, false);

  const second = await handler.handle(inbound('Hello again'));
  assert.equal(second.rateLimited, true);
  assert.match(second.messages[0] ?? '', /wait \d+ seconds/i);
});

test('falls back to an apology when the AI request fails', async () => {
  const { handler } = setup(failingAi());

  const result = await handler.handle(inbound('What is a cell?'));

  assert.match(result.messages[0] ?? '', /could not answer/i);
});

test('splits long answers and serves the rest via MORE', async () => {
  const longAnswer = Array.from({ length: 40 }, (_, index) => `Sentence ${index}.`).join(' ');
  const ai = fakeAi(longAnswer);
  const { handler } = setup(ai, { config: { maxSegmentsPerReply: 3 } });

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

test('reset clears pending segments and history', async () => {
  const longAnswer = 'word '.repeat(400).trim();
  const { handler, sessions } = setup(fakeAi(longAnswer));

  await handler.handle(inbound('Explain everything'));
  assert.ok((sessions.get(PHONE)?.pendingChunks.length ?? 0) > 0);

  await handler.handle(inbound('RESET'));
  assert.equal(sessions.get(PHONE)?.pendingChunks.length, 0);
  assert.deepEqual(sessions.get(PHONE)?.history, []);
});
