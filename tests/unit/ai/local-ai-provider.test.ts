/** @jest-environment node */
import { LocalAIProvider } from '@/services/ai/LocalAIProvider';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('LocalAIProvider', () => {
  it('parses an Ollama-style generate response', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ response: 'Local answer in Amharic.' }));

    const provider = new LocalAIProvider({
      endpoint: 'http://localhost:11434',
      model: 'llama3',
      fetchImpl: fetchMock,
    });

    const response = await provider.query({
      question: 'ሰላም',
      language: 'am',
      context: ['Course note one'],
    });

    expect(response.answer).toBe('Local answer in Amharic.');
    expect(response.provider).toBe('local');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/api/generate');
    const body = JSON.parse(String(options.body));
    expect(body.model).toBe('llama3');
    expect(body.prompt).toContain('ሰላም');
    expect(body.prompt).toContain('Course note one');
  });

  it('accepts OpenAI-style local servers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'OpenAI-style answer.' } }] }),
    );

    const provider = new LocalAIProvider({
      endpoint: 'http://localhost:8000/v1/chat/completions',
      fetchImpl: fetchMock,
    });

    const response = await provider.query({ question: 'Hello', language: 'en' });

    expect(response.answer).toBe('OpenAI-style answer.');
  });

  it('reports unavailable when the local server cannot be reached', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const provider = new LocalAIProvider({
      endpoint: 'http://localhost:11434',
      fetchImpl: fetchMock,
    });

    await expect(provider.isAvailable()).resolves.toBe(false);
  });

  it('throws a descriptive error when generation fails', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ error: 'no model' }, 500));

    const provider = new LocalAIProvider({
      endpoint: 'http://localhost:11434',
      fetchImpl: fetchMock,
    });

    await expect(
      provider.query({ question: 'Hello', language: 'en' }),
    ).rejects.toThrow(/local ai request failed/i);
  });
});
