import { z } from 'zod';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { appConfig } from '@/lib/config';

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_LOGO_BYTES = 512 * 1024;
const MAX_APP_NAME_LENGTH = 64;

export type BrandingValues = {
  appName: string;
  logo: File | null | undefined;
};

export type BrandingStep =
  | { kind: 'upload'; file: File }
  | { kind: 'remove-logo' }
  | { kind: 'update'; appName: string | null };

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
    .min(1, 'system-settings.branding.errors.name-required')
    .max(MAX_APP_NAME_LENGTH, 'system-settings.branding.errors.name-too-long'),
  logo: logoSchema,
});

export function toBrandingValues(saved: AppConfigurationDto): BrandingValues {
  return { appName: saved.appName ?? appConfig.BRAND, logo: undefined };
}

export function brandingSteps(values: BrandingValues, saved: AppConfigurationDto): BrandingStep[] {
  const steps: BrandingStep[] = [];
  if (values.logo instanceof File) steps.push({ kind: 'upload', file: values.logo });
  if (values.logo === null && saved.logo) steps.push({ kind: 'remove-logo' });

  const appName = values.appName.trim();
  if (appName !== (saved.appName ?? appConfig.BRAND)) steps.push({ kind: 'update', appName });
  return steps;
}

export function resetBrandingSteps(saved: AppConfigurationDto): BrandingStep[] {
  const steps: BrandingStep[] = [];
  if (saved.logo) steps.push({ kind: 'remove-logo' });
  if (saved.appName !== null) steps.push({ kind: 'update', appName: null });
  return steps;
}
