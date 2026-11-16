import { CourseCache, MemoryStore } from '@/services/storage';

describe('CourseCache', () => {
  it('caches a course and returns it later', async () => {
    const cache = new CourseCache<{ title: string }>(new MemoryStore());

    const entry = await cache.cache('biology-9', { title: 'Biology Grade 9' });

    expect(entry.id).toBe('biology-9');
    expect(entry.cachedAt).toBe(entry.lastAccessed);
    expect(await cache.get('biology-9')).toEqual({ title: 'Biology Grade 9' });
    expect(await cache.has('biology-9')).toBe(true);
  });

  it('returns null for a course that was never cached', async () => {
    const cache = new CourseCache(new MemoryStore());
    expect(await cache.get('missing')).toBeNull();
    expect(await cache.has('missing')).toBe(false);
  });

  it('updates lastAccessed when a course is opened', async () => {
    let now = 1_000;
    const cache = new CourseCache<{ title: string }>(new MemoryStore(), () => now);

    await cache.cache('a', { title: 'A' });
    now = 5_000;
    await cache.get('a');

    const [entry] = await cache.list();
    expect(entry.cachedAt).toBe(1_000);
    expect(entry.lastAccessed).toBe(5_000);
  });

  it('sorts the listing by most recently opened', async () => {
    let now = 1_000;
    const cache = new CourseCache<{ title: string }>(new MemoryStore(), () => now);

    await cache.cache('older', { title: 'Older' });
    now = 2_000;
    await cache.cache('newer', { title: 'Newer' });
    now = 3_000;
    await cache.get('older');

    expect((await cache.list()).map((entry) => entry.id)).toEqual(['older', 'newer']);
  });

  it('prunes only courses that have not been opened recently', async () => {
    const day = 24 * 60 * 60 * 1_000;
    let now = 1_000;
    const cache = new CourseCache<{ title: string }>(new MemoryStore(), () => now);

    await cache.cache('stale', { title: 'Stale' });
    now = 2_000;
    await cache.cache('fresh', { title: 'Fresh' });

    // Just over 30 days after the stale course, but still inside the window
    // for the fresh one.
    now = 1_000 + 30 * day + 1;

    const removed = await cache.pruneOlderThan(30);

    expect(removed).toBe(1);
    expect((await cache.list()).map((entry) => entry.id)).toEqual(['fresh']);
  });

  it('measures UTF-8 size, so Amharic content counts correctly', async () => {
    const cache = new CourseCache<{ text: string }>(new MemoryStore());

    await cache.cache('latin', { text: 'abc' });
    const [latin] = await cache.list();
    expect(latin.size).toBe(Buffer.byteLength(JSON.stringify({ text: 'abc' }), 'utf8'));

    await cache.cache('amharic', { text: 'ሰላም' });
    const entries = await cache.list();
    const amharic = entries.find((entry) => entry.id === 'amharic');
    const expected = Buffer.byteLength(JSON.stringify({ text: 'ሰላም' }), 'utf8');

    expect(amharic?.size).toBe(expected);
    expect(amharic?.size).toBeGreaterThan(JSON.stringify({ text: 'ሰላም' }).length);
  });

  it('reports the total cached size and clears everything', async () => {
    const cache = new CourseCache<{ text: string }>(new MemoryStore());

    await cache.cache('a', { text: 'one' });
    await cache.cache('b', { text: 'two' });

    const total = await cache.totalSize();
    expect(total).toBeGreaterThan(0);

    await cache.clear();
    expect(await cache.list()).toEqual([]);
    expect(await cache.totalSize()).toBe(0);
  });

  it('removes a single course', async () => {
    const cache = new CourseCache(new MemoryStore());

    await cache.cache('a', { title: 'A' });
    await cache.remove('a');

    expect(await cache.has('a')).toBe(false);
  });
});
