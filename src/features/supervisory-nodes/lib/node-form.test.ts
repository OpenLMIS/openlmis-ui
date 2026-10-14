import { describe, expect, it } from 'vitest';
import {
  childOptions,
  nodeFormSchema,
  parentOptions,
  partnerOptions,
  toDraft,
  toNodeBody,
} from '@/features/supervisory-nodes/lib/node-form';
import type { SupervisoryNode } from '@/features/supervisory-nodes/lib/types';

const node = (id: string): SupervisoryNode => ({
  id,
  code: id,
  name: id,
  childNodes: [],
  partnerNodes: [],
});

describe('node draft', () => {
  it('requires code and name after trimming', () => {
    expect(
      nodeFormSchema.safeParse({ ...toDraft(node('self')), code: ' ', name: ' ' }).success,
    ).toBe(false);
  });

  it('offers only legacy allowed nodes in name order with facility labels', () => {
    const draft = {
      ...toDraft(node('self')),
      parentId: 'parent',
      children: [{ id: 'child' }],
      partners: [{ id: 'partner' }],
    };
    const nodes = ['self', 'partner', 'parent', 'child', 'available'].map(node);
    nodes[4].facility = { id: 'f' };
    const names = new Map([['f', 'Facility']]);
    expect(childOptions(nodes, 'self', draft.children, draft.parentId, names)).toEqual([
      { value: 'available', label: 'available (Facility)' },
      { value: 'partner', label: 'partner' },
    ]);
    expect(parentOptions(nodes, 'self', draft.children).map(({ value }) => value)).toEqual([
      'available',
      'parent',
      'partner',
    ]);
    expect(partnerOptions(nodes, 'self', draft.partners).map(({ value }) => value)).toEqual([
      'available',
      'child',
      'parent',
    ]);
  });

  it('merges edits with the reread without undoing concurrent changes or duplicating refs', () => {
    const saved = {
      ...node('self'),
      description: 'Original description',
      facility: { id: 'f' },
      parentNode: { id: 'old-parent' },
      childNodes: [{ id: 'removed' }, { id: 'kept' }],
      partnerNodes: [{ id: 'removed-partner' }],
    };
    const latest = {
      ...saved,
      name: 'Concurrent name',
      description: 'Concurrent description',
      customServerField: 'preserved',
      parentNode: { id: 'new-parent' },
      requisitionGroup: { id: 'group' },
      partnerNodeOf: { id: 'owner' },
      extraData: { custom: true },
      childNodes: [{ id: 'removed' }, { id: 'kept' }, { id: 'concurrent' }, { id: 'added' }],
      partnerNodes: [{ id: 'removed-partner' }, { id: 'concurrent-partner' }],
    };
    const draft = {
      ...toDraft(saved),
      code: ' edited ',
      facilityId: null,
      description: '',
      children: [{ id: 'kept' }, { id: 'added' }],
      partners: [{ id: 'added-partner' }],
    };
    expect(toNodeBody(latest, saved, draft)).toEqual({
      ok: true,
      body: {
        ...latest,
        code: 'edited',
        description: null,
        facility: null,
        childNodes: [{ id: 'kept' }, { id: 'concurrent' }, { id: 'added' }],
        partnerNodes: [{ id: 'concurrent-partner' }, { id: 'added-partner' }],
      },
    });
  });

  it.each(['self', 'child'])('refuses a merged parent of %s', (parent) => {
    const saved = node('self');
    const latest = { ...saved, parentNode: { id: parent }, childNodes: [{ id: 'child' }] };
    expect(toNodeBody(latest, saved, toDraft(saved))).toEqual({ ok: false });
  });
});
