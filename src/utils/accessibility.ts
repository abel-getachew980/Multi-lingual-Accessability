// Accessibility utilities for screen reader announcements and focus management

/**
 * Announce message to screen readers using ARIA live region
 */
export function announceToScreenReader(
  message: string, 
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcer = document.getElementById('sr-announcer');
  if (announcer) {
    announcer.setAttribute('aria-live', priority === 'assertive' ? 'assertive' : 'polite');
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
  const element = document.getElementById(elementId);
  if (element) {
    element.focus();
    // Scroll into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Trap focus within a modal or dialog
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
  
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
  
  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Handle keyboard navigation for a list of items
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
      const nextIndex = currentIndex < itemsLength - 1 ? currentIndex + 1 : 0;
      onSelect(nextIndex);
      break;
    case 'ArrowUp':
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemsLength - 1;
      onSelect(prevIndex);
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
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Get accessible name for an element
 */
export function getAccessibleName(element: HTMLElement): string {
  return (
    element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby') 
      ? document.getElementById(element.getAttribute('aria-labelledby') || '')?.textContent || ''
      : element.textContent?.trim() ||
    element.getAttribute('title') ||
    ''
  );
}

/**
 * Skip to main content link handler
 */
export function skipToMainContent(): void {
  const main = document.querySelector('main') || document.getElementById('main-content');
  if (main) {
    main.setAttribute('tabindex', '-1');
    (main as HTMLElement).focus();
    main.removeAttribute('tabindex');
  }
}
