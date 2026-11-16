import type { SignalRole, SignalType } from '@/services/help/signalStore';

export interface IncomingSignal {
  id: number;
  role: SignalRole;
  type: SignalType;
  payload: unknown;
  createdAt: number;
}

export interface SignalingClientOptions {
  requestId: string;
  role: SignalRole;
  /** Defaults to the same origin. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  onSignal: (signal: IncomingSignal) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_POLL_MS = 1_500;

/**
 * Polls the signaling endpoint and posts local SDP/ICE messages.
 *
 * Polling (rather than a WebSocket) keeps the deployment simple: the route
 * works on any Next.js host, including ones that do not support long-lived
 * connections. The messages are small and only exchanged during the handshake.
 */
export class SignalingClient {
  private nextSince = 0;
  private stopped = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollIntervalMs: number;

  constructor(private readonly options: SignalingClientOptions) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.pollIntervalMs = Math.max(250, options.pollIntervalMs ?? DEFAULT_POLL_MS);
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getNextSince(): number {
    return this.nextSince;
  }

  async send(type: SignalType, payload: unknown): Promise<void> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/help/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: this.options.requestId,
        role: this.options.role,
        type,
        payload,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Could not send the ${type} signal (${response.status})`);
    }
  }

  async pollOnce(): Promise<IncomingSignal[]> {
    if (this.polling) return [];
    this.polling = true;

    try {
      const params = new URLSearchParams({
        requestId: this.options.requestId,
        role: this.options.role,
        since: String(this.nextSince),
      });

      const response = await this.fetchImpl(
        `${this.baseUrl}/api/help/signal?${params.toString()}`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error(`Could not read signals (${response.status})`);
      }

      const data = (await response.json()) as {
        messages?: IncomingSignal[];
        nextSince?: number;
      };

      if (typeof data.nextSince === 'number' && data.nextSince > this.nextSince) {
        this.nextSince = data.nextSince;
      }

      const messages = Array.isArray(data.messages) ? data.messages : [];
      messages.forEach((message) => this.options.onSignal(message));
      return messages;
    } catch (error) {
      this.options.onError?.(
        error instanceof Error ? error : new Error('Signaling failed'),
      );
      return [];
    } finally {
      this.polling = false;
    }
  }

  private schedule(delay: number): void {
    if (this.stopped) return;

    this.timer = setTimeout(() => {
      void this.pollOnce().finally(() => {
        if (!this.stopped) this.schedule(this.pollIntervalMs);
      });
    }, delay);
  }
}
