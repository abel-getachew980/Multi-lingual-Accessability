/**
 * Offline storage layer.
 *
 * - `PreferencesStore`  - localStorage, readable before the first render.
 * - `ConversationStore` - keeps the transcript across reloads.
 * - `CourseCache`       - cached course material for 3G/offline use.
 * - `OfflineQueue`      - requests sent when the connection comes back.
 * - `IndexedDBStore`    - the browser backend; `MemoryStore` is the fallback.
 */

export { CourseCache } from './CourseCache';
export { ConversationStore } from './ConversationStore';
export { IndexedDBStore, type IndexedDBStoreOptions } from './IndexedDBStore';
export { isStorageAvailable, MemoryStore, type KVStore } from './KVStore';
export { OfflineQueue, type OfflineQueueOptions } from './OfflineQueue';
export { PreferencesStore, sanitizePreferences } from './PreferencesStore';
export {
  DB_NAME,
  DB_VERSION,
  DEFAULT_PREFERENCES,
  STORES,
  StorageUnavailableError,
  type CachedCourseEntry,
  type QueueSyncResult,
  type QueueSyncSuccess,
  type QueuedRequest,
  type QueuedRequestInput,
  type StoreName,
  type StoredConversation,
  type StoredMessage,
  type StoredRecord,
} from './types';
