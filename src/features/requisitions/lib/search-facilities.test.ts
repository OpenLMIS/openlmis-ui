import { expect, it } from 'vitest';
import type { RequisitionGroup } from '@/features/reference-data/lib/types';
import { searchFacilityOptions } from '@/features/requisitions/lib/search-facilities';

it('merges partner facilities after grants, keeps grant programs and sorts names ignoring case', () => {
  const options = searchFacilityOptions(
    [{ right: 'REQUISITION_VIEW', facilityId: 'b', programId: 'p' }],
    [{ id: 'b', code: 'B', name: 'beta', active: true }],
    [{ id: 'p', name: 'Program' }],
    [
      {
        memberFacilities: [
          {
            id: 'b',
            code: 'wrong',
            name: 'wrong',
            supportedPrograms: [{ id: 'other', name: 'Other' }],
          },
          {
            id: 'a',
            code: 'A',
            name: 'Alpha',
            supportedPrograms: [{ id: 'partner', name: 'Partner' }],
          },
          { id: 'z', code: 'Z', name: 'zeta', supportedPrograms: [] },
        ],
      },
    ] as RequisitionGroup[],
  );
  expect(options.map(({ id, programs }) => ({ id, programs }))).toEqual([
    { id: 'a', programs: [{ id: 'partner', name: 'Partner' }] },
    { id: 'b', programs: [{ id: 'p', name: 'Program' }] },
    { id: 'z', programs: [] },
  ]);
});
