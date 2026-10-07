import { describe, expect, it } from 'vitest';
import { homeStockPrograms } from '@/lib/stock-programs';

const named = (id: string, name: string | null = id, code = id) => ({ id, name, code });
const homeFacility = {
  id: 'home',
  supportedPrograms: [named('fp'), named('em'), named('not-mine')],
};
const programs = [named('fp', 'Family Planning'), named('em', 'Essential Meds'), named('tb')];
const grants = [
  { facilityId: 'home', programId: 'fp' },
  { facilityId: 'home', programId: 'em' },
  { facilityId: 'home', programId: 'not-mine' },
  { facilityId: 'home', programId: 'tb' },
];

describe('homeStockPrograms', () => {
  it('intersects supported programs, user programs and exact home grants', () => {
    expect(homeStockPrograms({ homeFacility, programs, grants })).toEqual([
      programs[1],
      programs[0],
    ]);
  });

  it('does not count a grant at another facility', () => {
    expect(
      homeStockPrograms({
        homeFacility,
        programs,
        grants: [{ facilityId: 'away', programId: 'fp' }],
      }),
    ).toEqual([]);
  });

  it('offers nothing without a home facility or supported programs', () => {
    expect(homeStockPrograms({ homeFacility: null, programs, grants })).toEqual([]);
    expect(homeStockPrograms({ homeFacility: undefined, programs, grants })).toEqual([]);
    expect(homeStockPrograms({ homeFacility: { id: 'home' }, programs, grants })).toEqual([]);
  });

  it('offers nothing without a scoped grant or the user program', () => {
    expect(homeStockPrograms({ homeFacility, programs, grants: [] })).toEqual([]);
    expect(homeStockPrograms({ homeFacility, programs: [], grants })).toEqual([]);
  });

  it('sorts by name with code as fallback and tie breaker, without mutating the sources', () => {
    const source = [named('fp', 'Beta', 'B'), named('em', null, 'Alpha'), named('tb', 'Beta', 'A')];
    const home = { id: 'home', supportedPrograms: source };
    const result = homeStockPrograms({ homeFacility: home, programs: source, grants });

    expect(result.map((program) => program.id)).toEqual(['em', 'tb', 'fp']);
    expect(source.map((program) => program.id)).toEqual(['fp', 'em', 'tb']);
  });

  it('lists a program only once when grants are repeated', () => {
    expect(
      homeStockPrograms({ homeFacility, programs, grants: [...grants, ...grants] }),
    ).toHaveLength(2);
  });
});
