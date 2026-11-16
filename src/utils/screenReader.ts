/**
 * Screen-reader announcements.
 *
 * The root layout renders `#sr-announcer`, but tests and embedded views may
 * not. `announce` creates the live region on demand and keeps it hidden with
 * the shared `.sr-only` utility, so a message is never lost because a layout
 * forgot the mount point.
 */

export type AnnouncementPriority = 'polite' | 'assertive';

export const ANNOUNCER_ID = 'sr-announcer';

let clearTimer: ReturnType<typeof setTimeout> | null = null;

function createRegion(priority: AnnouncementPriority): HTMLElement {
  const region = document.createElement('div');
  region.id = ANNOUNCER_ID;
  region.className = 'sr-only';
  region.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  region.setAttribute('aria-live', priority);
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

export function getAnnouncer(
  priority: AnnouncementPriority = 'polite',
): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const existing = document.getElementById(ANNOUNCER_ID);
  if (existing) return existing;

  return createRegion(priority);
}

/**
 * Writes `message` into the live region and clears it after a second.
 *
 * Clearing matters: some screen readers ignore an update that reuses the
 * exact same string, and a stale message would be announced again when the
 * user navigates back to the region.
 */
export function announce(
  message: string,
  priority: AnnouncementPriority = 'polite',
): void {
  const region = getAnnouncer(priority);
  if (!region) return;

  const text = message.trim();
  region.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  region.setAttribute('aria-live', priority);
  region.setAttribute('aria-atomic', 'true');
  region.textContent = text;

  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;

  if (text) {
    clearTimer = setTimeout(() => {
      region.textContent = '';
      clearTimer = null;
    }, 1_000);
  }
}

/** Removes a pending clear timer. Exposed for tests and teardown. */
export function resetAnnouncer(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }

  if (typeof document === 'undefined') return;
  document.getElementById(ANNOUNCER_ID)?.remove();
}
