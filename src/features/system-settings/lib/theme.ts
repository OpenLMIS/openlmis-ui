import { z } from 'zod';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { DEFAULT_THEME_PRESET, THEME_PRESETS, type ThemePresetName } from '@/lib/theme-presets';

export const APPEARANCES = ['light', 'dark', 'system'] as const;
export type Appearance = (typeof APPEARANCES)[number];

export const PRESET_NAMES = Object.keys(THEME_PRESETS) as ThemePresetName[];

export type ThemeValues = { preset: ThemePresetName; appearance: Appearance };

export const themeSchema = z.object({
  preset: z.enum(PRESET_NAMES as [ThemePresetName, ...ThemePresetName[]]),
  appearance: z.enum(APPEARANCES),
});

function isPresetName(name: string | null): name is ThemePresetName {
  return name !== null && Object.hasOwn(THEME_PRESETS, name);
}

export function toThemeValues(saved: AppConfigurationDto): ThemeValues {
  return {
    preset: isPresetName(saved.theme.preset) ? saved.theme.preset : DEFAULT_THEME_PRESET,
    appearance: saved.theme.defaultAppearance ?? 'system',
  };
}

export function isThemeChanged(values: ThemeValues, saved: AppConfigurationDto): boolean {
  const current = toThemeValues(saved);
  return values.preset !== current.preset || values.appearance !== current.appearance;
}

export function toThemeSettings(values: ThemeValues): AppConfigurationDto['theme'] {
  return { preset: values.preset, defaultAppearance: values.appearance };
}

export function isThemeDefault(saved: AppConfigurationDto): boolean {
  return saved.theme.preset === null && saved.theme.defaultAppearance === null;
}
