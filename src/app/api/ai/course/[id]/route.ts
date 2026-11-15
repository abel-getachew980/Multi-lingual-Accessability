import { courseIndexer } from '@/services/ai/CourseIndexer';

export const runtime = 'nodejs';

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext) {
  const course = await courseIndexer.getCourse(context.params.id);

  if (!course) {
    return Response.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Course not found' },
      },
      { status: 404 },
    );
  }

  return Response.json({ success: true, data: course });
}
