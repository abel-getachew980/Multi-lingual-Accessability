/** @jest-environment node */

import { CourseIndexer } from '@/services/ai/CourseIndexer';
import {
  handleCourseList,
  handleCourseUpload,
} from '@/services/ai/courseUploadHandler';
import { validateCourseFile } from '@/services/ai/courseFileValidation';

function uploadRequest(file: File): Request {
  const formData = new FormData();
  formData.append('file', file);
  return new Request('http://localhost/api/ai/course', {
    method: 'POST',
    body: formData,
  });
}

describe('validateCourseFile', () => {
  it('accepts supported files under the size limit', () => {
    expect(
      validateCourseFile({ name: 'biology.md', type: 'text/markdown', size: 1024 }),
    ).toEqual({ ok: true });
  });

  it('rejects unsupported file types', () => {
    const result = validateCourseFile({
      name: 'slides.pptx',
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: 1024,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNSUPPORTED_TYPE');
  });

  it('rejects files larger than 10 MB', () => {
    const result = validateCourseFile({
      name: 'huge.txt',
      type: 'text/plain',
      size: 10 * 1024 * 1024 + 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FILE_TOO_LARGE');
  });
});

describe('handleCourseUpload', () => {
  it('parses, indexes, and returns an uploaded markdown course', async () => {
    const indexer = new CourseIndexer();
    const response = await handleCourseUpload(
      uploadRequest(
        new File(
          ['# Biology\n\n## Cells\n\nCells are the basic unit of life.'],
          'biology.md',
          { type: 'text/markdown' },
        ),
      ),
      { indexer },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Biology');
    expect(body.data.chunks).toBeGreaterThan(0);
    expect(body.data.course.title).toBe('Biology');
    expect(body.data.course.chunks.length).toBeGreaterThan(0);
    expect(await indexer.getCourse(body.data.id)).toBeDefined();
  });

  it('returns 400 when the file field is missing', async () => {
    const response = await handleCourseUpload(
      new Request('http://localhost/api/ai/course', {
        method: 'POST',
        body: new FormData(),
      }),
      { indexer: new CourseIndexer() },
    );

    expect(response.status).toBe(400);
  });

  it('returns 415 for unsupported files', async () => {
    const response = await handleCourseUpload(
      uploadRequest(new File(['x'], 'slides.pptx', { type: 'application/octet-stream' })),
      { indexer: new CourseIndexer() },
    );

    expect(response.status).toBe(415);
  });

  it('lists indexed courses', async () => {
    const indexer = new CourseIndexer();
    await handleCourseUpload(
      uploadRequest(new File(['# Water Cycle\n\nWater evaporates.'], 'water.md', { type: 'text/markdown' })),
      { indexer },
    );

    const response = await handleCourseList({ indexer });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Water Cycle');
  });
});
