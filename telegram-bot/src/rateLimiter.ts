/**
 * Sliding-window rate limiter.
 *
 * Telegram is free, but a forwarded or scripted chat can still flood the AI
 * backend. Each chat gets `max` messages per window.
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

  prune(): void {
    const cutoff = this.now() - this.windowMs;
    Array.from(this.hits.entries()).forEach(([key, timestamps]) => {
      if (!timestamps.some((timestamp) => timestamp > cutoff)) {
        this.hits.delete(key);
      }
    });
  }
}
