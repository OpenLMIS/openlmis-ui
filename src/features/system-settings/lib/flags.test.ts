import { describe, expect, it } from 'vitest';
import {
  buildFlagOverrides,
  flagSource,
  inheritedFlagValue,
  isFlagsChanged,
  toFlagValues,
} from '@/features/system-settings/lib/flags';

const deployment = { GS1_SCANNING: 'true' };

describe('toFlagValues', () => {
  it("shows what each flag is: the administrator's value, then the deployment's, then the default", () => {
    expect(toFlagValues({ QUANTITY_UNIT_OPTION: 'PACKS' }, deployment)).toEqual({
      BATCH_APPROVE_SCREEN: false,
      DEFAULT_QUANTITY_UNIT: 'DOSES',
      GS1_SCANNING: true,
      QUANTITY_UNIT_OPTION: 'PACKS',
      SHOW_REQUISITION_LESS_ORDER: true,
    });
  });

  it('ignores a stored value of the wrong type', () => {
    expect(toFlagValues({ DEFAULT_QUANTITY_UNIT: 'BOTH' }, {}).DEFAULT_QUANTITY_UNIT).toBe('DOSES');
  });
});

describe('flagSource', () => {
  it('is Changed Here only when the value differs from what the flag would inherit', () => {
    expect(flagSource('GS1_SCANNING', true, deployment)).toBe('deployment');
    expect(flagSource('BATCH_APPROVE_SCREEN', false, deployment)).toBe('default');
    expect(flagSource('BATCH_APPROVE_SCREEN', true, deployment)).toBe('admin');
  });
});

describe('inheritedFlagValue', () => {
  it("is the deployment's value, or the default", () => {
    expect(inheritedFlagValue('GS1_SCANNING', deployment)).toBe(true);
    expect(inheritedFlagValue('QUANTITY_UNIT_OPTION', deployment)).toBe('BOTH');
  });
});

describe('buildFlagOverrides', () => {
  it('stores only the values that differ from what they would inherit', () => {
    const values = { ...toFlagValues({}, deployment), BATCH_APPROVE_SCREEN: true };

    expect(buildFlagOverrides(values, {}, deployment)).toEqual({ BATCH_APPROVE_SCREEN: true });
  });

  it('keeps flags this version does not know', () => {
    expect(buildFlagOverrides(toFlagValues({}, {}), { NEWER_FLAG: 'on' }, {})).toEqual({
      NEWER_FLAG: 'on',
    });
  });
});

describe('isFlagsChanged', () => {
  it('is false for what is already in effect, even when the stored value is invalid', () => {
    const saved = { DEFAULT_QUANTITY_UNIT: 'BOTH', NEWER_FLAG: 'on' };
    expect(isFlagsChanged(toFlagValues(saved, deployment), saved, deployment)).toBe(false);
  });

  it('is true for a change, and for a value put back to what it inherits', () => {
    const saved = { BATCH_APPROVE_SCREEN: true };
    const values = toFlagValues(saved, {});

    expect(isFlagsChanged({ ...values, GS1_SCANNING: true }, saved, {})).toBe(true);
    expect(isFlagsChanged({ ...values, BATCH_APPROVE_SCREEN: false }, saved, {})).toBe(true);
  });
});
