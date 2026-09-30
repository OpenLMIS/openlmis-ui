import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import type { Appearance } from '@/lib/app-configuration';
import {
  DEFAULT_THEME_PRESET,
  presetName,
  THEME_PRESETS,
  type ThemePresetName,
} from '@/lib/theme-presets';

export const PRESET_NAMES = Object.keys(THEME_PRESETS) as ThemePresetName[];

type ThemeValues = { preset: ThemePresetName; defaultAppearance: Appearance };

export function toThemeValues(saved: AppConfigurationDto): ThemeValues {
  return {
    preset: presetName(saved.theme.preset),
    defaultAppearance: saved.theme.defaultAppearance ?? 'system',
  };
}

export function isThemeChanged(values: ThemeValues, saved: AppConfigurationDto): boolean {
  const current = toThemeValues(saved);
  return values.preset !== current.preset || values.defaultAppearance !== current.defaultAppearance;
}

export function isThemeDefault(saved: AppConfigurationDto): boolean {
  const { preset, defaultAppearance } = toThemeValues(saved);
  return preset === DEFAULT_THEME_PRESET && defaultAppearance === 'system';
}
