import { expect, it } from 'vitest';
import {
  applyRequisitionDraft,
  buildRequisitionDraft,
  canRemoveLine,
  canSkipLine,
} from '@/features/requisitions/lib/draft';
import { column, line, record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

const base = {
  ...record(),
  id: 'r',
  facility: { id: 'f' },
  processingPeriod: { id: 'period' },
  requisitionLineItems: [line({ id: 'a' }), line({ id: 'b' })],
} as RequisitionRecord;
it('applies edits, additions, removals and header values without changing the base', () => {
  const draft = buildRequisitionDraft(base);
  draft.lines.a = { requestedQuantity: '١٢' };
  draft.addedLines.push({
    ...line({ id: 'c' }),
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
      line({ requestedQuantity: 0, skipped: true, stockOnHand: 10, remarks: 'hidden' }),
      template,
    ),
  ).toBe(true);
  expect(canSkipLine(line({ requestedQuantity: 1 }), template)).toBe(false);
});
it('allows removal of saved or added non-full lines only while editable', () => {
  expect(canRemoveLine(false, true)).toBe(true);
  expect(canRemoveLine(true, true)).toBe(false);
  expect(canRemoveLine(false, false)).toBe(false);
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
  expect(canSkipLine({ requestedQuantity: '٠' }, template)).toBe(true);
  expect(canSkipLine({ requestedQuantityExplanation: '0' }, template)).toBe(false);
});
