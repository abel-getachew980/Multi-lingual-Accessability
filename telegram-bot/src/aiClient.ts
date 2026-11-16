import type { AiAnswer, Citation, ConversationTurn, Language } from './types';

export interface AiClient {
  ask(
    question: string,
    language: Language,
    history?: ConversationTurn[],
  ): Promise<AiAnswer>;
}

interface HttpAiClientOptions {
  /** Full URL of the app's AI endpoint. */
  url: string;
  /** Preferred provider (`cloud` | `local` | `offline`). */
  provider?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/**
 * Calls `POST /api/ai` on the Next.js app.
 *
 * The app owns provider selection and the offline index, so the bot only
 * forwards the question and the recent conversation.
 */
export class HttpAiClient implements AiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpAiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async ask(
    question: string,
    language: Language,
    history: ConversationTurn[] = [],
  ): Promise<AiAnswer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    const conversationHistory = history.map((turn, index) => ({
      id: `telegram-history-${index}`,
      role: turn.role,
      content: turn.content,
      language,
      timestamp: new Date().toISOString(),
    }));

    try {
      const response = await this.fetchImpl(this.options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          language,
          provider: this.options.provider,
          ...(conversationHistory.length > 0 ? { conversationHistory } : {}),
        }),
        signal: controller.signal,
      });

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
        throw new Error(
          `AI API timed out after ${this.options.timeoutMs} ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
