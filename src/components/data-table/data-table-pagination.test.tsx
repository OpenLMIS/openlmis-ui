import { type PaginationState, useTable } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { dataTableFeatures } from '@/components/data-table/data-table';
import { DataTableLabelsProvider } from '@/components/data-table/data-table-labels';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';

type Row = { id: string };

const rows: Row[] = [{ id: 'a' }];
const columns: [] = [];

function Harness({
  pagination,
  rowCount,
  onPaginationChange,
  disabled,
  isPageInvalid,
}: {
  pagination: PaginationState;
  rowCount: number;
  onPaginationChange: (updater: unknown) => void;
  disabled?: boolean;
  isPageInvalid?: (pageIndex: number) => boolean;
}) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    rowCount,
    manualPagination: true,
    state: { pagination },
    onPaginationChange,
  });
  return <DataTablePagination disabled={disabled} table={table} isPageInvalid={isPageInvalid} />;
}

describe('DataTablePagination', () => {
  it('shows which rows are on screen out of the total', () => {
    render(
      <Harness
        onPaginationChange={vi.fn()}
        pagination={{ pageIndex: 1, pageSize: 10 }}
        rowCount={25}
      />,
    );

    expect(screen.getByText('11-20 / 25')).toBeInTheDocument();
  });

  it('disables moving past either end', () => {
    render(
      <Harness
        onPaginationChange={vi.fn()}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        rowCount={5}
      />,
    );

    expect(screen.getByText('1-5 / 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous Page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next Page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('turns every page control off while disabled', () => {
    render(
      <Harness
        disabled
        onPaginationChange={vi.fn()}
        pagination={{ pageIndex: 1, pageSize: 10 }}
        rowCount={25}
      />,
    );

    expect(screen.getByRole('button', { name: 'Previous Page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next Page' })).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: /^Page \d+$/ })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByRole('combobox', { name: 'Rows Per Page' })).toBeDisabled();
  });

  it('reads an empty result as 0-0 / 0', () => {
    render(
      <Harness
        onPaginationChange={vi.fn()}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        rowCount={0}
      />,
    );

    expect(screen.getByText('0-0 / 0')).toBeInTheDocument();
  });

  it('asks for the next page', () => {
    const onPaginationChange = vi.fn();
    render(
      <Harness
        onPaginationChange={onPaginationChange}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        rowCount={25}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next Page' }));

    const updater = onPaginationChange.mock.calls[0]?.[0];
    expect(updater({ pageIndex: 0, pageSize: 10 })).toEqual({ pageIndex: 1, pageSize: 10 });
  });

  it.each([
    { pageIndex: 0, rowCount: 0, pages: [1] },
    { pageIndex: 0, rowCount: 10, pages: [1] },
    { pageIndex: 1, rowCount: 40, pages: [1, 2, 3, 4] },
    { pageIndex: 0, rowCount: 230, pages: [1, 2, 3, 4] },
    { pageIndex: 2, rowCount: 230, pages: [1, 2, 3, 4, 5, 6] },
    { pageIndex: 10, rowCount: 230, pages: [8, 9, 10, 11, 12, 13, 14] },
    { pageIndex: 22, rowCount: 230, pages: [20, 21, 22, 23] },
  ])(
    'shows the current page and up to three on each side, as legacy, at page index $pageIndex of $rowCount rows',
    ({ pageIndex, rowCount, pages }) => {
      render(
        <Harness
          onPaginationChange={vi.fn()}
          pagination={{ pageIndex, pageSize: 10 }}
          rowCount={rowCount}
        />,
      );

      expect(
        screen.getAllByRole('button', { name: /^Page \d+$/ }).map((button) => button.textContent),
      ).toEqual(pages.map(String));
      expect(screen.getByRole('button', { name: `Page ${pageIndex + 1}` })).toHaveAttribute(
        'aria-current',
        'page',
      );
    },
  );

  it('jumps to the selected page through the table pagination', () => {
    const onPaginationChange = vi.fn();
    const pagination = { pageIndex: 4, pageSize: 10 };
    render(
      <Harness onPaginationChange={onPaginationChange} pagination={pagination} rowCount={230} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Page 8' }));

    const updater = onPaginationChange.mock.calls[0]?.[0];
    expect(updater(pagination)).toEqual({ pageIndex: 7, pageSize: 10 });
  });

  it('keeps the current page in full colour and focusable, doing nothing when pressed', () => {
    const onPaginationChange = vi.fn();
    render(
      <Harness
        onPaginationChange={onPaginationChange}
        pagination={{ pageIndex: 4, pageSize: 10 }}
        rowCount={230}
      />,
    );

    const current = screen.getByRole('button', { name: 'Page 5' });
    expect(current).toBeEnabled();
    fireEvent.click(current);
    expect(onPaginationChange).not.toHaveBeenCalled();
  });

  it('names each page with the supplied label', () => {
    render(
      <DataTableLabelsProvider labels={{ page: (page) => `Página ${page}` }}>
        <Harness
          onPaginationChange={vi.fn()}
          pagination={{ pageIndex: 1, pageSize: 10 }}
          rowCount={30}
        />
      </DataTableLabelsProvider>,
    );

    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Página 3' })).toBeEnabled();
  });

  it.each([1, 25, 75])(
    'shows a linked page size of %i and offers the standard sizes',
    async (pageSize) => {
      const user = userEvent.setup();
      const onPaginationChange = vi.fn();
      const pagination = { pageIndex: 0, pageSize };
      render(
        <Harness onPaginationChange={onPaginationChange} pagination={pagination} rowCount={2000} />,
      );

      const select = screen.getByRole('combobox', { name: 'Rows Per Page' });
      expect(select).toHaveTextContent(String(pageSize));
      await user.click(select);
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
        [10, 20, 50, 100, pageSize].sort((a, b) => a - b).map(String),
      );
      await user.click(screen.getByRole('option', { name: '20' }));

      const updater = onPaginationChange.mock.calls[0]?.[0];
      expect(updater(pagination)).toEqual({ pageIndex: 0, pageSize: 20 });
    },
  );
});

describe('invalid pages', () => {
  it('marks invalid page buttons with an icon and the supplied accessible label', () => {
    render(
      <DataTableLabelsProvider labels={{ invalidPage: 'Contém linhas inválidas' }}>
        <Harness
          onPaginationChange={vi.fn()}
          pagination={{ pageIndex: 0, pageSize: 10 }}
          rowCount={30}
          isPageInvalid={(index) => index === 1}
        />
      </DataTableLabelsProvider>,
    );
    const invalid = screen.getByRole('button', { name: 'Page 2: Contém linhas inválidas' });
    expect(invalid.querySelector('svg')).toBeInTheDocument();
    expect(invalid.querySelector('.text-destructive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' }).querySelector('svg')).toBeNull();
  });
});

it('uses the current page foreground for its invalid mark and checks each page once', () => {
  const invalid = vi.fn(() => true);
  render(
    <Harness
      onPaginationChange={vi.fn()}
      pagination={{ pageIndex: 0, pageSize: 10 }}
      rowCount={30}
      isPageInvalid={invalid}
    />,
  );
  expect(
    screen
      .getByRole('button', { name: 'Page 1: Contains Invalid Rows' })
      .querySelector('.text-destructive'),
  ).toBeNull();
  expect(invalid.mock.calls).toHaveLength(3);
});
