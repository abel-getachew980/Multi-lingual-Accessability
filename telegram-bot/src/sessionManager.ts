import type { ChatSession, Language } from './types';

/**
 * In-memory session store keyed by chat id.
 *
 * The bot is a single process for the hackathon, so a Map is enough. The
 * interface is deliberately small so a Redis implementation can replace it
 * when the bot runs on more than one instance.
 */
export class InMemorySessionStore {
  private readonly sessions = new Map<string, ChatSession>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (ttlMs < 1) throw new RangeError('ttlMs must be at least 1');
  }

  get(chatId: string): ChatSession | undefined {
    const session = this.sessions.get(chatId);
    if (!session) return undefined;

    if (this.isExpired(session)) {
      this.sessions.delete(chatId);
      return undefined;
    }

    return session;
  }

  getOrCreate(chatId: string, defaultLanguage: Language): ChatSession {
    const existing = this.get(chatId);
    if (existing) return existing;

    const session: ChatSession = {
      chatId,
      language: defaultLanguage,
      lastActivity: this.now(),
      history: [],
    };

    this.sessions.set(chatId, session);
    return session;
  }

  save(session: ChatSession): void {
    session.lastActivity = this.now();
    this.sessions.set(session.chatId, session);
  }

  delete(chatId: string): void {
    this.sessions.delete(chatId);
  }

  prune(): void {
    Array.from(this.sessions.entries()).forEach(([chatId, session]) => {
      if (this.isExpired(session)) this.sessions.delete(chatId);
    });
  }

  get size(): number {
    return this.sessions.size;
  }

  private isExpired(session: ChatSession): boolean {
    return this.now() - session.lastActivity > this.ttlMs;
  }
}
