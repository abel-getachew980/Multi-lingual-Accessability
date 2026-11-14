// ============================================
// ACCESSIBILITY UTILITIES (Teammate 7)
// ============================================

/**
 * Announce message to screen readers using ARIA live region
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  if (typeof window === 'undefined') return;

  const announcer = document.getElementById('sr-announcer');
  if (announcer) {
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}

/**
 * Move focus to an element with proper accessibility handling
 */
export function focusElement(elementId: string): void {
  if (typeof window === 'undefined') return;

  const element = document.getElementById(elementId);
  if (element) {
    element.focus();
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Trap focus within a modal or dialog
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }
  }

  element.addEventListener('keydown', handleKeyDown);

  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
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
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Skip to main content
 */
export function skipToMainContent(): void {
  if (typeof window === 'undefined') return;

  const main = document.querySelector('main') || document.getElementById('main-content');
  if (main) {
    main.setAttribute('tabindex', '-1');
    (main as HTMLElement).focus();
    main.removeAttribute('tabindex');
  }
}

/**
 * Generate unique ID for accessibility
 */
export function generateA11yId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}
