import { createColumnHelper } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { DataTableColumnHeader, type DataTableFeatures } from '@/components/data-table/data-table';
import { selectionColumn } from '@/components/data-table/data-table-selection';
import { resolveColumnVisibility } from '@/components/data-table/responsive-columns';
import { CellText } from '@/components/table-cards';
import type { Orderable } from '@/features/reference-data/lib/types';

const helper = createColumnHelper<DataTableFeatures, Orderable>();

const HIDEABLE_COLUMNS = [{ id: 'unit', hideBelow: 'md' }] as const;

export const productPickVisibility = (cards: boolean, width: number | undefined) =>
  cards ? {} : resolveColumnVisibility(HIDEABLE_COLUMNS, {}, width);

function Locked({ locked, children }: { locked: boolean; children: ReactNode }) {
  return locked ? <span className="text-muted-foreground">{children}</span> : children;
}

export function productPickColumns({
  code,
  product,
  unit,
  selectLabel,
  note,
}: {
  code: string;
  product: string;
  unit: string;
  selectLabel: (product: Orderable) => string;
  note?: (product: Orderable) => string | undefined;
}) {
  return helper.columns([
    selectionColumn<Orderable>(selectLabel),
    helper.accessor('productCode', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={code} />,
      cell: ({ row, getValue }) => (
        <Locked locked={!row.getCanSelect()}>
          <span className="block whitespace-normal break-all" dir="ltr">
            {getValue()}
          </span>
        </Locked>
      ),
      meta: { className: 'w-24 @lg/table:w-36', label: code },
    }),
    helper.accessor((item) => item.fullProductName ?? '', {
      id: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={product} />,
      cell: ({ row, getValue }) => {
        const extra = note?.(row.original);
        return (
          <Locked locked={!row.getCanSelect()}>
            <span className="block whitespace-normal break-words">
              <bdi>{getValue()}</bdi>
              {extra && ` ${extra}`}
            </span>
          </Locked>
        );
      },
    }),
    helper.accessor((item) => item.dispensable?.displayUnit ?? '', {
      id: 'unit',
      header: ({ column }) => <DataTableColumnHeader column={column} title={unit} />,
      cell: ({ row, getValue }) =>
        getValue() ? (
          <Locked locked={!row.getCanSelect()}>
            <CellText dir="ltr">{getValue()}</CellText>
          </Locked>
        ) : null,
      meta: { className: 'w-32', label: unit },
    }),
  ]);
}
