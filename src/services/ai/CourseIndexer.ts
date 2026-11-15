import type { ContentChunk, CourseContent, Language } from '@/types';
import type { CourseSearchOptions, CourseSearchResult } from './types';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'with',
]);

interface IndexedCourse {
  course: CourseContent;
  chunks: ContentChunk[];
}

export class CourseIndexer {
  private readonly courses = new Map<string, IndexedCourse>();

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

    this.courses.set(course.id, {
      course: { ...course, chunks },
      chunks,
    });
  }

  async addChunks(courseId: string, chunks: ContentChunk[]): Promise<void> {
    const existing = this.courses.get(courseId);
    if (!existing) {
      throw new Error(`Course ${courseId} has not been indexed`);
    }

    existing.chunks = [...existing.chunks, ...chunks];
    existing.course = { ...existing.course, chunks: existing.chunks };
  }

  async getCourse(courseId: string): Promise<CourseContent | undefined> {
    return this.courses.get(courseId)?.course;
  }

  async search(query: string, options: CourseSearchOptions = {}): Promise<CourseSearchResult[]> {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const normalizedQuery = this.normalize(query);
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
  }

  private scoreChunk(normalizedQuery: string, queryTokens: string[], content: string): number {
    const normalizedContent = this.normalize(content);
    if (!normalizedContent) return 0;

    const contentTokens = this.tokenize(content);
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

export const courseIndexer = new CourseIndexer();
