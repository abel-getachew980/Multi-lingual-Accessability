/**
 * Storage layer types.
 *
 * Everything here is deliberately framework-free so the same code runs in the
 * browser, in tests (with `MemoryStore`) and during server rendering (where the
 * stores simply report that IndexedDB is unavailable).
 */

import type { Message, UserPreferences } from '@/types';

export const DB_NAME = 'ai-tutor-db';
export const DB_VERSION = 1;

export const STORES = {
  courses: 'courses',
  conversations: 'conversations',
  queue: 'queue',
  messages: 'messages',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/** Every record needs a string key so one interface works for all stores. */
export interface StoredRecord {
  id: string;
}

export interface CachedCourseEntry<T = unknown> extends StoredRecord {
  data: T;
  cachedAt: number;
  lastAccessed: number;
  /** UTF-8 byte size of the serialised payload. */
  size: number;
}

export interface QueuedRequestInput {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  /** Human readable label, e.g. the question that produced the request. */
  label?: string;
}

export interface QueuedRequest extends StoredRecord {
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  label?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface QueueSyncSuccess {
  request: QueuedRequest;
  status: number;
  body: string;
}

export interface QueueSyncResult {
  /** Requests the server accepted; the response body is kept for the caller. */
  sent: QueueSyncSuccess[];
  /** Requests that failed in a way worth retrying later. */
  failed: string[];
  /** Requests that were permanently rejected or ran out of attempts. */
  dropped: string[];
}

export interface StoredMessage extends Omit<Message, 'timestamp'> {
  /** ISO string: IndexedDB would keep a Date, but JSON fallbacks would not. */
  timestamp: string;
}

export interface StoredConversation extends StoredRecord {
  messages: StoredMessage[];
  updatedAt: number;
}

export class StorageUnavailableError extends Error {
  constructor(message = 'Persistent storage is not available in this environment') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

/**
 * Defaults live here (not in the React context) so the preferences store and
 * the UI cannot drift apart.
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
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
