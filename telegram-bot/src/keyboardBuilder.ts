import { menuLabels } from './strings';
import type { ChatSession, InlineKeyboardMarkup, Language } from './types';

/**
 * Inline keyboard helpers.
 *
 * `callback_data` is limited to 64 bytes by Telegram, so the constants stay
 * short and stable.
 */

export const CALLBACK = {
  ask: 'menu:ask',
  language: 'menu:language',
  humanHelp: 'menu:help',
  clear: 'menu:clear',
  back: 'menu:back',
  requestHelp: 'help:request',
  helpStatus: 'help:status',
  cancelHelp: 'help:cancel',
  languageAm: 'lang:am',
  languageEn: 'lang:en',
} as const;

function keyboard(rows: string[][], labels: Record<string, string>): InlineKeyboardMarkup {
  return {
    inline_keyboard: rows.map((row) =>
      row.map((data) => ({ text: labels[data] ?? data, callback_data: data })),
    ),
  };
}

/** Main menu, always visible from `/start` and `/menu`. */
export function mainMenu(language: Language): InlineKeyboardMarkup {
  const labels = menuLabels[language];
  const buttons: Record<string, string> = {
    [CALLBACK.ask]: labels.ask,
    [CALLBACK.language]: labels.language,
    [CALLBACK.humanHelp]: labels.humanHelp,
    [CALLBACK.clear]: labels.clear,
  };

  return keyboard(
    [
      [CALLBACK.ask],
      [CALLBACK.language, CALLBACK.humanHelp],
      [CALLBACK.clear],
    ],
    buttons,
  );
}

export function languageMenu(language: Language): InlineKeyboardMarkup {
  const labels = menuLabels[language];
  const buttons: Record<string, string> = {
    [CALLBACK.languageAm]: labels.amharic,
    [CALLBACK.languageEn]: labels.english,
    [CALLBACK.back]: labels.back,
  };

  return keyboard(
    [
      [CALLBACK.languageAm, CALLBACK.languageEn],
      [CALLBACK.back],
    ],
    buttons,
  );
}

/**
 * Human help menu. An active request shows status and cancel instead of
 * "request", so a learner cannot accidentally open a second queue ticket.
 */
export function helpMenu(
  language: Language,
  hasActiveRequest: boolean,
): InlineKeyboardMarkup {
  const labels = menuLabels[language];
  const buttons: Record<string, string> = {
    [CALLBACK.requestHelp]: labels.requestHelp,
    [CALLBACK.helpStatus]: labels.status,
    [CALLBACK.cancelHelp]: labels.cancelHelp,
    [CALLBACK.back]: labels.back,
  };

  return keyboard(
    hasActiveRequest
      ? [[CALLBACK.helpStatus], [CALLBACK.cancelHelp], [CALLBACK.back]]
      : [[CALLBACK.requestHelp], [CALLBACK.back]],
    buttons,
  );
}

/** Buttons that go with a queued help request. */
export function pendingHelpMenu(language: Language): InlineKeyboardMarkup {
  const labels = menuLabels[language];
  const buttons: Record<string, string> = {
    [CALLBACK.helpStatus]: labels.status,
    [CALLBACK.cancelHelp]: labels.cancelHelp,
  };

  return keyboard(
    [[CALLBACK.helpStatus], [CALLBACK.cancelHelp]],
    buttons,
  );
}

export function backMenu(language: Language): InlineKeyboardMarkup {
  const labels = menuLabels[language];
  return keyboard([[CALLBACK.back]], { [CALLBACK.back]: labels.back });
}

export function isActiveHelp(session: ChatSession): boolean {
  return (
    typeof session.helpRequestId === 'string' &&
    session.helpStatus !== 'resolved' &&
    session.helpStatus !== 'cancelled'
  );
}
