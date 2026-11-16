/**
 * Keyboard focus management for dialogs and menus.
 *
 * The dialog components call this from an effect. `trapFocus` focuses the
 * first control, keeps Tab/Shift+Tab inside the container, and restores focus
 * to the trigger on release. Keeping it in one place means every dialog
 * behaves the same way for keyboard and screen-reader users.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Dialogs stack (a settings dialog can open over a help dialog). Only the
 * top-most trap enforces focus; otherwise two traps would take turns pulling
 * focus towards themselves forever.
 */
const activeTraps: HTMLElement[] = [];

export interface FocusTrapOptions {
  /** Element to focus first. Defaults to the first focusable element. */
  initialFocus?: HTMLElement | null;
  /** Element to focus on release. Defaults to the active element at setup. */
  returnFocus?: HTMLElement | null;
  /** Called when Escape is pressed inside the container. */
  onEscape?: () => void;
}

function isAvailable(element: HTMLElement): boolean {
  if (element.closest('[hidden]')) return false;
  if (element.closest('[aria-hidden="true"]')) return false;
  if (element.closest('[inert]')) return false;

  // jsdom has no layout engine, so this only checks explicit hiding. Real
  // browsers additionally skip display:none elements from the tab order.
  return true;
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isAvailable);
}

/**
 * Traps Tab focus inside `container` and returns a release function.
 *
 * The release function is idempotent and restores the element that was
 * focused before the trap opened, which is what keyboard users expect after
 * closing a dialog.
 */
export function trapFocus(
  container: HTMLElement,
  options: FocusTrapOptions = {},
): () => void {
  if (typeof document === 'undefined' || !container) return () => {};

  const previous =
    options.returnFocus ??
    (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);

  // A container with no controls must still be focusable so Tab cannot
  // escape into the page behind the dialog.
  const addedTabIndex = !container.hasAttribute('tabindex');
  if (addedTabIndex) container.setAttribute('tabindex', '-1');

  // Become the top-most trap before moving focus, so an older dialog's
  // focusin handler does not immediately pull focus back to itself.
  activeTraps.push(container);

  const initial =
    options.initialFocus ??
    getFocusableElements(container)[0] ??
    container;
  initial.focus();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      options.onEscape?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);

    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  // Programmatic focus (or browser chrome) can still move focus outside a
  // dialog. Pull it back to the first control.
  const handleFocusIn = (event: FocusEvent) => {
    if (activeTraps[activeTraps.length - 1] !== container) return;
    if (container.contains(event.target as Node)) return;

    const focusable = getFocusableElements(container);
    (focusable[0] ?? container).focus();
  };

  container.addEventListener('keydown', handleKeyDown);
  document.addEventListener('focusin', handleFocusIn);

  let released = false;

  return () => {
    if (released) return;
    released = true;

    container.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('focusin', handleFocusIn);

    const index = activeTraps.lastIndexOf(container);
    if (index !== -1) activeTraps.splice(index, 1);

    if (addedTabIndex) container.removeAttribute('tabindex');

    if (previous && document.contains(previous)) {
      previous.focus();
    }
  };
}
