import type { AIQuery, ContentChunk } from '@/types';

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

export function tokenizeText(text: string): string[] {
  return (text.toLowerCase().match(/[\w\u1200-\u137F]+/g) ?? [])
    .filter((token) => !STOP_WORDS.has(token));
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u1200-\u137F\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatContextLines(
  request: Pick<AIQuery, 'context'>,
  chunks: ContentChunk[],
): string[] {
  return [
    ...(request.context ?? []),
    ...chunks.map((chunk, index) => {
      const page = chunk.pageNumber ? `, page ${chunk.pageNumber}` : '';
      const section = chunk.section ? `, ${chunk.section}` : '';
      return `[${index + 1}] ${chunk.courseId}${page}${section}: ${chunk.content}`;
    }),
  ];
}
