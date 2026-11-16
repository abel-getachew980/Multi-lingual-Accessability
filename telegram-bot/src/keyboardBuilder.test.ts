import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALLBACK,
  backMenu,
  helpMenu,
  isActiveHelp,
  languageMenu,
  mainMenu,
  pendingHelpMenu,
} from './keyboardBuilder';
import { menuLabels } from './strings';
import type { ChatSession } from './types';

function session(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    chatId: '1',
    language: 'en',
    lastActivity: 0,
    history: [],
    ...overrides,
  };
}

test('the main menu uses the learner language', () => {
  const menu = mainMenu('am');
  const labels = menu.inline_keyboard.flat().map((button) => button.text);

  assert.deepEqual(labels, [
    menuLabels.am.ask,
    menuLabels.am.language,
    menuLabels.am.humanHelp,
    menuLabels.am.clear,
  ]);
  assert.deepEqual(
    menu.inline_keyboard.flat().map((button) => button.callback_data),
    [CALLBACK.ask, CALLBACK.language, CALLBACK.humanHelp, CALLBACK.clear],
  );
});

test('the language menu offers both languages and a way back', () => {
  const menu = languageMenu('en');
  const rows = menu.inline_keyboard;

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows[0].map((button) => button.callback_data),
    [CALLBACK.languageAm, CALLBACK.languageEn],
  );
  assert.equal(rows[1][0].callback_data, CALLBACK.back);
});

test('the help menu offers request when no ticket exists', () => {
  const menu = helpMenu('en', false);
  const data = menu.inline_keyboard.flat().map((button) => button.callback_data);

  assert.deepEqual(data, [CALLBACK.requestHelp, CALLBACK.back]);
});

test('the help menu hides a duplicate request while one is active', () => {
  const menu = helpMenu('am', true);
  const data = menu.inline_keyboard.flat().map((button) => button.callback_data);

  assert.deepEqual(data, [
    CALLBACK.helpStatus,
    CALLBACK.cancelHelp,
    CALLBACK.back,
  ]);
});

test('the pending menu shows only status and cancel', () => {
  const data = pendingHelpMenu('en')
    .inline_keyboard.flat()
    .map((button) => button.callback_data);

  assert.deepEqual(data, [CALLBACK.helpStatus, CALLBACK.cancelHelp]);
});

test('the back menu has a single button', () => {
  const rows = backMenu('am').inline_keyboard;

  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 1);
  assert.equal(rows[0][0].callback_data, CALLBACK.back);
});

test('callback data stays within Telegram 64 byte limit', () => {
  const all = Object.values(CALLBACK);

  all.forEach((data) => {
    assert.ok(Buffer.byteLength(data, 'utf-8') <= 64, `${data} is too long`);
  });
});

test('a ticket is active until it is resolved or cancelled', () => {
  assert.equal(isActiveHelp(session()), false);
  assert.equal(isActiveHelp(session({ helpRequestId: 'help-1' })), true);
  assert.equal(
    isActiveHelp(session({ helpRequestId: 'help-1', helpStatus: 'pending' })),
    true,
  );
  assert.equal(
    isActiveHelp(session({ helpRequestId: 'help-1', helpStatus: 'resolved' })),
    false,
  );
  assert.equal(
    isActiveHelp(session({ helpRequestId: 'help-1', helpStatus: 'cancelled' })),
    false,
  );
});
