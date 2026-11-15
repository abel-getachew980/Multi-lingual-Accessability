export const MAX_COURSE_FILE_SIZE = 10 * 1024 * 1024;

export const SUPPORTED_COURSE_EXTENSIONS = [
  'pdf',
  'docx',
  'txt',
  'text',
  'md',
  'markdown',
  'csv',
  'json',
  'html',
  'htm',
] as const;

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
]);

export interface CourseFileInfo {
  name: string;
  type: string;
  size: number;
}

export type CourseFileValidation =
  | { ok: true }
  | { ok: false; code: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE'; message: string };

export function validateCourseFile(file: CourseFileInfo): CourseFileValidation {
  if (file.size > MAX_COURSE_FILE_SIZE) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: 'Course files must be 10 MB or smaller.',
    };
  }

  const extension = file.name.includes('.')
    ? file.name.split('.').pop()?.toLowerCase() ?? ''
    : '';
  const mimeType = file.type.toLowerCase();

  if (
    !SUPPORTED_COURSE_EXTENSIONS.includes(extension as (typeof SUPPORTED_COURSE_EXTENSIONS)[number])
    && !SUPPORTED_MIME_TYPES.has(mimeType)
  ) {
    return {
      ok: false,
      code: 'UNSUPPORTED_TYPE',
      message: 'Unsupported course file. Use PDF, DOCX, TXT, MD, CSV, JSON, or HTML.',
    };
  }

  return { ok: true };
}
