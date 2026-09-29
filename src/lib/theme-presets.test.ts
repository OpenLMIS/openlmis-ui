import { beforeEach, describe, expect, it } from 'vitest';
import { contrastRatio, inSrgbGamut, parseOklch } from '@/lib/color-contrast';
import {
  applyThemePreset,
  DEFAULT_THEME_PRESET,
  resolveThemePreset,
  THEME_PRESETS,
  THEME_TOKENS,
  themePresetCss,
} from '@/lib/theme-presets';

beforeEach(() => {
  document.head.innerHTML = '';
});

describe('resolveThemePreset', () => {
  it('finds a known preset', () => {
    expect(resolveThemePreset('blue')).toBe(THEME_PRESETS.blue);
  });

  it('falls back to the default for an unknown or missing name', () => {
    expect(resolveThemePreset('ocean')).toBe(THEME_PRESETS[DEFAULT_THEME_PRESET]);
    expect(resolveThemePreset(null)).toBe(THEME_PRESETS[DEFAULT_THEME_PRESET]);
  });
});

describe('THEME_PRESETS', () => {
  it('gives every preset every token in both modes', () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(Object.keys(preset.light).sort()).toEqual([...THEME_TOKENS].sort());
      expect(Object.keys(preset.dark).sort()).toEqual([...THEME_TOKENS].sort());
    }
  });
});

describe('themePresetCss', () => {
  it('writes the light tokens on the root and the dark ones under the dark class', () => {
    const css = themePresetCss(THEME_PRESETS.blue);

    expect(css).toContain(`:root{--primary:${THEME_PRESETS.blue.light.primary};`);
    expect(css).toContain(`.dark{--primary:${THEME_PRESETS.blue.dark.primary};`);
  });
});

describe('applyThemePreset', () => {
  it('keeps one style element, replacing its tokens on every call', () => {
    applyThemePreset('blue');
    applyThemePreset('unknown');

    const styles = document.head.querySelectorAll('style#app-theme');
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe(themePresetCss(THEME_PRESETS[DEFAULT_THEME_PRESET]));
  });
});

const SURFACES = {
  light: { background: 'oklch(1 0 0)', card: 'oklch(1 0 0)', sidebar: 'oklch(0.97 0 0)' },
  dark: { background: 'oklch(0.145 0 0)', card: 'oklch(0.205 0 0)', sidebar: 'oklch(0.2 0 0)' },
};
const CHARTS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;
const MODES = ['light', 'dark'] as const;

describe('every preset', () => {
  it('offers six presets, blue first', () => {
    expect(Object.keys(THEME_PRESETS)).toEqual([
      'blue',
      'teal',
      'green',
      'indigo',
      'purple',
      'slate',
    ]);
  });

  for (const [name, preset] of Object.entries(THEME_PRESETS)) {
    for (const mode of MODES) {
      const tokens = preset[mode];
      const blue = THEME_PRESETS.blue[mode];
      const surfaces = SURFACES[mode];
      const noWorseThanBlue = (color: string, blueColor: string, surface: string) =>
        expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(
          0.9 * contrastRatio(blueColor, surface),
        );

      it(`${name} (${mode}): button text reads at WCAG AA`, () => {
        expect(contrastRatio(tokens['primary-foreground'], tokens.primary)).toBeGreaterThanOrEqual(
          4.5,
        );
      });

      it(`${name} (${mode}): controls and the sidebar read no worse than blue`, () => {
        noWorseThanBlue(tokens.primary, blue.primary, surfaces.background);
        noWorseThanBlue(tokens['sidebar-primary'], blue['sidebar-primary'], surfaces.sidebar);
        expect(
          contrastRatio(tokens['sidebar-primary-foreground'], tokens['sidebar-primary']),
        ).toBeGreaterThanOrEqual(
          0.9 * contrastRatio(blue['sidebar-primary-foreground'], blue['sidebar-primary']),
        );
      });

      it(`${name} (${mode}): the chart ramp keeps blue's steps and contrast`, () => {
        for (const step of CHARTS) {
          expect(parseOklch(tokens[step]).l).toBe(parseOklch(blue[step]).l);
          noWorseThanBlue(tokens[step], blue[step], surfaces.card);
        }
      });

      it.skipIf(name === 'blue')(`${name} (${mode}): every colour is one a screen can show`, () => {
        for (const value of Object.values(tokens)) {
          expect(inSrgbGamut(parseOklch(value))).toBe(true);
        }
      });
    }
  }
});
