import type { Language, ReplyMode, SmsConfig, SmsProviderName } from './types';

export interface GatewayConfig {
  port: number;
  provider: SmsProviderName;
  twilio: {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
    /** Public URL Twilio is configured to call. Required to verify signatures. */
    webhookUrl?: string;
  };
  ai: {
    /** Base URL of the Next.js app, e.g. http://localhost:3000 */
    baseUrl: string;
    provider?: string;
  };
  sms: SmsConfig;
}

function readInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readLanguage(env: NodeJS.ProcessEnv): Language {
  return env.SMS_DEFAULT_LANGUAGE === 'en' ? 'en' : 'am';
}

function readProvider(env: NodeJS.ProcessEnv): SmsProviderName {
  const provider = (env.SMS_PROVIDER ?? 'console').trim().toLowerCase();

  if (provider === 'twilio' || provider === 'console') return provider;

  throw new Error(
    `Unsupported SMS_PROVIDER "${provider}". Supported values: twilio, console.`,
  );
}

function readReplyMode(env: NodeJS.ProcessEnv): ReplyMode {
  const mode = (env.SMS_REPLY_MODE ?? 'twiml').trim().toLowerCase();

  if (mode === 'twiml' || mode === 'api') return mode;

  throw new Error(`Unsupported SMS_REPLY_MODE "${mode}". Supported values: twiml, api.`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const provider = readProvider(env);

  if (provider === 'twilio') {
    const missing = ['SMS_ACCOUNT_SID', 'SMS_AUTH_TOKEN', 'SMS_FROM_NUMBER'].filter(
      (key) => !env[key],
    );

    if (missing.length > 0) {
      throw new Error(`SMS_PROVIDER=twilio is missing: ${missing.join(', ')}`);
    }
  }

  return {
    port: readInt(env, 'PORT', 3001),
    provider,
    twilio: {
      accountSid: env.SMS_ACCOUNT_SID,
      authToken: env.SMS_AUTH_TOKEN,
      fromNumber: env.SMS_FROM_NUMBER,
      webhookUrl: env.TWILIO_WEBHOOK_URL,
    },
    ai: {
      baseUrl: env.AI_API_URL ?? 'http://localhost:3000',
      provider: env.AI_PROVIDER,
    },
    sms: {
      defaultLanguage: readLanguage(env),
      maxSegmentsPerReply: readInt(env, 'SMS_MAX_SEGMENTS', 3),
      maxQuestionLength: readInt(env, 'SMS_MAX_QUESTION_LENGTH', 500),
      rateLimitMax: readInt(env, 'SMS_RATE_LIMIT_MAX', 10),
      rateLimitWindowMs: readInt(env, 'SMS_RATE_LIMIT_WINDOW_MS', 60_000),
      sessionTtlMs: readInt(env, 'SMS_SESSION_TTL_MS', 24 * 60 * 60 * 1_000),
      aiTimeoutMs: readInt(env, 'AI_TIMEOUT_MS', 8_000),
      replyMode: readReplyMode(env),
    },
  };
}
