import { describe, expect, it } from 'vitest';
import {
  isThemeChanged,
  isThemeDefault,
  themeSchema,
  toThemeSettings,
  toThemeValues,
} from '@/features/system-settings/lib/theme';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';

const saved: AppConfigurationDto = {
  version: 3,
  appName: 'SIGECA',
  logo: null,
  theme: { preset: 'teal', defaultAppearance: 'dark' },
  featureFlags: {},
  modifiedDate: '2026-09-29T10:00:00Z',
};

const unset: AppConfigurationDto = { ...saved, theme: { preset: null, defaultAppearance: null } };

describe('toThemeValues', () => {
  it('starts from the saved theme', () => {
    expect(toThemeValues(saved)).toEqual({ preset: 'teal', appearance: 'dark' });
  });

  it('shows blue following the system when nothing is saved', () => {
    expect(toThemeValues(unset)).toEqual({ preset: 'blue', appearance: 'system' });
  });

  it('shows blue for a preset this version does not know', () => {
    expect(
      toThemeValues({ ...saved, theme: { preset: 'ocean', defaultAppearance: null } }).preset,
    ).toBe('blue');
  });
});

describe('isThemeChanged', () => {
  it('is false for what is already in effect, saved or not', () => {
    expect(isThemeChanged(toThemeValues(saved), saved)).toBe(false);
    expect(isThemeChanged({ preset: 'blue', appearance: 'system' }, unset)).toBe(false);
  });

  it('is true for another preset or appearance', () => {
    expect(isThemeChanged({ preset: 'green', appearance: 'dark' }, saved)).toBe(true);
    expect(isThemeChanged({ preset: 'teal', appearance: 'light' }, saved)).toBe(true);
  });
});

describe('toThemeSettings', () => {
  it('stores the chosen preset and appearance', () => {
    expect(toThemeSettings({ preset: 'green', appearance: 'light' })).toEqual({
      preset: 'green',
      defaultAppearance: 'light',
    });
  });
});

describe('isThemeDefault', () => {
  it('is true only when nothing is saved', () => {
    expect(isThemeDefault(unset)).toBe(true);
    expect(isThemeDefault(saved)).toBe(false);
  });
});

describe('themeSchema', () => {
  it('accepts a known preset and appearance only', () => {
    expect(themeSchema.safeParse({ preset: 'slate', appearance: 'system' }).success).toBe(true);
    expect(themeSchema.safeParse({ preset: 'ocean', appearance: 'system' }).success).toBe(false);
    expect(themeSchema.safeParse({ preset: 'blue', appearance: 'sepia' }).success).toBe(false);
  });
});
