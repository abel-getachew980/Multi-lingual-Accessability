import type { HumanHelpChannel, HumanHelpStatus, Language } from '@/types';
import {
  HelpConflictError,
  HelpCooldownError,
  HelpNotFoundError,
  HelpValidationError,
  type HelpHistoryEntry,
  type HelpRequestInput,
  type HelpSnapshot,
  type HelpStatusUpdate,
  type HelpTicket,
  type QueueStats,
} from './types';

export const MAX_HISTORY_ENTRIES = 20;
export const MAX_HISTORY_CHARS = 500;
export const MINUTES_PER_QUEUE_SLOT = 2;
export const PENDING_TTL_MS = 2 * 60 * 60 * 1_000;
export const ACTIVE_TTL_MS = 4 * 60 * 60 * 1_000;
export const ENDED_TTL_MS = 24 * 60 * 60 * 1_000;

const CHANNELS: HumanHelpChannel[] = ['web', 'sms', 'telegram'];
const LANGUAGES: Language[] = ['am', 'en'];
const STATUSES: HumanHelpStatus[] = [
  'pending',
  'connected',
  'in_progress',
  'resolved',
  'cancelled',
];

const ACTIVE_STATUSES: HumanHelpStatus[] = ['pending', 'connected', 'in_progress'];

/** Status transitions the help desk is allowed to make. */
const ALLOWED_TRANSITIONS: Record<HumanHelpStatus, HumanHelpStatus[]> = {
  // A tutor may resolve a pending ticket directly (a duplicate or a question
  // answered without a call), so `resolved` is allowed from the queue too.
  pending: ['connected', 'in_progress', 'resolved', 'cancelled'],
  connected: ['in_progress', 'resolved', 'cancelled'],
  in_progress: ['resolved', 'cancelled'],
  resolved: [],
  cancelled: [],
};

export interface HelpQueueOptions {
  now?: () => number;
  idFactory?: () => string;
  /** Seconds a learner must wait after an earlier request ended. */
  cooldownSeconds?: number;
  maxHistoryEntries?: number;
  maxHistoryChars?: number;
}

function defaultId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `help-${uuid}` : `help-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new HelpValidationError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HelpValidationError(`${field} is required`);
  }

  if (trimmed.length > maxLength) {
    throw new HelpValidationError(`${field} is too long`);
  }

  return trimmed;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: T[],
  field: string,
  fallback: T,
): T {
  if (value === undefined || value === null) return fallback;

  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new HelpValidationError(`${field} must be one of: ${allowed.join(', ')}`);
  }

  return value as T;
}

/** Removes control characters that would corrupt SMS or screen readers. */
function cleanContent(content: string): string {
  return content
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function sanitizeConversationHistory(
  input: unknown,
  maxEntries: number = MAX_HISTORY_ENTRIES,
  maxChars: number = MAX_HISTORY_CHARS,
): HelpHistoryEntry[] {
  if (!Array.isArray(input)) return [];

  const entries: HelpHistoryEntry[] = [];

  input.slice(-Math.max(1, maxEntries)).forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;

    const record = raw as Record<string, unknown>;
    if (typeof record.content !== 'string') return;

    const content = cleanContent(record.content).slice(0, maxChars);
    if (!content) return;

    entries.push({
      role:
        record.role === 'assistant' || record.role === 'system' ? record.role : 'user',
      content,
    });
  });

  return entries;
}

/**
 * In-memory help desk queue.
 *
 * A single Next.js process is the deployment target for the hackathon, so a
 * Map is enough. The class takes `now` and `idFactory` so tests are
 * deterministic and a Redis/Postgres implementation can replace it later
 * without touching the routes.
 */
export class HelpQueue {
  private readonly tickets = new Map<string, HelpTicket>();
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private readonly cooldownMs: number;
  private readonly maxHistoryEntries: number;
  private readonly maxHistoryChars: number;

  constructor(options: HelpQueueOptions = {}) {
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? defaultId;
    this.cooldownMs = Math.max(0, options.cooldownSeconds ?? 30) * 1_000;
    this.maxHistoryEntries = options.maxHistoryEntries ?? MAX_HISTORY_ENTRIES;
    this.maxHistoryChars = options.maxHistoryChars ?? MAX_HISTORY_CHARS;
  }

  /** Adds a request, or returns the learner's existing active one. */
  create(input: HelpRequestInput): { ticket: HelpSnapshot; reused: boolean } {
    const now = this.now();
    this.prune(now);

    const userId = requireString(input.userId, 'userId', 120);
    const language = parseEnum(input.language, LANGUAGES, 'language', 'am');
    const channel = parseEnum(input.channel, CHANNELS, 'channel', 'web');

    if (input.screenShareEnabled !== undefined && typeof input.screenShareEnabled !== 'boolean') {
      throw new HelpValidationError('screenShareEnabled must be a boolean');
    }

    const phoneNumber =
      input.phoneNumber === undefined
        ? undefined
        : requireString(input.phoneNumber, 'phoneNumber', 32);

    const existing = this.findActiveByUser(userId);
    if (existing) {
      return { ticket: this.snapshot(existing), reused: true };
    }

    this.assertCooldown(userId, now);

    const ticket: HelpTicket = {
      id: this.idFactory(),
      userId,
      channel,
      language,
      phoneNumber,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      history: sanitizeConversationHistory(
        input.conversationHistory,
        this.maxHistoryEntries,
        this.maxHistoryChars,
      ),
      screenShareEnabled: input.screenShareEnabled === true,
    };

    this.tickets.set(ticket.id, ticket);
    return { ticket: this.snapshot(ticket), reused: false };
  }

  get(id: string): HelpSnapshot | null {
    this.prune(this.now());
    const ticket = this.tickets.get(id);
    return ticket ? this.snapshot(ticket) : null;
  }

  require(id: string): HelpSnapshot {
    const snapshot = this.get(id);
    if (!snapshot) throw new HelpNotFoundError(id);
    return snapshot;
  }

  /** Active tickets, oldest first. */
  list(): HelpSnapshot[] {
    this.prune(this.now());
    return Array.from(this.tickets.values())
      .filter((ticket) => ACTIVE_STATUSES.includes(ticket.status))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((ticket) => this.snapshot(ticket));
  }

  stats(): QueueStats {
    this.prune(this.now());

    const tickets = Array.from(this.tickets.values());
    const pending = tickets.filter((ticket) => ticket.status === 'pending').length;
    const connected = tickets.filter((ticket) => ticket.status === 'connected').length;
    const inProgress = tickets.filter((ticket) => ticket.status === 'in_progress').length;

    return {
      pending,
      connected,
      inProgress,
      total: tickets.length,
      estimatedWaitMinutes: pending * MINUTES_PER_QUEUE_SLOT,
    };
  }

  updateStatus(
    id: string,
    status: HelpStatusUpdate,
    options: { tutorId?: string } = {},
  ): HelpSnapshot {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new HelpNotFoundError(id);

    if (!STATUSES.includes(status)) {
      throw new HelpValidationError(`status must be one of: ${STATUSES.join(', ')}`);
    }

    if (ticket.status === status) {
      return this.snapshot(ticket);
    }

    if (!ALLOWED_TRANSITIONS[ticket.status].includes(status)) {
      throw new HelpConflictError(`Cannot change a ${ticket.status} request to ${status}`);
    }

    if (options.tutorId !== undefined) {
      ticket.assignedTutor = requireString(options.tutorId, 'tutorId', 80);
    }

    ticket.status = status;
    ticket.updatedAt = this.now();

    return this.snapshot(ticket);
  }

  assign(id: string, tutorId: string): HelpSnapshot {
    return this.updateStatus(id, 'connected', { tutorId });
  }

  resolve(id: string): HelpSnapshot {
    return this.updateStatus(id, 'resolved');
  }

  cancel(id: string): HelpSnapshot {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new HelpNotFoundError(id);

    if (ticket.status === 'resolved') {
      throw new HelpConflictError('This request has already been resolved');
    }

    if (ticket.status === 'cancelled') {
      return this.snapshot(ticket);
    }

    return this.updateStatus(id, 'cancelled');
  }

  /** Test helper: forget every ticket. */
  clear(): void {
    this.tickets.clear();
  }

  private findActiveByUser(userId: string): HelpTicket | undefined {
    return Array.from(this.tickets.values()).find(
      (ticket) => ticket.userId === userId && ACTIVE_STATUSES.includes(ticket.status),
    );
  }

  private assertCooldown(userId: string, now: number): void {
    if (this.cooldownMs === 0) return;

    const recent = Array.from(this.tickets.values())
      .filter(
        (ticket) =>
          ticket.userId === userId &&
          (ticket.status === 'resolved' || ticket.status === 'cancelled') &&
          now - ticket.updatedAt < this.cooldownMs,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];

    if (!recent) return;

    const remaining = this.cooldownMs - (now - recent.updatedAt);
    throw new HelpCooldownError(Math.max(1, Math.ceil(remaining / 1_000)));
  }

  private positionOf(ticket: HelpTicket): number {
    if (ticket.status !== 'pending') return 0;

    const pending = Array.from(this.tickets.values())
      .filter((item) => item.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

    const index = pending.findIndex((item) => item.id === ticket.id);
    return index === -1 ? 0 : index + 1;
  }

  private snapshot(ticket: HelpTicket): HelpSnapshot {
    const position = this.positionOf(ticket);

    return {
      ...ticket,
      history: ticket.history.map((entry) => ({ ...entry })),
      position,
      estimatedWaitMinutes: position > 0 ? position * MINUTES_PER_QUEUE_SLOT : 0,
    };
  }

  /**
   * Expires abandoned requests. Without this an open tab that was closed
   * would keep its place in the queue forever.
   */
  private prune(now: number): void {
    Array.from(this.tickets.values()).forEach((ticket) => {
      const age = now - ticket.updatedAt;

      if (
        ticket.status === 'pending' &&
        now - ticket.createdAt > PENDING_TTL_MS
      ) {
        ticket.status = 'cancelled';
        ticket.updatedAt = now;
        return;
      }

      if (ACTIVE_STATUSES.includes(ticket.status) && age > ACTIVE_TTL_MS) {
        ticket.status = ticket.status === 'pending' ? 'cancelled' : 'resolved';
        ticket.updatedAt = now;
        return;
      }

      if (
        (ticket.status === 'resolved' || ticket.status === 'cancelled') &&
        age > ENDED_TTL_MS
      ) {
        this.tickets.delete(ticket.id);
      }
    });
  }
}

/** Process-wide queue used by the API routes. */
export const helpQueue = new HelpQueue();
