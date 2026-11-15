import { normalizeText, tokenizeText } from '@/services/ai/textUtils';

describe('Ethiopic text normalization', () => {
  it('normalizes common Amharic homophone spellings', () => {
    expect(normalizeText('ሐይማኖት')).toBe(normalizeText('ሀይማኖት'));
    expect(normalizeText('ፀሐይ')).toBe(normalizeText('ጸሀይ'));
    expect(normalizeText('ሠላም')).toBe(normalizeText('ሰላም'));
  });

  it('preserves the Ethiopic vowel order while normalizing variants', () => {
    expect(normalizeText('ሐሁሂሃሄህሆ')).toBe(normalizeText('ሀሁሂሃሄህሆ'));
  });

  it('tokenizes Amharic text', () => {
    expect(tokenizeText('ፎቶሲንተሲስ ምንድን ነው?')).toEqual(['ፎቶሲንተሲስ', 'ምንድን']);
  });
});
