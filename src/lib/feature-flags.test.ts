import { describe, expect, it } from 'vitest';
import { FEATURE_FLAGS, resolveFlag } from '@/lib/feature-flags';
import en from '../../public/locales/en.json';

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

describe('FEATURE_FLAGS', () => {
  it('names and describes every flag, and every option of an enum', () => {
    const keys = new Set(Object.keys(en));
    for (const definition of Object.values(FEATURE_FLAGS)) {
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
