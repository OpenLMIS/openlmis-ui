import type {
  Requisition,
  RequisitionColumn,
  RequisitionLineItem,
  RequisitionProduct,
} from '@/features/requisitions/lib/requisition';

export function column(
  name: string,
  displayOrder = 0,
  overrides: Partial<RequisitionColumn> = {},
): RequisitionColumn {
  return {
    name,
    label: name,
    indicator: name,
    isDisplayed: true,
    displayOrder,
    source: 'CALCULATED',
    ...overrides,
  };
}

export function record(overrides: Partial<Requisition> = {}): Requisition {
  return {
    status: 'INITIATED',
    emergency: false,
    program: { id: 'program' },
    template: { columnsMap: {} },
    requisitionLineItems: [],
    ...overrides,
  };
}

export function product(overrides: Partial<RequisitionProduct> = {}): RequisitionProduct {
  return {
    id: 'product',
    meta: { versionNumber: 1 },
    productCode: 'P1',
    fullProductName: 'Product',
    netContent: 10,
    packRoundingThreshold: 5,
    roundToZero: false,
    programs: [{ programId: 'program', fullSupply: true, pricePerPack: 2 }],
    ...overrides,
  };
}

export function line(overrides: Partial<RequisitionLineItem> = {}): RequisitionLineItem {
  return {
    id: 'line',
    approvedProduct: { id: 'approved', versionNumber: 1 },
    orderable: { id: 'product', versionNumber: 1 },
    ...overrides,
  };
}
