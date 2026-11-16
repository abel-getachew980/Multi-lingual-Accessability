import type { Message } from '@/types';
import type { KVStore } from './KVStore';
import { STORES, type StoredConversation, type StoredMessage } from './types';

const ACTIVE_CONVERSATION_ID = 'active';
const DEFAULT_LIMIT = 200;

function toStored(message: Message): StoredMessage {
  return { ...message, timestamp: message.timestamp.toISOString() };
}

function fromStored(message: StoredMessage): Message {
  const parsed = new Date(message.timestamp);
  return {
    ...message,
    timestamp: Number.isNaN(parsed.getTime()) ? new Date() : parsed,
  };
}

/**
 * Keeps the current transcript across reloads and app restarts.
 *
 * Only the most recent `limit` messages are persisted: a long tutoring session
 * should not grow without bound on a phone with little free space.
 */
export class ConversationStore {
  constructor(
    private readonly store: KVStore,
    private readonly limit: number = DEFAULT_LIMIT,
    private readonly now: () => number = Date.now,
  ) {}

  async save(messages: Message[]): Promise<void> {
    const recent = messages.slice(-Math.max(1, this.limit));
    const conversation: StoredConversation = {
      id: ACTIVE_CONVERSATION_ID,
      messages: recent.map(toStored),
      updatedAt: this.now(),
    };

    await this.store.set(STORES.conversations, conversation);
  }

  async load(): Promise<Message[]> {
    const conversation = await this.store.get<StoredConversation>(
      STORES.conversations,
      ACTIVE_CONVERSATION_ID,
    );

    if (!conversation || !Array.isArray(conversation.messages)) return [];
    return conversation.messages.map(fromStored);
  }

  async clear(): Promise<void> {
    await this.store.delete(STORES.conversations, ACTIVE_CONVERSATION_ID);
  }
}
