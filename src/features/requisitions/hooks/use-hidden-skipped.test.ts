import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useHiddenSkipped } from '@/features/requisitions/hooks/use-hidden-skipped';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import { buildLines, type RequisitionLine } from '@/features/requisitions/lib/lines';

it('takes a refresh from the current draft while rendered lines still lag behind', () => {
  const lines = buildLines(
    record({
      template: {
        columnsMap: {
          skipped: column('skipped', 0, { option: { optionName: 'hideSkippedLineItems' } }),
        },
      },
      requisitionLineItems: [line({ id: 'a', skipped: true }), line({ id: 'b', skipped: true })],
    }),
    [product()],
  );
  const unskipped = new Set(['a']);
  const isSkipped = (model: RequisitionLine) => !unskipped.has(model.line.id);
  const { result, rerender } = renderHook(
    ({ dialog }) => useHiddenSkipped(lines, true, [dialog], isSkipped),
    { initialProps: { dialog: true } },
  );
  expect([...result.current.hidden]).toEqual(['b']);
  unskipped.add('b');
  rerender({ dialog: false });
  expect([...result.current.hidden]).toEqual([]);
});
