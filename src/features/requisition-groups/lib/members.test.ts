import { describe, expect, it } from 'vitest';
import type { MemberFacility } from '@/features/reference-data/lib/types';
import { memberPage } from '@/features/requisition-groups/lib/members';

const members: MemberFacility[] = ['Zèbre', 'Alpha', 'Éclair'].map((name, index) => ({
  id: String(index),
  code: String(index),
  name,
  enabled: true,
  type: { name: 'Clinic' },
}));
describe('member facilities', () => {
  it('folds case and accents when filtering names', () => {
    expect(memberPage(members, { q: ' ECLAIR ' }).data.map((row) => row.name)).toEqual(['Éclair']);
  });
  it('sorts on a copy with name ties, keeping the draft order', () => {
    expect(memberPage(members, { sort: 'type', dir: 'desc' }).data.map((row) => row.name)).toEqual([
      'Alpha',
      'Éclair',
      'Zèbre',
    ]);
    expect(members[0]?.name).toBe('Zèbre');
  });
  it('slices pages and clamps after removing the last row', () => {
    expect(memberPage(members, { page: 3, size: 1 }).data[0]?.name).toBe('Zèbre');
    expect(memberPage(members.slice(1), { page: 3, size: 1 })).toMatchObject({
      page: 2,
      data: [members[2]],
      total: 2,
    });
    expect(memberPage([], { page: 2 })).toMatchObject({ page: 1, data: [], total: 0 });
  });
});
