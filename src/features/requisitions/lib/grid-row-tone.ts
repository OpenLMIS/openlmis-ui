import type { RequisitionLine } from '@/features/requisitions/lib/lines';

export const gridRowTone = (row: { model?: RequisitionLine }, supplyingStock: boolean) =>
  row.model?.line.skipped
    ? ('skipped' as const)
    : supplyingStock &&
        (row.model?.line.approvedQuantity ?? 0) >
          (row.model?.line.supplyingFacilityStockOnHand ?? 0)
      ? ('shortfall' as const)
      : undefined;
