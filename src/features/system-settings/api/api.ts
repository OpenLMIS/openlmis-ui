import type { BrandingStep } from '@/features/system-settings/lib/branding';
import { PartialSaveError } from '@/features/system-settings/lib/partial-save-error';
import type { AppConfigurationDto, EditableSettings } from '@/features/system-settings/lib/types';
import { client } from '@/integrations/axios';
import { getIfExists } from '@/lib/http';

const basedOn = (saved: AppConfigurationDto) => ({
  headers: { 'If-Match': `W/"${saved.version}"` },
});

const withDefaults = (dto: AppConfigurationDto): AppConfigurationDto => ({
  ...dto,
  showAppName: dto.showAppName ?? true,
});

export async function fetchAppConfiguration(): Promise<AppConfigurationDto | null> {
  const dto = await getIfExists<AppConfigurationDto>('/appConfiguration');
  return dto && withDefaults(dto);
}

export async function updateAppConfiguration(
  saved: AppConfigurationDto,
  changes: Partial<EditableSettings>,
): Promise<AppConfigurationDto> {
  const body: EditableSettings = {
    appName: saved.appName,
    showAppName: saved.showAppName,
    theme: saved.theme,
    featureFlags: saved.featureFlags,
    ...changes,
  };
  const { data } = await client.put<AppConfigurationDto>('/appConfiguration', body, basedOn(saved));
  return withDefaults(data);
}

export async function uploadLogo(
  saved: AppConfigurationDto,
  file: File,
): Promise<AppConfigurationDto> {
  const body = new FormData();
  body.append('file', file);
  const { data } = await client.put<AppConfigurationDto>('/appConfiguration/logo', body, {
    headers: { ...basedOn(saved).headers, 'Content-Type': 'multipart/form-data' },
  });
  return withDefaults(data);
}

export async function removeLogo(saved: AppConfigurationDto): Promise<AppConfigurationDto> {
  const { data } = await client.delete<AppConfigurationDto>(
    '/appConfiguration/logo',
    basedOn(saved),
  );
  return withDefaults(data);
}

export async function saveBranding(
  saved: AppConfigurationDto,
  steps: BrandingStep[],
): Promise<AppConfigurationDto> {
  let current = saved;
  for (const step of steps) {
    try {
      if (step.kind === 'upload') current = await uploadLogo(current, step.file);
      else if (step.kind === 'remove-logo') current = await removeLogo(current);
      else {
        current = await updateAppConfiguration(current, {
          appName: step.appName,
          showAppName: step.showAppName,
        });
      }
    } catch (error) {
      throw current === saved ? error : new PartialSaveError(current, error);
    }
  }
  return current;
}
