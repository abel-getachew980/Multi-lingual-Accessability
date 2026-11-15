import {
  handleCourseList,
  handleCourseUpload,
} from '@/services/ai/courseUploadHandler';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleCourseUpload(request);
}

export async function GET() {
  return handleCourseList();
}
