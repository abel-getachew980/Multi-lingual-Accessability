/**
 * WCAG contrast helpers.
 *
 * These are used by the accessibility tests to check the design tokens
 * instead of trusting a screenshot. Formula and thresholds come from
 * WCAG 2.1: 4.5:1 for normal text, 3:1 for large text and UI graphics.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses `#rgb`, `#rrggbb` or `#rrggbbaa` (alpha is ignored). */
export function hexToRgb(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');

  if (!/^[0-9a-fA-F]{3,8}$/.test(value)) {
    throw new RangeError(`"${hex}" is not a hex colour`);
  }

  const expanded =
    value.length === 3 || value.length === 4
      ? value
          .slice(0, 3)
          .split('')
          .map((character) => character + character)
          .join('')
      : value.slice(0, 6);

  if (expanded.length !== 6) {
    throw new RangeError(`"${hex}" is not a hex colour`);
  }

  const numeric = Number.parseInt(expanded, 16);

  return {
    r: (numeric >> 16) & 0xff,
    g: (numeric >> 8) & 0xff,
    b: numeric & 0xff,
  };
}

function linearise(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * linearise(r) +
    0.7152 * linearise(g) +
    0.0722 * linearise(b)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastOptions {
  /** Text at 18.66px bold or 24px regular only needs 3:1. */
  largeText?: boolean;
  /** Icons, borders and focus rings need 3:1. */
  uiComponent?: boolean;
}

export function meetsWcagAA(
  ratio: number,
  options: ContrastOptions = {},
): boolean {
  if (options.uiComponent || options.largeText) return ratio >= 3;
  return ratio >= 4.5;
}

export function passesWcagAA(
  foreground: string,
  background: string,
  options: ContrastOptions = {},
): boolean {
  return meetsWcagAA(contrastRatio(foreground, background), options);
}
