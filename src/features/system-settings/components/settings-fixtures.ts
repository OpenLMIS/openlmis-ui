import type { AppConfigurationDto } from '@/features/system-settings/lib/types';

export const savedConfiguration: AppConfigurationDto = {
  version: 3,
  appName: 'SIGECA',
  showAppName: true,
  logo: null,
  theme: { preset: 'teal', defaultAppearance: 'dark' },
  featureFlags: {},
  modifiedDate: '2026-09-29T10:00:00Z',
};
