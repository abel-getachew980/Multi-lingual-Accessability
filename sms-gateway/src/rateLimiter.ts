/**
 * Small in-memory sliding-window rate limiter.
 *
 * SMS is expensive and easy to abuse, so each phone number gets a fixed number
 * of messages per window. Counters are intentionally in-memory: a single
 * gateway process is enough for a hackathon deployment. Swap in Redis or a
 * shared store when running more than one instance.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the next request will be accepted. */
  retryAfterMs: number;
  remaining: number;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (max < 1) throw new RangeError('max must be at least 1');
    if (windowMs < 1) throw new RangeError('windowMs must be at least 1');
  }

  check(key: string): RateLimitResult {
    const currentTime = this.now();
    const cutoff = currentTime - this.windowMs;
    const previous = this.hits.get(key) ?? [];
    const recent = previous.filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.max) {
      const oldest = recent[0] ?? currentTime;
      this.hits.set(key, recent);
      return {
        allowed: false,
        retryAfterMs: Math.max(oldest + this.windowMs - currentTime, 0),
        remaining: 0,
      };
    }

    recent.push(currentTime);
    this.hits.set(key, recent);

    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(this.max - recent.length, 0),
    };
  }

  reset(key?: string): void {
    if (key === undefined) {
      this.hits.clear();
      return;
    }
    this.hits.delete(key);
  }

  /** Drop keys that no longer have activity inside the window. */
  prune(): void {
    const cutoff = this.now() - this.windowMs;
    for (const [key, timestamps] of this.hits) {
      if (!timestamps.some((timestamp) => timestamp > cutoff)) {
        this.hits.delete(key);
      }
    }
  }
}
