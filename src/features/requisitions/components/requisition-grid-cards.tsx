import type { ReactNode, Ref } from 'react';
import type { DataTableInstance } from '@/components/data-table/data-table';
import { TableCards } from '@/components/table-cards';
import type { GridRow } from '@/features/requisitions/components/requisition-grid';

export const gridRowTone = (row: GridRow, supplyingStock: boolean) =>
  row.model?.line.skipped
    ? ('skipped' as const)
    : supplyingStock &&
        (row.model?.line.approvedQuantity ?? 0) >
          (row.model?.line.supplyingFacilityStockOnHand ?? 0)
      ? ('shortfall' as const)
      : undefined;

export function RequisitionGridCards({
  table,
  footer,
  empty,
  listRef,
  supplyingStock,
}: {
  table: DataTableInstance<GridRow>;
  supplyingStock: boolean;
  footer: ReactNode;
  empty: ReactNode;
  listRef: Ref<HTMLUListElement>;
}) {
  return (
    <TableCards
      table={table}
      title="orderable.fullProductName"
      heading={(row) => row.category}
      tone={(row) => gridRowTone(row, supplyingStock)}
      detailVisible={(_, id) => id !== 'orderable.productCode'}
      footer={footer}
      empty={empty}
      listRef={listRef}
    />
  );
}
