import { describe, expect, it } from 'vitest';
import { FEATURE_FLAGS, resolveFlag } from '@/lib/feature-flags';

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

  it('treats an unset deployment variable as absent', () => {
    expect(resolveFlag('GS1_SCANNING', {}, { GS1_SCANNING: '' })).toEqual({
      value: false,
      source: 'default',
    });
  });
});
