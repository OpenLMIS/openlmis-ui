import { describe, expect, it } from 'vitest';
import {
  brandingSchema,
  brandingSteps,
  logoSchema,
  MAX_LOGO_BYTES,
  resetBrandingSteps,
  toBrandingValues,
} from '@/features/system-settings/lib/branding';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';

const saved: AppConfigurationDto = {
  version: 3,
  appName: 'SIGECA',
  logo: { url: '/api/appConfiguration/logo?v=abc', contentType: 'image/png', size: 10 },
  theme: { preset: 'teal', defaultAppearance: 'dark' },
  featureFlags: { GS1_SCANNING: true },
  modifiedDate: '2026-09-29T10:00:00Z',
};

const unset: AppConfigurationDto = { ...saved, appName: null, logo: null };

const png = (size = 10) => new File([new Uint8Array(size)], 'logo.png', { type: 'image/png' });

function errorsOf(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);
}

describe('toBrandingValues', () => {
  it('starts from the saved name, keeping the logo', () => {
    expect(toBrandingValues(saved)).toEqual({ appName: 'SIGECA', logo: undefined });
  });

  it('shows the built-in name when none is saved', () => {
    expect(toBrandingValues(unset).appName).toBe('OpenLMIS');
  });
});

describe('brandingSchema', () => {
  it('needs a name', () => {
    expect(errorsOf(brandingSchema.safeParse({ appName: '   ', logo: undefined }))).toEqual([
      'system-settings.branding.errors.name-required',
    ]);
  });

  it('allows at most 64 characters', () => {
    expect(
      errorsOf(brandingSchema.safeParse({ appName: 'a'.repeat(65), logo: undefined })),
    ).toEqual(['system-settings.branding.errors.name-too-long']);
    expect(brandingSchema.safeParse({ appName: 'a'.repeat(64), logo: undefined }).success).toBe(
      true,
    );
  });
});

describe('logoSchema', () => {
  it('accepts PNG, JPEG and WebP, a removal and no change', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(logoSchema.safeParse(new File(['x'], 'logo', { type })).success).toBe(true);
    }
    expect(logoSchema.safeParse(null).success).toBe(true);
    expect(logoSchema.safeParse(undefined).success).toBe(true);
  });

  it('refuses other types, SVG included', () => {
    for (const type of ['image/svg+xml', 'image/gif', 'application/pdf']) {
      expect(errorsOf(logoSchema.safeParse(new File(['x'], 'logo', { type })))).toEqual([
        'system-settings.branding.errors.logo-type',
      ]);
    }
  });

  it('refuses a file over 512 KB', () => {
    expect(errorsOf(logoSchema.safeParse(png(MAX_LOGO_BYTES + 1)))).toEqual([
      'system-settings.branding.errors.logo-too-large',
    ]);
    expect(logoSchema.safeParse(png(MAX_LOGO_BYTES)).success).toBe(true);
  });
});

describe('brandingSteps', () => {
  it('asks for nothing when nothing changed', () => {
    expect(brandingSteps(toBrandingValues(saved), saved)).toEqual([]);
    expect(brandingSteps({ appName: ' SIGECA ', logo: undefined }, saved)).toEqual([]);
  });

  it('does not store the built-in name when it was never set', () => {
    expect(brandingSteps(toBrandingValues(unset), unset)).toEqual([]);
  });

  it('saves a new name, trimmed', () => {
    expect(brandingSteps({ appName: ' Malawi LMIS ', logo: undefined }, saved)).toEqual([
      { kind: 'update', appName: 'Malawi LMIS' },
    ]);
  });

  it('uploads a new logo before saving the name', () => {
    const file = png();
    expect(brandingSteps({ appName: 'Malawi LMIS', logo: file }, saved)).toEqual([
      { kind: 'upload', file },
      { kind: 'update', appName: 'Malawi LMIS' },
    ]);
  });

  it('removes a stored logo, and only a stored one', () => {
    expect(brandingSteps({ appName: 'SIGECA', logo: null }, saved)).toEqual([
      { kind: 'remove-logo' },
    ]);
    expect(brandingSteps({ appName: 'OpenLMIS', logo: null }, unset)).toEqual([]);
  });
});

describe('resetBrandingSteps', () => {
  it('removes the logo and clears the name', () => {
    expect(resetBrandingSteps(saved)).toEqual([
      { kind: 'remove-logo' },
      { kind: 'update', appName: null },
    ]);
  });

  it('asks for nothing when the branding is already the built-in one', () => {
    expect(resetBrandingSteps(unset)).toEqual([]);
  });
});
