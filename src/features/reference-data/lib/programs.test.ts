import { describe, expect, it } from 'vitest';
import { programName } from '@/features/reference-data/lib/programs';

const program = { id: 'p1', code: 'PRG001', active: true };

describe('programName', () => {
  it('names a program by its name', () => {
    expect(programName({ ...program, name: 'Family Planning' })).toBe('Family Planning');
  });

  it('falls back to the code when the name is missing or empty', () => {
    expect(programName({ ...program, name: null })).toBe('PRG001');
    expect(programName({ ...program, name: '' })).toBe('PRG001');
  });
});
