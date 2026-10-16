import { expect, it } from 'vitest';
import {
  canonicalSupplyPartner,
  toSupplyPartnerBody,
  toSupplyPartnerDraft,
} from '@/features/supply-partners/lib/supply-partner-form';
import type { SupplyPartner } from '@/features/supply-partners/lib/types';

const saved: SupplyPartner = {
  id: 'sp',
  code: 'SUP',
  name: 'Supplier',
  associations: Array.from({ length: 12 }, (_, i) => ({
    id: `old-${i}`,
    program: { id: `p${i}` },
    supervisoryNode: { id: 'node' },
    facilities: [{ id: 'f2', href: 'ignored' }, { id: 'f1' }],
    orderables: [{ id: 'o2' }, { id: 'o1' }],
  })),
};

it('copies every association into the draft and serializes only refs with the saved id and code', () => {
  const draft = toSupplyPartnerDraft(saved);
  draft.name = 'Edited';
  draft.associations[11].facilityIds.push('f3');
  const body = toSupplyPartnerBody(saved, draft);
  expect(body).toEqual({
    id: 'sp',
    code: 'SUP',
    name: 'Edited',
    associations: saved.associations.map((item, i) => ({
      program: { id: item.program.id },
      supervisoryNode: { id: 'node' },
      facilities: [...(i === 11 ? ['f2', 'f1', 'f3'] : ['f2', 'f1'])].map((id) => ({ id })),
      orderables: [{ id: 'o2' }, { id: 'o1' }],
    })),
  });
  expect(saved.associations[11].facilities).toHaveLength(2);
});

it('ignores regenerated association ids, hrefs and ordering, but detects changed name or membership', () => {
  const reordered = structuredClone(saved);
  reordered.associations.reverse();
  for (const item of reordered.associations) {
    item.id = `new-${item.id}`;
    item.facilities.reverse();
    item.orderables.reverse();
    item.facilities[0].href = 'new';
  }
  expect(canonicalSupplyPartner(reordered)).toBe(canonicalSupplyPartner(saved));
  reordered.name = 'Another supplier';
  expect(canonicalSupplyPartner(reordered)).not.toBe(canonicalSupplyPartner(saved));
  reordered.name = saved.name;
  reordered.associations[0].orderables.pop();
  expect(canonicalSupplyPartner(reordered)).not.toBe(canonicalSupplyPartner(saved));
});
