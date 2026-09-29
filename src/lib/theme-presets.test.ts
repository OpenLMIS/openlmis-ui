import { beforeEach, describe, expect, it } from 'vitest';
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
