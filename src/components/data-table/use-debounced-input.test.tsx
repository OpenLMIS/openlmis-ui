import { act, fireEvent, render, screen } from '@testing-library/react';
import { DataTableFilters } from './data-table-filters-popover';
import { DataTableSearch } from './data-table-search';

function Filters({ onValueChange }: { onValueChange: (value: string) => void }) {
  return (
    <DataTableFilters activeCount={0} onClear={vi.fn()}>
      <DataTableSearch label="Product Code" onValueChange={onValueChange} value="" />
    </DataTableFilters>
  );
}

describe('debounced text in Filters', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('applies pending text once on Escape before the delay without relying on blur', () => {
    const onValueChange = vi.fn();
    render(<Filters onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const input = screen.getByRole('textbox', { name: 'Product Code' });
    act(() => screen.getByRole('button', { name: 'Filters' }).focus());
    fireEvent.change(input, { target: { value: 'ABC' } });
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Product Code' }), { key: 'Escape' });

    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('ABC');
    act(() => vi.runAllTimers());
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('ABC');
  });

  it('does not emit on close when nothing is pending', () => {
    const onValueChange = vi.fn();
    render(<Filters onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Product Code' }), { key: 'Escape' });
    act(() => vi.runAllTimers());

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('drops pending filter text when the page unmounts', () => {
    const onValueChange = vi.fn();
    const { unmount } = render(<Filters onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Product Code' }), {
      target: { value: 'ABC' },
    });

    unmount();
    act(() => vi.runAllTimers());

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
