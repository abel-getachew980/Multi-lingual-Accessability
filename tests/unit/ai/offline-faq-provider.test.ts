import { OfflineFAQProvider } from '@/services/ai/OfflineFAQProvider';
import type { FAQEntry } from '@/services/ai/types';

const entries: FAQEntry[] = [
  {
    id: 'faq-1',
    question: 'What is photosynthesis?',
    questionAm: 'ፎቶሲንተሲስ ምንድን ነው?',
    answer: 'Photosynthesis is how plants make food from sunlight.',
    answerAm: 'ፎቶሲንተሲስ እፅዋት ከፀሐይ ብርሃን ምግብ የሚሠሩበት ሂደት ነው።',
    citation: { source: 'Biology Grade 9', page: 42 },
    keywords: ['plants', 'chlorophyll', 'sunlight'],
  },
  {
    id: 'faq-2',
    question: 'How do I reset my password?',
    answer: 'Open settings and choose reset password.',
    citation: { source: 'Learner Handbook', section: 'Accounts' },
    keywords: ['account', 'login'],
  },
];

describe('OfflineFAQProvider', () => {
  it('finds an exact English question', async () => {
    const provider = new OfflineFAQProvider({ entries });

    const response = await provider.query({
      question: 'what is photosynthesis?',
      language: 'en',
    });

    expect(response.provider).toBe('offline');
    expect(response.answer).toBe(entries[0].answer);
    expect(response.citation).toEqual(entries[0].citation);
    expect(response.confidence).toBeGreaterThan(0.5);
  });

  it('matches a fuzzy question using keywords', async () => {
    const provider = new OfflineFAQProvider({ entries });

    const response = await provider.query({
      question: 'which plants use chlorophyll in sunlight',
      language: 'en',
    });

    expect(response.answer).toBe(entries[0].answer);
  });

  it('answers Amharic questions with the Amharic answer', async () => {
    const provider = new OfflineFAQProvider({ entries });

    const response = await provider.query({
      question: 'ፎቶሲንተሲስ ምንድን ነው?',
      language: 'am',
    });

    expect(response.answer).toBe(entries[0].answerAm);
    expect(response.citation).toEqual(entries[0].citation);
  });

  it('falls back in the requested language when there is no match', async () => {
    const provider = new OfflineFAQProvider({ entries });

    const english = await provider.query({
      question: 'tell me about the periodic table',
      language: 'en',
    });
    const amharic = await provider.query({
      question: 'ስለ ወቅታዊ ሰንጠረዥ ንገረኝ',
      language: 'am',
    });

    expect(english.answer).toMatch(/could not|cannot|sorry/i);
    expect(amharic.answer).toMatch(/ይቅርታ/);
    expect(english.confidence).toBe(0);
    expect(amharic.confidence).toBe(0);
  });

  it('accepts new FAQ entries at runtime', async () => {
    const provider = new OfflineFAQProvider({ entries });

    provider.addFAQ({
      id: 'faq-3',
      question: 'What is the capital of Ethiopia?',
      answer: 'Addis Ababa is the capital of Ethiopia.',
    });

    const response = await provider.query({
      question: 'capital of Ethiopia',
      language: 'en',
    });

    expect(response.answer).toBe('Addis Ababa is the capital of Ethiopia.');
  });

  it('is always available without a network connection', async () => {
    const provider = new OfflineFAQProvider({ entries });

    await expect(provider.isAvailable()).resolves.toBe(true);
    expect(provider.getName()).toBe('Offline FAQ');
  });
});
