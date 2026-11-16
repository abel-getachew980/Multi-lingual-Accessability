import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Zoom and reflow audit.
 *
 * jsdom has no layout engine, so "200% zoom" cannot be measured by rendering.
 * These tests check the properties that make zoom work instead: the viewport
 * allows user scaling, text is sized in relative units, containers shrink
 * rather than force horizontal scrolling, and motion can be reduced.
 *
 * The visual check at 200% and 400% is in `manual-checklist.md`.
 */

const root = process.cwd();
const layoutSource = readFileSync(join(root, 'src', 'app', 'layout.tsx'), 'utf-8');
const globalsCss = readFileSync(join(root, 'src', 'app', 'globals.css'), 'utf-8');
const manifest = JSON.parse(
  readFileSync(join(root, 'public', 'manifest.json'), 'utf-8'),
);

function collectFiles(directory: string, extension: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      found.push(...collectFiles(path, extension));
    } else if (entry.name.endsWith(extension)) {
      found.push(path);
    }
  }

  return found;
}

const cssFiles = collectFiles(join(root, 'src'), '.css').map((path) => ({
  path: relative(root, path),
  source: readFileSync(path, 'utf-8'),
}));

const sourceFiles = collectFiles(join(root, 'src'), '.tsx').map((path) => ({
  path: relative(root, path),
  source: readFileSync(path, 'utf-8'),
}));

function declarations(source: string, property: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = new RegExp(`(?:^|[;{])\\s*${property}\\s*:\\s*([^;}]+)`, 'g');

  return Array.from(withoutComments.matchAll(pattern), (match) =>
    match[1].trim(),
  );
}

describe('viewport and browser zoom', () => {
  it('lets the learner zoom to at least 200%', () => {
    expect(layoutSource).toMatch(/width:\s*'device-width'/);
    expect(layoutSource).toMatch(/initialScale:\s*1/);
    expect(layoutSource).toMatch(/userScalable:\s*true/);

    const maximumScale = Number(
      layoutSource.match(/maximumScale:\s*([\d.]+)/)?.[1],
    );
    expect(maximumScale).toBeGreaterThanOrEqual(2);
  });

  it('never disables zoom or caps it at 1x', () => {
    const everything = [
      ...sourceFiles,
      ...cssFiles,
      { path: 'public/manifest.json', source: JSON.stringify(manifest) },
    ];

    everything.forEach(({ path, source }) => {
      expect(`${path}: ${source}`).not.toMatch(/user-scalable\s*=\s*no/i);
      expect(`${path}: ${source}`).not.toMatch(/userScalable:\s*false/);
      expect(`${path}: ${source}`).not.toMatch(/maximum-scale\s*=\s*1(?![\d.])/i);
      expect(`${path}: ${source}`).not.toMatch(/text-size-adjust:\s*none/i);
    });
  });

  it('does not lock the installed app to one orientation', () => {
    // WCAG 1.3.4: content must work in portrait and landscape unless the
    // orientation is essential, which it is not for a chat interface.
    expect(manifest.orientation === undefined || manifest.orientation === 'any').toBe(
      true,
    );
  });
});

describe('relative text sizing', () => {
  it('sizes the root from the scalable token', () => {
    expect(globalsCss).toMatch(/html\s*{[^}]*font-size:\s*var\(--font-size-base\)/);
  });

  it('defines every font-size token in rem', () => {
    const tokens = Array.from(
      globalsCss.matchAll(/--font-(?:size-[\w-]+):\s*([^;]+);/g),
      (match) => match[1].trim(),
    );

    expect(tokens.length).toBeGreaterThan(5);
    tokens.forEach((value) => expect(value).toMatch(/^[\d.]+rem$/));
  });

  it('does not use pixel font sizes anywhere in the app', () => {
    cssFiles.forEach(({ path, source }) => {
      declarations(source, 'font-size').forEach((value) => {
        expect(`${path}: font-size: ${value}`).not.toMatch(/\dpx\b/);
        expect(`${path}: font-size: ${value}`).toMatch(
          /var\(--font-size-|[\d.]+(?:rem|em|%|pt)\b/,
        );
      });
    });
  });

  it('scales the whole type ramp in the large and extra-large settings', () => {
    const large = globalsCss.match(/\[data-font-size="large"\]\s*{([^}]*)}/)?.[1];
    const xlarge = globalsCss.match(
      /\[data-font-size="xlarge"\]\s*{([^}]*)}/,
    )?.[1];

    expect(large).toMatch(/--font-size-base:\s*1\.125rem/);
    expect(xlarge).toMatch(/--font-size-base:\s*1\.25rem/);
    expect(large).toMatch(/--font-size-3xl/);
    expect(xlarge).toMatch(/--font-size-3xl/);
  });
});

describe('reflow at narrow widths', () => {
  it('uses max-width, not fixed width, for the main column', () => {
    cssFiles.forEach(({ path, source }) => {
      declarations(source, 'width').forEach((value) => {
        const pixels = /^(\d+)px$/.exec(value);
        if (!pixels) return;

        // Small values are icons, borders and screen-reader-only clips.
        expect(Number(pixels[1])).toBeLessThanOrEqual(100);
      });

      declarations(source, 'min-width').forEach((value) => {
        const pixels = /^(\d+)px$/.exec(value);
        if (!pixels) return;

        expect(Number(pixels[1])).toBeLessThanOrEqual(100);
      });
    });
  });

  it('has a media query for narrow screens', () => {
    const widths = cssFiles.flatMap(({ source }) =>
      Array.from(source.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g), (match) =>
        Number(match[1]),
      ),
    );

    expect(widths.some((width) => width <= 600)).toBe(true);
  });

  it('lets headers wrap instead of overflowing', () => {
    const joined = cssFiles.map(({ source }) => source).join('\n');
    expect(joined).toMatch(/flex-wrap:\s*wrap/);

    const header = cssFiles.find(({ source }) => /\.chatHeader\s*{/.test(source));
    expect(header?.source).toMatch(/\.chatHeader\s*{[^}]*flex-wrap:\s*wrap/);
  });

  it('breaks long words and URLs inside bubbles', () => {
    const joined = cssFiles.map(({ source }) => source).join('\n');
    expect(joined).toMatch(/overflow-wrap:\s*(anywhere|break-word)/);
    expect(joined).toMatch(/word-wrap:\s*break-word|overflow-wrap:\s*break-word/);
  });
});

describe('focus and motion preferences', () => {
  it('draws a visible focus ring for keyboard users', () => {
    expect(globalsCss).toMatch(/:focus-visible\s*{[^}]*outline:/);
    expect(globalsCss).toMatch(/--focus-outline:\s*\d+px solid/);
    expect(globalsCss).toMatch(/data-keyboard-only="true"[^}]*:focus-visible/);
  });

  it('honours prefers-reduced-motion and the in-app setting', () => {
    expect(globalsCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    );
    expect(globalsCss).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(globalsCss).toMatch(
      /html\[data-reduce-motion="true"\]\s*\*\s*{[^}]*animation:\s*none/,
    );
  });

  it('keeps the skip link off-screen until it is focused', () => {
    expect(globalsCss).toMatch(/\.skip-link\s*{[^}]*top:\s*-40px/);
    expect(globalsCss).toMatch(/\.skip-link:focus\s*{[^}]*top:\s*0/);
  });

  it('provides a main landmark for the skip link target', () => {
    const chat = sourceFiles.find(({ path }) =>
      path.endsWith(join('Chat', 'ChatContainer.tsx')),
    );

    expect(chat?.source).toMatch(/<main[^>]*id="main-content"/);
    expect(layoutSource).toMatch(/href="#main-content"/);
  });
});
