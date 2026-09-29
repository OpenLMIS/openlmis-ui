import type { Appearance } from '@/lib/app-configuration';

export type AppConfigurationDto = {
  version: number;
  appName: string | null;
  logo: { url: string; contentType: string; size: number } | null;
  theme: { preset: string | null; defaultAppearance: Appearance | null };
  featureFlags: Record<string, boolean | string>;
  modifiedDate: string;
};

export type EditableSettings = Pick<AppConfigurationDto, 'appName' | 'theme' | 'featureFlags'>;
