import { describe, expect, it } from 'vitest';
import {
  buildFlagOverrides,
  flagSource,
  inheritedFlagValue,
  isFlagsChanged,
  toFlagDraft,
} from '@/features/system-settings/lib/flags';

const deployment = { GS1_SCANNING: 'true' };

describe('toFlagDraft', () => {
  it("shows what each flag is: the administrator's value, then the deployment's, then the default", () => {
    expect(toFlagDraft({ QUANTITY_UNIT_OPTION: 'PACKS' }, deployment)).toEqual({
      BATCH_APPROVE_SCREEN: { value: false, overridden: false },
      DEFAULT_QUANTITY_UNIT: { value: 'DOSES', overridden: false },
      GS1_SCANNING: { value: true, overridden: false },
      QUANTITY_UNIT_OPTION: { value: 'PACKS', overridden: true },
      SHOW_REQUISITION_LESS_ORDER: { value: true, overridden: false },
    });
  });

  it('marks a stored value as an override even when it matches what the flag inherits', () => {
    expect(toFlagDraft({ GS1_SCANNING: true }, deployment).GS1_SCANNING).toEqual({
      value: true,
      overridden: true,
    });
  });

  it('ignores a stored value of the wrong type', () => {
    expect(toFlagDraft({ DEFAULT_QUANTITY_UNIT: 'BOTH' }, {}).DEFAULT_QUANTITY_UNIT).toEqual({
      value: 'DOSES',
      overridden: false,
    });
  });
});

describe('flagSource', () => {
  it('is Changed Here for an override, otherwise where the inherited value comes from', () => {
    expect(flagSource('GS1_SCANNING', { value: true, overridden: false }, deployment)).toBe(
      'deployment',
    );
    expect(flagSource('GS1_SCANNING', { value: true, overridden: true }, deployment)).toBe('admin');
    expect(flagSource('BATCH_APPROVE_SCREEN', { value: false, overridden: false }, {})).toBe(
      'default',
    );
  });
});

describe('inheritedFlagValue', () => {
  it("is the deployment's value, or the default", () => {
    expect(inheritedFlagValue('GS1_SCANNING', deployment)).toBe(true);
    expect(inheritedFlagValue('QUANTITY_UNIT_OPTION', deployment)).toBe('BOTH');
  });
});

describe('buildFlagOverrides', () => {
  it('stores the overridden flags only', () => {
    const draft = {
      ...toFlagDraft({}, deployment),
      BATCH_APPROVE_SCREEN: { value: true, overridden: true },
    };

    expect(buildFlagOverrides(draft, {})).toEqual({ BATCH_APPROVE_SCREEN: true });
  });

  it('drops an override that was reset', () => {
    const saved = { GS1_SCANNING: true };
    const draft = {
      ...toFlagDraft(saved, deployment),
      GS1_SCANNING: { value: true, overridden: false },
    };

    expect(buildFlagOverrides(draft, saved)).toEqual({});
  });

  it('keeps flags this version does not know', () => {
    expect(buildFlagOverrides(toFlagDraft({}, {}), { NEWER_FLAG: 'on' })).toEqual({
      NEWER_FLAG: 'on',
    });
  });
});

describe('isFlagsChanged', () => {
  it('is false for what is stored, including an override equal to what it inherits', () => {
    const saved = { DEFAULT_QUANTITY_UNIT: 'BOTH', GS1_SCANNING: true, NEWER_FLAG: 'on' };
    expect(isFlagsChanged(toFlagDraft(saved, deployment), saved, deployment)).toBe(false);
  });

  it('is true for a new value and for a reset override', () => {
    const saved = { GS1_SCANNING: true };
    const draft = toFlagDraft(saved, deployment);

    expect(
      isFlagsChanged(
        { ...draft, BATCH_APPROVE_SCREEN: { value: true, overridden: true } },
        saved,
        deployment,
      ),
    ).toBe(true);
    expect(
      isFlagsChanged(
        { ...draft, GS1_SCANNING: { value: true, overridden: false } },
        saved,
        deployment,
      ),
    ).toBe(true);
  });
});
