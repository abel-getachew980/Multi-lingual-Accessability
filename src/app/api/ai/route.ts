import { getStatus, handleAIQuery } from '@/services/ai/queryHandler';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleAIQuery(request);
}

export async function GET() {
  return getStatus();
}
