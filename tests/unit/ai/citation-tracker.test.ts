import { CitationTracker } from '@/services/ai/CitationTracker';
import type { ContentChunk } from '@/types';

const chunk: ContentChunk = {
  id: 'chunk-1',
  courseId: 'course-bio',
  content: 'Photosynthesis converts sunlight into chemical energy.',
  pageNumber: 7,
  section: 'Energy',
};

describe('CitationTracker', () => {
  it('creates a citation from a content chunk', () => {
    const tracker = new CitationTracker({ courseTitles: { 'course-bio': 'Biology Basics' } });

    expect(tracker.track(chunk)).toEqual({
      source: 'Biology Basics',
      page: 7,
      section: 'Energy',
      snippet: 'Photosynthesis converts sunlight into chemical energy.',
    });
  });

  it('deduplicates citations for chunks from the same source and page', () => {
    const tracker = new CitationTracker({ courseTitles: { 'course-bio': 'Biology Basics' } });

    const citations = tracker.trackMany([
      chunk,
      { ...chunk, id: 'chunk-2', content: 'Another sentence.' },
    ]);

    expect(citations).toHaveLength(1);
  });

  it('formats citations in English', () => {
    const tracker = new CitationTracker({ courseTitles: { 'course-bio': 'Biology Basics' } });
    const citation = tracker.track(chunk);

    expect(tracker.format(citation, 'en')).toBe('Biology Basics, page 7, Energy');
  });

  it('formats citations in Amharic', () => {
    const tracker = new CitationTracker({ courseTitles: { 'course-bio': 'Biology Basics' } });
    const citation = tracker.track(chunk);

    expect(tracker.format(citation, 'am')).toBe('ምንጭ፦ Biology Basics፣ ገጽ 7፣ Energy');
  });

  it('extracts citations referenced by bracketed numbers', () => {
    const tracker = new CitationTracker({ courseTitles: { 'course-bio': 'Biology Basics' } });

    const citations = tracker.extractFromAnswer(
      'Plants use sunlight [1]. Cells divide [2].',
      [chunk, { ...chunk, id: 'chunk-2', pageNumber: 9, section: 'Cells' }],
    );

    expect(citations.map((citation) => citation.page)).toEqual([7, 9]);
  });
});

describe('CitationTracker document links', () => {
  it('attaches document URLs when a mapping is available', () => {
    const tracker = new CitationTracker({
      courseTitles: { 'course-bio': 'Biology Basics' },
      documentUrls: { 'course-bio': 'https://example.com/biology.pdf' },
    });

    expect(tracker.track(chunk).url).toBe('https://example.com/biology.pdf');
  });
});
