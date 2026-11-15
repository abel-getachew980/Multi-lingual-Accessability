/**
 * OfflineQueue - Queue messages when offline
 *
 * Manages a queue of messages and requests to be sent
 * when the connection is restored.
 */

import { IndexedDBStore } from './IndexedDBStore';
import { OfflineQueueItem } from './types';
import { Message, HumanHelpRequest } from '@/types';

export class OfflineQueue {
  private store: IndexedDBStore;
  private maxRetries: number;

  constructor(store: IndexedDBStore, maxRetries: number = 3) {
    this.store = store;
    this.maxRetries = maxRetries;
  }

  /**
   * Queue a message for later sending
   */
  async queueMessage(message: Message): Promise<string> {
    const queueItem: OfflineQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'message',
      payload: message,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending',
      maxRetries: this.maxRetries,
    };

    await this.store.set('queue', queueItem);
    return queueItem.id;
  }

  /**
   * Queue a help request for later sending
   */
  async queueHelpRequest(request: HumanHelpRequest): Promise<string> {
    const queueItem: OfflineQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'help_request',
      payload: request,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending',
      maxRetries: this.maxRetries,
    };

    await this.store.set('queue', queueItem);
    return queueItem.id;
  }

  /**
   * Get all pending items
   */
  async getPendingItems(): Promise<OfflineQueueItem[]> {
    const all = await this.store.getAll<OfflineQueueItem>('queue');
    return all.filter(item => item.status === 'pending');
  }

  /**
   * Get all items (including failed)
   */
  async getAllItems(): Promise<OfflineQueueItem[]> {
    return await this.store.getAll<OfflineQueueItem>('queue');
  }

  /**
   * Get failed items
   */
  async getFailedItems(): Promise<OfflineQueueItem[]> {
    const all = await this.store.getAll<OfflineQueueItem>('queue');
    return all.filter(item => item.status === 'failed');
  }

  /**
   * Mark an item as sent
   */
  async markAsSent(id: string): Promise<void> {
    const item = await this.store.get<OfflineQueueItem>('queue', id);
    if (item) {
      item.status = 'sent';
      await this.store.set('queue', item);
    }
  }

  /**
   * Mark an item as failed
   */
  async markAsFailed(id: string): Promise<void> {
    const item = await this.store.get<OfflineQueueItem>('queue', id);
    if (item) {
      item.status = 'failed';
      await this.store.set('queue', item);
    }
  }

  /**
   * Increment retry count
   */
  async incrementRetry(id: string): Promise<void> {
    const item = await this.store.get<OfflineQueueItem>('queue', id);
    if (item) {
      item.retryCount++;
      if (item.retryCount >= this.maxRetries) {
        item.status = 'failed';
      }
      await this.store.set('queue', item);
    }
  }

  /**
   * Retry a failed item
   */
  async retryItem(id: string): Promise<void> {
    const item = await this.store.get<OfflineQueueItem>('queue', id);
    if (item && item.status === 'failed') {
      item.status = 'pending';
      item.retryCount = 0;
      await this.store.set('queue', item);
    }
  }

  /**
   * Sync the queue with a sync function
   */
  async syncQueue(
    syncFn: (item: OfflineQueueItem) => Promise<boolean>
  ): Promise<{
    synced: number;
    failed: number;
    pending: number;
  }> {
    const pending = await this.getPendingItems();
    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        const success = await syncFn(item);
        if (success) {
          await this.markAsSent(item.id);
          synced++;
        } else {
          await this.incrementRetry(item.id);
          if (item.retryCount + 1 >= this.maxRetries) {
            failed++;
          }
        }
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
        await this.incrementRetry(item.id);
        if (item.retryCount + 1 >= this.maxRetries) {
          failed++;
        }
      }
    }

    const remaining = await this.getPendingItems();

    return {
      synced,
      failed,
      pending: remaining.length,
    };
  }

  /**
   * Remove sent items
   */
  async clearSent(): Promise<number> {
    const all = await this.store.getAll<OfflineQueueItem>('queue');
    let removed = 0;

    for (const item of all) {
      if (item.status === 'sent') {
        await this.store.delete('queue', item.id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Remove failed items
   */
  async clearFailed(): Promise<number> {
    const all = await this.store.getAll<OfflineQueueItem>('queue');
    let removed = 0;

    for (const item of all) {
      if (item.status === 'failed') {
        await this.store.delete('queue', item.id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear all items
   */
  async clearAll(): Promise<void> {
    await this.store.clear('queue');
  }

  /**
   * Get queue count
   */
  async count(): Promise<number> {
    return await this.store.count('queue');
  }

  /**
   * Get pending count
   */
  async pendingCount(): Promise<number> {
    const pending = await this.getPendingItems();
    return pending.length;
  }
}
