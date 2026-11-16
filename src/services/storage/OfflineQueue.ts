import type { KVStore } from './KVStore';
import {
  STORES,
  type QueueSyncResult,
  type QueuedRequest,
  type QueuedRequestInput,
} from './types';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_ITEMS = 50;

export interface OfflineQueueOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Total attempts per request before it is dropped. */
  maxAttempts?: number;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Upper bound so a long offline session cannot fill the tab's storage. */
  maxItems?: number;
}

function createId(now: number): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `queue-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Holds requests that could not be sent because the learner was offline.
 *
 * The response body is returned on success so the caller can use it: the chat
 * context feeds the answer of a queued question back into the transcript
 * instead of silently throwing it away.
 */
export class OfflineQueue {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;
  private readonly maxItems: number;

  constructor(
    private readonly store: KVStore,
    options: OfflineQueueOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.now = options.now ?? Date.now;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.maxItems = Math.max(1, options.maxItems ?? DEFAULT_MAX_ITEMS);
  }

  async enqueue(input: QueuedRequestInput): Promise<QueuedRequest> {
    if (!input.url) {
      throw new Error('Queued requests need a URL');
    }

    const request: QueuedRequest = {
      id: createId(this.now()),
      url: input.url,
      method: (input.method ?? 'POST').toUpperCase(),
      body: input.body,
      headers: input.headers,
      label: input.label,
      createdAt: this.now(),
      attempts: 0,
    };

    await this.enforceLimit();
    await this.store.set(STORES.queue, request);
    return request;
  }

  async list(): Promise<QueuedRequest[]> {
    const items = await this.store.getAll<QueuedRequest>(STORES.queue);
    return items.sort((a, b) => a.createdAt - b.createdAt);
  }

  async size(): Promise<number> {
    return (await this.list()).length;
  }

  async remove(id: string): Promise<void> {
    await this.store.delete(STORES.queue, id);
  }

  async clear(): Promise<void> {
    await this.store.clear(STORES.queue);
  }

  /**
   * Sends queued requests oldest-first.
   *
   * A request is dropped when the server answers with a permanent client error
   * (4xx other than 408/425/429) or when it runs out of attempts. Transient
   * failures stay in the queue for the next reconnection.
   */
  async sync(): Promise<QueueSyncResult> {
    const result: QueueSyncResult = { sent: [], failed: [], dropped: [] };
    const items = await this.list();

    for (const item of items) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
          signal: controller.signal,
          cache: 'no-store',
        });
        const body = await response.text();

        if (response.ok) {
          result.sent.push({ request: item, status: response.status, body });
          await this.store.delete(STORES.queue, item.id);
        } else if (this.isRetryable(response.status)) {
          const dropped = await this.recordFailure(item, `HTTP ${response.status}`);
          (dropped ? result.dropped : result.failed).push(item.id);
        } else {
          await this.store.delete(STORES.queue, item.id);
          result.dropped.push(item.id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const dropped = await this.recordFailure(item, message);
        (dropped ? result.dropped : result.failed).push(item.id);
      } finally {
        clearTimeout(timeout);
      }
    }

    return result;
  }

  private isRetryable(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  /** Returns true when the request has now been dropped. */
  private async recordFailure(item: QueuedRequest, lastError: string): Promise<boolean> {
    const attempts = item.attempts + 1;

    if (attempts >= this.maxAttempts) {
      await this.store.delete(STORES.queue, item.id);
      return true;
    }

    await this.store.set(STORES.queue, { ...item, attempts, lastError });
    return false;
  }

  private async enforceLimit(): Promise<void> {
    const items = await this.list();
    if (items.length < this.maxItems) return;

    const overflow = items.length - this.maxItems + 1;
    for (const item of items.slice(0, overflow)) {
      await this.store.delete(STORES.queue, item.id);
    }
  }
}
