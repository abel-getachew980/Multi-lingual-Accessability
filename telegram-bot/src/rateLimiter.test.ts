import test from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindowRateLimiter } from './rateLimiter';

test('allows messages up to the limit', () => {
  const limiter = new SlidingWindowRateLimiter(2, 1_000, () => 0);

  assert.deepEqual(limiter.check('chat'), {
    allowed: true,
    retryAfterMs: 0,
    remaining: 1,
  });
  assert.deepEqual(limiter.check('chat'), {
    allowed: true,
    retryAfterMs: 0,
    remaining: 0,
  });
});

test('blocks after the limit and reports the wait', () => {
  let now = 10_000;
  const limiter = new SlidingWindowRateLimiter(1, 1_000, () => now);

  limiter.check('chat');
  now += 400;

  const blocked = limiter.check('chat');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterMs, 600);
});

test('allows again once the window has passed', () => {
  let now = 0;
  const limiter = new SlidingWindowRateLimiter(1, 1_000, () => now);

  assert.equal(limiter.check('chat').allowed, true);
  now = 1_001;

  assert.equal(limiter.check('chat').allowed, true);
});

test('keeps separate counters per chat', () => {
  const limiter = new SlidingWindowRateLimiter(1, 1_000, () => 0);

  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('b').allowed, true);
  assert.equal(limiter.check('a').allowed, false);
});

test('reset clears one key or everything', () => {
  const limiter = new SlidingWindowRateLimiter(1, 1_000, () => 0);
  limiter.check('a');
  limiter.check('b');

  limiter.reset('a');
  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('b').allowed, false);

  limiter.reset();
  assert.equal(limiter.check('b').allowed, true);
});

test('prune drops keys with no recent hits', () => {
  let now = 0;
  const limiter = new SlidingWindowRateLimiter(1, 1_000, () => now);

  limiter.check('old');
  now = 2_000;
  limiter.check('fresh');
  limiter.prune();

  // `old` starts fresh, while `fresh` is still at its limit.
  assert.equal(limiter.check('old').allowed, true);
  assert.equal(limiter.check('fresh').allowed, false);
});

test('validates its constructor arguments', () => {
  assert.throws(() => new SlidingWindowRateLimiter(0, 1_000), RangeError);
  assert.throws(() => new SlidingWindowRateLimiter(1, 0), RangeError);
});
