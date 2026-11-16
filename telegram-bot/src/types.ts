/**
 * Shared types for the Telegram bot.
 *
 * Only the parts of the Telegram Bot API the bot uses are modelled. The bot
 * talks to the API over `fetch`, so no SDK (and no extra dependency) is
 * required at runtime.
 */

export type Language = 'am' | 'en';

export type BotMode = 'polling' | 'webhook';

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  /** Duration in seconds. */
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  voice?: TelegramVoice;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  reply_markup?: InlineKeyboardMarkup;
  disable_notification?: boolean;
  /** Telegram renders plain text by default, which cannot break on Amharic. */
  parse_mode?: undefined;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface Citation {
  source: string;
  page?: number;
  section?: string;
  url?: string;
  snippet?: string;
}

export interface AiAnswer {
  answer: string;
  citation?: Citation;
  provider?: string;
}

export interface ChatSession {
  chatId: string;
  language: Language;
  lastActivity: number;
  /** Recent turns, capped by `maxHistoryTurns`. */
  history: ConversationTurn[];
  /** Set once the help desk accepted a ticket. */
  helpRequestId?: string;
  helpStatus?: string;
  helpPosition?: number;
  helpRequestedAt?: number;
}

export type CommandType =
  | 'question'
  | 'start'
  | 'help'
  | 'language'
  | 'set-language'
  | 'tutor'
  | 'status'
  | 'cancel'
  | 'clear'
  | 'menu'
  | 'empty';

export interface ParsedCommand {
  type: CommandType;
  language?: Language;
  question?: string;
}

export interface HandleResult {
  handled: boolean;
}

export interface HelpRequestResult {
  requestId: string;
  status?: string;
  position?: number;
  estimatedWaitMinutes?: number;
}

export interface HelpStatusResult extends HelpRequestResult {
  status: string;
}

export interface BotConfig {
  token: string;
  mode: BotMode;
  /** Port for webhook mode. */
  port: number;
  webhookPath: string;
  webhookSecret?: string;
  /** Full public URL of the bot's own webhook; optional, used on startup. */
  webhookUrl?: string;
  apiBaseUrl: string;
  app: {
    /** Base URL of the Next.js app, e.g. http://localhost:3000 */
    baseUrl: string;
    provider?: string;
  };
  ai: {
    url: string;
    provider?: string;
    timeoutMs: number;
  };
  help: {
    url: string;
    timeoutMs: number;
  };
  transcription?: {
    url: string;
    model?: string;
    /** Whisper-compatible language hint (`am` or `en`). */
    language?: string;
    timeoutMs: number;
  };
  behaviour: {
    defaultLanguage: Language;
    maxQuestionLength: number;
    maxHistoryTurns: number;
    rateLimitMax: number;
    rateLimitWindowMs: number;
    sessionTtlMs: number;
    helpRequestCooldownMs: number;
    maxVoiceSeconds: number;
    maxVoiceBytes: number;
  };
}

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly method: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TelegramApiError';
  }
}
