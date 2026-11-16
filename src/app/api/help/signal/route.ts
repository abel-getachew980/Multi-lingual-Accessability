import { NextResponse } from 'next/server';
import { helpQueue } from '@/services/help';
import {
  signalStore,
  type SignalRole,
  type SignalType,
} from '@/services/help/signalStore';
import { helpErrorResponse, isTutorAuthorized } from '@/services/help/apiHelpers';
import { HelpValidationError } from '@/services/help/types';

/**
 * WebRTC signaling.
 *
 * - POST /api/help/signal  `{ requestId, role, type, payload }`
 * - GET  /api/help/signal?requestId=...&role=learner&since=0
 *
 * Messages are short lived (ten minutes) and the endpoint never touches media:
 * only SDP offers/answers and ICE candidates pass through.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES: SignalRole[] = ['learner', 'tutor'];
const TYPES: SignalType[] = ['offer', 'answer', 'ice-candidate', 'bye'];

function parseRole(value: unknown): SignalRole | null {
  return typeof value === 'string' && ROLES.includes(value as SignalRole)
    ? (value as SignalRole)
    : null;
}

export async function POST(request: Request): Promise<NextResponse> {
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

  const input = body as {
    requestId?: unknown;
    role?: unknown;
    type?: unknown;
    payload?: unknown;
  };

  try {
    if (typeof input.requestId !== 'string') {
      throw new HelpValidationError('requestId is required');
    }

    const ticket = helpQueue.require(input.requestId);

    if (ticket.status === 'resolved' || ticket.status === 'cancelled') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'conflict', message: 'This help request has already ended' },
        },
        { status: 409 },
      );
    }

    const role = parseRole(input.role);
    if (!role) {
      throw new HelpValidationError(`role must be one of: ${ROLES.join(', ')}`);
    }

    if (role === 'tutor' && !isTutorAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'forbidden', message: 'Tutor credentials are required' },
        },
        { status: 403 },
      );
    }

    if (typeof input.type !== 'string' || !TYPES.includes(input.type as SignalType)) {
      throw new HelpValidationError(`type must be one of: ${TYPES.join(', ')}`);
    }

    const message = signalStore.add({
      requestId: input.requestId,
      role,
      type: input.type as SignalType,
      payload: input.payload,
    });

    return NextResponse.json({ success: true, id: message.id, createdAt: message.createdAt });
  } catch (error) {
    return helpErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const requestId = url.searchParams.get('requestId');
  const role = parseRole(url.searchParams.get('role'));
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw === null ? 0 : Number(sinceRaw);

  if (!requestId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'invalid_request', message: 'requestId is required' },
      },
      { status: 400 },
    );
  }

  if (!role) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'invalid_request',
          message: `role must be one of: ${ROLES.join(', ')}`,
        },
      },
      { status: 400 },
    );
  }

  if (!Number.isFinite(since) || since < 0) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'invalid_request', message: 'since must be a positive number' },
      },
      { status: 400 },
    );
  }

  try {
    // A resolved request may still need its final "bye" signal, so only 404
    // when the ticket never existed.
    helpQueue.require(requestId);

    const result = signalStore.since(requestId, role, since);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return helpErrorResponse(error);
  }
}
