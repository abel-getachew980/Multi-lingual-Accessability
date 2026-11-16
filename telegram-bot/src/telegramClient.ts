import {
  TelegramApiError,
  type InlineKeyboardMarkup,
  type SendMessageOptions,
  type TelegramFile,
  type TelegramUpdate,
} from './types';

export const TELEGRAM_MAX_MESSAGE_LENGTH = 4_096;

export interface BotCommand {
  command: string;
  description: string;
}

export interface TelegramApi {
  sendMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<void>;
  sendChatAction(chatId: string | number, action?: string): Promise<void>;
  answerCallbackQuery(id: string, text?: string): Promise<void>;
  editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<void>;
  getFile(fileId: string): Promise<TelegramFile>;
  downloadFile(filePath: string): Promise<Buffer>;
  getUpdates(offset: number, timeoutSeconds: number): Promise<TelegramUpdate[]>;
  deleteWebhook(dropPendingUpdates?: boolean): Promise<void>;
  setWebhook(url: string, secretToken?: string): Promise<void>;
  setMyCommands(commands: BotCommand[]): Promise<void>;
}

interface TelegramBotApiOptions {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Per-request timeout for ordinary API calls. */
  timeoutMs?: number;
  maxMessageLength?: number;
}

interface ApiEnvelope<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

/**
 * Splits a long answer on paragraph, line or word boundaries.
 *
 * Telegram rejects messages longer than 4096 characters. Splitting here means
 * an answer that filled a screen on the web still arrives complete in chat.
 */
export function splitMessage(
  text: string,
  maxLength: number = TELEGRAM_MAX_MESSAGE_LENGTH,
): string[] {
  const limit = Math.max(1, maxLength);
  const normalized = text.replace(/\r\n/g, '\n').trim();

  if (!normalized) return [];
  if (normalized.length <= limit) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);

    // Prefer a paragraph break, then a line break, then a space. Anything is
    // better than cutting a word (or an Ethiopic syllable) in half, but a
    // single very long word still has to be split at the limit.
    const paragraph = window.lastIndexOf('\n\n');
    const line = window.lastIndexOf('\n');
    const space = window.lastIndexOf(' ');

    const cut =
      paragraph > limit * 0.5
        ? paragraph
        : line > limit * 0.5
          ? line
          : space > 0
            ? space
            : limit;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);

  return chunks;
}

/**
 * Minimal typed client for the Telegram Bot API.
 *
 * `fetch` is injected so the client and the handlers can be tested without a
 * network or a real bot token.
 */
export class HttpTelegramApi implements TelegramApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxMessageLength: number;

  constructor(private readonly options: TelegramBotApiOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://api.telegram.org').replace(
      /\/+$/,
      '',
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxMessageLength = options.maxMessageLength ?? TELEGRAM_MAX_MESSAGE_LENGTH;
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options: SendMessageOptions = {},
  ): Promise<void> {
    const chunks = splitMessage(text, this.maxMessageLength);

    if (chunks.length === 0) return;

    for (let index = 0; index < chunks.length; index += 1) {
      const isLast = index === chunks.length - 1;

      await this.call('sendMessage', {
        chat_id: chatId,
        text: chunks[index],
        ...(isLast && options.reply_markup
          ? { reply_markup: options.reply_markup }
          : {}),
        ...(options.disable_notification
          ? { disable_notification: true }
          : {}),
      });
    }
  }

  async sendChatAction(
    chatId: string | number,
    action = 'typing',
  ): Promise<void> {
    await this.call('sendChatAction', { chat_id: chatId, action });
  }

  async answerCallbackQuery(id: string, text?: string): Promise<void> {
    await this.call('answerCallbackQuery', {
      callback_query_id: id,
      ...(text ? { text } : {}),
    });
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options: SendMessageOptions = {},
  ): Promise<void> {
    await this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...(options.reply_markup ? { reply_markup: options.reply_markup } : {}),
    });
  }

  async getFile(fileId: string): Promise<TelegramFile> {
    return this.call<TelegramFile>('getFile', { file_id: fileId });
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const url = `${this.baseUrl}/file/bot${this.options.token}/${filePath.replace(/^\/+/, '')}`;

    const response = await this.fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new TelegramApiError(
        `Telegram file download responded with ${response.status}`,
        'downloadFile',
        response.status,
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async getUpdates(
    offset: number,
    timeoutSeconds: number,
  ): Promise<TelegramUpdate[]> {
    return this.call<TelegramUpdate[]>(
      'getUpdates',
      {
        offset,
        timeout: timeoutSeconds,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
      },
      // The long poll holds the connection open for `timeoutSeconds`, so the
      // ordinary per-call timeout must not cut it short.
      (timeoutSeconds + 10) * 1_000,
    );
  }

  async deleteWebhook(dropPendingUpdates = false): Promise<void> {
    await this.call('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  async setWebhook(url: string, secretToken?: string): Promise<void> {
    await this.call('setWebhook', {
      url,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
      ...(secretToken ? { secret_token: secretToken } : {}),
    });
  }

  async setMyCommands(commands: BotCommand[]): Promise<void> {
    await this.call('setMyCommands', { commands });
  }

  private async call<T>(
    method: string,
    payload: Record<string, unknown>,
    timeoutMs: number = this.timeoutMs,
  ): Promise<T> {
    const url = `${this.baseUrl}/bot${this.options.token}/${method}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let data: ApiEnvelope<T> | null = null;
      try {
        data = (await response.json()) as ApiEnvelope<T>;
      } catch {
        // A non-JSON body is handled by the status check below.
      }

      if (!response.ok || data?.ok === false) {
        throw new TelegramApiError(
          data?.description ?? `Telegram responded with ${response.status}`,
          method,
          data?.error_code ?? response.status,
        );
      }

      return data?.result as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TelegramApiError(
          `Telegram call ${method} timed out after ${timeoutMs} ms`,
          method,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Convenience type guard for handlers that accept partial dependencies. */
export function hasReplyMarkup(
  options: SendMessageOptions,
): options is SendMessageOptions & { reply_markup: InlineKeyboardMarkup } {
  return options.reply_markup !== undefined;
}
