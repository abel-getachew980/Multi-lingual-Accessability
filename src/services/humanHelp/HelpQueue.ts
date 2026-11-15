import type { HumanHelpRequest, HumanHelpStatus, Message } from '@/types';

export interface HelpQueueEntry extends HumanHelpRequest {
  position?: number;
  estimatedWait?: string;
}

export interface CreateHelpRequestInput {
  userId: string;
  conversationHistory: Message[];
}

export interface HelpStatusPayload {
  success: true;
  status: HumanHelpStatus;
  position?: number;
  estimatedWait?: string;
  tutorId?: string;
  screenShareEnabled: boolean;
}

const WAIT_MINUTES_PER_POSITION = 2;

export class HelpQueue {
  private readonly requests = new Map<string, HelpQueueEntry>();
  private sequence = 0;

  create({ userId, conversationHistory }: CreateHelpRequestInput): HelpQueueEntry {
    this.sequence += 1;
    const entry: HelpQueueEntry = {
      id: `help-${Date.now()}-${this.sequence}`,
      userId,
      conversationHistory,
      timestamp: new Date(),
      status: 'pending',
      screenShareEnabled: false,
    };

    this.requests.set(entry.id, entry);
    return this.snapshot(entry);
  }

  get(id: string): HelpQueueEntry | null {
    const entry = this.requests.get(id);
    return entry ? this.snapshot(entry) : null;
  }

  cancel(id: string): HelpQueueEntry | null {
    const entry = this.requests.get(id);
    if (!entry) return null;

    entry.status = 'cancelled';
    entry.assignedTutor = undefined;
    return this.snapshot(entry);
  }

  assignTutor(id: string, tutorId: string): HelpQueueEntry | null {
    const entry = this.requests.get(id);
    if (!entry) return null;

    entry.status = 'connected';
    entry.assignedTutor = tutorId;
    return this.snapshot(entry);
  }

  list(): HelpQueueEntry[] {
    return Array.from(this.requests.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((entry) => this.snapshot(entry));
  }

  clear(): void {
    this.requests.clear();
    this.sequence = 0;
  }

  private snapshot(entry: HelpQueueEntry): HelpQueueEntry {
    const position = entry.status === 'pending' ? this.positionOf(entry.id) : undefined;
    return {
      ...entry,
      position,
      estimatedWait: position ? `${position * WAIT_MINUTES_PER_POSITION} minutes` : undefined,
    };
  }

  private positionOf(id: string): number {
    const pending = Array.from(this.requests.values())
      .filter((entry) => entry.status === 'pending')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return pending.findIndex((entry) => entry.id === id) + 1;
  }
}

export const helpQueue = new HelpQueue();

export function resetHelpQueue(): void {
  helpQueue.clear();
}

export function isHumanHelpStatus(value: unknown): value is HumanHelpStatus {
  return (
    value === 'pending' ||
    value === 'connected' ||
    value === 'in_progress' ||
    value === 'resolved' ||
    value === 'cancelled'
  );
}


export function helpStatusPayload(entry: HelpQueueEntry): HelpStatusPayload {
  return {
    success: true,
    status: entry.status,
    position: entry.position,
    estimatedWait: entry.estimatedWait,
    tutorId: entry.assignedTutor,
    screenShareEnabled: entry.screenShareEnabled,
  };
}
