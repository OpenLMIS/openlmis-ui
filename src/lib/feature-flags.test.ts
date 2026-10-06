import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_APP_CONFIGURATION,
  parseAppConfiguration,
  setAppConfiguration,
} from '@/lib/app-configuration';
import {
  ADMIN_FLAG_KEYS,
  FEATURE_FLAGS,
  type FeatureFlagDefinition,
  getFlag,
  resolveFlag,
  useFlag,
} from '@/lib/feature-flags';
import { loadRuntimeConfig } from '@/lib/runtime-config';
import en from '../../public/locales/en.json';

afterEach(() => vi.unstubAllGlobals());

describe('resolveFlag', () => {
  it('uses the default when nobody set the flag', () => {
    expect(resolveFlag('BATCH_APPROVE_SCREEN', {}, {})).toEqual({
      value: FEATURE_FLAGS.BATCH_APPROVE_SCREEN.default,
      source: 'default',
    });
  });

  it('prefers the deployment over the default', () => {
    expect(resolveFlag('BATCH_APPROVE_SCREEN', {}, { BATCH_APPROVE_SCREEN: 'true' })).toEqual({
      value: true,
      source: 'deployment',
    });
  });

  it('prefers the administrator over the deployment', () => {
    expect(
      resolveFlag(
        'QUANTITY_UNIT_OPTION',
        { QUANTITY_UNIT_OPTION: 'PACKS' },
        { QUANTITY_UNIT_OPTION: 'DOSES' },
      ),
    ).toEqual({ value: 'PACKS', source: 'admin' });
  });

  it('reads false from the deployment, not just true', () => {
    expect(
      resolveFlag('SHOW_REQUISITION_LESS_ORDER', {}, { SHOW_REQUISITION_LESS_ORDER: 'false' }),
    ).toEqual({ value: false, source: 'deployment' });
  });

  it('skips a layer whose value has the wrong type', () => {
    expect(resolveFlag('GS1_SCANNING', { GS1_SCANNING: 'yes' }, { GS1_SCANNING: 'true' })).toEqual({
      value: true,
      source: 'deployment',
    });
  });

  it('skips an enum value outside its options', () => {
    expect(resolveFlag('DEFAULT_QUANTITY_UNIT', { DEFAULT_QUANTITY_UNIT: 'BOTH' }, {})).toEqual({
      value: 'DOSES',
      source: 'default',
    });
  });

  it('reads a deployment-only flag from the deployment alone, so Settings cannot lock itself out', () => {
    expect(resolveFlag('SYSTEM_SETTINGS', { SYSTEM_SETTINGS: true }, {})).toEqual({
      value: false,
      source: 'default',
    });
    expect(
      resolveFlag('SYSTEM_SETTINGS', { SYSTEM_SETTINGS: false }, { SYSTEM_SETTINGS: 'true' }),
    ).toEqual({ value: true, source: 'deployment' });
  });

  it('treats an unset deployment variable as absent', () => {
    expect(resolveFlag('GS1_SCANNING', {}, { GS1_SCANNING: '' })).toEqual({
      value: false,
      source: 'default',
    });
  });
});

describe('ADMIN_FLAG_KEYS', () => {
  it('leaves deployment-only flags off the list an administrator can change', () => {
    expect(ADMIN_FLAG_KEYS).not.toContain('SYSTEM_SETTINGS');
    expect(ADMIN_FLAG_KEYS).toContain('GS1_SCANNING');
  });
});

describe('FEATURE_FLAGS', () => {
  it('names and describes every flag, and every option of an enum', () => {
    const keys = new Set(Object.keys(en));
    const definitions: FeatureFlagDefinition[] = Object.values(FEATURE_FLAGS);
    for (const definition of definitions) {
      expect(keys).toContain(definition.labelKey);
      expect(keys).toContain(definition.descriptionKey);
      expect(keys).toContain(definition.usedByKey);
      if (definition.type === 'enum') {
        for (const option of definition.options) {
          expect(keys).toContain(definition.optionKeys[option]);
        }
      }
    }
  });
});

describe('getFlag and useFlag', () => {
  it("read the administrator's value, then the default", () => {
    expect(getFlag('BATCH_APPROVE_SCREEN')).toBe(false);

    setAppConfiguration(parseAppConfiguration({ featureFlags: { BATCH_APPROVE_SCREEN: true } }));
    const { result } = renderHook(() => useFlag('BATCH_APPROVE_SCREEN'));

    expect(getFlag('BATCH_APPROVE_SCREEN')).toBe(true);
    expect(result.current).toBe(true);
    setAppConfiguration(DEFAULT_APP_CONFIGURATION);
  });

  it('follow deployment flags that arrive after the app started', async () => {
    const { result } = renderHook(() => useFlag('GS1_SCANNING'));
    expect(result.current).toBe(false);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ featureFlags: { GS1_SCANNING: 'true' } })),
        ),
    );

    await loadRuntimeConfig();

    await waitFor(() => expect(result.current).toBe(true));
  });
});
