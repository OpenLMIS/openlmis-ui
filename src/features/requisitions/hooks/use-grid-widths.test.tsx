import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGridWidths } from '@/features/requisitions/hooks/use-grid-widths';

afterEach(() => vi.restoreAllMocks());
it('reserves formatted currency and measures uppercase headers in their actual font', () => {
  const measureText = vi.fn((text: string) => ({ width: text.length * 8 }));
  const context = { font: '', measureText };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  const element = document.createElement('div');
  element.innerHTML =
    '<table><thead><tr><th style="font-weight:500;font-size:14px;font-family:sans-serif">Cost</th></tr></thead></table>';
  document.body.append(element);
  const columns = [{ label: 'Cost', values: ['$1,234,567.00'] }];
  const { result, rerender } = renderHook(() => useGridWidths({ current: element }, columns));
  expect(result.current).toEqual([128]);
  expect(context.font).toContain('500');
  expect(measureText).toHaveBeenCalledWith('COST');
  const before = result.current;
  rerender();
  expect(result.current).toBe(before);
  element.remove();
});

it('never exposes widths for columns removed by a tab switch', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: () => ({ width: 80 }),
  } as never);
  const frame = { current: document.createElement('div') };
  const snapshots: number[] = [];
  const { rerender } = renderHook(
    ({ columns }) => {
      const widths = useGridWidths(frame, columns);
      snapshots.push(widths.length - columns.length);
    },
    {
      initialProps: {
        columns: [
          { label: 'Code', values: [] },
          { label: 'Stock', values: [] },
        ],
      },
    },
  );
  rerender({ columns: [{ label: 'Code', values: [] }] });
  expect(snapshots).toEqual(expect.arrayContaining([0]));
  expect(snapshots.every((difference) => difference === 0)).toBe(true);
});
