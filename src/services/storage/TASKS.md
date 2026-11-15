# Teammate 6 - Offline Storage Services

## Overview
Build the complete offline storage layer using IndexedDB and localStorage. This module ensures the app works without internet connection and caches course content.

## Branch
```bash
git checkout -b feature/offline-storage
```

## Files to Create

### 1. `IndexedDBStore.ts` - Generic IndexedDB wrapper
**Priority: HIGH**

```typescript
// TODO: Create IndexedDBStore.ts
```

**Requirements:**
- Generic wrapper for IndexedDB operations
- Initialize database with object stores
- CRUD operations (get, set, delete, getAll)
- Error handling
- Promise-based API

**Database Schema:**
```typescript
const DB_NAME = 'ai-tutor-db';
const DB_VERSION = 1;

// Object stores:
// - courses: { id, data, cachedAt, lastAccessed, size }
// - messages: { id, conversationId, role, content, timestamp }
// - queue: { id, type, payload, timestamp, retryCount }
// - preferences: { key, value }
```

**Implementation:**
```typescript
export class IndexedDBStore {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase): void {
    // Courses store
    if (!db.objectStoreNames.contains('courses')) {
      const courseStore = db.createObjectStore('courses', { keyPath: 'id' });
      courseStore.createIndex('cachedAt', 'cachedAt', { unique: false });
    }

    // Messages store
    if (!db.objectStoreNames.contains('messages')) {
      const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
      messageStore.createIndex('conversationId', 'conversationId', { unique: false });
      messageStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Queue store
    if (!db.objectStoreNames.contains('queue')) {
      const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
      queueStore.createIndex('type', 'type', { unique: false });
    }

    // Preferences store
    if (!db.objectStoreNames.contains('preferences')) {
      db.createObjectStore('preferences', { keyPath: 'key' });
    }
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async set<T extends { id?: string }>(storeName: string, value: T): Promise<string> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => resolve(request.result as string);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey
  ): Promise<T[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}
```

---

### 2. `CourseCache.ts` - Cache course content
**Priority: HIGH**

```typescript
// TODO: Create CourseCache.ts
```

**Requirements:**
- Cache downloaded course content
- Track when cached and last accessed
- Manage cache size (remove old items)
- Get course by ID
- List all cached courses

**Interface:**
```typescript
export class CourseCache {
  private store: IndexedDBStore;

  constructor(store: IndexedDBStore) {
    this.store = store;
  }

  async cacheCourse(course: CourseContent): Promise<void> {
    const cachedCourse: CachedCourse = {
      id: course.id,
      data: course,
      cachedAt: new Date(),
      lastAccessed: new Date(),
      size: JSON.stringify(course).length,
    };

    await this.store.set('courses', cachedCourse);
  }

  async getCourse(id: string): Promise<CourseContent | null> {
    const cached = await this.store.get<CachedCourse>('courses', id);

    if (cached) {
      // Update last accessed time
      cached.lastAccessed = new Date();
      await this.store.set('courses', cached);
      return cached.data;
    }

    return null;
  }

  async getAllCourses(): Promise<CachedCourse[]> {
    return await this.store.getAll<CachedCourse>('courses');
  }

  async removeCourse(id: string): Promise<void> {
    await this.store.delete('courses', id);
  }

  async getCacheSize(): Promise<number> {
    const courses = await this.getAllCourses();
    return courses.reduce((total, course) => total + course.size, 0);
  }

  async clearOldCourses(daysOld: number): Promise<number> {
    const courses = await this.getAllCourses();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    let removed = 0;
    for (const course of courses) {
      if (new Date(course.lastAccessed) < cutoff) {
        await this.removeCourse(course.id);
        removed++;
      }
    }

    return removed;
  }

  async clearAll(): Promise<void> {
    await this.store.clear('courses');
  }
}
```

---

### 3. `OfflineQueue.ts` - Queue messages when offline
**Priority: HIGH**

```typescript
// TODO: Create OfflineQueue.ts
```

**Requirements:**
- Queue messages when offline
- Sync when back online
- Retry failed messages (max 3 attempts)
- Track queue status

**Interface:**
```typescript
export class OfflineQueue {
  private store: IndexedDBStore;
  private maxRetries: number;

  constructor(store: IndexedDBStore, maxRetries: number = 3) {
    this.store = store;
    this.maxRetries = maxRetries;
  }

  async queueMessage(message: Message): Promise<void> {
    const queueItem: OfflineQueueItem = {
      id: `queue-${Date.now()}`,
      type: 'message',
      payload: message,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending',
    };

    await this.store.set('queue', queueItem);
  }

  async queueHelpRequest(request: HumanHelpRequest): Promise<void> {
    const queueItem: OfflineQueueItem = {
      id: `queue-${Date.now()}`,
      type: 'help_request',
      payload: request,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending',
    };

    await this.store.set('queue', queueItem);
  }

  async getPendingItems(): Promise<OfflineQueueItem[]> {
    const all = await this.store.getAll<OfflineQueueItem>('queue');
    return all.filter(item => item.status === 'pending');
  }

  async markAsSent(id: string): Promise<void> {
    const item = await this.store.get<OfflineQueueItem>('queue', id);
    if (item) {
      item.status = 'sent';
      await this.store.set('queue', item);
    }
  }

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

  async syncQueue(syncFn: (item: OfflineQueueItem) => Promise<boolean>): Promise<{
    synced: number;
    failed: number;
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
          failed++;
        }
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
        await this.incrementRetry(item.id);
        failed++;
      }
    }

    return { synced, failed };
  }

  async clearSent(): Promise<void> {
    const all = await this.store.getAll<OfflineQueueItem>('queue');
    for (const item of all) {
      if (item.status === 'sent') {
        await this.store.delete('queue', item.id);
      }
    }
  }

  async clearAll(): Promise<void> {
    await this.store.clear('queue');
  }
}
```

---

### 4. `PreferencesStore.ts` - User preferences (localStorage)
**Priority: MEDIUM**

```typescript
// TODO: Create PreferencesStore.ts
```

**Requirements:**
- Store user preferences in localStorage
- Sync with TutorContext
- Provide defaults
- Validate preferences

**Interface:**
```typescript
const PREFS_KEY = 'ai-tutor-preferences';

const defaultPreferences: UserPreferences = {
  language: 'am',
  soundEnabled: true,
  highContrast: false,
  fontSize: 'normal',
  keyboardOnlyMode: false,
  preferredAIProvider: 'offline',
  screenReaderOptimized: true,
  autoPlayVoiceResponses: false,
  reduceMotion: false,
};

export class PreferencesStore {
  get(): UserPreferences {
    if (typeof window === 'undefined') {
      return defaultPreferences;
    }

    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults (in case new fields added)
        return { ...defaultPreferences, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }

    return defaultPreferences;
  }

  set(prefs: Partial<UserPreferences>): UserPreferences {
    const current = this.get();
    const updated = { ...current, ...prefs };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save preferences:', error);
      }
    }

    return updated;
  }

  reset(): UserPreferences {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PREFS_KEY);
    }
    return defaultPreferences;
  }

  validate(prefs: Partial<UserPreferences>): boolean {
    const validLanguages = ['am', 'en'];
    const validFontSizes = ['normal', 'large', 'xlarge'];
    const validProviders = ['cloud', 'local', 'offline'];

    if (prefs.language && !validLanguages.includes(prefs.language)) {
      return false;
    }

    if (prefs.fontSize && !validFontSizes.includes(prefs.fontSize)) {
      return false;
    }

    if (prefs.preferredAIProvider && !validProviders.includes(prefs.preferredAIProvider)) {
      return false;
    }

    return true;
  }
}
```

---

### 5. `ConversationStore.ts` - Store conversation history
**Priority: MEDIUM**

```typescript
// TODO: Create ConversationStore.ts
```

**Requirements:**
- Store conversation history locally
- Load previous conversations
- Clear old conversations

**Interface:**
```typescript
export class ConversationStore {
  private store: IndexedDBStore;

  constructor(store: IndexedDBStore) {
    this.store = store;
  }

  async saveMessage(conversationId: string, message: Message): Promise<void> {
    const storedMessage: StoredMessage = {
      id: message.id,
      conversationId,
      role: message.role,
      content: message.content,
      language: message.language,
      timestamp: message.timestamp,
      citation: message.citation,
      isOffline: message.isOffline,
    };

    await this.store.set('messages', storedMessage);
  }

  async getConversation(conversationId: string): Promise<Message[]> {
    const messages = await this.store.getByIndex<StoredMessage>(
      'messages',
      'conversationId',
      conversationId
    );

    return messages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(this.convertToMessage);
  }

  async getAllConversations(): Promise<Map<string, Message[]>> {
    const all = await this.store.getAll<StoredMessage>('messages');
    const grouped = new Map<string, Message[]>();

    for (const msg of all) {
      if (!grouped.has(msg.conversationId)) {
        grouped.set(msg.conversationId, []);
      }
      grouped.get(msg.conversationId)!.push(this.convertToMessage(msg));
    }

    return grouped;
  }

  async clearConversation(conversationId: string): Promise<void> {
    const messages = await this.getConversation(conversationId);
    for (const msg of messages) {
      await this.store.delete('messages', msg.id);
    }
  }

  async clearOlderThan(days: number): Promise<number> {
    const all = await this.store.getAll<StoredMessage>('messages');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let removed = 0;
    for (const msg of all) {
      if (new Date(msg.timestamp) < cutoff) {
        await this.store.delete('messages', msg.id);
        removed++;
      }
    }

    return removed;
  }

  private convertToMessage(stored: StoredMessage): Message {
    return {
      id: stored.id,
      role: stored.role,
      content: stored.content,
      language: stored.language,
      timestamp: stored.timestamp,
      citation: stored.citation,
      isOffline: stored.isOffline,
    };
  }
}
```

---

### 6. `StorageManager.ts` - Central storage manager
**Priority: HIGH**

```typescript
// TODO: Create StorageManager.ts
```

**Requirements:**
- Initialize all storage services
- Provide unified API
- Handle online/offline sync
- Manage storage quotas

**Interface:**
```typescript
export class StorageManager {
  private db: IndexedDBStore;
  courseCache: CourseCache;
  offlineQueue: OfflineQueue;
  preferences: PreferencesStore;
  conversations: ConversationStore;
  private syncInterval: NodeJS.Timeout | null = null;

  async init(): Promise<void> {
    this.db = new IndexedDBStore();
    await this.db.init();

    this.courseCache = new CourseCache(this.db);
    this.offlineQueue = new OfflineQueue(this.db);
    this.preferences = new PreferencesStore();
    this.conversations = new ConversationStore(this.db);
  }

  startAutoSync(syncFn: (item: OfflineQueueItem) => Promise<boolean>): void {
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        const result = await this.offlineQueue.syncQueue(syncFn);
        if (result.synced > 0) {
          console.log(`Synced ${result.synced} items`);
        }
      }
    }, 30000);

    // Also sync when coming online
    window.addEventListener('online', async () => {
      const result = await this.offlineQueue.syncQueue(syncFn);
      console.log(`Online: synced ${result.synced} items`);
    });
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async getStorageUsage(): Promise<{
    courses: number;
    messages: number;
    queue: number;
    total: number;
  }> {
    const courses = await this.courseCache.getCacheSize();
    const messages = await this.db.getAll('messages');
    const queue = await this.db.getAll('queue');

    const messagesSize = JSON.stringify(messages).length;
    const queueSize = JSON.stringify(queue).length;

    return {
      courses,
      messages: messagesSize,
      queue: queueSize,
      total: courses + messagesSize + queueSize,
    };
  }

  async clearAllData(): Promise<void> {
    await this.courseCache.clearAll();
    await this.offlineQueue.clearAll();
    await this.db.clear('messages');
    this.preferences.reset();
  }
}

// Singleton instance
let storageManager: StorageManager | null = null;

export async function getStorageManager(): Promise<StorageManager> {
  if (!storageManager) {
    storageManager = new StorageManager();
    await storageManager.init();
  }
  return storageManager;
}
```

---

### 7. `types.ts` - Storage-specific types
**Priority: HIGH**

```typescript
// TODO: Create types.ts
```

**Types:**
```typescript
export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  language: Language;
  timestamp: Date;
  citation?: Citation;
  isOffline?: boolean;
}

export interface CachedCourse {
  id: string;
  data: CourseContent;
  cachedAt: Date;
  lastAccessed: Date;
  size: number;
}

export interface OfflineQueueItem {
  id: string;
  type: 'message' | 'help_request';
  payload: Message | HumanHelpRequest;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'sent' | 'failed';
  maxRetries?: number;
}

export interface StorageUsage {
  courses: number;
  messages: number;
  queue: number;
  total: number;
}
```

---

### 8. `index.ts` - Exports
**Priority: HIGH**

```typescript
export { IndexedDBStore } from './IndexedDBStore';
export { CourseCache } from './CourseCache';
export { OfflineQueue } from './OfflineQueue';
export { PreferencesStore } from './PreferencesStore';
export { ConversationStore } from './ConversationStore';
export { StorageManager, getStorageManager } from './StorageManager';
export type { StoredMessage, CachedCourse, OfflineQueueItem, StorageUsage } from './types';
```

---

## How to Use

### In TutorContext:
```typescript
import { getStorageManager } from '@/services/storage';

// Initialize on mount
useEffect(() => {
  const initStorage = async () => {
    const storage = await getStorageManager();
    
    // Load preferences
    const prefs = storage.preferences.get();
    updatePreferences(prefs);
    
    // Start auto-sync
    storage.startAutoSync(async (item) => {
      if (item.type === 'message') {
        const msg = item.payload as Message;
        await fetch('/api/ai/query', {
          method: 'POST',
          body: JSON.stringify({
            question: msg.content,
            language: msg.language,
          }),
        });
        return true;
      }
      return false;
    });
  };

  initStorage();
}, []);

// Queue message when offline
const sendMessage = async (content: string) => {
  const message: Message = { /* ... */ };

  if (!navigator.onLine) {
    const storage = await getStorageManager();
    await storage.offlineQueue.queueMessage(message);
    // Still add to local messages
    setMessages(prev => [...prev, message]);
    return;
  }

  // Send normally if online
  // ...
};
```

### In ChatContainer:
```typescript
// Check offline status
const { isOffline } = useTutor();

// Show indicator
{isOffline && (
  <div className="offline-banner">
    You're offline. Messages will be sent when connection is restored.
  </div>
)}
```

---

## Testing Checklist

- [ ] IndexedDB initializes correctly
- [ ] Can cache and retrieve courses
- [ ] Can queue messages when offline
- [ ] Messages sync when back online
- [ ] Preferences persist across sessions
- [ ] Conversation history saves correctly
- [ ] Storage usage calculation works
- [ ] Clear all data works
- [ ] Handles quota exceeded errors

---

## Implementation Order

1. `types.ts` - Define all types first
2. `IndexedDBStore.ts` - Core database wrapper
3. `PreferencesStore.ts` - Simple localStorage
4. `CourseCache.ts` - Course caching
5. `OfflineQueue.ts` - Message queue
6. `ConversationStore.ts` - History
7. `StorageManager.ts` - Tie everything together
8. `index.ts` - Exports
