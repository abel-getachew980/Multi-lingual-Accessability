import { NextResponse } from 'next/server';
import { helpQueue, helpStatusPayload } from '@/services/humanHelp';

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const entry = helpQueue.get(params.id);
  if (!entry) {
    return NextResponse.json(
      { success: false, error: 'Help request not found' },
      { status: 404 },
    );
  }

  return NextResponse.json(helpStatusPayload(entry));
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const cancelled = helpQueue.cancel(params.id);
  if (!cancelled) {
    return NextResponse.json(
      { success: false, error: 'Help request not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
