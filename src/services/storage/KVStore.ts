import type { StoreName, StoredRecord } from './types';

/**
 * The tiny key/value surface the storage layer needs.
 *
 * `IndexedDBStore` provides the browser implementation; `MemoryStore` backs
 * tests, private browsing fallbacks and server rendering. Keeping the surface
 * this small means swapping in another backend later is a single file.
 */
export interface KVStore {
  get<T extends StoredRecord>(store: StoreName, key: string): Promise<T | null>;
  getAll<T extends StoredRecord>(store: StoreName): Promise<T[]>;
  set<T extends StoredRecord>(store: StoreName, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
  keys(store: StoreName): Promise<string[]>;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON for values structuredClone rejects.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * In-memory implementation.
 *
 * Data disappears when the tab closes, so it is only a fallback: callers that
 * need durability should treat a failed IndexedDB open as "offline storage not
 * available" and say so in the UI.
 */
export class MemoryStore implements KVStore {
  private readonly stores = new Map<string, Map<string, unknown>>();

  private bucket(store: StoreName): Map<string, unknown> {
    let bucket = this.stores.get(store);
    if (!bucket) {
      bucket = new Map<string, unknown>();
      this.stores.set(store, bucket);
    }
    return bucket;
  }

  async get<T extends StoredRecord>(store: StoreName, key: string): Promise<T | null> {
    const value = this.bucket(store).get(key);
    return value ? clone(value as T) : null;
  }

  async getAll<T extends StoredRecord>(store: StoreName): Promise<T[]> {
    return Array.from(this.bucket(store).values()).map((value) => clone(value as T));
  }

  async set<T extends StoredRecord>(store: StoreName, value: T): Promise<void> {
    this.bucket(store).set(value.id, clone(value));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    this.bucket(store).delete(key);
  }

  async clear(store: StoreName): Promise<void> {
    this.bucket(store).clear();
  }

  async keys(store: StoreName): Promise<string[]> {
    return Array.from(this.bucket(store).keys());
  }
}

export function isStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
