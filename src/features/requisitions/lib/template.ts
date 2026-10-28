import type { RequisitionTemplate } from '@/features/requisitions/lib/requisition';
import type { RequisitionStatus } from '@/lib/requisition-status';
import type { RequisitionColumn } from '@/lib/requisition-template';

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
  label: string;
  definition: string;
  stockBasedNote?: boolean;
  kind: GridColumnKind;
  convertsToPacks: boolean;
  sticky: boolean;
};
export type ColumnContext = {
  tab: 'fullSupply' | 'nonFullSupply' | 'patients';
  status: RequisitionStatus;
  emergency?: boolean;
  supplyingStock?: boolean;
};

const approvalStatuses = new Set<RequisitionStatus>([
  'AUTHORIZED',
  'IN_APPROVAL',
  'APPROVED',
  'RELEASED',
  'RELEASED_WITHOUT_ORDER',
]);
export const SUBSET_COLUMNS = new Set([
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
const pinnedColumns = new Set(['skipped', 'orderable.productCode', 'orderable.fullProductName']);
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
      if (
        (context.emergency || context.tab === 'nonFullSupply') &&
        !SUBSET_COLUMNS.has(column.name)
      )
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
    const compiled = compileColumn(column, template.populateStockOnHandFromStockCards ?? false);
    return column.name === 'orderable.fullProductName'
      ? [
          compiled,
          {
            name: 'packSize',
            label: '',
            definition: '',
            kind: 'packSize' as const,
            convertsToPacks: false,
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
    label: column.label,
    definition: column.definition ?? '',
    stockBasedNote: stockBased && column.name === 'totalLossesAndAdjustments',
    kind:
      kinds[column.name] ??
      (convertsToPacks
        ? 'quantity'
        : column.columnDefinition?.columnType === 'TEXT'
          ? 'text'
          : 'count'),
    convertsToPacks,
    sticky: pinnedColumns.has(column.name),
  };
}

export type RequisitionTab = 'fullSupply' | 'nonFullSupply' | 'patients';

export const defaultRequisitionTab = (template: RequisitionTemplate): RequisitionTab =>
  template.patientsTabEnabled ? 'patients' : 'fullSupply';

export const hidesSkipped = (
  template: RequisitionTemplate,
  tab: RequisitionTab = defaultRequisitionTab(template),
) =>
  tab === 'fullSupply' &&
  template.columnsMap.skipped?.option?.optionName === 'hideSkippedLineItems';
