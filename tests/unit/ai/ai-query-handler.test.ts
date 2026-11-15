/** @jest-environment node */
import {
  handleAIQuery,
  validateAIQueryRequest,
  RateLimiter,
} from '@/services/ai/queryHandler';
import { OfflineFAQProvider } from '@/services/ai/OfflineFAQProvider';

function request(body: unknown, ip = '127.0.0.1'): Request {
  return new Request('http://localhost/api/ai/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('validateAIQueryRequest', () => {
  it('normalizes a valid request', () => {
    expect(
      validateAIQueryRequest({
        question: '  What is photosynthesis?  ',
        language: 'en',
        provider: 'offline',
      }),
    ).toEqual({
      ok: true,
      value: {
        question: 'What is photosynthesis?',
        language: 'en',
        provider: 'offline',
        context: undefined,
      },
    });
  });

  it('rejects an empty question', () => {
    const result = validateAIQueryRequest({ question: '   ', language: 'en' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/question/i);
  });

  it('rejects unsupported languages and providers', () => {
    expect(validateAIQueryRequest({ question: 'Hi', language: 'fr' }).ok).toBe(false);
    expect(
      validateAIQueryRequest({ question: 'Hi', language: 'en', provider: 'magic' }).ok,
    ).toBe(false);
  });

  it('rejects questions longer than the maximum', () => {
    const result = validateAIQueryRequest({
      question: 'x'.repeat(2001),
      language: 'en',
    });
    expect(result.ok).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('allows requests up to the limit and then rejects', () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 });

    expect(limiter.check('user-1').allowed).toBe(true);
    expect(limiter.check('user-1').allowed).toBe(true);

    const blocked = limiter.check('user-1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(limiter.check('user-2').allowed).toBe(true);
  });
});

describe('handleAIQuery', () => {
  const provider = new OfflineFAQProvider({
    entries: [
      {
        id: 'faq-1',
        question: 'What is photosynthesis?',
        answer: 'Plants make food from sunlight.',
        citation: { source: 'Biology', page: 3 },
      },
    ],
  });

  it('returns an answer from the selected provider', async () => {
    const response = await handleAIQuery(request({ question: 'What is photosynthesis?', language: 'en' }), {
      resolveProvider: () => provider,
      rateLimiter: new RateLimiter({ limit: 100, windowMs: 60_000 }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.answer).toBe('Plants make food from sunlight.');
    expect(body.provider).toBe('offline');
    expect(body.citation.source).toBe('Biology');
  });

  it('returns a 400 for invalid JSON', async () => {
    const badRequest = new Request('http://localhost/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    });

    const response = await handleAIQuery(badRequest, {
      resolveProvider: () => provider,
      rateLimiter: new RateLimiter({ limit: 100, windowMs: 60_000 }),
    });

    expect(response.status).toBe(400);
  });

  it('returns a 429 when the rate limit is exceeded', async () => {
    const limiter = new RateLimiter({ limit: 0, windowMs: 60_000 });

    const response = await handleAIQuery(
      request({ question: 'What is photosynthesis?', language: 'en' }),
      { resolveProvider: () => provider, rateLimiter: limiter },
    );

    expect(response.status).toBe(429);
  });

  it('falls back to the offline provider when the primary provider fails', async () => {
    const failingProvider = {
      getName: () => 'Broken Cloud',
      isAvailable: async () => true,
      query: async () => {
        throw new Error('network down');
      },
    };

    const response = await handleAIQuery(
      request({ question: 'What is photosynthesis?', language: 'en', provider: 'cloud' }),
      {
        resolveProvider: () => failingProvider,
        offlineProvider: provider,
        rateLimiter: new RateLimiter({ limit: 100, windowMs: 60_000 }),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.provider).toBe('offline');
    expect(body.fallbackUsed).toBe(true);
    expect(body.answer).toBe('Plants make food from sunlight.');
  });
});
