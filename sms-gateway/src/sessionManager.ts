import type { Language, SmsSession } from './types';

/**
 * In-memory session store keyed by phone number.
 *
 * If the gateway is scaled to more than one process this should be moved to a
 * shared store (Redis, Postgres). The interface is intentionally tiny so that
 * swap is easy.
 */
export class InMemorySessionStore {
  private readonly sessions = new Map<string, SmsSession>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(phoneNumber: string): SmsSession | undefined {
    const session = this.sessions.get(phoneNumber);
    if (!session) return undefined;

    if (this.isExpired(session)) {
      this.sessions.delete(phoneNumber);
      return undefined;
    }

    return session;
  }

  getOrCreate(phoneNumber: string, defaultLanguage: Language): SmsSession {
    const existing = this.get(phoneNumber);
    if (existing) return existing;

    const session: SmsSession = {
      phoneNumber,
      language: defaultLanguage,
      lastActivity: this.now(),
      pendingChunks: [],
    };

    this.sessions.set(phoneNumber, session);
    return session;
  }

  save(session: SmsSession): void {
    session.lastActivity = this.now();
    this.sessions.set(session.phoneNumber, session);
  }

  delete(phoneNumber: string): void {
    this.sessions.delete(phoneNumber);
  }

  prune(): void {
    for (const [phoneNumber, session] of this.sessions) {
      if (this.isExpired(session)) this.sessions.delete(phoneNumber);
    }
  }

  get size(): number {
    return this.sessions.size;
  }

  private isExpired(session: SmsSession): boolean {
    return this.now() - session.lastActivity > this.ttlMs;
  }
}
