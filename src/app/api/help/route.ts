import { NextResponse } from 'next/server';
import {
  helpQueue,
  type HelpRequestInput,
} from '@/services/help';
import {
  helpErrorResponse,
  readIdFromUrl,
  serializeHelpTicket,
} from '@/services/help/apiHelpers';

/**
 * Human help API.
 *
 * - POST   /api/help          create (or return the active) help request
 * - GET    /api/help?id=...   status, queue position and estimated wait
 * - GET    /api/help          queue statistics
 * - DELETE /api/help?id=...   cancel a request
 *
 * The SMS gateway posts `{ userId, channel: 'sms', phoneNumber, language,
 * conversationHistory }` and reads `{ success, requestId, status }`, so those
 * fields are always present.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVALID_JSON = {
  success: false,
  error: { code: 'invalid_json', message: 'Request body must be valid JSON' },
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(INVALID_JSON, { status: 400 });
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

  try {
    const { ticket, reused } = helpQueue.create(body as HelpRequestInput);

    return NextResponse.json(serializeHelpTicket(ticket, reused), {
      status: reused ? 200 : 201,
    });
  } catch (error) {
    return helpErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const id = readIdFromUrl(request);

  if (!id) {
    return NextResponse.json({ success: true, queue: helpQueue.stats() });
  }

  try {
    return NextResponse.json(serializeHelpTicket(helpQueue.require(id)));
  } catch (error) {
    return helpErrorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  let id = readIdFromUrl(request);

  // Allow `{ "requestId": "..." }` as well, which keeps fetch clients that
  // cannot send a body-less DELETE simple.
  if (!id) {
    try {
      const body = (await request.json()) as { requestId?: unknown; id?: unknown };
      const value = body.requestId ?? body.id;
      if (typeof value === 'string' && value.trim()) id = value.trim();
    } catch {
      // No body: fall through to the validation error below.
    }
  }

  if (!id) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'invalid_request', message: 'A request id is required' },
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(serializeHelpTicket(helpQueue.cancel(id)));
  } catch (error) {
    return helpErrorResponse(error);
  }
}
