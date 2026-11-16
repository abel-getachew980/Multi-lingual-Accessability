import type {
  ConversationTurn,
  HelpRequestResult,
  HelpStatusResult,
  Language,
} from './types';

export interface HelpRequestInput {
  chatId: string;
  language: Language;
  conversationHistory: ConversationTurn[];
}

export interface HelpClient {
  requestHelp(input: HelpRequestInput): Promise<HelpRequestResult>;
  getStatus(requestId: string): Promise<HelpStatusResult>;
  cancel(requestId: string): Promise<HelpStatusResult>;
}

interface HttpHelpClientOptions {
  /** Full URL of the app's help endpoint, e.g. http://localhost:3000/api/help */
  url: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface HelpPayload {
  success?: boolean;
  requestId?: unknown;
  id?: unknown;
  status?: unknown;
  position?: unknown;
  estimatedWaitMinutes?: unknown;
  error?: { message?: unknown };
}

function requestIdOf(data: HelpPayload): string | null {
  if (typeof data.requestId === 'string') return data.requestId;
  if (typeof data.id === 'string') return data.id;
  return null;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function statusOf(data: HelpPayload): HelpStatusResult | null {
  const requestId = requestIdOf(data);
  if (!requestId) return null;

  return {
    requestId,
    status: typeof data.status === 'string' ? data.status : 'pending',
    position: numberOrUndefined(data.position),
    estimatedWaitMinutes: numberOrUndefined(data.estimatedWaitMinutes),
  };
}

/**
 * HTTP client for the help desk.
 *
 * The bot never invents a ticket id: a request is only reported as registered
 * when the API returns one. Status and cancel reuse the same endpoint, so the
 * web app and the bot share one queue.
 */
export class HttpHelpClient implements HelpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpHelpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async requestHelp(input: HelpRequestInput): Promise<HelpRequestResult> {
    const data = await this.request<HelpPayload>(this.options.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: `telegram:${input.chatId}`,
        channel: 'telegram',
        language: input.language,
        conversationHistory: input.conversationHistory,
      }),
    });

    if (data.success === false) {
      throw new Error('Help API rejected the request');
    }

    const result = statusOf(data);
    if (!result) {
      throw new Error('Help API did not return a request id');
    }

    return result;
  }

  async getStatus(requestId: string): Promise<HelpStatusResult> {
    const data = await this.request<HelpPayload>(
      `${this.options.url}?id=${encodeURIComponent(requestId)}`,
      { method: 'GET' },
    );

    const result = statusOf(data);
    if (!result) {
      throw new Error('Help API did not return a status');
    }

    return result;
  }

  async cancel(requestId: string): Promise<HelpStatusResult> {
    const data = await this.request<HelpPayload>(
      `${this.options.url}?id=${encodeURIComponent(requestId)}`,
      { method: 'DELETE' },
    );

    const result = statusOf(data);
    if (!result) {
      throw new Error('Help API did not return a status');
    }

    return result;
  }

  private async request<T>(
    url: string,
    init: RequestInit,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Help API responded with ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Help API timed out after ${this.options.timeoutMs} ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
