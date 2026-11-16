import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_COMMANDS,
  createBot,
  parseUpdate,
  webhookSecretMatches,
} from './bot';
import { loadConfig } from './config';
import type { AiClient } from './aiClient';
import type { HelpClient, HelpRequestInput } from './helpClient';
import type { TelegramApi } from './telegramClient';
import type { TelegramUpdate } from './types';

const TOKEN = '123456789:AAHtest-token_value';

function config() {
  return loadConfig({
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_DEFAULT_LANGUAGE: 'en',
    TELEGRAM_RATE_LIMIT_MAX: '100',
  });
}

function fakeApi(): TelegramApi & { sent: string[] } {
  const sent: string[] = [];

  const api: TelegramApi = {
    async sendMessage(_chatId, text) {
      sent.push(text);
    },
    async sendChatAction() {},
    async answerCallbackQuery() {},
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

  return Object.assign(api, { sent });
}

function fakeAi(): AiClient {
  return {
    async ask() {
      return { answer: 'Answer' };
    },
  };
}

function fakeHelp(): HelpClient & { requests: HelpRequestInput[] } {
  const requests: HelpRequestInput[] = [];

  const help: HelpClient = {
    async requestHelp(input) {
      requests.push(input);
      return { requestId: 'help-1', status: 'pending', position: 1 };
    },
    async getStatus(requestId) {
      return { requestId, status: 'pending' };
    },
    async cancel(requestId) {
      return { requestId, status: 'cancelled' };
    },
  };

  return Object.assign(help, { requests });
}

function textUpdate(chatId: number, text: string): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'Learner', is_bot: false },
      date: 1_700_000_000,
      text,
    },
  };
}

test('parseUpdate accepts a well formed update', () => {
  const update = textUpdate(1, '/start');
  assert.equal(parseUpdate(update), update);
});

test('parseUpdate rejects malformed bodies', () => {
  assert.equal(parseUpdate(null), null);
  assert.equal(parseUpdate(undefined), null);
  assert.equal(parseUpdate([]), null);
  assert.equal(parseUpdate('update'), null);
  assert.equal(parseUpdate({}), null);
  assert.equal(parseUpdate({ update_id: '1' }), null);
});

test('webhookSecretMatches is a strict constant-time comparison', () => {
  assert.equal(webhookSecretMatches('secret', 'secret'), true);
  assert.equal(webhookSecretMatches('secret', 'secreT'), false);
  assert.equal(webhookSecretMatches('secret', 'secret-longer'), false);
  assert.equal(webhookSecretMatches(undefined, 'secret'), false);
  assert.equal(webhookSecretMatches('secret', undefined), false);
  assert.equal(webhookSecretMatches('secret', null), false);
  assert.equal(webhookSecretMatches('', ''), false);
});

test('BOT_COMMANDS is unique and includes the core commands', () => {
  const names = BOT_COMMANDS.map((command) => command.command);

  assert.equal(new Set(names).size, names.length);
  ['start', 'help', 'language', 'tutor', 'status', 'cancel', 'clear'].forEach(
    (name) => assert.ok(names.includes(name), `missing /${name}`),
  );
  BOT_COMMANDS.forEach((command) => {
    assert.ok(command.description.length > 0);
    assert.ok(command.description.length <= 256);
  });
});

test('createBot wires injected dependencies and processes updates', async () => {
  const api = fakeApi();
  const ai = fakeAi();
  const help = fakeHelp();

  const bot = createBot(config(), { api, ai, help });

  const result = await bot.processUpdate(textUpdate(7, 'What is a cell?'));

  assert.deepEqual(result, { handled: true });
  assert.equal(api.sent.length, 1);
  assert.equal(api.sent[0], 'Answer');
  assert.equal(bot.sessions.size, 1);
});

test('createBot builds its own clients from the config', async () => {
  const bot = createBot(config(), { api: fakeApi() });

  assert.equal(typeof bot.handler.handleUpdate, 'function');
  assert.equal(typeof bot.processUpdate, 'function');
  assert.equal(bot.config.token, TOKEN);
});
