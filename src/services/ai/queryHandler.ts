import type { AIProvider, Language, Message } from '@/types';
import type { AIProviderInterface, ValidationResult } from './types';
import { createAIProviderFromEnv } from './AIProviderFactory';
import { OfflineFAQProvider } from './OfflineFAQProvider';
import { courseIndexer } from './CourseIndexer';

const MAX_QUESTION_LENGTH = 2_000;
const VALID_LANGUAGES: Language[] = ['am', 'en'];
const VALID_PROVIDERS: AIProvider[] = ['cloud', 'local', 'offline'];

function parseTimestamp(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function validateAIQueryRequest(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const body = input as Record<string, unknown>;

  if (typeof body.question !== 'string' || body.question.trim().length === 0) {
    return { ok: false, error: 'A non-empty question is required' };
  }

  const question = body.question.trim();
  if (question.length > MAX_QUESTION_LENGTH) {
    return { ok: false, error: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer` };
  }

  const language = body.language ?? 'am';
  if (typeof language !== 'string' || !VALID_LANGUAGES.includes(language as Language)) {
    return { ok: false, error: 'Language must be "am" or "en"' };
  }

  const provider = body.provider ?? 'offline';
  if (typeof provider !== 'string' || !VALID_PROVIDERS.includes(provider as AIProvider)) {
    return { ok: false, error: 'Provider must be "cloud", "local", or "offline"' };
  }

  let context: string[] | undefined;
  if (body.context !== undefined) {
    if (!Array.isArray(body.context) || body.context.some((item) => typeof item !== 'string')) {
      return { ok: false, error: 'Context must be an array of strings' };
    }
    context = body.context.map((item) => String(item).trim()).filter(Boolean);
  }

  let conversationHistory: Message[] | undefined;
  if (body.conversationHistory !== undefined) {
    if (!Array.isArray(body.conversationHistory)) {
      return { ok: false, error: 'conversationHistory must be an array of messages' };
    }

    const history: Message[] = [];
    for (let index = 0; index < body.conversationHistory.length; index += 1) {
      const item = body.conversationHistory[index];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return { ok: false, error: 'Each conversation history item must be a message object' };
      }

      const record = item as Record<string, unknown>;
      const role = record.role;
      if (
        (role !== 'user' && role !== 'assistant' && role !== 'system')
        || typeof record.content !== 'string'
      ) {
        return { ok: false, error: 'Conversation history messages require a valid role and content' };
      }

      const itemLanguage = record.language === 'am' || record.language === 'en'
        ? record.language
        : (language as Language);
      history.push({
        id: typeof record.id === 'string' ? record.id : `history-${index}`,
        role,
        content: record.content,
        language: itemLanguage,
        timestamp: parseTimestamp(record.timestamp),
      });
    }

    conversationHistory = history.slice(-20);
  }

  return {
    ok: true,
    value: {
      question,
      language: language as Language,
      provider: provider as AIProvider,
      context,
      conversationHistory,
    },
  };
}

interface RateLimiterOptions {
  limit?: number;
  windowMs?: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: RateLimiterOptions = {}) {
    this.limit = options.limit ?? 30;
    this.windowMs = options.windowMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

    if (timestamps.length >= this.limit) {
      this.hits.set(key, timestamps);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, (timestamps[0] ?? now) + this.windowMs - now),
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    return {
      allowed: true,
      remaining: Math.max(0, this.limit - timestamps.length),
      retryAfterMs: 0,
    };
  }
}

const defaultRateLimiter = new RateLimiter();
const defaultOfflineProvider = new OfflineFAQProvider();

interface HandleAIQueryDependencies {
  resolveProvider?: (provider: AIProvider) => AIProviderInterface;
  offlineProvider?: AIProviderInterface;
  rateLimiter?: RateLimiter;
}

function errorResponse(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json(
    { success: false, error: { code, message } },
    { status, headers },
  );
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function handleAIQuery(
  request: Request,
  dependencies: HandleAIQueryDependencies = {},
): Promise<Response> {
  const limiter = dependencies.rateLimiter ?? defaultRateLimiter;
  const rateLimit = limiter.check(clientKey(request));

  if (!rateLimit.allowed) {
    return errorResponse(
      429,
      'RATE_LIMITED',
      'Too many requests. Please wait before trying again.',
      { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }

  const validation = validateAIQueryRequest(body);
  if (!validation.ok) {
    return errorResponse(400, 'INVALID_REQUEST', validation.error);
  }

  const { question, language, provider, context, conversationHistory } = validation.value;
  const resolveProvider = dependencies.resolveProvider
    ?? ((selectedProvider: AIProvider) => createAIProviderFromEnv({}, selectedProvider));

  const startedAt = Date.now();
  const contextChunks = (await courseIndexer.search(question, { language, limit: 5 }))
    .map((result) => result.chunk);
  const aiQuery = { question, language, context, conversationHistory };

  try {
    const aiProvider = resolveProvider(provider);
    const result = await aiProvider.query(aiQuery, { contextChunks });

    return Response.json({
      success: true,
      answer: result.answer,
      citation: result.citation,
      provider: result.provider,
      confidence: result.confidence,
      processingTime: result.processingTime ?? Date.now() - startedAt,
      fallbackUsed: false,
    });
  } catch (primaryError) {
    if (provider !== 'offline') {
      try {
        const offlineProvider = dependencies.offlineProvider ?? defaultOfflineProvider;
        const fallback = await offlineProvider.query(aiQuery, { contextChunks });

        return Response.json({
          success: true,
          answer: fallback.answer,
          citation: fallback.citation,
          provider: 'offline',
          confidence: fallback.confidence,
          processingTime: Date.now() - startedAt,
          fallbackUsed: true,
        });
      } catch (fallbackError) {
        console.error('AI query failed and offline fallback failed', {
          primary: primaryError instanceof Error ? primaryError.message : String(primaryError),
          fallback: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }
    } else {
      console.error('AI query failed', {
        error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      });
    }

    return errorResponse(
      502,
      'AI_UNAVAILABLE',
      'The AI service is currently unavailable. Please try again.',
    );
  }
}

export function getStatus(): Response {
  return Response.json({
    success: true,
    status: 'ok',
    providers: VALID_PROVIDERS,
    languages: VALID_LANGUAGES,
  });
}
