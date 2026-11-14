import test from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindowRateLimiter } from './rateLimiter';

test('allows requests up to the limit, then blocks', () => {
  let now = 0;
  const limiter = new SlidingWindowRateLimiter(2, 1_000, () => now);

  now = 100;
  assert.deepEqual(limiter.check('+251900000000'), {
    allowed: true,
    retryAfterMs: 0,
    remaining: 1,
  });

  now = 200;
  const second = limiter.check('+251900000000');
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  now = 300;
  const blocked = limiter.check('+251900000000');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 800);
});

test('frees capacity as the window slides', () => {
  let now = 0;
  const limiter = new SlidingWindowRateLimiter(1, 1_000, () => now);

  now = 100;
  assert.equal(limiter.check('a').allowed, true);

  now = 1_050;
  assert.equal(limiter.check('a').allowed, false);

  now = 1_100;
  assert.equal(limiter.check('a').allowed, true);
});

test('tracks phone numbers independently', () => {
  let now = 0;
  const limiter = new SlidingWindowRateLimiter(1, 1_000, () => now);

  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('b').allowed, true);
  assert.equal(limiter.check('a').allowed, false);
});

test('prune drops idle keys', () => {
  let now = 0;
  const limiter = new SlidingWindowRateLimiter(1, 1_000, () => now);
  limiter.check('a');

  now = 5_000;
  limiter.prune();

  assert.equal(limiter.check('a').allowed, true);
});
