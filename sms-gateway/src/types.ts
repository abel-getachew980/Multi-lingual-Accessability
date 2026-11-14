/**
 * Shared types for the SMS gateway.
 *
 * The gateway is a standalone process (see README.md) so that SMS traffic can
 * keep working even when the Next.js web app is redeployed.
 */

export type Language = 'am' | 'en';

export type SmsProviderName = 'twilio' | 'console';

/**
 * `twiml` - reply inside the webhook response (Twilio sends the SMS).
 * `api`   - answer the webhook immediately and send through the provider API.
 */
export type ReplyMode = 'twiml' | 'api';

export interface InboundSms {
  from: string;
  body: string;
  to?: string;
  messageId?: string;
  receivedAt: Date;
}

export interface OutboundSms {
  to: string;
  body: string;
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

export interface SmsSession {
  phoneNumber: string;
  language: Language;
  lastActivity: number;
  /** Answer segments that did not fit in the previous reply. */
  pendingChunks: string[];
  /** Set when the learner asked for a human tutor. */
  helpRequestedAt?: number;
}

export type SmsCommandType =
  | 'question'
  | 'set-language'
  | 'help'
  | 'more'
  | 'reset'
  | 'empty';

export interface ParsedCommand {
  type: SmsCommandType;
  language?: Language;
  question?: string;
}

export interface HandleResult {
  messages: string[];
  session: SmsSession;
  rateLimited: boolean;
}

export interface SmsConfig {
  defaultLanguage: Language;
  /** Maximum SMS segments sent in a single reply (including the "MORE" hint). */
  maxSegmentsPerReply: number;
  maxQuestionLength: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  sessionTtlMs: number;
  aiTimeoutMs: number;
  replyMode: ReplyMode;
}
