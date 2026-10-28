import { expect, it } from 'vitest';
import {
  applyRequisitionDraft,
  buildRequisitionDraft,
  canSkipLine,
  rebaseRequisitionDraft,
} from '@/features/requisitions/lib/draft';
import { column, line, record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

function recordLine(values: Parameters<typeof line>[0] = {}) {
  return {
    ...line(values),
    orderable: { id: 'product', versionNumber: 1 },
    approvedProduct: { id: 'approved', versionNumber: 1 },
  };
}

const base = {
  ...record(),
  template: {
    columnsMap: { requestedQuantity: column('requestedQuantity', 0, { source: 'USER_INPUT' }) },
  },
  id: 'r',
  facility: { id: 'f' },
  processingPeriod: { id: 'period' },
  requisitionLineItems: [recordLine({ id: 'a' }), recordLine({ id: 'b' })],
} as RequisitionRecord;
it('applies edits, additions, removals and header values without changing the base', () => {
  const draft = buildRequisitionDraft(base);
  draft.lines.a = { requestedQuantity: '١٢' };
  draft.addedLines.push({
    ...recordLine({ id: 'c' }),
    orderable: { id: 'p', versionNumber: 1 },
    approvedProduct: { id: 'approved', versionNumber: 1 },
  });
  draft.removedLineIds.push('b');
  draft.draftStatusMessage = 'Comment';
  draft.datePhysicalStockCountCompleted = '2026-10-28';
  expect(applyRequisitionDraft(base, draft)).toMatchObject({
    draftStatusMessage: 'Comment',
    datePhysicalStockCountCompleted: '2026-10-28',
    requisitionLineItems: [{ id: 'a', requestedQuantity: 12 }, { id: 'c' }],
  });
  expect(base.requisitionLineItems).toHaveLength(2);
  expect(base.requisitionLineItems[0].requestedQuantity).toBeUndefined();
});
it('allows skip for zero and ignores boolean, hidden and calculated cells', () => {
  const template = {
    columnsMap: {
      requestedQuantity: column('requestedQuantity', 0, { source: 'USER_INPUT' }),
      skipped: column('skipped', 1, {
        source: 'USER_INPUT',
        columnDefinition: { columnType: 'BOOLEAN' },
      }),
      stockOnHand: column('stockOnHand'),
      remarks: column('remarks', 2, { source: 'USER_INPUT', isDisplayed: false }),
    },
  };
  expect(
    canSkipLine(
      recordLine({ requestedQuantity: 0, skipped: true, stockOnHand: 10, remarks: 'hidden' }),
      template,
      { tab: 'fullSupply', status: 'INITIATED' },
    ),
  ).toBe(true);
  expect(
    canSkipLine(recordLine({ requestedQuantity: 1 }), template, {
      tab: 'fullSupply',
      status: 'INITIATED',
    }),
  ).toBe(false);
});
it('treats zero in a numeric text editor as empty while retaining text content', () => {
  const template = {
    columnsMap: {
      requestedQuantity: column('requestedQuantity', 0, {
        source: 'USER_INPUT',
        columnDefinition: { columnType: 'NUMERIC' },
      }),
      requestedQuantityExplanation: column('requestedQuantityExplanation', 1, {
        source: 'USER_INPUT',
        columnDefinition: { columnType: 'TEXT' },
      }),
    },
  };
  expect(
    canSkipLine({ requestedQuantity: '٠' }, template, { tab: 'fullSupply', status: 'INITIATED' }),
  ).toBe(true);
  expect(
    canSkipLine({ requestedQuantityExplanation: '0' }, template, {
      tab: 'fullSupply',
      status: 'INITIATED',
    }),
  ).toBe(false);
});

it('starts with no overrides and rebases edits over the server response without stale fields or additions', () => {
  const original = {
    ...base,
    template: {
      columnsMap: {
        requestedQuantity: column('requestedQuantity', 0, { source: 'USER_INPUT' }),
        stockOnHand: column('stockOnHand'),
      },
    },
  };
  const draft = buildRequisitionDraft(original);
  expect(draft.lines).toEqual({});
  draft.lines.a = { requestedQuantity: '7' };
  draft.addedLines = [
    {
      ...{
        ...recordLine({ id: 'server-c', requestedQuantity: 3 }),
        orderable: { id: 'new-product', versionNumber: 1 },
      },
      orderable: { id: 'new-product', versionNumber: 1 },
    },
  ];
  draft.removedLineIds = ['b'];
  const response = {
    ...original,
    requisitionLineItems: [
      recordLine({ id: 'a', requestedQuantity: 5, stockOnHand: 20 }),
      {
        ...recordLine({ id: 'server-c', requestedQuantity: 3 }),
        orderable: { id: 'new-product', versionNumber: 1 },
      },
    ],
  };
  const rebased = rebaseRequisitionDraft(response, draft);
  expect(rebased).toMatchObject({
    lines: { a: { requestedQuantity: '7' } },
    addedLines: [],
    removedLineIds: [],
  });
  expect(applyRequisitionDraft(response, rebased).requisitionLineItems).toMatchObject([
    { id: 'a', requestedQuantity: 7, stockOnHand: 20 },
    { id: 'server-c', requestedQuantity: 3 },
  ]);
});
it('only retains changed editable values from a saved line', () => {
  const original = {
    ...base,
    template: {
      columnsMap: {
        requestedQuantity: column('requestedQuantity', 0, { source: 'USER_INPUT' }),
        stockOnHand: column('stockOnHand'),
      },
    },
    requisitionLineItems: [recordLine({ id: 'a', requestedQuantity: 5, stockOnHand: 10 })],
  };
  const draft = buildRequisitionDraft(original);
  draft.lines.a = { requestedQuantity: '5', stockOnHand: 99 };
  expect(rebaseRequisitionDraft(original, draft).lines).toEqual({});
});
it('uses only the compiled columns for skip eligibility in the current tab and status', () => {
  const template = {
    columnsMap: {
      beginningBalance: column('beginningBalance', 0, { source: 'USER_INPUT' }),
      requestedQuantity: column('requestedQuantity', 1, { source: 'USER_INPUT' }),
      remarks: column('remarks', 2, { source: 'USER_INPUT' }),
    },
  };
  const values = { beginningBalance: 5, remarks: 'approval only' };
  expect(canSkipLine(values, template, { tab: 'nonFullSupply', status: 'INITIATED' })).toBe(true);
  expect(
    canSkipLine(values, template, { tab: 'fullSupply', status: 'INITIATED', emergency: true }),
  ).toBe(true);
  expect(canSkipLine(values, template, { tab: 'nonFullSupply', status: 'AUTHORIZED' })).toBe(false);
});

it('does not resurrect an unsaved added line removed before Sync', () => {
  const draft = buildRequisitionDraft(base);
  draft.addedLines = [{ ...recordLine({ id: 'c' }), orderable: { id: 'p', versionNumber: 1 } }];
  draft.removedLineIds = ['c'];
  expect(applyRequisitionDraft(base, draft).requisitionLineItems.map(({ id }) => id)).toEqual([
    'a',
    'b',
  ]);
});

it('retains invalid numeric input in the device draft until it is corrected', () => {
  const draft = buildRequisitionDraft(base);
  draft.lines.a = { requestedQuantity: 'invalid' };
  expect(rebaseRequisitionDraft(base, draft).lines.a).toEqual({ requestedQuantity: 'invalid' });
});

it('rebases a synced addition by product when the server assigns a new line id', () => {
  const original = { ...base, requisitionLineItems: [] };
  const draft = buildRequisitionDraft(original);
  draft.addedLines = [recordLine({ id: 'local', requestedQuantity: 3 })];
  draft.lines.local = { requestedQuantity: '3' };
  const saved = {
    ...original,
    requisitionLineItems: [recordLine({ id: 'server', requestedQuantity: 3 })],
  };
  expect(rebaseRequisitionDraft(saved, draft)).toEqual(buildRequisitionDraft(saved));
  expect(applyRequisitionDraft(saved, draft).requisitionLineItems).toHaveLength(1);
});
