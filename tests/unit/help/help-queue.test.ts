import {
  HelpConflictError,
  HelpCooldownError,
  HelpQueue,
  HelpValidationError,
  sanitizeConversationHistory,
} from '@/services/help';
import {
  ENDED_TTL_MS,
  PENDING_TTL_MS,
} from '@/services/help/helpQueue';

function makeQueue(
  options: Partial<ConstructorParameters<typeof HelpQueue>[0]> = {},
) {
  let now = 1_700_000_000_000;
  let sequence = 0;

  const queue = new HelpQueue({
    now: () => now,
    idFactory: () => `help-${++sequence}`,
    cooldownSeconds: 0,
    ...options,
  });

  return {
    queue,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('HelpQueue', () => {
  it('creates a pending ticket with a position and an estimated wait', () => {
    const { queue } = makeQueue();

    const { ticket, reused } = queue.create({
      userId: 'learner-1',
      language: 'am',
      channel: 'web',
    });

    expect(reused).toBe(false);
    expect(ticket.id).toBe('help-1');
    expect(ticket.status).toBe('pending');
    expect(ticket.position).toBe(1);
    expect(ticket.estimatedWaitMinutes).toBe(2);
    expect(ticket.history).toEqual([]);
  });

  it('returns the same active ticket when a learner asks twice', () => {
    const { queue } = makeQueue();

    const first = queue.create({ userId: 'learner-1' });
    const second = queue.create({ userId: 'learner-1' });

    expect(second.reused).toBe(true);
    expect(second.ticket.id).toBe(first.ticket.id);
    expect(queue.stats().pending).toBe(1);
  });

  it('orders positions by arrival and closes the gap after a cancellation', () => {
    const { queue, advance } = makeQueue();

    const first = queue.create({ userId: 'a' });
    advance(1_000);
    const second = queue.create({ userId: 'b' });
    advance(1_000);
    const third = queue.create({ userId: 'c' });

    expect(first.ticket.position).toBe(1);
    expect(second.ticket.position).toBe(2);
    expect(third.ticket.position).toBe(3);

    queue.cancel(second.ticket.id);

    expect(queue.get(third.ticket.id)?.position).toBe(2);
    expect(queue.get(first.ticket.id)?.position).toBe(1);
  });

  it('assigns a tutor and moves the ticket out of the queue', () => {
    const { queue } = makeQueue();
    const { ticket } = queue.create({ userId: 'learner-1' });

    const connected = queue.assign(ticket.id, 'tutor-sara');

    expect(connected.status).toBe('connected');
    expect(connected.assignedTutor).toBe('tutor-sara');
    expect(connected.position).toBe(0);
    expect(connected.estimatedWaitMinutes).toBe(0);
  });

  it('resolves a connected conversation', () => {
    const { queue } = makeQueue();
    const { ticket } = queue.create({ userId: 'learner-1' });

    queue.assign(ticket.id, 'tutor-sara');
    expect(queue.resolve(ticket.id).status).toBe('resolved');
    expect(queue.list()).toEqual([]);
  });

  it('rejects impossible status transitions', () => {
    const { queue } = makeQueue();
    const { ticket } = queue.create({ userId: 'learner-1' });

    queue.resolve(ticket.id);

    expect(() => queue.assign(ticket.id, 'tutor-sara')).toThrow(HelpConflictError);
    expect(() => queue.cancel(ticket.id)).toThrow(HelpConflictError);
  });

  it('is idempotent when cancelling twice', () => {
    const { queue } = makeQueue();
    const { ticket } = queue.create({ userId: 'learner-1' });

    expect(queue.cancel(ticket.id).status).toBe('cancelled');
    expect(queue.cancel(ticket.id).status).toBe('cancelled');
  });

  it('enforces a cooldown after a request ends', () => {
    const { queue, advance } = makeQueue({ cooldownSeconds: 30 });
    const { ticket } = queue.create({ userId: 'learner-1' });

    queue.cancel(ticket.id);
    advance(10_000);

    let caught: unknown;
    try {
      queue.create({ userId: 'learner-1' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HelpCooldownError);
    expect((caught as HelpCooldownError).retryAfterSeconds).toBe(20);
    expect((caught as HelpCooldownError).status).toBe(429);

    advance(21_000);
    expect(queue.create({ userId: 'learner-1' }).reused).toBe(false);
  });

  it('validates the request fields', () => {
    const { queue } = makeQueue();

    expect(() => queue.create({ userId: '' })).toThrow(HelpValidationError);
    expect(() => queue.create({ userId: 42 })).toThrow(HelpValidationError);
    expect(() => queue.create({ userId: 'a', language: 'fr' })).toThrow(HelpValidationError);
    expect(() => queue.create({ userId: 'a', channel: 'carrier-pigeon' })).toThrow(
      HelpValidationError,
    );
    expect(() =>
      queue.create({ userId: 'a', screenShareEnabled: 'yes' }),
    ).toThrow(HelpValidationError);
    expect(() => queue.create({ userId: 'a', phoneNumber: 'x'.repeat(40) })).toThrow(
      HelpValidationError,
    );
  });

  it('defaults the language and channel for SMS clients', () => {
    const { queue } = makeQueue();

    const { ticket } = queue.create({ userId: 'sms:+251911000000' });

    expect(ticket.language).toBe('am');
    expect(ticket.channel).toBe('web');
  });

  it('accepts an SMS ticket and keeps its phone number', () => {
    const { queue } = makeQueue();

    const { ticket } = queue.create({
      userId: 'sms:+251911000000',
      channel: 'sms',
      phoneNumber: '+251911000000',
      language: 'en',
      conversationHistory: [{ role: 'user', content: 'What is a cell?' }],
    });

    expect(ticket.channel).toBe('sms');
    expect(ticket.phoneNumber).toBe('+251911000000');
    expect(ticket.history).toEqual([{ role: 'user', content: 'What is a cell?' }]);
  });

  it('reports queue statistics', () => {
    const { queue } = makeQueue();

    const first = queue.create({ userId: 'a' });
    queue.create({ userId: 'b' });
    queue.assign(first.ticket.id, 'tutor-sara');

    expect(queue.stats()).toEqual({
      pending: 1,
      connected: 1,
      inProgress: 0,
      total: 2,
      estimatedWaitMinutes: 2,
    });
  });

  it('expires abandoned pending tickets', () => {
    const { queue, advance } = makeQueue();
    const { ticket } = queue.create({ userId: 'learner-1' });

    advance(PENDING_TTL_MS + 1);

    expect(queue.get(ticket.id)?.status).toBe('cancelled');
  });

  it('forgets tickets long after they ended', () => {
    const { queue, advance } = makeQueue();
    const { ticket } = queue.create({ userId: 'learner-1' });
    queue.cancel(ticket.id);

    advance(ENDED_TTL_MS + 1);

    expect(queue.get(ticket.id)).toBeNull();
  });

  it('throws a not-found error for unknown tickets', () => {
    const { queue } = makeQueue();
    expect(() => queue.require('missing')).toThrow(/not found/i);
  });
});

describe('sanitizeConversationHistory', () => {
  it('keeps only the newest entries and caps their length', () => {
    const history = Array.from({ length: 30 }, (_, index) => ({
      role: 'user',
      content: `message-${index}-${'x'.repeat(600)}`,
    }));

    const cleaned = sanitizeConversationHistory(history, 20, 100);

    expect(cleaned).toHaveLength(20);
    expect(cleaned[0].content.startsWith('message-10-')).toBe(true);
    expect(cleaned[19].content.length).toBe(100);
  });

  it('drops invalid entries and control characters', () => {
    const cleaned = sanitizeConversationHistory([
      { role: 'user', content: '  hello\u0000 world  ' },
      { role: 'assistant', content: 'a real answer' },
      { role: 'system', content: '' },
      { role: 'tool', content: 'unknown role becomes user' },
      { content: 42 },
      null,
      'not an object',
    ]);

    expect(cleaned).toEqual([
      { role: 'user', content: 'hello world' },
      { role: 'assistant', content: 'a real answer' },
      { role: 'user', content: 'unknown role becomes user' },
    ]);
  });

  it('returns an empty list for non-arrays', () => {
    expect(sanitizeConversationHistory('hello')).toEqual([]);
    expect(sanitizeConversationHistory(null)).toEqual([]);
  });
});
