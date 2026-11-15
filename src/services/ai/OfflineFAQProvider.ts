import type { AIQuery, AIResponse, Citation, Language } from '@/types';
import type {
  AIProviderInterface,
  FAQEntry,
  FAQStorage,
  OfflineFAQOptions,
  ProviderQueryOptions,
} from './types';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'do',
  'does',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'please',
  'tell',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'what',
  'which',
  'with',
]);

const DATABASE_NAME = 'ai-tutor';
const DATABASE_VERSION = 1;
const FAQ_STORE = 'faqs';

class MemoryFAQStorage implements FAQStorage {
  private readonly entries = new Map<string, FAQEntry>();

  async getAll(): Promise<FAQEntry[]> {
    return Array.from(this.entries.values());
  }

  async put(entry: FAQEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}

class IndexedDBFAQStorage implements FAQStorage {
  private databasePromise?: Promise<IDBDatabase>;

  async getAll(): Promise<FAQEntry[]> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(FAQ_STORE, 'readonly');
      const request = transaction.objectStore(FAQ_STORE).getAll();
      request.onsuccess = () => resolve(request.result as FAQEntry[]);
      request.onerror = () => reject(request.error ?? new Error('Failed to read FAQs'));
    });
  }

  async put(entry: FAQEntry): Promise<void> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(FAQ_STORE, 'readwrite');
      transaction.objectStore(FAQ_STORE).put(entry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save FAQ'));
    });
  }

  async remove(id: string): Promise<void> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(FAQ_STORE, 'readwrite');
      transaction.objectStore(FAQ_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to delete FAQ'));
    });
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(FAQ_STORE, 'readwrite');
      transaction.objectStore(FAQ_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to clear FAQs'));
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(FAQ_STORE)) {
            database.createObjectStore(FAQ_STORE, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open FAQ database'));
      });
    }

    return this.databasePromise;
  }
}

function createDefaultFAQStorage(): FAQStorage {
  if (typeof indexedDB !== 'undefined') return new IndexedDBFAQStorage();
  return new MemoryFAQStorage();
}

export class OfflineFAQProvider implements AIProviderInterface {
  private readonly entries = new Map<string, FAQEntry>();
  private readonly storage: FAQStorage;
  private readonly minimumScore: number;
  private loadPromise?: Promise<void>;

  constructor(options: OfflineFAQOptions = {}) {
    this.storage = options.storage ?? createDefaultFAQStorage();
    this.minimumScore = options.minimumScore ?? 0.3;

    for (const entry of options.entries ?? []) {
      this.entries.set(entry.id, entry);
    }
  }

  async query(request: AIQuery, _options?: ProviderQueryOptions): Promise<AIResponse> {
    const startedAt = Date.now();
    await this.ensureLoaded();

    const normalizedQuestion = this.normalize(request.question);
    const queryTokens = this.tokenize(request.question);

    let bestEntry: FAQEntry | undefined;
    let bestScore = 0;

    for (const entry of Array.from(this.entries.values())) {
      const score = this.scoreEntry(entry, normalizedQuestion, queryTokens, request.language);
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    if (!bestEntry || bestScore < this.minimumScore) {
      return {
        answer: request.language === 'am'
          ? 'ይቅርታ፣ ይህን ጥያቄ መመለስ አልቻልኩም። እባክዎ ሌላ መንገድ ይሞክሩ።'
          : 'Sorry, I could not find an answer to that question. Please try another way.',
        provider: 'offline',
        confidence: 0,
        processingTime: Date.now() - startedAt,
      };
    }

    return {
      answer: this.answerFor(bestEntry, request.language),
      ...(bestEntry.citation ? { citation: bestEntry.citation } : {}),
      provider: 'offline',
      confidence: Math.min(1, bestScore),
      processingTime: Date.now() - startedAt,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getName(): string {
    return 'Offline FAQ';
  }

  addFAQ(entry: FAQEntry): void {
    this.entries.set(entry.id, entry);
    void this.storage.put(entry).catch(() => undefined);
  }

  async removeFAQ(id: string): Promise<void> {
    this.entries.delete(id);
    await this.storage.remove?.(id);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    await this.storage.clear?.();
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
      for (const entry of stored) {
        if (!this.entries.has(entry.id)) {
          this.entries.set(entry.id, entry);
        }
      }
    } catch {
      this.loadPromise = Promise.resolve();
    }
  }

  private answerFor(entry: FAQEntry, language: Language): string {
    if (language === 'am' && entry.answerAm) return entry.answerAm;
    return entry.answer;
  }

  private scoreEntry(
    entry: FAQEntry,
    normalizedQuestion: string,
    queryTokens: string[],
    language: Language,
  ): number {
    const candidates = [
      language === 'am' ? entry.questionAm : undefined,
      entry.question,
      entry.questionAm,
      ...(entry.keywords ?? []),
    ].filter((candidate): candidate is string => Boolean(candidate));

    let best = 0;

    for (const candidate of candidates) {
      const normalizedCandidate = this.normalize(candidate);
      if (!normalizedCandidate) continue;

      if (normalizedCandidate === normalizedQuestion) {
        best = Math.max(best, 1);
        continue;
      }

      if (
        normalizedQuestion.length > 3
        && (normalizedCandidate.includes(normalizedQuestion)
          || normalizedQuestion.includes(normalizedCandidate))
      ) {
        best = Math.max(best, 0.85);
        continue;
      }

      const candidateTokens = this.tokenize(candidate);
      if (queryTokens.length === 0 || candidateTokens.length === 0) continue;

      const candidateSet = new Set(candidateTokens);
      const intersection = queryTokens.filter((token) => candidateSet.has(token)).length;
      if (intersection === 0) continue;

      const queryCoverage = intersection / queryTokens.length;
      const candidateCoverage = intersection / candidateTokens.length;
      best = Math.max(best, queryCoverage * 0.7 + candidateCoverage * 0.3);
    }

    return best;
  }

  private tokenize(text: string): string[] {
    return (text.toLowerCase().match(/[\w\u1200-\u137F]+/g) ?? [])
      .filter((token) => !STOP_WORDS.has(token));
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\u1200-\u137F\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export type { FAQEntry, FAQStorage, OfflineFAQOptions, Citation };
