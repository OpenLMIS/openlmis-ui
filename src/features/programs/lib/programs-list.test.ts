import { describe, expect, it } from 'vitest';
import { sortPrograms, withSavedProgram } from '@/features/programs/lib/programs-list';
import type { Program } from '@/features/reference-data/lib/types';

const program = (id: string, code: string, name: string, active: boolean | null): Program => ({
  id,
  code,
  name,
  active,
});

const programs = [
  program('1', 'PRG002', 'Essential Meds', true),
  program('2', 'PRG001', 'family Planning', true),
  program('3', 'PRG007', 'TB', false),
  program('4', 'PRG004', 'ARV', null),
];

const names = (list: Program[]) => list.map((item) => item.name);

describe('sortPrograms', () => {
  it('sorts by name ignoring case, as legacy lists them', () => {
    expect(names(sortPrograms(programs, 'name', false))).toEqual([
      'ARV',
      'Essential Meds',
      'family Planning',
      'TB',
    ]);
  });

  it('sorts by code, descending when asked', () => {
    expect(names(sortPrograms(programs, 'code', true))).toEqual([
      'TB',
      'ARV',
      'Essential Meds',
      'family Planning',
    ]);
  });

  it('sorts active programs first, a missing flag counting as inactive, then by name', () => {
    expect(names(sortPrograms(programs, 'active', false))).toEqual([
      'Essential Meds',
      'family Planning',
      'ARV',
      'TB',
    ]);
  });

  it('leaves the given list alone', () => {
    const copy = [...programs];
    sortPrograms(programs, 'name', true);
    expect(programs).toEqual(copy);
  });
});

describe('withSavedProgram', () => {
  it('replaces an edited program', () => {
    const list = withSavedProgram(programs, { ...programs[2], name: 'Tuberculosis' } as Program);

    expect(list.find((item) => item.id === '3')?.name).toBe('Tuberculosis');
    expect(list).toHaveLength(4);
  });

  it('adds a new program', () => {
    expect(withSavedProgram(programs, program('5', 'PRG009', 'Malaria', true)).at(-1)?.id).toBe(
      '5',
    );
  });
});
