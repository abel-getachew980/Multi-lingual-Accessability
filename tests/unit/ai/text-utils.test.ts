import { normalizeText, tokenizeText } from '@/services/ai/textUtils';

describe('Ethiopic text normalization', () => {
  it('normalizes common Amharic homophone spellings', () => {
    expect(normalizeText('ሐይማኖት')).toBe(normalizeText('ሀይማኖት'));
    expect(normalizeText('ፀሐይ')).toBe(normalizeText('ጸሀይ'));
    expect(normalizeText('ሠላም')).toBe(normalizeText('ሰላም'));
    expect(normalizeText('ኸረ')).toBe(normalizeText('ሀረ'));
    expect(normalizeText('ኹሉ')).toBe(normalizeText('ሁሉ'));
  });

  it('preserves the Ethiopic vowel order while normalizing variants', () => {
    expect(normalizeText('ሐሁሂሃሄህሆ')).toBe(normalizeText('ሀሁሂሃሄህሆ'));
  });

  it('does not collapse the XWA family into HA', () => {
    expect(normalizeText('ኈ')).not.toBe(normalizeText('ሀ'));
  });

  it('tokenizes Amharic text', () => {
    expect(tokenizeText('ፎቶሲንተሲስ ምንድን ነው?')).toEqual(['ፎቶሲንተሲስ', 'ምንድን']);
  });
});
