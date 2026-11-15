/** @jest-environment node */
import { CloudAIProvider } from '@/services/ai/CloudAIProvider';
import type { ContentChunk } from '@/types';

const chunk: ContentChunk = {
  id: 'chunk-1',
  courseId: 'course-bio',
  content: 'Photosynthesis converts sunlight into chemical energy.',
  pageNumber: 7,
  section: 'Energy',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CloudAIProvider', () => {
  it('sends course context to an OpenAI-compatible endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'Plants make food from sunlight.' } }],
      }),
    );

    const provider = new CloudAIProvider({
      apiKey: 'test-key',
      endpoint: 'https://api.example.com/v1/chat/completions',
      model: 'test-model',
      fetchImpl: fetchMock,
    });

    const response = await provider.query(
      { question: 'How do plants eat?', language: 'en' },
      { contextChunks: [chunk] },
    );

    expect(response.answer).toBe('Plants make food from sunlight.');
    expect(response.provider).toBe('cloud');
    expect(response.citation).toEqual({
      source: 'course-bio',
      page: 7,
      section: 'Energy',
      snippet: chunk.content,
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    const body = JSON.parse(String(options.body));
    expect(body.model).toBe('test-model');
    expect(JSON.stringify(body.messages)).toContain('Photosynthesis');
    expect(JSON.stringify(body.messages)).toContain('only');
  });

  it('retries rate-limited requests with exponential backoff', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429))
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: 'Retried answer.' } }] }),
      );

    const provider = new CloudAIProvider({
      apiKey: 'test-key',
      endpoint: 'https://api.example.com/v1/chat/completions',
      fetchImpl: fetchMock,
      sleep,
      maxRetries: 2,
    });

    const response = await provider.query({ question: 'Retry?', language: 'en' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(response.answer).toBe('Retried answer.');
  });

  it('throws a descriptive error after exhausting retries', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ error: 'down' }, 503));

    const provider = new CloudAIProvider({
      apiKey: 'test-key',
      endpoint: 'https://api.example.com/v1/chat/completions',
      fetchImpl: fetchMock,
      maxRetries: 1,
      sleep: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      provider.query({ question: 'Anybody there?', language: 'en' }),
    ).rejects.toThrow(/cloud ai request failed/i);
  });

  it('reports availability only when configured', async () => {
    const provider = new CloudAIProvider({
      apiKey: 'test-key',
      endpoint: 'https://api.example.com/v1/chat/completions',
      fetchImpl: jest.fn(),
    });

    await expect(provider.isAvailable()).resolves.toBe(true);
    expect(provider.getName()).toContain('Cloud');
  });
});
