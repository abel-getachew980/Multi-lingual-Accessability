import type { HumanHelpChannel, HumanHelpStatus, Language } from '@/types';

/**
 * Shared types for the help desk queue.
 *
 * Kept separate from the React components so the API routes and the tests can
 * import them without pulling in browser code.
 */

export interface HelpHistoryEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface HelpTicket {
  id: string;
  userId: string;
  channel: HumanHelpChannel;
  language: Language;
  phoneNumber?: string;
  status: HumanHelpStatus;
  createdAt: number;
  updatedAt: number;
  assignedTutor?: string;
  /** Trimmed conversation, so the tutor sees context without the full log. */
  history: HelpHistoryEntry[];
  screenShareEnabled: boolean;
}

export interface HelpRequestInput {
  userId: unknown;
  language?: unknown;
  channel?: unknown;
  phoneNumber?: unknown;
  conversationHistory?: unknown;
  screenShareEnabled?: unknown;
}

export interface HelpSnapshot extends HelpTicket {
  /** 1-based place in the queue; 0 when a tutor has joined or the ticket ended. */
  position: number;
  estimatedWaitMinutes: number;
}

export interface QueueStats {
  pending: number;
  connected: number;
  inProgress: number;
  total: number;
  estimatedWaitMinutes: number;
}

export type HelpStatusUpdate = Extract<
  HumanHelpStatus,
  'connected' | 'in_progress' | 'resolved' | 'cancelled'
>;

export class HelpError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HelpError';
  }
}

export class HelpValidationError extends HelpError {
  constructor(message: string) {
    super(message, 'invalid_request', 400);
    this.name = 'HelpValidationError';
  }
}

export class HelpCooldownError extends HelpError {
  constructor(readonly retryAfterSeconds: number) {
    super(
      `Please wait ${retryAfterSeconds} seconds before requesting help again`,
      'cooldown',
      429,
    );
    this.name = 'HelpCooldownError';
  }
}

export class HelpNotFoundError extends HelpError {
  constructor(id: string) {
    super(`Help request ${id} was not found`, 'not_found', 404);
    this.name = 'HelpNotFoundError';
  }
}

export class HelpConflictError extends HelpError {
  constructor(message: string) {
    super(message, 'conflict', 409);
    this.name = 'HelpConflictError';
  }
}
