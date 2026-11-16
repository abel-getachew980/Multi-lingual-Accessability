import test from 'node:test';
import assert from 'node:assert/strict';
import type { AiClient } from './aiClient';
import type { HelpClient, HelpRequestInput } from './helpClient';
import { CALLBACK } from './keyboardBuilder';
import {
  MessageHandler,
  formatCitation,
  parseCommand,
} from './messageHandler';
import { SlidingWindowRateLimiter } from './rateLimiter';
import { InMemorySessionStore } from './sessionManager';
import { botStrings } from './strings';
import type { TelegramApi } from './telegramClient';
import type {
  AiAnswer,
  BotConfig,
  ConversationTurn,
  HelpRequestResult,
  HelpStatusResult,
  Language,
  TelegramUpdate,
} from './types';
import type { VoiceHandler, VoiceResult } from './voiceHandler';

type Behaviour = BotConfig['behaviour'];

function makeConfig(overrides: Partial<Behaviour> = {}): Behaviour {
  return {
    defaultLanguage: 'en',
    maxQuestionLength: 500,
    maxHistoryTurns: 6,
    rateLimitMax: 100,
    rateLimitWindowMs: 60_000,
    sessionTtlMs: 60_000,
    helpRequestCooldownMs: 10 * 60_000,
    maxVoiceSeconds: 120,
    maxVoiceBytes: 5 * 1024 * 1024,
    ...overrides,
  };
}

interface SentMessage {
  chatId: string | number;
  text: string;
  options: Record<string, unknown>;
}

function fakeApi() {
  const messages: SentMessage[] = [];
  const actions: string[] = [];
  const answered: string[] = [];

  const api: TelegramApi = {
    async sendMessage(chatId, text, options = {}) {
      messages.push({ chatId, text, options: options as Record<string, unknown> });
    },
    async sendChatAction(_chatId, action) {
      actions.push(action ?? 'typing');
    },
    async answerCallbackQuery(id) {
      answered.push(id);
    },
    async editMessageText() {},
    async getFile() {
      throw new Error('not used');
    },
    async downloadFile() {
      throw new Error('not used');
    },
    async getUpdates() {
      return [];
    },
    async deleteWebhook() {},
    async setWebhook() {},
    async setMyCommands() {},
  };

  return { api, messages, actions, answered };
}

interface AiCall {
  question: string;
  language: Language;
  history: ConversationTurn[];
}

function fakeAi(
  result: AiAnswer | Error = {
    answer: 'A cell is the basic unit of life.',
    citation: { source: 'Biology Grade 9.pdf', page: 12 },
  },
) {
  const calls: AiCall[] = [];

  const ai: AiClient = {
    async ask(question, language, history = []) {
      calls.push({ question, language, history });
      if (result instanceof Error) throw result;
      return result;
    },
  };

  return { ai, calls };
}

interface HelpState {
  requestResult: HelpRequestResult;
  requestError?: Error;
  statusResult: HelpStatusResult;
  statusError?: Error;
  cancelResult: HelpStatusResult;
  cancelError?: Error;
  requests: HelpRequestInput[];
  statusCalls: string[];
  cancelCalls: string[];
}

function fakeHelp(overrides: Partial<HelpState> = {}) {
  const state: HelpState = {
    requestResult: {
      requestId: 'help-1',
      status: 'pending',
      position: 2,
      estimatedWaitMinutes: 4,
    },
    statusResult: {
      requestId: 'help-1',
      status: 'pending',
      position: 2,
      estimatedWaitMinutes: 4,
    },
    cancelResult: { requestId: 'help-1', status: 'cancelled' },
    requests: [],
    statusCalls: [],
    cancelCalls: [],
    ...overrides,
  };

  const help: HelpClient = {
    async requestHelp(input) {
      state.requests.push(input);
      if (state.requestError) throw state.requestError;
      return state.requestResult;
    },
    async getStatus(requestId) {
      state.statusCalls.push(requestId);
      if (state.statusError) throw state.statusError;
      return state.statusResult;
    },
    async cancel(requestId) {
      state.cancelCalls.push(requestId);
      if (state.cancelError) throw state.cancelError;
      return state.cancelResult;
    },
  };

  return { help, state };
}

function fakeVoice(result: VoiceResult | Error) {
  const calls: Array<{ language: Language }> = [];

  const voice = {
    isConfigured: () => true,
    async transcribe(_note: unknown, language: Language) {
      calls.push({ language });
      if (result instanceof Error) throw result;
      return result;
    },
  } as unknown as VoiceHandler;

  return { voice, calls };
}

let updateId = 1;

function textUpdate(chatId: number, text: string): TelegramUpdate {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'Learner', is_bot: false },
      date: 1_700_000_000,
      text,
    },
  };
}

function voiceUpdate(chatId: number, duration = 5): TelegramUpdate {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'Learner', is_bot: false },
      date: 1_700_000_000,
      voice: {
        file_id: 'voice-1',
        file_unique_id: 'unique-1',
        duration,
      },
    },
  };
}

function callbackUpdate(chatId: number, data: string): TelegramUpdate {
  return {
    update_id: updateId++,
    callback_query: {
      id: 'cb-1',
      from: { id: chatId, first_name: 'Learner', is_bot: false },
      message: {
        message_id: 10,
        chat: { id: chatId, type: 'private' },
        date: 1_700_000_000,
        text: 'Menu',
      },
      data,
    },
  };
}

function setup(
  options: {
    config?: Partial<Behaviour>;
    ai?: ReturnType<typeof fakeAi>;
    help?: Partial<HelpState>;
    voice?: VoiceHandler;
    now?: () => number;
  } = {},
) {
  const config = makeConfig(options.config);
  const api = fakeApi();
  const ai = options.ai ?? fakeAi();
  const help = fakeHelp(options.help);
  const sessions = new InMemorySessionStore(config.sessionTtlMs, options.now);
  const limiter = new SlidingWindowRateLimiter(
    config.rateLimitMax,
    config.rateLimitWindowMs,
    options.now,
  );

  const handler = new MessageHandler({
    api: api.api,
    ai: ai.ai,
    help: help.help,
    sessions,
    limiter,
    voice: options.voice,
    config,
    now: options.now,
  });

  return { handler, api, ai, help, sessions, limiter };
}

test('parseCommand reads every supported command', () => {
  assert.deepEqual(parseCommand('/start'), { type: 'start' });
  assert.deepEqual(parseCommand('/start@TutorBot'), { type: 'start' });
  assert.deepEqual(parseCommand('/help'), { type: 'help' });
  assert.deepEqual(parseCommand('/menu'), { type: 'menu' });
  assert.deepEqual(parseCommand('/language'), { type: 'language' });
  assert.deepEqual(parseCommand('/lang am'), {
    type: 'set-language',
    language: 'am',
  });
  assert.deepEqual(parseCommand('/language English'), {
    type: 'set-language',
    language: 'en',
  });
  assert.deepEqual(parseCommand('/language አማርኛ'), {
    type: 'set-language',
    language: 'am',
  });
  assert.deepEqual(parseCommand('/tutor'), { type: 'tutor' });
  assert.deepEqual(parseCommand('/status'), { type: 'status' });
  assert.deepEqual(parseCommand('/cancel'), { type: 'cancel' });
  assert.deepEqual(parseCommand('/clear'), { type: 'clear' });
});

test('parseCommand treats text and unknown commands as questions', () => {
  assert.deepEqual(parseCommand('What is a cell?'), {
    type: 'question',
    question: 'What is a cell?',
  });
  assert.deepEqual(parseCommand('  What   is a cell?  '), {
    type: 'question',
    question: 'What is a cell?',
  });
  assert.deepEqual(parseCommand('/unknown'), {
    type: 'question',
    question: '/unknown',
  });
  assert.deepEqual(parseCommand('   '), { type: 'empty' });
});

test('parseCommand falls back to the language menu for an unknown language', () => {
  assert.deepEqual(parseCommand('/language klingon'), { type: 'language' });
});

test('formatCitation is localised and optional', () => {
  assert.equal(formatCitation(undefined, 'en'), null);
  assert.equal(formatCitation({ source: '' }, 'en'), null);
  assert.equal(formatCitation({ source: 'Notes' }, 'en'), 'Source: Notes');
  assert.equal(
    formatCitation({ source: 'Notes', section: 'Unit 2', page: 5 }, 'am'),
    'ምንጭ: Notes, Unit 2, p. 5',
  );
});

test('ignores updates from other bots', async () => {
  const { handler, api } = setup();

  const result = await handler.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: 1, type: 'private' },
      from: { id: 2, first_name: 'Bot', is_bot: true },
      date: 1_700_000_000,
      text: 'beep',
    },
  });

  assert.deepEqual(result, { handled: false });
  assert.equal(api.messages.length, 0);
});

test('/start sends the welcome with the main menu', async () => {
  const { handler, api } = setup();

  const result = await handler.handleUpdate(textUpdate(1, '/start'));

  assert.deepEqual(result, { handled: true });
  assert.equal(api.messages[0].text, botStrings.en.welcome);
  assert.ok(api.messages[0].options.reply_markup);
});

test('answers a question with the citation appended', async () => {
  const { handler, api, ai } = setup();

  await handler.handleUpdate(textUpdate(1, 'What is a cell?'));

  assert.equal(ai.calls.length, 1);
  assert.equal(ai.calls[0].question, 'What is a cell?');
  assert.equal(ai.calls[0].language, 'en');
  assert.deepEqual(ai.calls[0].history, []);
  assert.equal(api.actions[0], 'typing');
  assert.equal(
    api.messages[0].text,
    'A cell is the basic unit of life.\n\nSource: Biology Grade 9.pdf, p. 12',
  );
});

test('sends the previous turns as context', async () => {
  const { handler, ai } = setup();

  await handler.handleUpdate(textUpdate(1, 'First question'));
  await handler.handleUpdate(textUpdate(1, 'Follow up'));

  assert.equal(ai.calls[1].question, 'Follow up');
  assert.deepEqual(ai.calls[1].history, [
    { role: 'user', content: 'First question' },
    { role: 'assistant', content: 'A cell is the basic unit of life.' },
  ]);
});

test('caps the stored history', async () => {
  const { handler, ai, sessions } = setup({
    config: { maxHistoryTurns: 2 },
  });

  await handler.handleUpdate(textUpdate(1, 'One'));
  await handler.handleUpdate(textUpdate(1, 'Two'));

  const session = sessions.get('1');
  assert.ok(session);
  assert.deepEqual(session.history, [
    { role: 'user', content: 'Two' },
    { role: 'assistant', content: 'A cell is the basic unit of life.' },
  ]);
  assert.equal(ai.calls[1].history.length, 2);
});

test('rejects an over-long question without calling the AI', async () => {
  const { handler, api, ai } = setup({
    config: { maxQuestionLength: 10 },
  });

  await handler.handleUpdate(textUpdate(1, 'This question is too long'));

  assert.equal(ai.calls.length, 0);
  assert.equal(api.messages[0].text, botStrings.en.tooLong);
});

test('rate limits a chat', async () => {
  const { handler, api, ai } = setup({
    config: { rateLimitMax: 1 },
  });

  await handler.handleUpdate(textUpdate(1, 'First'));
  await handler.handleUpdate(textUpdate(1, 'Second'));

  assert.equal(ai.calls.length, 1);
  assert.match(api.messages[1].text, /Too many messages/);
});

test('says the AI is unavailable and keeps only the user turn', async () => {
  const { handler, api, ai, sessions } = setup({
    ai: fakeAi(new Error('offline')),
  });

  await handler.handleUpdate(textUpdate(1, 'Question'));

  assert.equal(ai.calls.length, 1);
  assert.equal(api.messages[0].text, botStrings.en.aiUnavailable);
  assert.deepEqual(sessions.get('1')?.history, [
    { role: 'user', content: 'Question' },
  ]);
});

test('asks for a question when the message is empty', async () => {
  const { handler, api } = setup();

  await handler.handleUpdate(textUpdate(1, '   '));

  assert.equal(api.messages[0].text, botStrings.en.empty);
});

test('registers a tutor request only after the help desk accepts it', async () => {
  const { handler, api, help, sessions } = setup();

  await handler.handleUpdate(textUpdate(1, '/tutor'));

  assert.equal(help.state.requests.length, 1);
  assert.equal(help.state.requests[0].chatId, '1');
  assert.equal(help.state.requests[0].language, 'en');
  assert.match(api.messages[0].text, /number 2 in the queue/);
  assert.equal(sessions.get('1')?.helpRequestId, 'help-1');
  assert.equal(sessions.get('1')?.helpStatus, 'pending');
});

test('does not pretend a tutor was queued when the help desk fails', async () => {
  const { handler, api, sessions } = setup({
    help: { requestError: new Error('down') },
  });

  await handler.handleUpdate(textUpdate(1, '/tutor'));

  assert.equal(api.messages[0].text, botStrings.en.tutorUnavailable);
  assert.equal(sessions.get('1')?.helpRequestId, undefined);
});

test('refuses a duplicate help request while one is active', async () => {
  const { handler, api, help } = setup();

  await handler.handleUpdate(textUpdate(1, '/tutor'));
  await handler.handleUpdate(textUpdate(1, '/tutor'));

  assert.equal(help.state.requests.length, 1);
  assert.equal(api.messages[1].text, botStrings.en.tutorPending);
});

test('honours the cooldown after a ticket has ended', async () => {
  let now = 1_000;
  const { handler, api, help, sessions } = setup({ now: () => now });

  await handler.handleUpdate(textUpdate(1, '/tutor'));
  const session = sessions.get('1');
  assert.ok(session);
  session.helpRequestId = undefined;
  session.helpStatus = 'resolved';

  now += 1_000;
  await handler.handleUpdate(textUpdate(1, '/tutor'));

  assert.equal(help.state.requests.length, 1);
  assert.equal(api.messages[1].text, botStrings.en.tutorPending);
});

test('reports when there is no help request', async () => {
  const { handler, api, help } = setup();

  await handler.handleUpdate(textUpdate(1, '/status'));
  await handler.handleUpdate(textUpdate(1, '/cancel'));

  assert.equal(help.state.statusCalls.length, 0);
  assert.equal(help.state.cancelCalls.length, 0);
  assert.equal(api.messages[0].text, botStrings.en.tutorNotRequested);
  assert.equal(api.messages[1].text, botStrings.en.tutorNotRequested);
});

test('shows the queue position and estimate', async () => {
  const { handler, api, help } = setup();

  await handler.handleUpdate(textUpdate(1, '/tutor'));
  await handler.handleUpdate(textUpdate(1, '/status'));

  assert.deepEqual(help.state.statusCalls, ['help-1']);
  assert.equal(
    api.messages[1].text,
    'Waiting for a tutor. Position 2 in the queue. Estimated wait 4 minutes.',
  );
});

test('clears the ticket once the status is resolved', async () => {
  const { handler, api, help, sessions } = setup();

  await handler.handleUpdate(textUpdate(1, '/tutor'));
  help.state.statusResult = {
    requestId: 'help-1',
    status: 'resolved',
    position: 0,
  };

  await handler.handleUpdate(textUpdate(1, '/status'));

  assert.equal(sessions.get('1')?.helpRequestId, undefined);
  assert.equal(api.messages[1].text, 'Resolved');
});

test('keeps the ticket when the status check fails', async () => {
  const { handler, api, help, sessions } = setup();

  await handler.handleUpdate(textUpdate(1, '/tutor'));
  help.state.statusError = new Error('offline');

  await handler.handleUpdate(textUpdate(1, '/status'));

  assert.equal(sessions.get('1')?.helpRequestId, 'help-1');
  assert.equal(api.messages[1].text, botStrings.en.statusUnavailable);
});

test('cancels a help request', async () => {
  const { handler, api, help, sessions } = setup();

  await handler.handleUpdate(textUpdate(1, '/tutor'));
  await handler.handleUpdate(textUpdate(1, '/cancel'));

  assert.deepEqual(help.state.cancelCalls, ['help-1']);
  assert.equal(sessions.get('1')?.helpRequestId, undefined);
  assert.equal(api.messages[1].text, botStrings.en.tutorCancelled);
});

test('keeps the ticket when cancelling fails', async () => {
  const { handler, api, help, sessions } = setup();

  await handler.handleUpdate(textUpdate(1, '/tutor'));
  help.state.cancelError = new Error('offline');

  await handler.handleUpdate(textUpdate(1, '/cancel'));

  assert.equal(sessions.get('1')?.helpRequestId, 'help-1');
  assert.equal(api.messages[1].text, botStrings.en.tutorCancelFailed);
});

test('clears the conversation but not the help ticket', async () => {
  const { handler, api, sessions } = setup();

  await handler.handleUpdate(textUpdate(1, '/tutor'));
  await handler.handleUpdate(textUpdate(1, 'What is a cell?'));
  await handler.handleUpdate(textUpdate(1, '/clear'));

  const session = sessions.get('1');
  assert.ok(session);
  assert.deepEqual(session.history, []);
  assert.equal(session.helpRequestId, 'help-1');
  assert.equal(api.messages[api.messages.length - 1].text, botStrings.en.clearDone);
});

test('switching language clears the history and uses the new copy', async () => {
  const { handler, api, sessions } = setup();

  await handler.handleUpdate(textUpdate(1, 'What is a cell?'));
  await handler.handleUpdate(textUpdate(1, '/language am'));

  const session = sessions.get('1');
  assert.ok(session);
  assert.equal(session.language, 'am');
  assert.deepEqual(session.history, []);
  assert.equal(api.messages[1].text, botStrings.am.languageChanged.am);
  assert.ok(api.messages[1].options.reply_markup);
});

test('answers callbacks and edits the menu', async () => {
  const { handler, api } = setup();

  await handler.handleUpdate(callbackUpdate(1, CALLBACK.language));

  assert.deepEqual(api.answered, ['cb-1']);
  assert.equal(api.messages[0].text, botStrings.en.languageTitle);
  assert.ok(api.messages[0].options.reply_markup);
});

test('a language callback changes the language', async () => {
  const { handler, api, sessions } = setup();

  await handler.handleUpdate(callbackUpdate(1, CALLBACK.languageAm));

  assert.equal(sessions.get('1')?.language, 'am');
  assert.equal(api.messages[0].text, botStrings.am.languageChanged.am);
});

test('the help callbacks request, check and cancel a ticket', async () => {
  const { handler, api, help, sessions } = setup();

  await handler.handleUpdate(callbackUpdate(1, CALLBACK.requestHelp));
  assert.equal(help.state.requests.length, 1);
  assert.equal(sessions.get('1')?.helpRequestId, 'help-1');

  await handler.handleUpdate(callbackUpdate(1, CALLBACK.helpStatus));
  assert.deepEqual(help.state.statusCalls, ['help-1']);

  await handler.handleUpdate(callbackUpdate(1, CALLBACK.cancelHelp));
  assert.deepEqual(help.state.cancelCalls, ['help-1']);
  assert.equal(sessions.get('1')?.helpRequestId, undefined);
});

test('the back callback shows the main menu', async () => {
  const { handler, api } = setup();

  await handler.handleUpdate(callbackUpdate(1, CALLBACK.back));

  assert.equal(api.messages[0].text, botStrings.en.menuTitle);
  assert.ok(api.messages[0].options.reply_markup);
});

test('an unknown callback only stops the spinner', async () => {
  const { handler, api } = setup();

  await handler.handleUpdate(callbackUpdate(1, 'menu:unknown'));

  assert.deepEqual(api.answered, ['cb-1']);
  assert.equal(api.messages.length, 0);
});

test('says voice is unavailable when transcription is not configured', async () => {
  const { handler, api, ai } = setup();

  await handler.handleUpdate(voiceUpdate(1));

  assert.equal(ai.calls.length, 0);
  assert.equal(api.messages[0].text, botStrings.en.voiceUnavailable);
});

test('answers a transcribed voice note', async () => {
  const voice = fakeVoice({ ok: true, text: 'What is a cell?' });
  const { handler, api, ai } = setup({ voice: voice.voice });

  await handler.handleUpdate(voiceUpdate(1));

  assert.deepEqual(voice.calls, [{ language: 'en' }]);
  assert.equal(ai.calls[0].question, 'What is a cell?');
  assert.equal(api.messages[0].text.startsWith('A cell is the basic unit'), true);
});

test('voice errors use honest, specific copy', async () => {
  const cases: Array<[VoiceResult, string]> = [
    [{ ok: false, reason: 'too-long' }, botStrings.en.voiceTooLong],
    [{ ok: false, reason: 'too-large' }, botStrings.en.voiceTooLarge],
    [{ ok: false, reason: 'empty' }, botStrings.en.voiceNoTranscript],
    [{ ok: false, reason: 'failed' }, botStrings.en.voiceFailed],
    [{ ok: false, reason: 'unavailable' }, botStrings.en.voiceUnavailable],
  ];

  for (const [result, expected] of cases) {
    const voice = fakeVoice(result);
    const { handler, api, ai } = setup({ voice: voice.voice });

    await handler.handleUpdate(voiceUpdate(1));

    assert.equal(ai.calls.length, 0);
    assert.equal(api.messages[0].text, expected);
  }
});

test('a voice note only counts once against the rate limit', async () => {
  const voice = fakeVoice({ ok: true, text: 'What is a cell?' });
  const { handler, api, ai } = setup({
    voice: voice.voice,
    config: { rateLimitMax: 1 },
  });

  await handler.handleUpdate(voiceUpdate(1));
  await handler.handleUpdate(textUpdate(1, 'Second'));

  assert.equal(ai.calls.length, 1);
  assert.match(api.messages[1].text, /Too many messages/);
});
