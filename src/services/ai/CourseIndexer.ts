import type { ContentChunk, CourseContent } from '@/types';
import type {
  CourseIndexerOptions,
  CourseIndexStorage,
  CourseSearchOptions,
  CourseSearchResult,
} from './types';
import { normalizeText, tokenizeText } from './textUtils';

const DATABASE_NAME = 'ai-tutor-courses';
const DATABASE_VERSION = 1;
const COURSE_STORE = 'courses';

interface IndexedCourse {
  course: CourseContent;
  chunks: ContentChunk[];
}

class MemoryCourseStorage implements CourseIndexStorage {
  private readonly courses = new Map<string, CourseContent>();

  async getAll(): Promise<CourseContent[]> {
    return Array.from(this.courses.values());
  }

  async put(course: CourseContent): Promise<void> {
    this.courses.set(course.id, course);
  }

  async remove(courseId: string): Promise<void> {
    this.courses.delete(courseId);
  }

  async clear(): Promise<void> {
    this.courses.clear();
  }
}

class IndexedDBCourseStorage implements CourseIndexStorage {
  private databasePromise?: Promise<IDBDatabase>;

  async getAll(): Promise<CourseContent[]> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(COURSE_STORE, 'readonly');
      const request = transaction.objectStore(COURSE_STORE).getAll();
      request.onsuccess = () => resolve(request.result as CourseContent[]);
      request.onerror = () => reject(request.error ?? new Error('Failed to read courses'));
    });
  }

  async put(course: CourseContent): Promise<void> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(COURSE_STORE, 'readwrite');
      transaction.objectStore(COURSE_STORE).put(course);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save course'));
    });
  }

  async remove(courseId: string): Promise<void> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(COURSE_STORE, 'readwrite');
      transaction.objectStore(COURSE_STORE).delete(courseId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to delete course'));
    });
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(COURSE_STORE, 'readwrite');
      transaction.objectStore(COURSE_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to clear courses'));
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(COURSE_STORE)) {
            database.createObjectStore(COURSE_STORE, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open course database'));
      });
    }

    return this.databasePromise;
  }
}

function createDefaultCourseStorage(): CourseIndexStorage {
  if (typeof indexedDB !== 'undefined') return new IndexedDBCourseStorage();
  return new MemoryCourseStorage();
}

export class CourseIndexer {
  private readonly courses = new Map<string, IndexedCourse>();
  private readonly storage: CourseIndexStorage;
  private loadPromise?: Promise<void>;

  constructor(options: CourseIndexerOptions = {}) {
    this.storage = options.storage ?? createDefaultCourseStorage();
  }

  async addCourse(course: CourseContent): Promise<void> {
    const chunks = course.chunks && course.chunks.length > 0
      ? course.chunks
      : [
          {
            id: `${course.id}-chunk-1`,
            courseId: course.id,
            content: course.content,
          },
        ];

    const indexedCourse = { ...course, chunks };
    this.courses.set(course.id, { course: indexedCourse, chunks });
    await this.storage.put(indexedCourse).catch(() => undefined);
  }

  async addChunks(courseId: string, chunks: ContentChunk[]): Promise<void> {
    await this.ensureLoaded();
    const existing = this.courses.get(courseId);
    if (!existing) {
      throw new Error(`Course ${courseId} has not been indexed`);
    }

    existing.chunks = [...existing.chunks, ...chunks];
    existing.course = { ...existing.course, chunks: existing.chunks };
    await this.storage.put(existing.course).catch(() => undefined);
  }

  async getCourse(courseId: string): Promise<CourseContent | undefined> {
    await this.ensureLoaded();
    return this.courses.get(courseId)?.course;
  }

  async listCourses(): Promise<CourseContent[]> {
    await this.ensureLoaded();
    return Array.from(this.courses.values())
      .map((indexed) => indexed.course)
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  async search(query: string, options: CourseSearchOptions = {}): Promise<CourseSearchResult[]> {
    const queryTokens = tokenizeText(query);
    if (queryTokens.length === 0) return [];

    await this.ensureLoaded();

    const normalizedQuery = normalizeText(query);
    const results: CourseSearchResult[] = [];

    for (const { course, chunks } of Array.from(this.courses.values())) {
      if (options.courseId && course.id !== options.courseId) continue;
      if (options.language && course.language !== options.language) continue;

      for (const chunk of chunks) {
        const score = this.scoreChunk(normalizedQuery, queryTokens, chunk.content);
        if (score > 0) {
          results.push({ chunk, course, score });
        }
      }
    }

    results.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.chunk.id.localeCompare(right.chunk.id);
    });

    return results.slice(0, options.limit ?? 5);
  }

  clear(): void {
    this.courses.clear();
    void this.storage.clear?.().catch(() => undefined);
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadFromStorage();
    }
    await this.loadPromise;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.getAll();
      for (const course of stored) {
        if (this.courses.has(course.id)) continue;
        const chunks = course.chunks && course.chunks.length > 0
          ? course.chunks
          : [{ id: `${course.id}-chunk-1`, courseId: course.id, content: course.content }];
        this.courses.set(course.id, { course, chunks });
      }
    } catch {
      this.loadPromise = Promise.resolve();
    }
  }

  private scoreChunk(normalizedQuery: string, queryTokens: string[], content: string): number {
    const normalizedContent = normalizeText(content);
    if (!normalizedContent) return 0;

    const contentTokens = tokenizeText(content);
    const frequencies = new Map<string, number>();
    for (const token of contentTokens) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }

    let score = normalizedContent.includes(normalizedQuery) ? 3 : 0;

    for (const token of Array.from(new Set(queryTokens))) {
      const occurrences = frequencies.get(token) ?? 0;
      if (occurrences > 0) {
        score += 1 + Math.log(occurrences);
      }
    }

    return score;
  }
}

export const courseIndexer = new CourseIndexer();
