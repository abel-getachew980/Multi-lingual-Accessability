import type { Message } from '@/types';
import { ConversationStore, MemoryStore } from '@/services/storage';

function message(id: string, content: string): Message {
  return {
    id,
    role: 'user',
    content,
    language: 'am',
    timestamp: new Date('2026-11-15T10:00:00.000Z'),
  };
}

describe('ConversationStore', () => {
  it('saves and restores messages with real Date timestamps', async () => {
    const store = new ConversationStore(new MemoryStore());

    await store.save([message('1', 'ሰላም'), message('2', 'ሕዋስ ምንድን ነው?')]);
    const loaded = await store.load();

    expect(loaded).toHaveLength(2);
    expect(loaded[0].content).toBe('ሰላም');
    expect(loaded[0].timestamp).toBeInstanceOf(Date);
    expect(loaded[0].timestamp.toISOString()).toBe('2026-11-15T10:00:00.000Z');
  });

  it('keeps only the newest messages', async () => {
    const store = new ConversationStore(new MemoryStore(), 2);

    await store.save([message('1', 'one'), message('2', 'two'), message('3', 'three')]);
    const loaded = await store.load();

    expect(loaded.map((item) => item.content)).toEqual(['two', 'three']);
  });

  it('returns an empty list when nothing was saved', async () => {
    const store = new ConversationStore(new MemoryStore());
    expect(await store.load()).toEqual([]);
  });

  it('ignores a corrupted record', async () => {
    const backend = new MemoryStore();
    await backend.set('conversations', {
      id: 'active',
      messages: 'not-an-array',
      updatedAt: 1,
    });

    const store = new ConversationStore(backend);
    expect(await store.load()).toEqual([]);
  });

  it('clears the saved transcript', async () => {
    const store = new ConversationStore(new MemoryStore());

    await store.save([message('1', 'hello')]);
    await store.clear();

    expect(await store.load()).toEqual([]);
  });
});
