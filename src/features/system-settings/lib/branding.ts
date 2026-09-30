import { z } from 'zod';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { getAppName } from '@/lib/app-configuration';
import { appConfig } from '@/lib/config';

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_LOGO_BYTES = 512 * 1024;
export const MAX_APP_NAME_LENGTH = 20;

type BrandingValues = {
  appName: string;
  showAppName: boolean;
  logo: File | null | undefined;
};

export type BrandingStep =
  | { kind: 'upload'; file: File }
  | { kind: 'remove-logo' }
  | { kind: 'update'; appName: string | null; showAppName: boolean };

export const logoSchema = z
  .custom<File | null | undefined>(
    (value) => value === undefined || value === null || value instanceof File,
  )
  .superRefine((file, context) => {
    if (!(file instanceof File)) return;
    if (!LOGO_TYPES.includes(file.type)) {
      context.addIssue({ code: 'custom', message: 'system-settings.branding.errors.logo-type' });
    } else if (file.size > MAX_LOGO_BYTES) {
      context.addIssue({
        code: 'custom',
        message: 'system-settings.branding.errors.logo-too-large',
      });
    }
  });

export const brandingSchema = z.object({
  appName: z
    .string()
    .trim()
    .max(MAX_APP_NAME_LENGTH, 'system-settings.branding.errors.name-too-long'),
  showAppName: z.boolean(),
  logo: logoSchema,
});

export function toBrandingValues(saved: AppConfigurationDto): BrandingValues {
  return { appName: saved.appName ?? '', showAppName: saved.showAppName, logo: undefined };
}

export function brandingSteps(values: BrandingValues, saved: AppConfigurationDto): BrandingStep[] {
  const steps: BrandingStep[] = [];
  if (values.logo instanceof File) steps.push({ kind: 'upload', file: values.logo });
  if (values.logo === null && saved.logo) steps.push({ kind: 'remove-logo' });

  const appName = values.appName.trim() || null;
  if (appName !== saved.appName || values.showAppName !== saved.showAppName) {
    steps.push({ kind: 'update', appName, showAppName: values.showAppName });
  }
  return steps;
}

export function resetBrandingSteps(saved: AppConfigurationDto): BrandingStep[] {
  const steps: BrandingStep[] = [];
  if (saved.logo) steps.push({ kind: 'remove-logo' });
  if (saved.appName !== null || !saved.showAppName) {
    steps.push({ kind: 'update', appName: null, showAppName: true });
  }
  return steps;
}

export function isBrandingDefault(saved: AppConfigurationDto): boolean {
  return saved.logo === null && getAppName(saved) === appConfig.BRAND && saved.showAppName;
}
