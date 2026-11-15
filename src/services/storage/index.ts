// ============================================
// STORAGE SERVICES - Teammate 6
// ============================================
//
// Provides offline storage capabilities using
// IndexedDB and localStorage.
//
// Usage:
//   import { getStorageManager } from '@/services/storage';
//
//   const storage = await getStorageManager();
//   await storage.courseCache.cacheCourse(course);
//   await storage.offlineQueue.queueMessage(message);
//   const prefs = storage.preferences.get();
// ============================================

export { IndexedDBStore } from './IndexedDBStore';
export { CourseCache } from './CourseCache';
export { OfflineQueue } from './OfflineQueue';
export { PreferencesStore } from './PreferencesStore';
export { ConversationStore } from './ConversationStore';
export { StorageManager, getStorageManager, resetStorageManager } from './StorageManager';

export type {
  StoredMessage,
  CachedCourse,
  OfflineQueueItem,
  StorageUsage,
  StorageConfig,
} from './types';
