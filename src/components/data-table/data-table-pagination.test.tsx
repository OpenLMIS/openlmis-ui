import { type PaginationState, useTable } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dataTableFeatures } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';

type Row = { id: string };

const rows: Row[] = [{ id: 'a' }];
const columns: [] = [];

function Harness({
  pagination,
  rowCount,
  onPaginationChange,
}: {
  pagination: PaginationState;
  rowCount: number;
  onPaginationChange: (updater: unknown) => void;
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
  return <DataTablePagination table={table} />;
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
});
