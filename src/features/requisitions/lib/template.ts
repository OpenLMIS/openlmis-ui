import type {
  ColumnSource,
  RequisitionColumn,
  RequisitionStatus,
  RequisitionTemplate,
} from '@/features/requisitions/lib/requisition';

export type GridColumnKind =
  | 'product'
  | 'quantity'
  | 'count'
  | 'currency'
  | 'text'
  | 'skip'
  | 'adjustments'
  | 'unit'
  | 'packSize'
  | 'supplyingStock';
export type GridColumn = {
  name: string;
  indicator: string;
  label: string;
  definition: string;
  source: ColumnSource;
  kind: GridColumnKind;
  convertsToPacks: boolean;
  userInput: boolean;
  sticky: boolean;
};
export type ColumnContext = {
  tab: 'fullSupply' | 'nonFullSupply' | 'patients';
  status: RequisitionStatus;
  emergency?: boolean;
  stockBased?: boolean;
  supplyingStock?: boolean;
};

const approvalStatuses = new Set<RequisitionStatus>([
  'AUTHORIZED',
  'IN_APPROVAL',
  'APPROVED',
  'RELEASED',
  'RELEASED_WITHOUT_ORDER',
]);
const subset = new Set([
  'requestedQuantity',
  'requestedQuantityExplanation',
  'orderable.productCode',
  'orderable.fullProductName',
  'orderable.dispensable.displayUnit',
  'dispensable',
  'packsToShip',
  'approvedQuantity',
  'remarks',
]);
const packColumns = new Set([
  'beginningBalance',
  'totalReceivedQuantity',
  'totalConsumedQuantity',
  'stockOnHand',
  'approvedQuantity',
  'maximumStockQuantity',
  'averageConsumption',
  'adjustedConsumption',
  'requestedQuantity',
  'calculatedOrderQuantity',
  'totalRequirement',
  'totalQuantityNeededByHf',
  'quantityToIssue',
  'totalLossesAndAdjustments',
]);
const kinds: Record<string, GridColumnKind> = {
  'orderable.productCode': 'product',
  'orderable.fullProductName': 'product',
  'orderable.dispensable.displayUnit': 'unit',
  dispensable: 'unit',
  remarksForTBDispensedQuantity: 'text',
  skipped: 'skip',
  totalLossesAndAdjustments: 'adjustments',
  totalCost: 'currency',
  pricePerPack: 'currency',
  supplyingFacilityStockOnHand: 'supplyingStock',
  requestedQuantityExplanation: 'text',
  remarks: 'text',
};

export function compileColumns(
  template: RequisitionTemplate,
  context: ColumnContext,
): GridColumn[] {
  if (context.tab === 'patients') return [];
  const afterAuthorization = approvalStatuses.has(context.status);
  const approvalColumn = template.patientsTabEnabled ? 'totalReceivedQuantity' : 'approvedQuantity';
  const columns = Object.values(template.columnsMap)
    .filter((column) => {
      if (!column.isDisplayed) return false;
      if (column.name === 'supplyingFacilityStockOnHand') return !!context.supplyingStock;
      if ((context.emergency || context.tab === 'nonFullSupply') && !subset.has(column.name))
        return false;
      if ((column.name === approvalColumn || column.name === 'remarks') && !afterAuthorization)
        return false;
      if (column.name === 'packsToShip' && column.option) {
        return (
          column.option.optionName === 'showPackToShipInAllPages' ||
          (column.option.optionName === 'showPackToShipInApprovalPage' && afterAuthorization)
        );
      }
      return true;
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
  return columns.flatMap((column) => {
    const compiled = compileColumn(
      column,
      context.stockBased ?? template.populateStockOnHandFromStockCards ?? false,
    );
    return column.name === 'orderable.fullProductName'
      ? [
          compiled,
          {
            name: 'packSize',
            indicator: '',
            label: 'Pack Size',
            definition: '',
            source: 'REFERENCE_DATA' as const,
            kind: 'packSize' as const,
            convertsToPacks: false,
            userInput: false,
            sticky: false,
          },
        ]
      : [compiled];
  });
}

function compileColumn(column: RequisitionColumn, stockBased: boolean): GridColumn {
  const convertsToPacks = packColumns.has(column.name);
  return {
    name: column.name,
    indicator: column.indicator ?? '',
    label: column.label,
    definition: [
      column.definition,
      stockBased && column.name === 'totalLossesAndAdjustments'
        ? 'Total losses and adjustments modal is disabled for stock based requisitions.'
        : null,
    ]
      .filter(Boolean)
      .join(' '),
    source: column.source,
    kind:
      kinds[column.name] ??
      (convertsToPacks
        ? 'quantity'
        : column.columnDefinition?.columnType === 'TEXT'
          ? 'text'
          : 'count'),
    convertsToPacks,
    userInput: column.source === 'USER_INPUT',
    sticky: column.name === 'orderable.productCode' || column.name === 'orderable.fullProductName',
  };
}
