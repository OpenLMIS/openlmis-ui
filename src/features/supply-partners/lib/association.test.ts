import { describe, expect, it } from 'vitest';
import {
  associationKey,
  availablePartnerNodes,
  availablePrograms,
  pruneAssociationProducts,
} from '@/features/supply-partners/lib/association';
import { matchesNameOrCode } from '@/features/supply-partners/lib/search';

const association = {
  programId: 'p1',
  supervisoryNodeId: 'n1',
  facilityIds: ['f1', 'f2'],
  orderableIds: ['shared', 'only-f1', 'inactive'],
};
const nodes = [
  { id: 'n1', code: 'N1', name: 'Partner one', partnerNodeOf: { id: 'parent' } },
  { id: 'n2', code: 'N2', name: 'Partner two', partnerNodeOf: { id: 'parent' } },
  { id: 'n3', code: 'N3', name: 'Ordinary', partnerNodeOf: null },
];

describe('association membership', () => {
  it('offers partner nodes and programs excluding used pairs while retaining an edited pair', () => {
    expect(associationKey(association)).toBe('p1:n1');
    const programs = [
      { id: 'p1', code: 'P1', name: 'Program one', active: true },
      { id: 'p2', code: 'P2', name: 'Program two', active: true },
    ];
    expect(
      [
        availablePrograms(programs, 'n1', [association]),
        availablePrograms(programs, 'n2', [association]),
        availablePrograms(programs, 'n1', [association], 'p1:n1'),
      ].map((offered) => offered.map(({ id }) => id)),
    ).toEqual([['p2'], ['p1', 'p2'], ['p1', 'p2']]);

    expect(availablePartnerNodes(nodes, 'p1', [association]).map(({ id }) => id)).toEqual(['n2']);
    expect(availablePartnerNodes(nodes, 'p2', [association]).map(({ id }) => id)).toEqual([
      'n1',
      'n2',
    ]);
    expect(availablePartnerNodes(nodes, 'p1', [association], 'p1:n1').map(({ id }) => id)).toEqual([
      'n1',
      'n2',
    ]);
  });

  it('keeps overlapping approvals and reports every pruned product without mutating the draft', () => {
    expect(pruneAssociationProducts(association, ['f2'], ['shared', 'only-f2'])).toEqual({
      association: { ...association, facilityIds: ['f2'], orderableIds: ['shared'] },
      removedOrderableIds: ['only-f1', 'inactive'],
    });
    expect(association.orderableIds).toEqual(['shared', 'only-f1', 'inactive']);
    expect(pruneAssociationProducts(association, [], ['shared'])).toEqual({
      association: { ...association, facilityIds: [], orderableIds: [] },
      removedOrderableIds: association.orderableIds,
    });
  });
});

it('matches names containing or codes beginning with search text, without case sensitivity', () => {
  expect(matchesNameOrCode({ name: 'Oral Rehydration', code: 'EM-01' }, 'HYDR')).toBe(true);
  expect(matchesNameOrCode({ name: null, code: 'EM-01' }, 'em')).toBe(true);
  expect(matchesNameOrCode({ name: null, code: 'EM-01' }, '01')).toBe(false);
  expect(matchesNameOrCode({ name: null, code: 'EM-01' }, '')).toBe(true);
});
