import { NextResponse } from 'next/server';
import { helpQueue, helpStatusPayload } from '@/services/humanHelp';

function helpRequestIdFromUrl(request: Request): string | null {
  return new URL(request.url).searchParams.get('id');
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const { userId, conversationHistory } = body as {
    userId?: unknown;
    conversationHistory?: unknown;
  };

  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'userId is required' },
      { status: 400 },
    );
  }

  const entry = helpQueue.create({
    userId,
    conversationHistory: Array.isArray(conversationHistory)
      ? conversationHistory.slice(-50)
      : [],
  });

  return NextResponse.json({
    success: true,
    requestId: entry.id,
    status: entry.status,
    position: entry.position,
  });
}

export async function GET(request: Request) {
  const id = helpRequestIdFromUrl(request);
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'id is required' },
      { status: 400 },
    );
  }

  const entry = helpQueue.get(id);
  if (!entry) {
    return NextResponse.json(
      { success: false, error: 'Help request not found' },
      { status: 404 },
    );
  }

  return NextResponse.json(helpStatusPayload(entry));
}

export async function DELETE(request: Request) {
  const id = helpRequestIdFromUrl(request);
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'id is required' },
      { status: 400 },
    );
  }

  const cancelled = helpQueue.cancel(id);
  if (!cancelled) {
    return NextResponse.json(
      { success: false, error: 'Help request not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
