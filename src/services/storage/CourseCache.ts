import type { KVStore } from './KVStore';
import { STORES, type CachedCourseEntry } from './types';

const DEFAULT_RETENTION_DAYS = 30;

/** UTF-8 byte length without relying on TextEncoder (missing in some jsdom setups). */
function utf8Length(text: string): number {
  let bytes = 0;

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }

  return bytes;
}

function byteSize(value: unknown): number {
  return utf8Length(JSON.stringify(value) ?? '');
}

/**
 * Caches course material so the learner can keep reading (and the offline FAQ
 * can keep answering) on a 3G connection or with no connection at all.
 */
export class CourseCache<T = unknown> {
  constructor(
    private readonly store: KVStore,
    private readonly now: () => number = Date.now,
  ) {}

  async cache(id: string, data: T): Promise<CachedCourseEntry<T>> {
    const timestamp = this.now();
    const entry: CachedCourseEntry<T> = {
      id,
      data,
      cachedAt: timestamp,
      lastAccessed: timestamp,
      size: byteSize(data),
    };

    await this.store.set(STORES.courses, entry);
    return entry;
  }

  async get(id: string): Promise<T | null> {
    const entry = await this.store.get<CachedCourseEntry<T>>(STORES.courses, id);
    if (!entry) return null;

    await this.store.set(STORES.courses, { ...entry, lastAccessed: this.now() });
    return entry.data;
  }

  async has(id: string): Promise<boolean> {
    return (await this.store.get(STORES.courses, id)) !== null;
  }

  async list(): Promise<CachedCourseEntry<T>[]> {
    const entries = await this.store.getAll<CachedCourseEntry<T>>(STORES.courses);
    return entries.sort((a, b) => b.lastAccessed - a.lastAccessed);
  }

  async remove(id: string): Promise<void> {
    await this.store.delete(STORES.courses, id);
  }

  /** Drops courses that have not been opened recently. Returns how many went. */
  async pruneOlderThan(days: number = DEFAULT_RETENTION_DAYS): Promise<number> {
    const cutoff = this.now() - days * 24 * 60 * 60 * 1_000;
    const entries = await this.store.getAll<CachedCourseEntry<T>>(STORES.courses);
    const stale = entries.filter((entry) => entry.lastAccessed < cutoff);

    for (const entry of stale) {
      await this.store.delete(STORES.courses, entry.id);
    }

    return stale.length;
  }

  async totalSize(): Promise<number> {
    const entries = await this.store.getAll<CachedCourseEntry<T>>(STORES.courses);
    return entries.reduce((total, entry) => total + entry.size, 0);
  }

  async clear(): Promise<void> {
    await this.store.clear(STORES.courses);
  }
}
