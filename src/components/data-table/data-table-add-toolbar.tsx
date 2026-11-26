import type { ReactNode } from 'react';
import { DataTableToolbar } from '@/components/data-table/data-table';
import {
  DataTableViewOptions,
  type DataTableViewSort,
} from '@/components/data-table/data-table-view-options';

export function DataTableAddToolbar({
  layout,
  sort,
  disabled,
  children,
}: {
  layout: 'table' | 'cards';
  sort: DataTableViewSort;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <DataTableToolbar>
      {layout === 'cards' ? (
        <>
          <DataTableViewOptions disabled={disabled} layout="cards" size="lg" sort={sort} />
          <div className="flex-1">{children}</div>
        </>
      ) : (
        <div className="w-full @2xl/main:ms-auto @2xl/main:w-auto">{children}</div>
      )}
    </DataTableToolbar>
  );
}
