import type { Citation, ContentChunk, Language } from '@/types';

interface CitationTrackerOptions {
  courseTitles?: Record<string, string>;
  defaultSource?: string;
}

export class CitationTracker {
  private readonly courseTitles: Record<string, string>;
  private readonly defaultSource?: string;

  constructor(options: CitationTrackerOptions = {}) {
    this.courseTitles = options.courseTitles ?? {};
    this.defaultSource = options.defaultSource;
  }

  track(chunk: ContentChunk, overrides: Partial<Citation> = {}): Citation {
    const citation: Citation = {
      source: this.courseTitles[chunk.courseId] ?? this.defaultSource ?? chunk.courseId,
      snippet: chunk.content,
    };

    if (chunk.pageNumber !== undefined) citation.page = chunk.pageNumber;
    if (chunk.section) citation.section = chunk.section;

    return { ...citation, ...overrides };
  }

  trackMany(chunks: ContentChunk[]): Citation[] {
    const citations = chunks.map((chunk) => this.track(chunk));
    return this.dedupe(citations);
  }

  dedupe(citations: Citation[]): Citation[] {
    const seen = new Set<string>();

    return citations.filter((citation) => {
      const key = `${citation.source}|${citation.page ?? ''}|${citation.section ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  format(citation: Citation, language: Language): string {
    const page = citation.page !== undefined
      ? language === 'am'
        ? `፣ ገጽ ${citation.page}`
        : `, page ${citation.page}`
      : '';
    const section = citation.section
      ? language === 'am'
        ? `፣ ${citation.section}`
        : `, ${citation.section}`
      : '';

    return language === 'am'
      ? `ምንጭ፦ ${citation.source}${page}${section}`
      : `${citation.source}${page}${section}`;
  }

  extractFromAnswer(answer: string, chunks: ContentChunk[]): Citation[] {
    const pattern = /\[(\d+)\]/g;
    const citations: Citation[] = [];
    let match: RegExpExecArray | null = pattern.exec(answer);

    while (match) {
      const index = Number.parseInt(match[1], 10) - 1;
      const chunk = chunks[index];
      if (chunk) citations.push(this.track(chunk));
      match = pattern.exec(answer);
    }

    return this.dedupe(citations);
  }
}

export function citationFromChunk(
  chunk: ContentChunk,
  courseTitles: Record<string, string> = {},
): Citation {
  return new CitationTracker({ courseTitles }).track(chunk);
}
