import type { BotConfig, BotMode, Language } from './types';

function readInt(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readLanguage(env: NodeJS.ProcessEnv): Language {
  return env.TELEGRAM_DEFAULT_LANGUAGE === 'en' ? 'en' : 'am';
}

function readMode(env: NodeJS.ProcessEnv): BotMode {
  const mode = (env.TELEGRAM_MODE ?? 'polling').trim().toLowerCase();

  if (mode === 'polling' || mode === 'webhook') return mode;

  throw new Error(
    `Unsupported TELEGRAM_MODE "${mode}". Supported values: polling, webhook.`,
  );
}

function readToken(env: NodeJS.ProcessEnv): string {
  const token = (env.TELEGRAM_BOT_TOKEN ?? '').trim();

  if (!token) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is required. Create a bot with @BotFather and copy its token.',
    );
  }

  // Catches the placeholder from .env.example and other obvious mistakes
  // before the process starts polling with a token that can never work.
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN does not look like a bot token (expected "<id>:<secret>").',
    );
  }

  return token;
}

function readPath(env: NodeJS.ProcessEnv): string {
  const raw = (env.TELEGRAM_WEBHOOK_PATH ?? '/telegram').trim();
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.replace(/\/+$/, '') || '/telegram';
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Reads and validates the bot configuration.
 *
 * Every value has a safe default except the token, so a local run only needs
 * `TELEGRAM_BOT_TOKEN`. Webhook mode also requires a secret because an
 * unauthenticated webhook lets anyone impersonate Telegram.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const token = readToken(env);
  const mode = readMode(env);
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined;

  if (mode === 'webhook' && !webhookSecret) {
    throw new Error(
      'TELEGRAM_WEBHOOK_SECRET is required in webhook mode. Telegram sends it back in the X-Telegram-Bot-Api-Secret-Token header.',
    );
  }

  const appBaseUrl = trimSlash(
    env.APP_BASE_URL ?? 'http://localhost:3000',
  );
  const apiBaseUrl = trimSlash(env.TELEGRAM_API_BASE_URL ?? 'https://api.telegram.org');
  const transcriptionUrl = env.TRANSCRIPTION_API_URL?.trim();

  return {
    token,
    mode,
    port: readInt(env, 'TELEGRAM_BOT_PORT', 3002),
    webhookPath: readPath(env),
    webhookSecret,
    webhookUrl: env.TELEGRAM_BOT_WEBHOOK_URL?.trim() || undefined,
    apiBaseUrl,
    app: {
      baseUrl: appBaseUrl,
      provider: env.AI_PROVIDER,
    },
    ai: {
      url: env.AI_API_URL?.trim() || `${appBaseUrl}/api/ai`,
      provider: env.AI_PROVIDER,
      timeoutMs: readInt(env, 'AI_TIMEOUT_MS', 15_000),
    },
    help: {
      url: env.HELP_API_URL?.trim() || `${appBaseUrl}/api/help`,
      timeoutMs: readInt(env, 'HELP_TIMEOUT_MS', 5_000),
    },
    transcription: transcriptionUrl
      ? {
          url: transcriptionUrl,
          model: env.TRANSCRIPTION_MODEL?.trim() || 'whisper-1',
          language: env.TRANSCRIPTION_LANGUAGE?.trim() || undefined,
          timeoutMs: readInt(env, 'TRANSCRIPTION_TIMEOUT_MS', 20_000),
        }
      : undefined,
    behaviour: {
      defaultLanguage: readLanguage(env),
      maxQuestionLength: readInt(env, 'TELEGRAM_MAX_QUESTION_LENGTH', 1_000),
      maxHistoryTurns: readInt(env, 'TELEGRAM_MAX_HISTORY_TURNS', 8),
      rateLimitMax: readInt(env, 'TELEGRAM_RATE_LIMIT_MAX', 20),
      rateLimitWindowMs: readInt(env, 'TELEGRAM_RATE_LIMIT_WINDOW_MS', 60_000),
      sessionTtlMs: readInt(
        env,
        'TELEGRAM_SESSION_TTL_MS',
        24 * 60 * 60 * 1_000,
      ),
      helpRequestCooldownMs: readInt(
        env,
        'HELP_REQUEST_COOLDOWN_MS',
        10 * 60 * 1_000,
      ),
      maxVoiceSeconds: readInt(env, 'TELEGRAM_MAX_VOICE_SECONDS', 120),
      maxVoiceBytes: readInt(env, 'TELEGRAM_MAX_VOICE_BYTES', 5 * 1024 * 1024),
    },
  };
}
