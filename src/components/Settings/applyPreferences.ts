import type { UserPreferences } from '@/types';

/**
 * Applies preferences to the document root.
 *
 * The global stylesheet reacts to these hooks:
 * - `data-font-size` scales the `--font-size-*` tokens
 * - `.high-contrast` swaps in the high contrast palette
 * - `data-reduce-motion` stops animations
 * - `data-keyboard-only` strengthens focus outlines
 *
 * Applied on `<html>` so it also covers content rendered outside the chat
 * (the courses page, portals and the offline page fallback).
 */
export function applyPreferences(
  preferences: UserPreferences,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.fontSize = preferences.fontSize;
  root.dataset.reduceMotion = String(preferences.reduceMotion);
  root.dataset.keyboardOnly = String(preferences.keyboardOnlyMode);
  root.classList.toggle('high-contrast', preferences.highContrast);
  root.lang = preferences.language;
}
