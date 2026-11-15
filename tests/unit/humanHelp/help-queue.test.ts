/** @jest-environment node */

import { HelpQueue } from '@/services/humanHelp/HelpQueue';

function create(queue: HelpQueue, userId: string) {
  return queue.create({ userId, conversationHistory: [] });
}

describe('HelpQueue', () => {
  it('creates a pending request with a queue position', () => {
    const queue = new HelpQueue();
    const request = create(queue, 'learner-1');

    expect(request.status).toBe('pending');
    expect(request.position).toBe(1);
    expect(request.estimatedWait).toBe('2 minutes');
  });

  it('positions later requests behind earlier ones', () => {
    const queue = new HelpQueue();
    create(queue, 'learner-1');
    const second = create(queue, 'learner-2');

    expect(second.position).toBe(2);
    expect(second.estimatedWait).toBe('4 minutes');
  });

  it('moves queued learners forward when a request is cancelled', () => {
    const queue = new HelpQueue();
    const first = create(queue, 'learner-1');
    const second = create(queue, 'learner-2');

    queue.cancel(first.id);

    expect(queue.get(second.id)?.position).toBe(1);
    expect(queue.get(first.id)?.status).toBe('cancelled');
  });

  it('marks a request connected when a tutor is assigned', () => {
    const queue = new HelpQueue();
    const request = create(queue, 'learner-1');

    const connected = queue.assignTutor(request.id, 'tutor-1');

    expect(connected?.status).toBe('connected');
    expect(connected?.assignedTutor).toBe('tutor-1');
    expect(connected?.position).toBeUndefined();
  });

  it('returns null for unknown requests', () => {
    const queue = new HelpQueue();
    expect(queue.get('missing')).toBeNull();
  });
});
