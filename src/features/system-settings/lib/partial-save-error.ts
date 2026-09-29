import type { AppConfigurationDto } from '@/features/system-settings/lib/types';

export class PartialSaveError extends Error {
  readonly saved: AppConfigurationDto;

  constructor(saved: AppConfigurationDto, cause: unknown) {
    super('Only part of the settings were saved', { cause });
    this.name = 'PartialSaveError';
    this.saved = saved;
  }
}
