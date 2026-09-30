import { describe, expect, it } from 'vitest';
import {
  isThemeChanged,
  isThemeDefault,
  toThemeValues,
} from '@/features/system-settings/lib/theme';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';

const saved: AppConfigurationDto = {
  version: 3,
  appName: 'SIGECA',
  showAppName: true,
  logo: null,
  theme: { preset: 'teal', defaultAppearance: 'dark' },
  featureFlags: {},
  modifiedDate: '2026-09-29T10:00:00Z',
};

const unset: AppConfigurationDto = { ...saved, theme: { preset: null, defaultAppearance: null } };

describe('toThemeValues', () => {
  it('starts from the saved theme', () => {
    expect(toThemeValues(saved)).toEqual({ preset: 'teal', defaultAppearance: 'dark' });
  });

  it('shows blue following the system when nothing is saved', () => {
    expect(toThemeValues(unset)).toEqual({ preset: 'blue', defaultAppearance: 'system' });
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
    expect(isThemeChanged({ preset: 'blue', defaultAppearance: 'system' }, unset)).toBe(false);
  });

  it('is true for another preset or appearance', () => {
    expect(isThemeChanged({ preset: 'green', defaultAppearance: 'dark' }, saved)).toBe(true);
    expect(isThemeChanged({ preset: 'teal', defaultAppearance: 'light' }, saved)).toBe(true);
  });
});

describe('isThemeDefault', () => {
  it('is true when the theme in use is the default, saved or not', () => {
    expect(isThemeDefault(unset)).toBe(true);
    expect(
      isThemeDefault({ ...saved, theme: { preset: 'blue', defaultAppearance: 'system' } }),
    ).toBe(true);
    expect(isThemeDefault(saved)).toBe(false);
    expect(isThemeDefault({ ...saved, theme: { preset: 'blue', defaultAppearance: 'dark' } })).toBe(
      false,
    );
  });
});
