import { describe, expect, it } from 'vitest';
import { toNodeRows } from '@/features/supervisory-nodes/lib/node-rows';
import type { SupervisoryNode } from '@/features/supervisory-nodes/lib/types';

const node = (id: string, partnerIds: string[] = []): SupervisoryNode => ({
  id,
  code: id.toUpperCase(),
  name: `Node ${id}`,
  childNodes: [],
  partnerNodes: partnerIds.map((id) => ({ id })),
});

describe('toNodeRows', () => {
  it('resolves no, one and multiple partners in the reference order, keeping unresolved ones', () => {
    const rows = toNodeRows(
      [node('none'), node('one', ['p1']), node('many', ['p2', 'missing', 'p1'])],
      [],
      [node('p1'), node('p2')],
    );

    expect(rows.map((row) => row.partners)).toEqual([
      [],
      [{ id: 'p1', name: 'Node p1' }],
      [
        { id: 'p2', name: 'Node p2' },
        { id: 'missing', name: '' },
        { id: 'p1', name: 'Node p1' },
      ],
    ]);
  });

  it('uses the node facility for its facility and zone names and counts child references', () => {
    const rows = toNodeRows(
      [
        { ...node('with'), facility: { id: 'f2' }, childNodes: [{ id: 'c1' }, { id: 'c2' }] },
        node('without'),
      ],
      [
        {
          id: 'f1',
          name: 'Other Facility',
          geographicZone: { id: 'z1', code: 'Z1', name: 'Other Zone', level: { name: 'District' } },
        },
        {
          id: 'f2',
          name: 'Own Facility',
          geographicZone: { id: 'z2', code: 'Z2', name: 'Own Zone', level: { name: 'District' } },
        },
      ],
      [],
    );

    expect(rows).toEqual([
      {
        id: 'with',
        code: 'WITH',
        name: 'Node with',
        facilityName: 'Own Facility',
        zoneName: 'Own Zone',
        childCount: 2,
        partners: [],
      },
      {
        id: 'without',
        code: 'WITHOUT',
        name: 'Node without',
        facilityName: null,
        zoneName: null,
        childCount: 0,
        partners: [],
      },
    ]);
  });
});
