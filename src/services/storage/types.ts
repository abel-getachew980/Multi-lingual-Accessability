// ============================================
// STORAGE TYPES - Teammate 6
// ============================================

import { Language, CourseContent, Citation, Message, HumanHelpRequest } from '@/types';

/**
 * Stored message in IndexedDB
 */
export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  language: Language;
  timestamp: Date;
  citation?: Citation;
  isOffline?: boolean;
}

/**
 * Cached course in IndexedDB
 */
export interface CachedCourse {
  id: string;
  data: CourseContent;
  cachedAt: Date;
  lastAccessed: Date;
  size: number;
}

/**
 * Offline queue item
 */
export interface OfflineQueueItem {
  id: string;
  type: 'message' | 'help_request';
  payload: Message | HumanHelpRequest;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'sent' | 'failed';
  maxRetries?: number;
}

/**
 * Storage usage statistics
 */
export interface StorageUsage {
  courses: number;
  messages: number;
  queue: number;
  total: number;
  usedMB: number;
  availableMB?: number;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  dbName: string;
  dbVersion: number;
  maxRetries: number;
  syncIntervalMs: number;
  maxCacheAge: number; // days
}
