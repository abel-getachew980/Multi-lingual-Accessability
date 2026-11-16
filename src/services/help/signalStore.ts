import { HelpValidationError } from './types';

/**
 * In-memory signaling bus for the WebRTC handshake.
 *
 * It deliberately holds only connection setup messages (SDP offers/answers and
 * ICE candidates) and forgets them quickly: the media itself never passes
 * through the server.
 */

export type SignalRole = 'learner' | 'tutor';
export type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'bye';

const ROLES: SignalRole[] = ['learner', 'tutor'];
const TYPES: SignalType[] = ['offer', 'answer', 'ice-candidate', 'bye'];

export const MAX_SIGNAL_BYTES = 64_000;
export const MAX_SIGNALS_PER_REQUEST = 50;
export const SIGNAL_TTL_MS = 10 * 60 * 1_000;

export interface SignalMessage {
  id: number;
  requestId: string;
  role: SignalRole;
  type: SignalType;
  payload: unknown;
  createdAt: number;
}

export interface SignalInput {
  requestId: string;
  role: SignalRole;
  type: SignalType;
  payload: unknown;
}

function isRole(value: unknown): value is SignalRole {
  return typeof value === 'string' && ROLES.includes(value as SignalRole);
}

function isType(value: unknown): value is SignalType {
  return typeof value === 'string' && TYPES.includes(value as SignalType);
}

export class SignalStore {
  private readonly rooms = new Map<string, SignalMessage[]>();
  private sequence = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxSignals: number = MAX_SIGNALS_PER_REQUEST,
  ) {}

  add(input: SignalInput): SignalMessage {
    this.prune();

    if (typeof input.requestId !== 'string' || !input.requestId.trim()) {
      throw new HelpValidationError('requestId is required');
    }

    if (!isRole(input.role)) {
      throw new HelpValidationError(`role must be one of: ${ROLES.join(', ')}`);
    }

    if (!isType(input.type)) {
      throw new HelpValidationError(`type must be one of: ${TYPES.join(', ')}`);
    }

    const serialized = JSON.stringify(input.payload ?? null);
    if (serialized.length > MAX_SIGNAL_BYTES) {
      throw new HelpValidationError('Signal payload is too large');
    }

    const message: SignalMessage = {
      id: ++this.sequence,
      requestId: input.requestId.trim(),
      role: input.role,
      type: input.type,
      payload: input.payload,
      createdAt: this.now(),
    };

    const room = this.rooms.get(message.requestId) ?? [];
    room.push(message);

    while (room.length > Math.max(1, this.maxSignals)) {
      room.shift();
    }

    this.rooms.set(message.requestId, room);
    return message;
  }

  /** Messages for the other party newer than `sinceId`. */
  since(
    requestId: string,
    role: SignalRole,
    sinceId = 0,
  ): { messages: SignalMessage[]; nextSince: number } {
    this.prune();

    const room = this.rooms.get(requestId) ?? [];
    const nextSince = room.reduce((max, message) => Math.max(max, message.id), sinceId);

    return {
      messages: room.filter(
        (message) => message.id > sinceId && message.role !== role,
      ),
      nextSince,
    };
  }

  has(requestId: string): boolean {
    return (this.rooms.get(requestId)?.length ?? 0) > 0;
  }

  clear(requestId: string): void {
    this.rooms.delete(requestId);
  }

  /** Test helper. */
  reset(): void {
    this.rooms.clear();
    this.sequence = 0;
  }

  private prune(): void {
    const cutoff = this.now() - SIGNAL_TTL_MS;

    Array.from(this.rooms.entries()).forEach(([requestId, messages]) => {
      const fresh = messages.filter((message) => message.createdAt >= cutoff);
      if (fresh.length === 0) {
        this.rooms.delete(requestId);
      } else if (fresh.length !== messages.length) {
        this.rooms.set(requestId, fresh);
      }
    });
  }
}

export const signalStore = new SignalStore();
