import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  contrastRatio,
  hexToRgb,
  meetsWcagAA,
  passesWcagAA,
  relativeLuminance,
} from '@/utils/contrast';

const globalsCss = readFileSync(
  join(process.cwd(), 'src', 'app', 'globals.css'),
  'utf-8',
);

/** Reads the palette from `:root` so the tests cannot drift from the app. */
function palette(): Record<string, string> {
  const tokens: Record<string, string> = {};

  for (const match of Array.from(
    globalsCss.matchAll(/--(color-[\w-]+):\s*(#[0-9a-fA-F]+);/g),
  )) {
    tokens[match[1]] = match[2];
  }

  return tokens;
}

const colors = palette();

describe('contrast helpers', () => {
  it('parses three and six digit hex colours', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#1e40af')).toEqual({ r: 30, g: 64, b: 175 });
    expect(hexToRgb('1e40af')).toEqual({ r: 30, g: 64, b: 175 });
  });

  it('ignores alpha rather than treating it as another channel', () => {
    expect(hexToRgb('#1e40afcc')).toEqual({ r: 30, g: 64, b: 175 });
    expect(hexToRgb('#1e4f')).toEqual({ r: 17, g: 238, b: 68 });
  });

  it('rejects names, shorthand with wrong length and empty values', () => {
    expect(() => hexToRgb('rebeccapurple')).toThrow(RangeError);
    expect(() => hexToRgb('#12345')).toThrow(RangeError);
    expect(() => hexToRgb('')).toThrow(RangeError);
  });

  it('computes the reference luminances', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('computes 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#1e40af', '#1e40af')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1e40af', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#1e40af'),
      5,
    );
  });

  it('applies the 4.5:1 / 3:1 thresholds', () => {
    expect(meetsWcagAA(4.5)).toBe(true);
    expect(meetsWcagAA(4.49)).toBe(false);
    expect(meetsWcagAA(3, { largeText: true })).toBe(true);
    expect(meetsWcagAA(3, { uiComponent: true })).toBe(true);
    expect(meetsWcagAA(2.99, { uiComponent: true })).toBe(false);
  });

  it('wraps the ratio and the threshold in one call', () => {
    expect(passesWcagAA('#1f2937', '#ffffff')).toBe(true);
    expect(passesWcagAA('#e5e7eb', '#ffffff')).toBe(false);
    expect(passesWcagAA('#6b7280', '#ffffff', { uiComponent: true })).toBe(true);
  });
});

describe('design tokens', () => {
  it('exports every token the components rely on', () => {
    expect(colors).toMatchObject({
      'color-primary': expect.stringMatching(/^#/),
      'color-primary-light': expect.stringMatching(/^#/),
      'color-primary-dark': expect.stringMatching(/^#/),
      'color-text': expect.stringMatching(/^#/),
      'color-text-light': expect.stringMatching(/^#/),
      'color-background': expect.stringMatching(/^#/),
      'color-surface': expect.stringMatching(/^#/),
      'color-border': expect.stringMatching(/^#/),
      'color-border-strong': expect.stringMatching(/^#/),
      'color-focus': expect.stringMatching(/^#/),
      'color-error': expect.stringMatching(/^#/),
      'color-success': expect.stringMatching(/^#/),
      'color-warning': expect.stringMatching(/^#/),
    });
  });

  const bodyTextPairs: Array<[string, string, string]> = [
    ['body on white', 'color-text', 'color-background'],
    ['body on surface', 'color-text', 'color-surface'],
    ['secondary text on white', 'color-text-light', 'color-background'],
    ['secondary text on surface', 'color-text-light', 'color-surface'],
    ['error text on white', 'color-error', 'color-background'],
    ['error text on surface', 'color-error', 'color-surface'],
    ['success text on white', 'color-success', 'color-background'],
    ['warning text on white', 'color-warning', 'color-background'],
  ];

  it.each(bodyTextPairs)('%s reaches 4.5:1', (_name, foreground, background) => {
    expect(
      contrastRatio(colors[foreground], colors[background]),
    ).toBeGreaterThanOrEqual(4.5);
  });

  const filledControlPairs: Array<[string, string, string]> = [
    ['white on primary', 'color-background', 'color-primary'],
    ['white on primary dark', 'color-background', 'color-primary-dark'],
    ['white on success badge', 'color-background', 'color-success'],
    ['white on warning badge', 'color-background', 'color-warning'],
    ['white on error button', 'color-background', 'color-error'],
  ];

  it.each(filledControlPairs)(
    '%s reaches 4.5:1',
    (_name, foreground, background) => {
      expect(
        contrastRatio(colors[foreground], colors[background]),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('keeps the focus ring visible against both page surfaces', () => {
    expect(
      contrastRatio(colors['color-focus'], colors['color-background']),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(colors['color-focus'], colors['color-surface']),
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps interactive borders at the 3:1 non-text threshold', () => {
    expect(
      contrastRatio(colors['color-border-strong'], colors['color-background']),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(colors['color-border-strong'], colors['color-surface']),
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps the primary colour readable as text and as a button fill', () => {
    expect(
      contrastRatio(colors['color-primary'], colors['color-background']),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(colors['color-background'], colors['color-primary']),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('high contrast mode', () => {
  const highContrast = globalsCss.match(/\.high-contrast\s*{([^}]*)}/)?.[1] ?? '';

  function token(name: string): string {
    const match = highContrast.match(
      new RegExp(`--${name}:\\s*(#[0-9a-fA-F]+);`),
    );
    expect(match).not.toBeNull();
    return match?.[1] as string;
  }

  it('uses black text on white', () => {
    expect(contrastRatio(token('color-text'), token('color-background'))).toBeCloseTo(
      21,
      1,
    );
  });

  it('keeps its primary colour at 4.5:1', () => {
    expect(
      contrastRatio(token('color-primary'), token('color-background')),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('uses a black border, not the default light grey', () => {
    expect(token('color-border')).toBe('#000000');
  });
});
