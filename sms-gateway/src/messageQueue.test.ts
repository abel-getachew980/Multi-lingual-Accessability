import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageQueue } from './messageQueue';
import type { OutboundSms } from './types';

test('retries failed deliveries with exponential backoff', async () => {
  let attempts = 0;
  const delays: number[] = [];
  const queue = new MessageQueue({
    send: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('temporary failure');
    },
    maxAttempts: 3,
    baseDelayMs: 10,
    delay: async (ms) => {
      delays.push(ms);
    },
  });

  queue.enqueue({ to: '+251911111111', body: 'hello' });
  await queue.waitForIdle();

  assert.equal(attempts, 3);
  assert.deepEqual(delays, [10, 20]);
  assert.equal(queue.size, 0);
});

test('reports a message that never succeeds and drops it', async () => {
  const errors: Array<{ attempts: number; to: string }> = [];
  let attempts = 0;

  const queue = new MessageQueue({
    send: async () => {
      attempts += 1;
      throw new Error('provider down');
    },
    maxAttempts: 2,
    delay: async () => {},
    onError: (_error, message, tries) => {
      errors.push({ attempts: tries, to: message.to });
    },
  });

  queue.enqueue({ to: '+251922222222', body: 'hello' });
  await queue.waitForIdle();

  assert.equal(attempts, 2);
  assert.deepEqual(errors, [{ attempts: 2, to: '+251922222222' }]);
  assert.equal(queue.size, 0);
});

test('sends messages in order', async () => {
  const sent: string[] = [];
  const queue = new MessageQueue({
    send: async (message: OutboundSms) => {
      sent.push(message.body);
    },
  });

  queue.enqueue({ to: '+251911111111', body: 'first' });
  queue.enqueue({ to: '+251911111111', body: 'second' });
  queue.enqueue({ to: '+251911111111', body: 'third' });

  await queue.waitForIdle();

  assert.deepEqual(sent, ['first', 'second', 'third']);
});

test('refuses new work after stop', () => {
  const queue = new MessageQueue({ send: async () => {} });
  queue.stop();

  assert.throws(() => queue.enqueue({ to: '+251911111111', body: 'late' }));
});
