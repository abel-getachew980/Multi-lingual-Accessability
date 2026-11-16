// ============================================
// ACCESSIBILITY UTILITIES (Teammate 7)
// ============================================

import { trapFocus as createFocusTrap } from './focusTrap';
import { announce } from './screenReader';

export { getFocusableElements, type FocusTrapOptions } from './focusTrap';
export {
  ANNOUNCER_ID,
  announce,
  getAnnouncer,
  resetAnnouncer,
  type AnnouncementPriority,
} from './screenReader';
export {
  contrastRatio,
  hexToRgb,
  meetsWcagAA,
  passesWcagAA,
  relativeLuminance,
  type ContrastOptions,
} from './contrast';
export {
  isSoundSupported,
  playNotificationSound,
  resetNotificationAudio,
  type NotificationSound,
  type SoundOptions,
} from './soundNotifications';

/**
 * Announce message to screen readers using ARIA live region
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  announce(message, priority);
}

/**
 * Move focus to an element with proper accessibility handling
 */
export function focusElement(elementId: string): void {
  if (typeof window === 'undefined') return;

  const element = document.getElementById(elementId);
  if (element) {
    element.focus();
    element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Trap focus within a modal or dialog
 */
export function trapFocus(element: HTMLElement): () => void {
  return createFocusTrap(element);
}

/**
 * Handle keyboard navigation for lists
 */
export function handleListNavigation(
  event: React.KeyboardEvent,
  currentIndex: number,
  itemsLength: number,
  onSelect: (index: number) => void,
  onActivate?: (index: number) => void
): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      onSelect(currentIndex < itemsLength - 1 ? currentIndex + 1 : 0);
      break;
    case 'ArrowUp':
      event.preventDefault();
      onSelect(currentIndex > 0 ? currentIndex - 1 : itemsLength - 1);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      onActivate?.(currentIndex);
      break;
    case 'Home':
      event.preventDefault();
      onSelect(0);
      break;
    case 'End':
      event.preventDefault();
      onSelect(itemsLength - 1);
      break;
  }
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Skip to main content
 */
export function skipToMainContent(): void {
  if (typeof window === 'undefined') return;

  const main = document.querySelector('main') || document.getElementById('main-content');
  if (main) {
    // Keep tabindex="-1": removing it from a focused element makes some
    // browsers drop focus back to <body>, which defeats the skip link.
    main.setAttribute('tabindex', '-1');
    (main as HTMLElement).focus();
  }
}

/**
 * Generate unique ID for accessibility
 */
export function generateA11yId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}
