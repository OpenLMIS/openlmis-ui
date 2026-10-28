import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useRequisitionForm } from '@/features/requisitions/hooks/use-requisition-form';
import { column, line, record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

const write = vi.fn();
vi.mock('@/features/requisitions/hooks/use-requisition-draft', () => ({
  useRequisitionDraft: () => ({ status: { status: 'saved' }, outdated: false, write }),
}));
const base = {
  ...record({
    template: {
      columnsMap: { beginningBalance: column('beginningBalance', 0, { source: 'USER_INPUT' }) },
    },
    requisitionLineItems: [line({ beginningBalance: 10 })],
  }),
  id: 'r',
  facility: { id: 'f' },
  processingPeriod: { id: 'period' },
} as RequisitionRecord;
it('keeps keyed edits across rerenders and stages each change without waiting for blur', async () => {
  const hook = renderHook(() => useRequisitionForm(base));
  act(() => hook.result.current.setLine('line', { beginningBalance: '25' }));
  hook.rerender();
  expect(hook.result.current.draft.lines.line.beginningBalance).toBe('25');
  await waitFor(() =>
    expect(write).toHaveBeenLastCalledWith(
      expect.objectContaining({ lines: { line: { beginningBalance: '25' } } }),
    ),
  );
  act(() => hook.result.current.removeLine('line'));
  expect(hook.result.current.draft.removedLineIds).toEqual(['line']);
});
