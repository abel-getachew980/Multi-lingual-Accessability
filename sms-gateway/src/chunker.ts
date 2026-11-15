/**
 * Splits answers into SMS-sized segments.
 *
 * Encoding matters for cost and for whether a message arrives as one SMS:
 * - GSM-7 (Latin, digits, basic punctuation): 160 characters per SMS.
 * - UCS-2 (Amharic / Ethiopic script, emoji, curly quotes): 70 characters.
 *
 * We deliberately avoid emoji in replies because a single emoji forces the
 * whole message into UCS-2, tripling the number of billable segments.
 */

export const GSM7_MAX_LENGTH = 160;
export const UCS2_MAX_LENGTH = 70;

/**
 * Characters in the GSM 03.38 basic alphabet. `\n`, `\r` and a handful of
 * extended characters are included; extended characters occupy two septets,
 * which is close enough to the 160 character budget for our purposes.
 */
const GSM7_CHARS =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€';

const GSM7_SET = new Set(Array.from(GSM7_CHARS));

export function isGsm7(text: string): boolean {
  return Array.from(text).every((char) => GSM7_SET.has(char));
}

export function maxLengthFor(text: string): number {
  return isGsm7(text) ? GSM7_MAX_LENGTH : UCS2_MAX_LENGTH;
}

/**
 * Chunk `text` respecting word boundaries when possible.
 *
 * A single word longer than `maxLength` is hard-split, so a segment is never
 * longer than the encoding limit.
 */
export function chunkMessage(text: string, maxLength?: number): string[] {
  const limit = maxLength ?? maxLengthFor(text);

  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('maxLength must be a positive integer');
  }

  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const chars = Array.from(normalized);
  const chunks: string[] = [];
  let start = 0;

  while (start < chars.length) {
    let end = Math.min(start + limit, chars.length);

    if (end < chars.length) {
      let newlineBreak = -1;
      let spaceBreak = -1;

      for (let i = end - 1; i > start; i--) {
        const char = chars[i];

        if (char === '\n') {
          if (newlineBreak === -1) newlineBreak = i;
          if (spaceBreak === -1) spaceBreak = i;
        } else if (char === ' ' && spaceBreak === -1) {
          spaceBreak = i;
        }

        if (newlineBreak !== -1 && spaceBreak !== -1) break;
      }

      // Prefer a line break so menus and citations stay readable, unless it
      // would leave most of a segment empty.
      const minUseful = start + Math.ceil(limit / 2);
      if (newlineBreak > minUseful) {
        end = newlineBreak;
      } else if (spaceBreak > start) {
        end = spaceBreak;
      }
    }

    const piece = chars.slice(start, end).join('').trim();
    if (piece) chunks.push(piece);

    start = end;
    while (start < chars.length && (chars[start] === ' ' || chars[start] === '\n')) {
      start += 1;
    }
  }

  return chunks;
}
