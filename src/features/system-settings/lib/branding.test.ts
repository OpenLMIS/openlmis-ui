import { describe, expect, it } from 'vitest';
import {
  brandingSchema,
  brandingSteps,
  isBrandingDefault,
  logoSchema,
  MAX_LOGO_BYTES,
  resetBrandingSteps,
  toBrandingValues,
} from '@/features/system-settings/lib/branding';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';

const saved: AppConfigurationDto = {
  version: 3,
  appName: 'SIGECA',
  showAppName: true,
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
  it('starts from the saved name and switch, keeping the logo', () => {
    expect(toBrandingValues(saved)).toEqual({
      appName: 'SIGECA',
      showAppName: true,
      logo: undefined,
    });
  });

  it('leaves the name empty when none is saved, so the built-in one applies', () => {
    expect(toBrandingValues(unset).appName).toBe('');
  });
});

describe('brandingSchema', () => {
  it('allows an empty name', () => {
    expect(
      brandingSchema.safeParse({ appName: '   ', showAppName: true, logo: undefined }).success,
    ).toBe(true);
  });

  it('allows at most 20 characters, which fit the sidebar', () => {
    expect(
      errorsOf(
        brandingSchema.safeParse({ appName: 'a'.repeat(21), showAppName: true, logo: undefined }),
      ),
    ).toEqual(['system-settings.branding.errors.name-too-long']);
    expect(
      brandingSchema.safeParse({ appName: 'a'.repeat(20), showAppName: true, logo: undefined })
        .success,
    ).toBe(true);
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

const update = (appName: string | null, showAppName = true) => ({
  kind: 'update',
  appName,
  showAppName,
});

describe('brandingSteps', () => {
  const values = { appName: 'SIGECA', showAppName: true, logo: undefined };

  it('asks for nothing when nothing changed', () => {
    expect(brandingSteps(toBrandingValues(saved), saved)).toEqual([]);
    expect(brandingSteps({ ...values, appName: ' SIGECA ' }, saved)).toEqual([]);
    expect(brandingSteps(toBrandingValues(unset), unset)).toEqual([]);
  });

  it('saves a new name, trimmed, and an empty one as none', () => {
    expect(brandingSteps({ ...values, appName: ' Malawi LMIS ' }, saved)).toEqual([
      update('Malawi LMIS'),
    ]);
    expect(brandingSteps({ ...values, appName: '  ' }, saved)).toEqual([update(null)]);
  });

  it('saves the switch that hides the name beside the logo', () => {
    expect(brandingSteps({ ...values, showAppName: false }, saved)).toEqual([
      update('SIGECA', false),
    ]);
  });

  it('uploads a new logo before saving the name', () => {
    const file = png();
    expect(brandingSteps({ ...values, appName: 'Malawi LMIS', logo: file }, saved)).toEqual([
      { kind: 'upload', file },
      update('Malawi LMIS'),
    ]);
  });

  it('removes the logo only when there is one', () => {
    expect(brandingSteps({ ...values, logo: null }, saved)).toEqual([{ kind: 'remove-logo' }]);
    expect(brandingSteps({ ...values, appName: '', logo: null }, unset)).toEqual([]);
  });
});

describe('resetBrandingSteps', () => {
  it('removes the logo, clears the name and shows it again', () => {
    expect(resetBrandingSteps({ ...saved, showAppName: false })).toEqual([
      { kind: 'remove-logo' },
      update(null),
    ]);
  });

  it('asks for nothing when everything is already the default', () => {
    expect(resetBrandingSteps(unset)).toEqual([]);
  });
});

describe('isBrandingDefault', () => {
  it('is true when the built-in name and logo are in use, saved or not', () => {
    expect(isBrandingDefault(unset)).toBe(true);
    expect(isBrandingDefault({ ...unset, appName: 'OpenLMIS' })).toBe(true);
    expect(isBrandingDefault({ ...unset, appName: 'SIGECA' })).toBe(false);
    expect(isBrandingDefault({ ...saved, appName: null })).toBe(false);
    expect(isBrandingDefault({ ...unset, showAppName: false })).toBe(false);
  });
});
