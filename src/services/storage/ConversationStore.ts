/**
 * ConversationStore - Store conversation history
 *
 * Manages conversation history in IndexedDB for
 * offline access and history browsing.
 */

import { IndexedDBStore } from './IndexedDBStore';
import { StoredMessage } from './types';
import { Message } from '@/types';

export class ConversationStore {
  private store: IndexedDBStore;

  constructor(store: IndexedDBStore) {
    this.store = store;
  }

  /**
   * Save a message to conversation history
   */
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

  /**
   * Get all messages for a conversation
   */
  async getConversation(conversationId: string): Promise<Message[]> {
    const messages = await this.store.getByIndex<StoredMessage>(
      'messages',
      'conversationId',
      conversationId
    );

    // Sort by timestamp
    return messages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(this.convertToMessage);
  }

  /**
   * Get all conversations grouped by ID
   */
  async getAllConversations(): Promise<Map<string, Message[]>> {
    const all = await this.store.getAll<StoredMessage>('messages');
    const grouped = new Map<string, Message[]>();

    // Sort all messages by timestamp first
    all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const msg of all) {
      if (!grouped.has(msg.conversationId)) {
        grouped.set(msg.conversationId, []);
      }
      grouped.get(msg.conversationId)!.push(this.convertToMessage(msg));
    }

    return grouped;
  }

  /**
   * Get list of conversation IDs
   */
  async getConversationIds(): Promise<string[]> {
    const all = await this.store.getAll<StoredMessage>('messages');
    const ids = new Set(all.map(msg => msg.conversationId));
    return Array.from(ids);
  }

  /**
   * Get conversation count
   */
  async getConversationCount(): Promise<number> {
    const ids = await this.getConversationIds();
    return ids.length;
  }

  /**
   * Get message count for a conversation
   */
  async getMessageCount(conversationId?: string): Promise<number> {
    if (conversationId) {
      const messages = await this.getConversation(conversationId);
      return messages.length;
    }

    return await this.store.count('messages');
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<number> {
    const messages = await this.store.getByIndex<StoredMessage>(
      'messages',
      'conversationId',
      conversationId
    );

    for (const msg of messages) {
      await this.store.delete('messages', msg.id);
    }

    return messages.length;
  }

  /**
   * Clear messages older than X days
   */
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

  /**
   * Search messages by content
   */
  async searchMessages(query: string, conversationId?: string): Promise<Message[]> {
    const messages = conversationId
      ? await this.getConversation(conversationId)
      : await this.getAllMessages();

    const lowerQuery = query.toLowerCase();
    return messages.filter(msg =>
      msg.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get all messages (flat list)
   */
  async getAllMessages(): Promise<Message[]> {
    const all = await this.store.getAll<StoredMessage>('messages');
    return all
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(this.convertToMessage);
  }

  /**
   * Clear all messages
   */
  async clearAll(): Promise<void> {
    await this.store.clear('messages');
  }

  /**
   * Convert stored message to Message type
   */
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
