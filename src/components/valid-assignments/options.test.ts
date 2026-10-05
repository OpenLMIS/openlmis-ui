import { describe, expect, it } from 'vitest';
import { toFacilityOption, toProgramOption } from '@/components/valid-assignments/options';

describe('toProgramOption', () => {
  it('names a program, or uses its code when it has no name', () => {
    expect(toProgramOption({ id: 'p1', code: 'PRG001', name: 'EPI' })).toEqual({
      value: 'p1',
      label: 'EPI',
    });
    expect(toProgramOption({ id: 'p2', code: 'PRG002', name: '' })).toEqual({
      value: 'p2',
      label: 'PRG002',
    });
  });
});

describe('toFacilityOption', () => {
  it('names a facility, with its code after it', () => {
    expect(toFacilityOption({ id: 'f1', code: 'HC01', name: 'Comfort Health Clinic' })).toEqual({
      value: 'f1',
      label: 'Comfort Health Clinic',
      description: 'HC01',
    });
  });
});
