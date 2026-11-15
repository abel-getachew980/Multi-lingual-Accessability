/**
 * StorageManager - Central storage manager
 *
 * Initializes and coordinates all storage services.
 * Handles online/offline sync and storage quotas.
 */

import { IndexedDBStore } from './IndexedDBStore';
import { CourseCache } from './CourseCache';
import { OfflineQueue } from './OfflineQueue';
import { PreferencesStore } from './PreferencesStore';
import { ConversationStore } from './ConversationStore';
import { StorageUsage, OfflineQueueItem, StorageConfig } from './types';

const DEFAULT_CONFIG: StorageConfig = {
  dbName: 'ai-tutor-db',
  dbVersion: 1,
  maxRetries: 3,
  syncIntervalMs: 30000,
  maxCacheAge: 30,
};

export class StorageManager {
  private db: IndexedDBStore;
  private config: StorageConfig;

  public courseCache!: CourseCache;
  public offlineQueue!: OfflineQueue;
  public preferences!: PreferencesStore;
  public conversations!: ConversationStore;

  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = new IndexedDBStore(this.config);
  }

  /**
   * Initialize all storage services
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.db.init();

    this.courseCache = new CourseCache(this.db);
    this.offlineQueue = new OfflineQueue(this.db, this.config.maxRetries);
    this.preferences = new PreferencesStore();
    this.conversations = new ConversationStore(this.db);

    this.initialized = true;
  }

  /**
   * Start automatic sync when online
   */
  startAutoSync(
    syncFn: (item: OfflineQueueItem) => Promise<boolean>
  ): void {
    // Clear existing interval
    this.stopAutoSync();

    // Sync periodically
    this.syncInterval = setInterval(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const result = await this.offlineQueue.syncQueue(syncFn);
          if (result.synced > 0) {
            console.log(`[Storage] Synced ${result.synced} items`);
          }
        } catch (error) {
          console.error('[Storage] Auto-sync failed:', error);
        }
      }
    }, this.config.syncIntervalMs);

    // Also sync when coming online
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this, syncFn));
    }
  }

  /**
   * Handle online event
   */
  private async handleOnline(
    syncFn: (item: OfflineQueueItem) => Promise<boolean>
  ): Promise<void> {
    console.log('[Storage] Back online, syncing queue...');
    try {
      const result = await this.offlineQueue.syncQueue(syncFn);
      console.log(`[Storage] Synced ${result.synced} items, ${result.pending} pending`);
    } catch (error) {
      console.error('[Storage] Sync failed:', error);
    }
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageUsage(): Promise<StorageUsage> {
    const coursesSize = await this.courseCache.getCacheSize();
    const messages = await this.db.getAll('messages');
    const queue = await this.db.getAll('queue');

    const messagesSize = new Blob([JSON.stringify(messages)]).size;
    const queueSize = new Blob([JSON.stringify(queue)]).size;
    const total = coursesSize + messagesSize + queueSize;

    return {
      courses: coursesSize,
      messages: messagesSize,
      queue: queueSize,
      total,
      usedMB: total / (1024 * 1024),
    };
  }

  /**
   * Check storage quota (if available)
   */
  async checkQuota(): Promise<{
    usage: number;
    quota: number;
    available: number;
  } | null> {
    if (typeof navigator === 'undefined' || !('storage' in navigator)) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        available: (estimate.quota || 0) - (estimate.usage || 0),
      };
    } catch {
      return null;
    }
  }

  /**
   * Request persistent storage
   */
  async requestPersistent(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('storage' in navigator)) {
      return false;
    }

    try {
      const result = await navigator.storage.persist();
      console.log('[Storage] Persistent storage:', result ? 'granted' : 'denied');
      return result;
    } catch {
      return false;
    }
  }

  /**
   * Check if storage is persistent
   */
  async isPersistent(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('storage' in navigator)) {
      return false;
    }

    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }

  /**
   * Clean up old data
   */
  async cleanup(): Promise<{
    coursesRemoved: number;
    messagesRemoved: number;
    queueRemoved: number;
  }> {
    const coursesRemoved = await this.courseCache.clearOldCourses(this.config.maxCacheAge);
    const messagesRemoved = await this.conversations.clearOlderThan(this.config.maxCacheAge);
    const queueRemoved = await this.offlineQueue.clearSent();

    return { coursesRemoved, messagesRemoved, queueRemoved };
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    await this.courseCache.clearAll();
    await this.offlineQueue.clearAll();
    await this.conversations.clearAll();
    this.preferences.reset();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.stopAutoSync();
    this.db.close();
    this.initialized = false;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

let storageManager: StorageManager | null = null;
let storageManagerInit: Promise<StorageManager> | null = null;

/**
 * Get or create the storage manager singleton
 */
export async function getStorageManager(
  config?: Partial<StorageConfig>
): Promise<StorageManager> {
  if (storageManager) {
    if (storageManagerInit) {
      await storageManagerInit;
    }
    return storageManager;
  }

  if (!storageManagerInit) {
    const manager = new StorageManager(config);
    storageManager = manager;
    storageManagerInit = manager.init().then(() => manager);
  }
  return storageManagerInit;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetStorageManager(): void {
  if (storageManager) {
    storageManager.close();
    storageManager = null;
  }
  storageManagerInit = null;
}
