import { describe, expect, it } from 'vitest';
import { toProgramFilter } from '@/features/products/lib/program-filter';

const programs = [
  { id: 'p2', code: 'PRG002', name: 'Essential Meds', active: true },
  { id: 'p1', code: 'PRG001', name: 'Family Planning', active: true },
  { id: 'p4', code: 'PRG004', name: 'EPI', active: false },
];

describe('toProgramFilter', () => {
  it('offers every program by name, sent by code', () => {
    expect(toProgramFilter(programs, undefined)).toEqual({
      value: '',
      options: [
        { value: 'PRG004', label: 'EPI' },
        { value: 'PRG002', label: 'Essential Meds' },
        { value: 'PRG001', label: 'Family Planning' },
      ],
    });
  });

  it('shows a program without a name by its code', () => {
    expect(
      toProgramFilter([{ id: 'p9', code: 'PRG009', name: null, active: true }], undefined).options,
    ).toEqual([{ value: 'PRG009', label: 'PRG009' }]);
  });

  it('picks the program a code in the URL names, ignoring case as the server does', () => {
    expect(toProgramFilter(programs, 'prg001').value).toBe('PRG001');
    expect(toProgramFilter(programs, 'prg001').options).toHaveLength(3);
  });

  it('offers a code the programs do not know, or not yet, so it shows and can be cleared', () => {
    expect(toProgramFilter(undefined, 'PRG001')).toEqual({
      value: 'PRG001',
      options: [{ value: 'PRG001', label: 'PRG001' }],
    });
    expect(toProgramFilter(programs, 'NOPE').options[0]).toEqual({ value: 'NOPE', label: 'NOPE' });
  });
});
