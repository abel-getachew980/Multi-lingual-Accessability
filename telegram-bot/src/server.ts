import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  BOT_COMMANDS,
  createBot,
  parseUpdate,
  webhookSecretMatches,
  type Bot,
} from './bot';
import type { BotConfig } from './types';

const MAX_BODY_BYTES = 1024 * 1024;
const POLL_TIMEOUT_SECONDS = 30;
const ERROR_RETRY_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;

    if (size > MAX_BODY_BYTES) {
      throw new RangeError('Request body is too large');
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf-8');
}

function secretHeader(req: IncomingMessage): string | null {
  const raw = req.headers['x-telegram-bot-api-secret-token'];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

/**
 * Small HTTP server that receives Telegram updates.
 *
 * Telegram expects a fast 2xx response, so the update is acknowledged first
 * and processed afterwards. Errors are logged; Telegram does not retry an
 * update that was already acknowledged.
 */
export function createWebhookServer(bot: Bot): ReturnType<typeof createServer> {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok',
        mode: 'webhook',
        sessions: bot.sessions.size,
        uptimeSeconds: Math.round(process.uptime()),
      });
      return;
    }

    if (req.method !== 'POST' || url.pathname !== bot.config.webhookPath) {
      sendJson(res, 404, { ok: false, error: 'not_found' });
      return;
    }

    if (
      !webhookSecretMatches(bot.config.webhookSecret, secretHeader(req))
    ) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }

    let body: unknown;

    try {
      const text = await readBody(req);
      body = JSON.parse(text);
    } catch (error) {
      const tooLarge = error instanceof RangeError;
      sendJson(res, tooLarge ? 413 : 400, {
        ok: false,
        error: tooLarge ? 'payload_too_large' : 'invalid_json',
      });
      return;
    }

    const update = parseUpdate(body);
    if (!update) {
      sendJson(res, 400, { ok: false, error: 'invalid_update' });
      return;
    }

    sendJson(res, 200, { ok: true });

    void bot.processUpdate(update).catch((error) => {
      console.error('[telegram] update failed', error);
    });
  });
}

export interface PollingOptions {
  signal?: AbortSignal;
  timeoutSeconds?: number;
}

/**
 * Long polling keeps local development simple: no public URL or TLS needed.
 * Updates are processed one at a time, which preserves chat order.
 */
export async function pollUpdates(
  bot: Bot,
  options: PollingOptions = {},
): Promise<void> {
  const timeout = Math.max(1, options.timeoutSeconds ?? POLL_TIMEOUT_SECONDS);
  let offset = 0;

  while (!options.signal?.aborted) {
    try {
      const updates = await bot.api.getUpdates(offset, timeout);

      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);

        try {
          await bot.processUpdate(update);
        } catch (error) {
          console.error('[telegram] update failed', error);
        }
      }
    } catch (error) {
      if (options.signal?.aborted) return;

      console.error(
        `[telegram] could not fetch updates; retrying in ${ERROR_RETRY_MS / 1_000}s`,
        error,
      );
      await sleep(ERROR_RETRY_MS);
    }
  }
}

/** Starts the bot in the mode selected by `TELEGRAM_MODE`. */
export async function startBot(config: BotConfig): Promise<Bot> {
  const bot = createBot(config);

  try {
    await bot.api.setMyCommands(BOT_COMMANDS);
  } catch (error) {
    console.warn('[telegram] could not register the command menu', error);
  }

  if (config.mode === 'polling') {
    // A leftover webhook would make getUpdates return 409 forever.
    try {
      await bot.api.deleteWebhook(false);
    } catch (error) {
      console.warn('[telegram] could not remove an existing webhook', error);
    }

    console.log('[telegram] bot started in long-polling mode');

    const controller = new AbortController();
    const stop = (signal: string) => {
      console.log(`[telegram] received ${signal}, stopping polling`);
      controller.abort();
    };

    process.on('SIGINT', () => stop('SIGINT'));
    process.on('SIGTERM', () => stop('SIGTERM'));

    await pollUpdates(bot, { signal: controller.signal });
    return bot;
  }

  const server = createWebhookServer(bot);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, () => resolve());
  });

  if (config.webhookUrl) {
    try {
      await bot.api.setWebhook(config.webhookUrl, config.webhookSecret);
      console.log(`[telegram] webhook registered at ${config.webhookUrl}`);
    } catch (error) {
      console.error(
        '[telegram] could not register the webhook; set it manually with setWebhook',
        error,
      );
    }
  } else {
    console.warn(
      '[telegram] TELEGRAM_BOT_WEBHOOK_URL is not set, so the webhook was not registered.',
    );
  }

  console.log(
    `[telegram] webhook server listening on http://localhost:${config.port}${config.webhookPath}`,
  );

  const shutdown = (signal: string) => {
    console.log(`[telegram] received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return bot;
}
