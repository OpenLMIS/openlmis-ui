import type { BatchRequisition } from '@/features/requisitions/lib/batch-types';

export function generateBatch(requisitions = 10, products = 200): BatchRequisition[] {
  return Array.from({ length: requisitions }, (_, r) => ({
    id: `requisition-${r}`,
    emergency: false,
    status: 'AUTHORIZED',
    modifiedDate: '2026-11-02T08:00:00Z',
    facilityName: `Facility ${r + 1}`,
    periodName: 'Oct 2026',
    requisitionLineItems: Array.from({ length: products }, (_, p) => ({
      id: `line-${r}-${p}`,
      approvedQuantity: 25,
      pricePerPack: 7.25,
      skipped: false,
      orderable: {
        id: `product-${p}`,
        productCode: `P${String(p).padStart(4, '0')}`,
        fullProductName: `Review Product ${p + 1}`,
        netContent: 10,
        packRoundingThreshold: 5,
        roundToZero: false,
        meta: { versionNumber: 1 },
      },
    })),
  }));
}
