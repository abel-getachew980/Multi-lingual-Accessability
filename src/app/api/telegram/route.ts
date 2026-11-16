import { createHash, timingSafeEqual } from 'node:crypto';
import { botEndpoint } from '@/services/telegram/webhookEndpoint';

/**
 * Telegram webhook — Teammate 3
 *
 * Telegram can only call one URL, and the standalone bot (see
 * `telegram-bot/`) may live on another host. This route is the public,
 * stable entry point: it checks the secret Telegram echoes back, then
 * forwards the raw update to the bot's `/telegram` endpoint.
 *
 * Keeping the route thin means the bot can also run in long-polling mode
 * locally without any public URL.
 */

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 1024 * 1024;
const FORWARD_TIMEOUT_MS = 10_000;

interface TelegramUpdateBody {
  update_id: number;
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function secretHeader(request: Request): string | null {
  return request.headers.get('x-telegram-bot-api-secret-token');
}

/**
 * Constant-time comparison. Hashing first keeps the comparison time
 * independent of the secret length, and comparing digests means
 * `timingSafeEqual` never sees buffers of different sizes.
 */
function secretsMatch(expected: string, provided: string | null): boolean {
  if (!provided) return false;

  const expectedDigest = createHash('sha256').update(expected, 'utf-8').digest();
  const providedDigest = createHash('sha256').update(provided, 'utf-8').digest();

  return timingSafeEqual(expectedDigest, providedDigest);
}

function isTelegramUpdate(body: unknown): body is TelegramUpdateBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { update_id?: unknown }).update_id === 'number'
  );
}

export async function POST(request: Request): Promise<Response> {
  const botUrl = process.env.TELEGRAM_BOT_URL?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!botUrl) {
    return errorResponse(
      503,
      'bot_not_configured',
      'TELEGRAM_BOT_URL is not set, so there is nowhere to forward the update.',
    );
  }

  // Without a secret anyone who knows the URL could forge updates. Refuse
  // to accept traffic in production rather than silently trust it.
  if (!secret && isProduction) {
    return errorResponse(
      503,
      'webhook_secret_missing',
      'TELEGRAM_WEBHOOK_SECRET must be set in production.',
    );
  }

  if (secret && !secretsMatch(secret, secretHeader(request))) {
    return errorResponse(
      401,
      'unauthorized',
      'The X-Telegram-Bot-Api-Secret-Token header is missing or wrong.',
    );
  }

  let text: string;

  try {
    text = await request.text();
  } catch {
    return errorResponse(400, 'invalid_body', 'The request body could not be read.');
  }

  if (Buffer.byteLength(text, 'utf-8') > MAX_BODY_BYTES) {
    return errorResponse(413, 'payload_too_large', 'The update is too large.');
  }

  let body: unknown;

  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse(400, 'invalid_json', 'The request body is not valid JSON.');
  }

  if (!isTelegramUpdate(body)) {
    return errorResponse(
      400,
      'invalid_update',
      'The body does not look like a Telegram update.',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);

  try {
    const response = await fetch(botEndpoint(botUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {}),
      },
      body: text,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      // Telegram retries non-2xx responses, which is what we want when the
      // bot was briefly unreachable: the update is not lost.
      return errorResponse(
        502,
        'bot_forward_failed',
        `The Telegram bot responded with ${response.status}.`,
      );
    }

    return Response.json(
      { ok: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return errorResponse(
      502,
      'bot_unreachable',
      'The Telegram bot could not be reached.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function GET(): Response {
  return errorResponse(
    405,
    'method_not_allowed',
    'Telegram sends updates with POST.',
  );
}
