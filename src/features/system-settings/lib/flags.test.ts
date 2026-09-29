import { describe, expect, it } from 'vitest';
import {
  buildFlagOverrides,
  isFlagsChanged,
  toFlagDraft,
} from '@/features/system-settings/lib/flags';

describe('toFlagDraft', () => {
  it('keeps the administrator values this version knows, of the right type', () => {
    expect(
      toFlagDraft({
        BATCH_APPROVE_SCREEN: true,
        QUANTITY_UNIT_OPTION: 'PACKS',
        GS1_SCANNING: 'yes',
        DEFAULT_QUANTITY_UNIT: 'BOTH',
        NEWER_FLAG: true,
      }),
    ).toEqual({ BATCH_APPROVE_SCREEN: true, QUANTITY_UNIT_OPTION: 'PACKS' });
  });
});

describe('buildFlagOverrides', () => {
  it('sends the draft and keeps keys this version does not know', () => {
    expect(
      buildFlagOverrides({ GS1_SCANNING: true }, { NEWER_FLAG: 'on', BATCH_APPROVE_SCREEN: true }),
    ).toEqual({ NEWER_FLAG: 'on', GS1_SCANNING: true });
  });

  it('drops a flag that was reset', () => {
    expect(buildFlagOverrides({}, { BATCH_APPROVE_SCREEN: true })).toEqual({});
  });

  it('keeps a value that matches the default, since the administrator chose it', () => {
    expect(buildFlagOverrides({ SHOW_REQUISITION_LESS_ORDER: true }, {})).toEqual({
      SHOW_REQUISITION_LESS_ORDER: true,
    });
  });
});

describe('isFlagsChanged', () => {
  it('is false when the draft is what is saved', () => {
    const saved = { BATCH_APPROVE_SCREEN: true, NEWER_FLAG: 'on' };
    expect(isFlagsChanged(toFlagDraft(saved), saved)).toBe(false);
  });

  it('is true for a new, changed or reset value', () => {
    expect(isFlagsChanged({ GS1_SCANNING: true }, {})).toBe(true);
    expect(isFlagsChanged({ BATCH_APPROVE_SCREEN: false }, { BATCH_APPROVE_SCREEN: true })).toBe(
      true,
    );
    expect(isFlagsChanged({}, { BATCH_APPROVE_SCREEN: true })).toBe(true);
  });
});
