import type { AiAnswer, Citation, Language } from './types';

export interface AiClient {
  ask(question: string, language: Language): Promise<AiAnswer>;
}

interface HttpAiClientOptions {
  /** Base URL of the Next.js app, e.g. http://localhost:3000 */
  baseUrl: string;
  /** Preferred provider passed through to the app (`cloud` | `local` | `offline`). */
  provider?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/** The app exposes the query endpoint at POST /api/ai. */
const QUERY_PATH = '/api/ai';

export class HttpAiClient implements AiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpAiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async ask(question: string, language: Language): Promise<AiAnswer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImpl(
        `${this.options.baseUrl.replace(/\/+$/, '')}${QUERY_PATH}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            language,
            provider: this.options.provider,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`AI API responded with ${response.status}`);
      }

      const data = (await response.json()) as {
        answer?: unknown;
        citation?: Citation;
        provider?: string;
      };

      if (typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error('AI API returned an empty answer');
      }

      return {
        answer: data.answer.trim(),
        citation: data.citation,
        provider: data.provider,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`AI API timed out after ${this.options.timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
