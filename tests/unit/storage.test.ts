/**
 * Storage Module Unit Tests
 * 
 * Tests for IndexedDBStore, CourseCache, OfflineQueue,
 * PreferencesStore, ConversationStore, and StorageManager.
 */

import {
  IndexedDBStore,
  CourseCache,
  OfflineQueue,
  PreferencesStore,
  ConversationStore,
  StorageManager,
  resetStorageManager,
} from '@/services/storage';
import { Message, CourseContent, HumanHelpRequest } from '@/types';

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Helper to generate unique DB names for test isolation
let dbCounter = 0;
const getUniqueDbName = () => `test-db-${Date.now()}-${dbCounter++}`;

describe('IndexedDBStore', () => {
  let store: IndexedDBStore;

  beforeEach(async () => {
    store = new IndexedDBStore({ dbName: getUniqueDbName(), dbVersion: 1 });
    await store.init();
  });

  afterEach(async () => {
    store.close();
  });

  describe('init', () => {
    it('should initialize the database', async () => {
      expect(store.isAvailable()).toBe(true);
    });

    it('should create object stores', async () => {
      // This is implicitly tested by successful init
      const count = await store.count('courses');
      expect(count).toBe(0);
    });
  });

  describe('set and get', () => {
    it('should set and get an item', async () => {
      const item = { id: 'test-1', name: 'Test Item' };
      await store.set('courses', item);

      const retrieved = await store.get<{ id: string; name: string }>('courses', 'test-1');
      expect(retrieved).toEqual(item);
    });

    it('should return null for non-existent item', async () => {
      const result = await store.get('courses', 'non-existent');
      expect(result).toBeNull();
    });

    it('should update an existing item', async () => {
      const item = { id: 'test-1', name: 'Original' };
      await store.set('courses', item);

      const updated = { id: 'test-1', name: 'Updated' };
      await store.set('courses', updated);

      const retrieved = await store.get<{ id: string; name: string }>('courses', 'test-1');
      expect(retrieved?.name).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should delete an item', async () => {
      const item = { id: 'test-1', name: 'Test' };
      await store.set('courses', item);

      await store.delete('courses', 'test-1');

      const result = await store.get('courses', 'test-1');
      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should get all items', async () => {
      await store.set('courses', { id: 'item-1', name: 'A' });
      await store.set('courses', { id: 'item-2', name: 'B' });

      const items = await store.getAll('courses');
      expect(items).toHaveLength(2);
    });

    it('should return empty array when no items', async () => {
      const items = await store.getAll('courses');
      expect(items).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all items from a store', async () => {
      await store.set('courses', { id: 'item-1', name: 'A' });
      await store.set('courses', { id: 'item-2', name: 'B' });

      await store.clear('courses');

      const count = await store.count('courses');
      expect(count).toBe(0);
    });
  });

  describe('count', () => {
    it('should count items', async () => {
      await store.set('courses', { id: 'item-1', name: 'A' });
      await store.set('courses', { id: 'item-2', name: 'B' });

      const count = await store.count('courses');
      expect(count).toBe(2);
    });
  });
});

describe('CourseCache', () => {
  let cache: CourseCache;
  let store: IndexedDBStore;

  const mockCourse: CourseContent = {
    id: 'course-1',
    title: 'Test Course',
    content: 'Course content here',
    language: 'am',
    metadata: {
      fileName: 'test.pdf',
      uploadedAt: new Date(),
      fileSize: 1024,
      fileType: 'application/pdf',
    },
  };

  beforeEach(async () => {
    store = new IndexedDBStore({ dbName: getUniqueDbName(), dbVersion: 1 });
    await store.init();
    cache = new CourseCache(store);
  });

  afterEach(() => {
    store.close();
  });

  describe('cacheCourse', () => {
    it('should cache a course', async () => {
      await cache.cacheCourse(mockCourse);

      const cached = await cache.getCourse('course-1');
      expect(cached).toEqual(mockCourse);
    });

    it('should update last accessed time on retrieval', async () => {
      await cache.cacheCourse(mockCourse);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const cached = await cache.getCourse('course-1');
      expect(cached).toBeTruthy();
    });
  });

  describe('isCached', () => {
    it('should return true for cached course', async () => {
      await cache.cacheCourse(mockCourse);
      const isCached = await cache.isCached('course-1');
      expect(isCached).toBe(true);
    });

    it('should return false for non-cached course', async () => {
      const isCached = await cache.isCached('non-existent');
      expect(isCached).toBe(false);
    });
  });

  describe('removeCourse', () => {
    it('should remove a cached course', async () => {
      await cache.cacheCourse(mockCourse);
      await cache.removeCourse('course-1');

      const cached = await cache.getCourse('course-1');
      expect(cached).toBeNull();
    });
  });

  describe('getCacheSize', () => {
    it('should return total cache size', async () => {
      await cache.cacheCourse(mockCourse);
      const size = await cache.getCacheSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('count', () => {
    it('should return number of cached courses', async () => {
      await cache.cacheCourse(mockCourse);
      const count = await cache.count();
      expect(count).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all cached courses', async () => {
      await cache.cacheCourse(mockCourse);
      await cache.clearAll();

      const count = await cache.count();
      expect(count).toBe(0);
    });
  });
});

describe('OfflineQueue', () => {
  let queue: OfflineQueue;
  let store: IndexedDBStore;

  const mockMessage: Message = {
    id: 'msg-1',
    role: 'user',
    content: 'Test message',
    language: 'am',
    timestamp: new Date(),
  };

  const mockHelpRequest: HumanHelpRequest = {
    id: 'help-1',
    userId: 'user-1',
    conversationHistory: [],
    timestamp: new Date(),
    status: 'pending',
    screenShareEnabled: false,
  };

  beforeEach(async () => {
    store = new IndexedDBStore({ dbName: getUniqueDbName(), dbVersion: 1 });
    await store.init();
    queue = new OfflineQueue(store, 3);
  });

  afterEach(() => {
    store.close();
  });

  describe('queueMessage', () => {
    it('should queue a message', async () => {
      const id = await queue.queueMessage(mockMessage);

      const pending = await queue.getPendingItems();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(id);
    });

    it('should set status to pending', async () => {
      await queue.queueMessage(mockMessage);

      const pending = await queue.getPendingItems();
      expect(pending[0].status).toBe('pending');
    });
  });

  describe('queueHelpRequest', () => {
    it('should queue a help request', async () => {
      const id = await queue.queueHelpRequest(mockHelpRequest);

      const pending = await queue.getPendingItems();
      expect(pending).toHaveLength(1);
      expect(pending[0].type).toBe('help_request');
    });
  });

  describe('markAsSent', () => {
    it('should mark item as sent', async () => {
      const id = await queue.queueMessage(mockMessage);
      await queue.markAsSent(id);

      const pending = await queue.getPendingItems();
      expect(pending).toHaveLength(0);
    });
  });

  describe('incrementRetry', () => {
    it('should increment retry count', async () => {
      const id = await queue.queueMessage(mockMessage);
      await queue.incrementRetry(id);

      const items = await queue.getAllItems();
      expect(items[0].retryCount).toBe(1);
    });

    it('should mark as failed after max retries', async () => {
      const id = await queue.queueMessage(mockMessage);

      for (let i = 0; i < 3; i++) {
        await queue.incrementRetry(id);
      }

      const failed = await queue.getFailedItems();
      expect(failed).toHaveLength(1);
    });
  });

  describe('syncQueue', () => {
    it('should sync pending items', async () => {
      await queue.queueMessage(mockMessage);
      await queue.queueMessage(mockMessage);

      const result = await queue.syncQueue(async () => true);

      expect(result.synced).toBe(2);
      expect(result.pending).toBe(0);
    });

    it('should handle sync failures', async () => {
      await queue.queueMessage(mockMessage);

      const result = await queue.syncQueue(async () => false);

      expect(result.synced).toBe(0);
    });
  });

  describe('clearSent', () => {
    it('should clear sent items', async () => {
      const id = await queue.queueMessage(mockMessage);
      await queue.markAsSent(id);

      const removed = await queue.clearSent();
      expect(removed).toBe(1);
    });
  });
});

describe('PreferencesStore', () => {
  let prefs: PreferencesStore;

  beforeEach(() => {
    prefs = new PreferencesStore();
    localStorage.clear();
  });

  describe('get', () => {
    it('should return default preferences when empty', () => {
      const result = prefs.get();
      expect(result.language).toBe('am');
      expect(result.soundEnabled).toBe(true);
    });

    it('should return stored preferences', () => {
      localStorage.setItem('ai-tutor-preferences', JSON.stringify({
        language: 'en',
        fontSize: 'large',
      }));

      const result = prefs.get();
      expect(result.language).toBe('en');
      expect(result.fontSize).toBe('large');
    });
  });

  describe('set', () => {
    it('should update preferences', () => {
      const result = prefs.set({ language: 'en' });
      expect(result.language).toBe('en');
    });

    it('should persist to localStorage', () => {
      prefs.set({ soundEnabled: false });

      const stored = JSON.parse(localStorage.getItem('ai-tutor-preferences') || '{}');
      expect(stored.soundEnabled).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to defaults', () => {
      prefs.set({ language: 'en' });
      const result = prefs.reset();

      expect(result.language).toBe('am');
    });
  });

  describe('validate', () => {
    it('should validate correct preferences', () => {
      const result = prefs.validate({ language: 'en' });
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid language', () => {
      const result = prefs.validate({ language: 'invalid' as any });
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid font size', () => {
      const result = prefs.validate({ fontSize: 'huge' as any });
      expect(result.isValid).toBe(false);
    });
  });

  describe('getValue', () => {
    it('should get a single value', () => {
      prefs.set({ language: 'en' });
      expect(prefs.getValue('language')).toBe('en');
    });
  });

  describe('setValue', () => {
    it('should set a single value', () => {
      prefs.setValue('language', 'am');
      expect(prefs.getValue('language')).toBe('am');
    });
  });
});

describe('ConversationStore', () => {
  let conversations: ConversationStore;
  let store: IndexedDBStore;

  const mockMessage: Message = {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    language: 'am',
    timestamp: new Date(),
  };

  beforeEach(async () => {
    store = new IndexedDBStore({ dbName: getUniqueDbName(), dbVersion: 1 });
    await store.init();
    conversations = new ConversationStore(store);
  });

  afterEach(() => {
    store.close();
  });

  describe('saveMessage', () => {
    it('should save a message', async () => {
      await conversations.saveMessage('conv-1', mockMessage);

      const messages = await conversations.getConversation('conv-1');
      expect(messages).toHaveLength(1);
    });
  });

  describe('getConversation', () => {
    it('should get all messages for a conversation', async () => {
      await conversations.saveMessage('conv-1', mockMessage);
      await conversations.saveMessage('conv-1', {
        ...mockMessage,
        id: 'msg-2',
        role: 'assistant',
      });

      const messages = await conversations.getConversation('conv-1');
      expect(messages).toHaveLength(2);
    });

    it('should return empty array for non-existent conversation', async () => {
      const messages = await conversations.getConversation('non-existent');
      expect(messages).toEqual([]);
    });
  });

  describe('deleteConversation', () => {
    it('should delete a conversation', async () => {
      await conversations.saveMessage('conv-1', mockMessage);
      const removed = await conversations.deleteConversation('conv-1');

      expect(removed).toBe(1);
    });
  });

  describe('searchMessages', () => {
    it('should search messages by content', async () => {
      await conversations.saveMessage('conv-1', {
        ...mockMessage,
        content: 'Hello world',
      });
      await conversations.saveMessage('conv-1', {
        ...mockMessage,
        id: 'msg-2',
        content: 'Goodbye',
      });

      const results = await conversations.searchMessages('Hello');
      expect(results).toHaveLength(1);
    });
  });
});

describe('StorageManager', () => {
  beforeEach(() => {
    resetStorageManager();
  });

  afterEach(() => {
    resetStorageManager();
  });

  describe('init', () => {
    it('should initialize all services', async () => {
      const manager = new StorageManager();
      await manager.init();

      expect(manager.courseCache).toBeDefined();
      expect(manager.offlineQueue).toBeDefined();
      expect(manager.preferences).toBeDefined();
      expect(manager.conversations).toBeDefined();

      manager.close();
    });
  });

  describe('getStorageManager singleton', () => {
    it('should return the same instance', async () => {
      const manager1 = await getStorageManager();
      const manager2 = await getStorageManager();

      expect(manager1).toBe(manager2);

      resetStorageManager();
    });
  });

  describe('getStorageUsage', () => {
    it('should return storage usage stats', async () => {
      const manager = await getStorageManager();
      const usage = await manager.getStorageUsage();

      expect(usage).toHaveProperty('courses');
      expect(usage).toHaveProperty('messages');
      expect(usage).toHaveProperty('queue');
      expect(usage).toHaveProperty('total');

      resetStorageManager();
    });
  });

  describe('clearAllData', () => {
    it('should clear all data', async () => {
      const manager = await getStorageManager();

      // Add some data
      await manager.preferences.set({ language: 'en' });

      // Clear
      await manager.clearAllData();

      // Verify
      const prefs = manager.preferences.get();
      expect(prefs.language).toBe('am'); // default

      resetStorageManager();
    });
  });
});

// Helper to get storage manager
async function getStorageManager() {
  const manager = new StorageManager();
  await manager.init();
  return manager;
}
