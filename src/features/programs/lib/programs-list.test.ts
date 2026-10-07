import { describe, expect, it } from 'vitest';
import { pageOfPrograms } from '@/features/programs/lib/programs-list';
import type { Program } from '@/features/reference-data/lib/types';

const program = (code: string, name: string | null, active: boolean | null = true): Program => ({
  id: code,
  code,
  name,
  active,
});

const programs = [
  program('PRG003', 'malaria'),
  program('PRG001', 'Family Planning', false),
  program('PRG002', 'Essential Meds'),
  program('PRG004', null),
];

describe('pageOfPrograms', () => {
  it('sorts by name by default, ignoring case, with a nameless program by its code', () => {
    expect(pageOfPrograms(programs, {}).content.map((item) => item.code)).toEqual([
      'PRG002',
      'PRG001',
      'PRG003',
      'PRG004',
    ]);
  });

  it('sorts by code or status, either way', () => {
    expect(
      pageOfPrograms(programs, { sort: 'code', dir: 'desc' }).content.map((item) => item.code),
    ).toEqual(['PRG004', 'PRG003', 'PRG002', 'PRG001']);
    expect(pageOfPrograms(programs, { sort: 'active' }).content[0]?.code).toBe('PRG001');
  });

  it('cuts the page asked for and counts every program', () => {
    expect(pageOfPrograms(programs, { page: 2, size: 10 })).toMatchObject({
      content: [],
      totalElements: 4,
      totalPages: 1,
    });
    const first = pageOfPrograms([...programs, ...programs, ...programs], { size: 10 });
    expect(first.content).toHaveLength(10);
    expect(first.totalPages).toBe(2);
  });
});
