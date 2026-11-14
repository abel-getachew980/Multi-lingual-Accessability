import type { OutboundSms } from './types';

export interface MessageQueueOptions {
  send: (message: OutboundSms) => Promise<void>;
  /** Total attempts per message, including the first one. */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onError?: (error: unknown, message: OutboundSms, attempts: number) => void;
  /** Injectable for tests so backoff does not slow the suite down. */
  delay?: (ms: number) => Promise<void>;
}

interface QueuedMessage {
  message: OutboundSms;
  attempts: number;
}

/**
 * Sequential outbound queue with exponential backoff.
 *
 * Used when `SMS_REPLY_MODE=api`: the webhook returns immediately and the
 * segments are sent through the provider API. A failed send is retried up to
 * `maxAttempts` before being dropped and reported through `onError`.
 */
export class MessageQueue {
  private readonly items: QueuedMessage[] = [];
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly delay: (ms: number) => Promise<void>;
  private drainPromise: Promise<void> | null = null;
  private stopped = false;

  constructor(private readonly options: MessageQueueOptions) {
    this.maxAttempts = Math.max(options.maxAttempts ?? 3, 1);
    this.baseDelayMs = Math.max(options.baseDelayMs ?? 1_000, 0);
    this.maxDelayMs = Math.max(options.maxDelayMs ?? 15_000, this.baseDelayMs);
    this.delay =
      options.delay ??
      ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  }

  get size(): number {
    return this.items.length;
  }

  get isDraining(): boolean {
    return this.drainPromise !== null;
  }

  enqueue(message: OutboundSms): void {
    if (this.stopped) {
      throw new Error('MessageQueue has been stopped');
    }

    this.items.push({ message, attempts: 0 });
    this.ensureDraining();
  }

  /** Resolves when the queue has finished all retries. Mainly for tests. */
  async waitForIdle(): Promise<void> {
    while (this.drainPromise) {
      await this.drainPromise;
    }
  }

  stop(): void {
    this.stopped = true;
    this.items.length = 0;
  }

  private ensureDraining(): void {
    if (this.drainPromise || this.stopped) return;

    this.drainPromise = this.drain().finally(() => {
      this.drainPromise = null;
      // A message may have been enqueued while the last send was finishing.
      if (this.items.length > 0) this.ensureDraining();
    });
  }

  private async drain(): Promise<void> {
    while (this.items.length > 0 && !this.stopped) {
      const item = this.items.shift();
      if (!item) return;
      await this.deliver(item);
    }
  }

  private async deliver(item: QueuedMessage): Promise<void> {
    while (!this.stopped && item.attempts < this.maxAttempts) {
      item.attempts += 1;

      try {
        await this.options.send(item.message);
        return;
      } catch (error) {
        if (item.attempts >= this.maxAttempts || this.stopped) {
          this.options.onError?.(error, item.message, item.attempts);
          return;
        }

        const backoff = Math.min(
          this.baseDelayMs * 2 ** (item.attempts - 1),
          this.maxDelayMs,
        );
        await this.delay(backoff);
      }
    }
  }
}
