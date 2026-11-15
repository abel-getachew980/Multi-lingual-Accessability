import type {
  AIProvider,
  AIQuery,
  AIResponse,
  Citation,
  ContentChunk,
  CourseContent,
  Language,
  Message,
} from '@/types';

export interface ProviderQueryOptions {
  contextChunks?: ContentChunk[];
}

export interface AIProviderInterface {
  query(request: AIQuery, options?: ProviderQueryOptions): Promise<AIResponse>;
  isAvailable(): Promise<boolean>;
  getName(): string;
}

export interface FAQEntry {
  id: string;
  question: string;
  questionAm?: string;
  answer: string;
  answerAm?: string;
  citation?: Citation;
  keywords?: string[];
  language?: Language;
}

export interface FAQStorage {
  getAll(): Promise<FAQEntry[]>;
  put(entry: FAQEntry): Promise<void>;
  remove?(id: string): Promise<void>;
  clear?(): Promise<void>;
}

export interface OfflineFAQOptions {
  entries?: FAQEntry[];
  storage?: FAQStorage;
  minimumScore?: number;
}

export interface ParsedFileInput {
  name: string;
  type?: string;
  data: string | ArrayBuffer | Uint8Array;
}

export interface CourseParseOptions {
  maxChunkSize?: number;
  chunkOverlap?: number;
  title?: string;
  language?: Language;
}

export interface ParsedCourse extends CourseContent {
  chunks: ContentChunk[];
  totalPages: number;
}

export interface CourseSearchResult {
  chunk: ContentChunk;
  course: CourseContent;
  score: number;
}

export interface CourseSearchOptions {
  courseId?: string;
  language?: Language;
  limit?: number;
}

export interface CourseIndexStorage {
  getAll(): Promise<CourseContent[]>;
  put(course: CourseContent): Promise<void>;
  remove?(courseId: string): Promise<void>;
  clear?(): Promise<void>;
}

export interface CourseIndexerOptions {
  storage?: CourseIndexStorage;
}

export interface CloudProviderConfig {
  apiKey: string;
  endpoint: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface LocalProviderConfig {
  endpoint: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface ProviderFactoryOptions {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxRetries?: number;
  timeoutMs?: number;
  faqEntries?: FAQEntry[];
  faqStorage?: FAQStorage;
}

export interface ValidatedAIQuery {
  question: string;
  language: Language;
  provider: AIProvider;
  context?: string[];
  conversationHistory?: Message[];
}

export type ValidationResult =
  | { ok: true; value: ValidatedAIQuery }
  | { ok: false; error: string };

export interface AIProviderErrorOptions extends ErrorOptions {
  retryable?: boolean;
}

export class AIProviderError extends Error {
  readonly provider: AIProvider;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    provider: AIProvider,
    status?: number,
    options: AIProviderErrorOptions = {},
  ) {
    super(message, options);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.status = status;
    this.retryable = options.retryable
      ?? (status === 429 || (status !== undefined && status >= 500));
  }
}
