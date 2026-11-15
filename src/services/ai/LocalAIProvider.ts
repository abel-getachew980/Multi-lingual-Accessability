import type { AIQuery, AIResponse, ContentChunk, Message } from '@/types';
import type {
  AIProviderInterface,
  LocalProviderConfig,
  ProviderQueryOptions,
} from './types';
import { AIProviderError } from './types';
import { citationFromChunk } from './CitationTracker';

const DEFAULT_MODEL = 'llama3';
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_TIMEOUT_MS = 30_000;

interface LocalCompletion {
  response?: string;
  answer?: string;
  content?: string;
  choices?: Array<{ message?: { content?: string } }>;
}

export class LocalAIProvider implements AIProviderInterface {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(config: LocalProviderConfig) {
    this.endpoint = config.endpoint.replace(/\/+$/, '');
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
    const chatMode = this.isChatEndpoint();
    const url = chatMode ? this.endpoint : `${this.endpoint}/api/generate`;
    const body = JSON.stringify(
      chatMode
        ? { model: this.model, messages: this.buildMessages(request, options.contextChunks ?? []), stream: false }
        : { model: this.model, prompt: this.buildPrompt(request, options.contextChunks ?? []), stream: false },
    );

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.request(url, body);
        const data = (await response.json()) as LocalCompletion;
        const answer = this.extractAnswer(data);
        const firstChunk = options.contextChunks?.[0];
        const citation = firstChunk ? citationFromChunk(firstChunk) : undefined;

        return {
          answer,
          ...(citation ? { citation } : {}),
          provider: 'local',
          processingTime: Date.now() - startedAt,
        };
      } catch (error) {
        lastError = error;
        const status = error instanceof AIProviderError ? error.status : undefined;
        const retryable = status === 429 || (status !== undefined && status >= 500) || status === undefined;

        if (!retryable || attempt >= this.maxRetries) break;
        await this.sleep(500 * 2 ** attempt);
      }
    }

    const status = lastError instanceof AIProviderError ? lastError.status : undefined;
    throw new AIProviderError(
      `Local AI request failed${status ? ` (status ${status})` : ''}`,
      'local',
      status,
      { cause: lastError },
    );
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'GET',
        signal: controller.signal,
      });
      return response.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  getName(): string {
    return `Local AI (${this.model})`;
  }

  private isChatEndpoint(): boolean {
    return /\/v1\/|\/chat\/completions|\/api\/chat$/.test(this.endpoint);
  }

  private async request(url: string, body: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AIProviderError(
          `Local AI request failed with status ${response.status}`,
          'local',
          response.status,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError('Local AI request failed', 'local', undefined, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractAnswer(data: LocalCompletion): string {
    const answer = data.response
      ?? data.choices?.[0]?.message?.content
      ?? data.answer
      ?? data.content;

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      throw new AIProviderError('Local AI returned an empty response', 'local');
    }

    return answer.trim();
  }

  private buildPrompt(request: AIQuery, chunks: ContentChunk[]): string {
    const context = [
      ...(request.context ?? []),
      ...chunks.map((chunk, index) => {
        const page = chunk.pageNumber ? `, page ${chunk.pageNumber}` : '';
        const section = chunk.section ? `, ${chunk.section}` : '';
        return `[${index + 1}] ${chunk.courseId}${page}${section}: ${chunk.content}`;
      }),
    ];

    return [
      'You are a learning assistant. Answer only from the course content provided.',
      'If the answer is not present, say that you do not know.',
      context.length > 0 ? `Course content:\n${context.join('\n')}` : '',
      `Question: ${request.question}`,
    ].filter(Boolean).join('\n\n');
  }

  private buildMessages(request: AIQuery, chunks: ContentChunk[]): Message[] {
    return [
      {
        id: 'system',
        role: 'system',
        content: this.buildPrompt({ ...request, question: '' }, chunks).trim(),
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
