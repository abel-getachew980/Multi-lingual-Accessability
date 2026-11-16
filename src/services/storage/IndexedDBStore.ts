import type { KVStore } from './KVStore';
import {
  DB_NAME,
  DB_VERSION,
  STORES,
  StorageUnavailableError,
  type StoreName,
  type StoredRecord,
} from './types';

export interface IndexedDBStoreOptions {
  dbName?: string;
  version?: number;
  /** Injectable for tests or for browsers that expose a prefixed implementation. */
  factory?: IDBFactory;
  stores?: StoreName[];
}

/**
 * IndexedDB implementation of `KVStore`.
 *
 * Opening is lazy so importing this module during server rendering is safe:
 * the error only appears when something actually tries to read or write.
 */
export class IndexedDBStore implements KVStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private readonly dbName: string;
  private readonly version: number;
  private readonly storeNames: StoreName[];
  private readonly factory?: IDBFactory;

  constructor(options: IndexedDBStoreOptions = {}) {
    this.dbName = options.dbName ?? DB_NAME;
    this.version = options.version ?? DB_VERSION;
    this.storeNames = options.stores ?? Object.values(STORES);
    this.factory = options.factory;
  }

  async open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.openDatabase();
    }
    return this.dbPromise;
  }

  async close(): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    db.close();
    this.dbPromise = null;
  }

  async get<T extends StoredRecord>(store: StoreName, key: string): Promise<T | null> {
    const db = await this.open();

    return new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const request = transaction.objectStore(store).get(key);

      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error(`IndexedDB read failed for ${store}/${key}`));
    });
  }

  async getAll<T extends StoredRecord>(store: StoreName): Promise<T[]> {
    const db = await this.open();

    return new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const request = transaction.objectStore(store).getAll();

      request.onsuccess = () => resolve((request.result as T[]) ?? []);
      request.onerror = () =>
        reject(request.error ?? new Error(`IndexedDB read failed for ${store}`));
    });
  }

  async set<T extends StoredRecord>(store: StoreName, value: T): Promise<void> {
    const db = await this.open();

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error(`IndexedDB write failed for ${store}/${value.id}`));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error(`IndexedDB write aborted for ${store}/${value.id}`));
    });
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.open();

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error(`IndexedDB delete failed for ${store}/${key}`));
    });
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.open();

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error(`IndexedDB clear failed for ${store}`));
    });
  }

  async keys(store: StoreName): Promise<string[]> {
    const db = await this.open();

    return new Promise<string[]>((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const request = transaction.objectStore(store).getAllKeys();

      request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(String));
      request.onerror = () =>
        reject(request.error ?? new Error(`IndexedDB keys failed for ${store}`));
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    const factory = this.factory ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined);

    if (!factory) {
      return Promise.reject(
        new StorageUnavailableError('IndexedDB is not available; using an in-memory fallback'),
      );
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.dbName, this.version);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of this.storeNames) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new StorageUnavailableError('Could not open IndexedDB'));
      request.onblocked = () =>
        reject(new StorageUnavailableError('IndexedDB upgrade blocked by another tab'));
    });
  }
}
