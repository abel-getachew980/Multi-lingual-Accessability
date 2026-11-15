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
  'ነው',
  'ናቸው',
  'የ',
  'ወደ',
  'ከ',
  'በ',
  'ለ',
  'እና',
  'ስለ',
]);

const ETHIOPIC_VARIANT_BASES: Array<[number, number]> = [
  [0x1210, 0x1200],
  [0x1280, 0x1200],
  [0x12B8, 0x1200],
  [0x1220, 0x1230],
  [0x12D0, 0x12A0],
  [0x1340, 0x1338],
];

const ETHIOPIC_VARIANT_PATTERN = new RegExp(
  `[${ETHIOPIC_VARIANT_BASES
    .map(([base]) => `${String.fromCharCode(base)}-${String.fromCharCode(base + 7)}`)
    .join('')}]`,
  'g',
);

const ETHIOPIC_VARIANT_MAP = new Map<string, string>();
for (const [variantBase, canonicalBase] of ETHIOPIC_VARIANT_BASES) {
  for (let order = 0; order < 8; order += 1) {
    ETHIOPIC_VARIANT_MAP.set(
      String.fromCharCode(variantBase + order),
      String.fromCharCode(canonicalBase + order),
    );
  }
}

export function normalizeEthiopic(text: string): string {
  return text.replace(
    ETHIOPIC_VARIANT_PATTERN,
    (character) => ETHIOPIC_VARIANT_MAP.get(character) ?? character,
  );
}

export function normalizeText(text: string): string {
  return normalizeEthiopic(text.toLowerCase())
    .replace(/[^\w\u1200-\u137F\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeText(text: string): string[] {
  return (normalizeText(text).match(/[\w\u1200-\u137F]+/g) ?? [])
    .filter((token) => !STOP_WORDS.has(token));
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

export function languageInstruction(language: 'am' | 'en'): string {
  return language === 'am'
    ? 'Respond in Amharic using Ethiopic script. Do not switch to English unless the learner explicitly asks.'
    : 'Respond in English.';
}
