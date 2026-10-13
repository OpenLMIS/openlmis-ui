import type { ColumnVisibilityState } from '@tanstack/react-table';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useFitColumnVisibility } from '@/hooks/use-fit-column-visibility';

const columns = ['productCode', 'packSize', 'total', 'expiry'].map((id) => ({ id }));
let available = 1000;
let required = 850;
let measuredColumns: string[][] = [];

function Harness({
  content = 'en',
  frozen = false,
  tableKey = 'first',
}: {
  content?: string;
  frozen?: boolean;
  tableKey?: string;
}) {
  const region = useRef<HTMLDivElement>(null);
  const choices = useState<ColumnVisibilityState>({});
  const { visibility, onVisibilityChange, onReset } = useFitColumnVisibility(
    columns,
    choices,
    region,
    available,
    content,
    true,
    frozen,
  );
  const visible = columns.filter(({ id }) => visibility[id] !== false);
  return (
    <div ref={region}>
      <div
        data-slot="table-container"
        ref={(element) => {
          if (!element) return;
          Object.defineProperties(element, {
            clientWidth: { configurable: true, get: () => available },
            scrollWidth: {
              configurable: true,
              get: () => {
                measuredColumns.push(visible.map(({ id }) => id));
                return Math.max(available, required + visible.length * 100);
              },
            },
          });
        }}
      >
        <table key={tableKey}>
          <tbody>
            <tr>
              {visible.map(({ id }) => (
                <td key={id}>{id}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onVisibilityChange({ ...visibility, productCode: true })}
      >
        Show Code
      </button>
      <button type="button" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}

beforeEach(() => {
  available = 1000;
  required = 850;
  measuredColumns = [];
});

it('hides in priority order and restores only at the recorded required width without oscillating', () => {
  const { rerender } = render(<Harness />);
  expect(screen.queryByRole('cell', { name: 'productCode' })).not.toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'packSize' })).not.toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'total' })).not.toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'expiry' })).toBeInTheDocument();
  available = 1049;
  rerender(<Harness />);
  expect(screen.queryByRole('cell', { name: 'total' })).not.toBeInTheDocument();
  available = 1050;
  rerender(<Harness />);
  expect(screen.getByRole('cell', { name: 'total' })).toBeInTheDocument();
  rerender(<Harness />);
  expect(screen.getAllByRole('cell')).toHaveLength(2);
  available = 1250;
  rerender(<Harness />);
  expect(screen.getAllByRole('cell')).toHaveLength(4);
});

it('recalculates natural widths after content changes and keeps user choices until Reset', () => {
  const { rerender } = render(<Harness />);
  act(() => screen.getByRole('button', { name: 'Show Code' }).click());
  expect(screen.getByRole('cell', { name: 'productCode' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'expiry' })).not.toBeInTheDocument();
  act(() => screen.getByRole('button', { name: 'Reset' }).click());
  expect(screen.queryByRole('cell', { name: 'productCode' })).not.toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'expiry' })).toBeInTheDocument();
  required = 500;
  rerender(<Harness content="ar" />);
  expect(screen.getAllByRole('cell')).toHaveLength(4);
  required = 1100;
  rerender(<Harness content="fr-packs" />);
  expect(screen.queryAllByRole('cell')).toHaveLength(0);
});

it('preserves other automatic columns when View pins a column', () => {
  render(<Harness />);
  measuredColumns = [];
  act(() => screen.getByRole('button', { name: 'Show Code' }).click());
  expect(screen.getByRole('cell', { name: 'productCode' })).toBeInTheDocument();
  expect(measuredColumns.flat()).not.toContain('packSize');
  expect(measuredColumns.flat()).not.toContain('total');
});

it('keeps the resize subscription on rerenders and follows independently replaced tables', async () => {
  const original = globalThis.ResizeObserver;
  const connected = vi.fn();
  const observed = vi.fn();
  const disconnected = vi.fn();
  let notifyResize = () => {};
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
        connected();
      }
      observe(element: Element) {
        observed(element);
      }
      disconnect() {
        disconnected();
      }
    },
  );
  try {
    const { rerender, unmount } = render(<Harness />);
    expect(connected).toHaveBeenCalledTimes(1);
    expect(observed.mock.calls.map(([element]) => element.tagName)).toEqual(['DIV', 'TABLE']);
    required = 950;
    act(notifyResize);
    expect(screen.queryByRole('cell', { name: 'expiry' })).not.toBeInTheDocument();
    rerender(<Harness />);
    act(() => screen.getByRole('button', { name: 'Show Code' }).click());
    expect(connected).toHaveBeenCalledTimes(1);
    expect(disconnected).not.toHaveBeenCalled();
    const oldTable = screen.getByRole('table');
    rerender(<Harness tableKey="replacement" />);
    const newTable = screen.getByRole('table');
    expect(newTable).not.toBe(oldTable);
    expect(observed).toHaveBeenCalledWith(newTable);
    expect(disconnected).toHaveBeenCalledTimes(1);
    const replacement = document.createElement('table');
    newTable.replaceWith(replacement);
    await waitFor(() => expect(observed).toHaveBeenCalledWith(replacement));
    expect(disconnected).toHaveBeenCalledTimes(2);
    unmount();
    expect(disconnected).toHaveBeenCalledTimes(3);
  } finally {
    vi.stubGlobal('ResizeObserver', original);
  }
});

it('keeps fitted columns while a filter renders no rows and resumes on clearing it', () => {
  const { rerender } = render(<Harness />);
  const before = screen.getAllByRole('cell').map((cell) => cell.textContent);
  available = 1400;
  required = 0;
  rerender(<Harness frozen />);
  expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(before);
  required = 850;
  rerender(<Harness />);
  expect(screen.getAllByRole('cell')).toHaveLength(4);
});

it('preserves fitted visibility through content changes while frozen, then recalculates', () => {
  const { rerender } = render(<Harness />);
  const before = screen.getAllByRole('cell').map((cell) => cell.textContent);
  required = 500;
  rerender(<Harness frozen content="fr-packs" />);
  expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(before);
  available = 1500;
  rerender(<Harness frozen content="fr-packs" />);
  expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(before);
  rerender(<Harness content="fr-packs" />);
  expect(screen.getAllByRole('cell')).toHaveLength(4);
});
