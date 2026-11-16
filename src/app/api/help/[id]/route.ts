import { NextResponse } from 'next/server';
import {
  helpQueue,
  signalStore,
  type HelpStatusUpdate,
} from '@/services/help';
import {
  helpErrorResponse,
  isTutorAuthorized,
  serializeHelpTicket,
} from '@/services/help/apiHelpers';
import { HelpValidationError } from '@/services/help/types';

/**
 * Single help request.
 *
 * - GET    /api/help/:id   status and queue position
 * - DELETE /api/help/:id   cancel (learner action)
 * - PATCH  /api/help/:id   tutor action, protected by HELP_TUTOR_KEY:
 *          `{ status: 'connected' | 'in_progress' | 'resolved' | 'cancelled',
 *             tutorId?: string }`
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_UPDATES: HelpStatusUpdate[] = [
  'connected',
  'in_progress',
  'resolved',
  'cancelled',
];

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    return NextResponse.json(serializeHelpTicket(helpQueue.require(params.id)));
  } catch (error) {
    return helpErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const ticket = helpQueue.cancel(params.id);
    signalStore.clear(params.id);
    return NextResponse.json(serializeHelpTicket(ticket));
  } catch (error) {
    return helpErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!isTutorAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'forbidden', message: 'Tutor credentials are required' },
      },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'invalid_json', message: 'Request body must be valid JSON' },
      },
      { status: 400 },
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'invalid_request', message: 'Request body must be a JSON object' },
      },
      { status: 400 },
    );
  }

  const update = body as { status?: unknown; tutorId?: unknown };

  if (typeof update.status !== 'string' || !STATUS_UPDATES.includes(update.status as HelpStatusUpdate)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'invalid_request',
          message: `status must be one of: ${STATUS_UPDATES.join(', ')}`,
        },
      },
      { status: 400 },
    );
  }

  try {
    if (update.tutorId !== undefined && typeof update.tutorId !== 'string') {
      throw new HelpValidationError('tutorId must be a string');
    }

    const ticket = helpQueue.updateStatus(
      params.id,
      update.status as HelpStatusUpdate,
      update.tutorId ? { tutorId: update.tutorId } : {},
    );

    if (ticket.status === 'resolved' || ticket.status === 'cancelled') {
      signalStore.clear(params.id);
    }

    return NextResponse.json(serializeHelpTicket(ticket));
  } catch (error) {
    return helpErrorResponse(error);
  }
}
