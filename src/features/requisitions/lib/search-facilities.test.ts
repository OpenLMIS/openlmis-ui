import { expect, it } from 'vitest';
import type { RequisitionGroup } from '@/features/reference-data/lib/types';
import {
  groupIdsOf,
  partnerNodeIds,
  searchFacilityOptions,
} from '@/features/requisitions/lib/search-facilities';

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

it('derives groups from the partner nodes rather than the viewer nodes', () => {
  const nodes = [
    {
      id: 'viewer',
      code: 'V',
      name: 'Viewer',
      partnerNodeOf: { id: 'partner' },
      requisitionGroup: { id: 'wrong' },
    },
    { id: 'duplicate', code: 'D', name: 'Duplicate', partnerNodeOf: { id: 'partner' } },
    { id: 'unlinked', code: 'U', name: 'Unlinked', requisitionGroup: { id: 'also-wrong' } },
  ];
  const partners = [
    { id: 'partner', code: 'P', name: 'Partner', requisitionGroup: { id: 'correct' } },
  ];
  expect(partnerNodeIds(nodes)).toEqual(['partner']);
  expect(groupIdsOf(partners)).toEqual(['correct']);
});
