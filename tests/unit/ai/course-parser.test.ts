import { CourseParser } from '@/services/ai/CourseParser';

describe('CourseParser', () => {
  const parser = new CourseParser();

  it('parses a markdown course and derives its title', async () => {
    const course = await parser.parseFile({
      name: 'biology.md',
      type: 'text/markdown',
      data: '# Biology\n\nPhotosynthesis turns sunlight into food.\n\nCells are the unit of life.',
    });

    expect(course.title).toBe('Biology');
    expect(course.language).toBe('en');
    expect(course.content).toContain('Photosynthesis');
    expect(course.metadata.fileName).toBe('biology.md');
    expect(course.chunks?.length).toBeGreaterThan(0);
  });

  it('detects Amharic content', async () => {
    const course = await parser.parseFile({
      name: 'amharic.txt',
      type: 'text/plain',
      data: 'ፎቶሲንተሲስ እፅዋት ከፀሐይ ብርሃን ምግብ የሚሠሩበት ሂደት ነው።',
    });

    expect(course.language).toBe('am');
  });

  it('parses JSON course payloads', async () => {
    const course = await parser.parseFile({
      name: 'lesson.json',
      type: 'application/json',
      data: JSON.stringify({
        title: 'Water Cycle',
        content: 'Water evaporates, condenses, and precipitates.',
      }),
    });

    expect(course.title).toBe('Water Cycle');
    expect(course.content).toContain('evaporates');
  });

  it('splits long content into bounded chunks with metadata', async () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, index) => `Paragraph ${index + 1}. ` + 'word '.repeat(60),
    );

    const course = await parser.parseFile({
      name: 'long.txt',
      type: 'text/plain',
      data: paragraphs.join('\n\n'),
    });

    expect(course.chunks).toBeDefined();
    for (const chunk of course.chunks ?? []) {
      expect(chunk.content.length).toBeLessThanOrEqual(600);
      expect(chunk.courseId).toBe(course.id);
      expect(chunk.id).toBeTruthy();
    }
    expect((course.chunks ?? []).length).toBeGreaterThan(1);
  });

  it('keeps PDF page separators as page numbers', async () => {
    const course = await parser.parseFile({
      name: 'pages.txt',
      type: 'text/plain',
      data: 'Page one content.\fPage two content.',
    });

    const pages = (course.chunks ?? []).map((chunk) => chunk.pageNumber);
    expect(pages).toContain(1);
    expect(pages).toContain(2);
  });

  it('rejects unsupported binary formats with a helpful error', async () => {
    await expect(
      parser.parseFile({
        name: 'slides.pptx',
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        data: 'not-really-a-pptx',
      }),
    ).rejects.toThrow(/unsupported file type/i);
  });
});
