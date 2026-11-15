import { CourseIndexer } from '@/services/ai/CourseIndexer';
import type { CourseContent } from '@/types';

const course: CourseContent = {
  id: 'course-bio',
  title: 'Biology Basics',
  content: 'Photosynthesis converts sunlight into chemical energy in plants.',
  language: 'en',
  metadata: {
    fileName: 'biology.txt',
    uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
    fileSize: 120,
    fileType: 'text/plain',
  },
  chunks: [
    {
      id: 'chunk-1',
      courseId: 'course-bio',
      content: 'Photosynthesis converts sunlight into chemical energy in plants.',
      pageNumber: 1,
      section: 'Energy',
    },
    {
      id: 'chunk-2',
      courseId: 'course-bio',
      content: 'Cells are the basic structural unit of every living organism.',
      pageNumber: 2,
      section: 'Cells',
    },
  ],
};

describe('CourseIndexer', () => {
  it('indexes and retrieves a course by id', async () => {
    const indexer = new CourseIndexer();
    await indexer.addCourse(course);

    expect(await indexer.getCourse('course-bio')).toEqual(course);
    expect(await indexer.getCourse('missing')).toBeUndefined();
  });

  it('ranks the most relevant chunk first', async () => {
    const indexer = new CourseIndexer();
    await indexer.addCourse(course);

    const results = await indexer.search('sunlight energy');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.id).toBe('chunk-1');
    expect(results[0].score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it('searches Amharic text', async () => {
    const indexer = new CourseIndexer();
    await indexer.addCourse({
      ...course,
      id: 'course-am',
      language: 'am',
      chunks: [
        {
          id: 'chunk-am',
          courseId: 'course-am',
          content: 'ፎቶሲንተሲስ እፅዋት ከፀሐይ ብርሃን ምግብ የሚሠሩበት ሂደት ነው።',
        },
      ],
    });

    const results = await indexer.search('ፀሐይ ብርሃን');

    expect(results[0]?.chunk.id).toBe('chunk-am');
  });

  it('filters results by course and limit', async () => {
    const indexer = new CourseIndexer();
    await indexer.addCourse(course);
    await indexer.addCourse({
      ...course,
      id: 'course-other',
      chunks: [
        {
          id: 'chunk-other',
          courseId: 'course-other',
          content: 'Sunlight is also discussed in astronomy.',
        },
      ],
    });

    const results = await indexer.search('sunlight', {
      courseId: 'course-bio',
      limit: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0].chunk.courseId).toBe('course-bio');
  });

  it('returns no results for an empty query', async () => {
    const indexer = new CourseIndexer();
    await indexer.addCourse(course);

    await expect(indexer.search('   ')).resolves.toEqual([]);
  });

  it('clears the index', async () => {
    const indexer = new CourseIndexer();
    await indexer.addCourse(course);
    indexer.clear();

    await expect(indexer.search('sunlight')).resolves.toEqual([]);
    expect(await indexer.getCourse('course-bio')).toBeUndefined();
  });
});

describe('CourseIndexer persistence', () => {
  it('writes courses to the configured storage and reloads them', async () => {
    const saved = new Map<string, CourseContent>();
    const storage = {
      getAll: async () => Array.from(saved.values()),
      put: async (item: CourseContent) => {
        saved.set(item.id, item);
      },
      clear: async () => {
        saved.clear();
      },
    };

    const first = new CourseIndexer({ storage });
    await first.addCourse(course);

    const second = new CourseIndexer({ storage });
    const reloaded = await second.getCourse('course-bio');

    expect(reloaded?.title).toBe('Biology Basics');
    expect(saved.has('course-bio')).toBe(true);
  });
});
