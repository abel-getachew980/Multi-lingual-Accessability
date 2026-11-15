import type { CourseContent } from '@/types';
import { CourseIndexer, courseIndexer } from './CourseIndexer';
import { CourseParser, courseParser } from './CourseParser';
import { validateCourseFile } from './courseFileValidation';

interface CourseUploadDependencies {
  parser?: CourseParser;
  indexer?: CourseIndexer;
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { success: false, error: { code, message } },
    { status },
  );
}

function courseSummary(course: CourseContent) {
  return {
    id: course.id,
    title: course.title,
    titleAm: course.titleAm,
    language: course.language,
    totalPages: course.metadata.totalPages ?? 1,
    chunks: course.chunks?.length ?? 0,
    metadata: course.metadata,
  };
}

export async function handleCourseUpload(
  request: Request,
  dependencies: CourseUploadDependencies = {},
): Promise<Response> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, 'INVALID_FORM_DATA', 'Upload must use multipart form data');
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return errorResponse(400, 'FILE_REQUIRED', 'A file field is required');
  }

  const validation = validateCourseFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  if (!validation.ok) {
    return errorResponse(
      validation.code === 'FILE_TOO_LARGE' ? 413 : 415,
      validation.code,
      validation.message,
    );
  }

  const parser = dependencies.parser ?? courseParser;
  const indexer = dependencies.indexer ?? courseIndexer;

  try {
    const data = await file.arrayBuffer();
    const course = await parser.parseFile({
      name: file.name,
      type: file.type,
      data,
    });

    await indexer.addCourse(course);

    return Response.json({
      success: true,
      data: courseSummary(course),
    });
  } catch (error) {
    console.error('Course upload failed', {
      fileName: file.name,
      error: error instanceof Error ? error.message : String(error),
    });

    return errorResponse(
      500,
      'COURSE_PARSE_FAILED',
      'The course file could not be parsed. Please check the file and try again.',
    );
  }
}

export async function handleCourseList(
  dependencies: CourseUploadDependencies = {},
): Promise<Response> {
  const indexer = dependencies.indexer ?? courseIndexer;
  const courses = await indexer.listCourses();

  return Response.json({
    success: true,
    data: courses.map(courseSummary),
  });
}
