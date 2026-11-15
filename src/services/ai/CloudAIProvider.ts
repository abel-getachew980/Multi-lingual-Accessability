import type { AIQuery, AIResponse, ContentChunk, Message } from '@/types';
import type {
  AIProviderInterface,
  CloudProviderConfig,
  ProviderQueryOptions,
} from './types';
import { AIProviderError } from './types';
import { citationFromChunk } from './CitationTracker';
import { formatContextLines, languageInstruction } from './textUtils';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 30_000;

interface OpenAIChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
  answer?: string;
  content?: string;
  citation?: AIResponse['citation'];
}

export class CloudAIProvider implements AIProviderInterface {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(config: CloudProviderConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.sleep = config.sleep ?? ((milliseconds) => new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }));
  }

  async query(request: AIQuery, options: ProviderQueryOptions = {}): Promise<AIResponse> {
    const startedAt = Date.now();
    const messages = this.buildMessages(request, options.contextChunks ?? []);
    const body = JSON.stringify({
      model: this.model,
      messages,
      temperature: 0.2,
      stream: false,
    });

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.request(body);
        const data = (await response.json()) as OpenAIChatCompletion;
        const answer = this.extractAnswer(data);
        const firstChunk = options.contextChunks?.[0];
        const citation = data.citation
          ?? (firstChunk ? citationFromChunk(firstChunk) : undefined);

        return {
          answer,
          ...(citation ? { citation } : {}),
          provider: 'cloud',
          processingTime: Date.now() - startedAt,
        };
      } catch (error) {
        lastError = error;

        const retryable = error instanceof AIProviderError ? error.retryable : true;

        if (!retryable || attempt >= this.maxRetries) break;
        await this.sleep(500 * 2 ** attempt);
      }
    }

    if (lastError instanceof AIProviderError && !lastError.retryable) {
      throw lastError;
    }

    const status = lastError instanceof AIProviderError ? lastError.status : undefined;
    throw new AIProviderError(
      `Cloud AI request failed${status ? ` (status ${status})` : ''}`,
      'cloud',
      status,
      { cause: lastError },
    );
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.endpoint);
  }

  getName(): string {
    return 'Cloud AI';
  }

  private async request(body: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AIProviderError(
          `Cloud AI request failed with status ${response.status}`,
          'cloud',
          response.status,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError('Cloud AI request failed', 'cloud', undefined, {
        cause: error,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractAnswer(data: OpenAIChatCompletion): string {
    const answer = data.choices?.[0]?.message?.content ?? data.answer ?? data.content;

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      throw new AIProviderError('Cloud AI returned an empty response', 'cloud');
    }

    return answer.trim();
  }

  private buildMessages(request: AIQuery, chunks: ContentChunk[]): Message[] {
    const contextLines = formatContextLines(request, chunks);

    return [
      {
        id: 'system',
        role: 'system',
        content: [
          'You are a learning assistant. Answer only from the course content provided.',
          languageInstruction(request.language),
          'If the answer is not present in the content, say that you do not know.',
          'Include source references when possible.',
          contextLines.length > 0 ? `Course content:\n${contextLines.join('\n')}` : '',
        ].filter(Boolean).join('\n\n'),
        language: request.language,
        timestamp: new Date(),
      },
      ...(request.conversationHistory ?? []).slice(-6),
      {
        id: 'user',
        role: 'user',
        content: request.question,
        language: request.language,
        timestamp: new Date(),
      },
    ];
  }
}
