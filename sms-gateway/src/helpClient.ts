import type { ConversationTurn, Language } from './types';

export interface HelpRequestInput {
  phoneNumber: string;
  language: Language;
  conversationHistory: ConversationTurn[];
}

export interface HelpRequestResult {
  requestId: string;
  status?: string;
}

export interface HelpClient {
  requestHelp(input: HelpRequestInput): Promise<HelpRequestResult>;
}

interface HttpHelpClientOptions {
  /** Full URL of the app's help endpoint, e.g. http://localhost:3000/api/help */
  url: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export class HttpHelpClient implements HelpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpHelpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async requestHelp(input: HelpRequestInput): Promise<HelpRequestResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImpl(this.options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: `sms:${input.phoneNumber}`,
          channel: 'sms',
          phoneNumber: input.phoneNumber,
          language: input.language,
          conversationHistory: input.conversationHistory,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Help API responded with ${response.status}`);
      }

      const data = (await response.json()) as {
        requestId?: unknown;
        id?: unknown;
        status?: string;
        success?: boolean;
      };

      if (data.success === false) {
        throw new Error('Help API rejected the request');
      }

      const requestId =
        typeof data.requestId === 'string'
          ? data.requestId
          : typeof data.id === 'string'
            ? data.id
            : `sms-help-${Date.now()}`;

      return { requestId, status: data.status };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Help API timed out after ${this.options.timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
