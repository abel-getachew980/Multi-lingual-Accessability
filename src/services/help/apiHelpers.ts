import { NextResponse } from 'next/server';
import { HelpCooldownError, HelpError, type HelpSnapshot } from './types';

/**
 * Response helpers shared by the help API routes.
 *
 * The JSON keeps both `requestId` and `id` because the SMS gateway reads
 * `requestId` while the web client was originally written against `id`.
 */
export interface SerializedHelpTicket {
  success: true;
  requestId: string;
  id: string;
  status: HelpSnapshot['status'];
  position: number;
  estimatedWaitMinutes: number;
  channel: HelpSnapshot['channel'];
  language: HelpSnapshot['language'];
  assignedTutor?: string;
  screenShareEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  reused?: boolean;
}

export function serializeHelpTicket(
  ticket: HelpSnapshot,
  reused?: boolean,
): SerializedHelpTicket {
  return {
    success: true,
    requestId: ticket.id,
    id: ticket.id,
    status: ticket.status,
    position: ticket.position,
    estimatedWaitMinutes: ticket.estimatedWaitMinutes,
    channel: ticket.channel,
    language: ticket.language,
    ...(ticket.assignedTutor ? { assignedTutor: ticket.assignedTutor } : {}),
    screenShareEnabled: ticket.screenShareEnabled,
    createdAt: new Date(ticket.createdAt).toISOString(),
    updatedAt: new Date(ticket.updatedAt).toISOString(),
    ...(reused === undefined ? {} : { reused }),
  };
}

export function helpErrorResponse(error: unknown): NextResponse {
  if (error instanceof HelpCooldownError) {
    return NextResponse.json(
      {
        success: false,
        error: { code: error.code, message: error.message },
        retryAfterSeconds: error.retryAfterSeconds,
      },
      {
        status: error.status,
        headers: { 'Retry-After': String(error.retryAfterSeconds) },
      },
    );
  }

  if (error instanceof HelpError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error('[help] unexpected error', error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'internal',
        message: 'The help desk is unavailable right now. Please try again.',
      },
    },
    { status: 500 },
  );
}

/**
 * Tutor-only actions are protected when `HELP_TUTOR_KEY` is configured.
 * Without it the app is assumed to be a local demo, so the endpoints stay open
 * but are never exposed with real learner data.
 */
export function isTutorAuthorized(request: Request): boolean {
  const expected = process.env.HELP_TUTOR_KEY;

  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  const provided = request.headers.get('x-help-tutor-key');
  return provided !== null && provided === expected;
}

export function readIdFromUrl(request: Request): string | null {
  const id = new URL(request.url).searchParams.get('id');
  return id && id.trim() ? id.trim() : null;
}
