import { timingSafeEqual } from 'node:crypto';
import { HttpAiClient, type AiClient } from './aiClient';
import { HttpHelpClient, type HelpClient } from './helpClient';
import { MessageHandler } from './messageHandler';
import { SlidingWindowRateLimiter } from './rateLimiter';
import { InMemorySessionStore } from './sessionManager';
import {
  HttpTelegramApi,
  type BotCommand,
  type TelegramApi,
} from './telegramClient';
import type { BotConfig, HandleResult, TelegramUpdate } from './types';
import { VoiceHandler } from './voiceHandler';

export interface BotDependencies {
  api?: TelegramApi;
  ai?: AiClient;
  help?: HelpClient;
  voice?: VoiceHandler;
  sessions?: InMemorySessionStore;
  limiter?: SlidingWindowRateLimiter;
  now?: () => number;
}

export interface Bot {
  config: BotConfig;
  api: TelegramApi;
  handler: MessageHandler;
  sessions: InMemorySessionStore;
  limiter: SlidingWindowRateLimiter;
  processUpdate(update: TelegramUpdate): Promise<HandleResult>;
}

/** Shown in Telegram's command menu. */
export const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Start the tutor / ቱቶሩን ጀምር' },
  { command: 'help', description: 'How to use the bot / እንዴት እንደሚሠራ' },
  { command: 'language', description: 'Change language / ቋንቋ ቀይር' },
  { command: 'tutor', description: 'Ask for a human tutor / የሰው እርዳታ' },
  { command: 'status', description: 'Help request status / የጥያቄ ሁኔታ' },
  { command: 'cancel', description: 'Cancel the help request / ጥያቄ ሰርዝ' },
  { command: 'clear', description: 'Clear the conversation / ውይይት አጽዳ' },
];

/**
 * Builds the bot from a configuration plus optional injected dependencies.
 *
 * The HTTP clients are created here once, so the poll/webhook loop and the
 * tests share exactly the same wiring.
 */
export function createBot(config: BotConfig, deps: BotDependencies = {}): Bot {
  const api =
    deps.api ??
    new HttpTelegramApi({
      token: config.token,
      baseUrl: config.apiBaseUrl,
    });

  const sessions =
    deps.sessions ??
    new InMemorySessionStore(config.behaviour.sessionTtlMs, deps.now);
  const limiter =
    deps.limiter ??
    new SlidingWindowRateLimiter(
      config.behaviour.rateLimitMax,
      config.behaviour.rateLimitWindowMs,
      deps.now,
    );

  const voice =
    deps.voice ??
    new VoiceHandler({
      client: api,
      transcription: config.transcription,
      maxSeconds: config.behaviour.maxVoiceSeconds,
      maxBytes: config.behaviour.maxVoiceBytes,
      onError: (error, note) => {
        console.error(
          `[telegram] could not transcribe a ${note.duration}s voice note`,
          error,
        );
      },
    });

  const handler = new MessageHandler({
    api,
    ai:
      deps.ai ??
      new HttpAiClient({
        url: config.ai.url,
        provider: config.ai.provider,
        timeoutMs: config.ai.timeoutMs,
      }),
    help:
      deps.help ??
      new HttpHelpClient({
        url: config.help.url,
        timeoutMs: config.help.timeoutMs,
      }),
    sessions,
    limiter,
    voice,
    config: config.behaviour,
    now: deps.now,
    onAiError: (error, question) => {
      console.error(
        `[telegram] AI request failed for "${question.slice(0, 60)}"`,
        error,
      );
    },
    onHelpError: (error, chatId) => {
      console.error(`[telegram] help request failed for chat ${chatId}`, error);
    },
  });

  return {
    config,
    api,
    handler,
    sessions,
    limiter,
    processUpdate: (update) => handler.handleUpdate(update),
  };
}

/** Validates the small part of an update the bot relies on. */
export function parseUpdate(body: unknown): TelegramUpdate | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const update = body as Record<string, unknown>;
  if (typeof update.update_id !== 'number') return null;

  return update as unknown as TelegramUpdate;
}

/**
 * Constant-time comparison of Telegram's secret header.
 *
 * Without the secret anyone who knows the webhook path could forge updates,
 * so a missing or different value is rejected.
 */
export function webhookSecretMatches(
  expected: string | undefined,
  provided: string | null | undefined,
): boolean {
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected, 'utf-8');
  const providedBuffer = Buffer.from(provided, 'utf-8');

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
