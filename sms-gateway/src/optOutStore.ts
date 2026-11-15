/**
 * Opt-out registry for SMS compliance.
 *
 * Carriers and aggregators expect `STOP` to be honoured permanently until the
 * learner sends `START` again. This implementation is in-memory: it survives
 * for the life of the process only. Swap it for a database table before
 * running more than one instance (see README "Known limits").
 */

export interface OptOutStore {
  isOptedOut(phoneNumber: string): boolean;
  optOut(phoneNumber: string): void;
  optIn(phoneNumber: string): void;
}

export class InMemoryOptOutStore implements OptOutStore {
  private readonly optedOut = new Set<string>();

  isOptedOut(phoneNumber: string): boolean {
    return this.optedOut.has(phoneNumber);
  }

  optOut(phoneNumber: string): void {
    this.optedOut.add(phoneNumber);
  }

  optIn(phoneNumber: string): void {
    this.optedOut.delete(phoneNumber);
  }

  get size(): number {
    return this.optedOut.size;
  }
}
