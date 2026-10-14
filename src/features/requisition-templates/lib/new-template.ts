import type { AddTemplateFormValues } from '@/features/requisition-templates/lib/add-template-form';
import type {
  ColumnDefinition,
  NewRequisitionTemplate,
  TemplateColumn,
} from '@/features/requisition-templates/lib/types';

const LOCKED_ORDER = ['skipped', 'orderable.productCode', 'orderable.fullProductName'];
const lockOrder = (column: ColumnDefinition) => {
  const index = LOCKED_ORDER.indexOf(column.name);
  return index < 0 ? LOCKED_ORDER.length : index;
};

export function buildNewTemplate(
  catalog: readonly ColumnDefinition[],
  form: Pick<
    AddTemplateFormValues,
    'name' | 'programId' | 'facilityTypeIds' | 'requisitionReportOnly'
  >,
): NewRequisitionTemplate {
  const ordered = catalog.toSorted((a, b) => {
    if (a.canChangeOrder !== b.canChangeOrder) return a.canChangeOrder ? 1 : -1;
    return a.canChangeOrder ? 0 : lockOrder(a) - lockOrder(b);
  });
  return {
    name: form.name.trim(),
    program: { id: form.programId ?? '' },
    facilityTypes: form.facilityTypeIds.map((id) => ({ id })),
    requisitionReportOnly: form.requisitionReportOnly,
    populateStockOnHandFromStockCards: false,
    rejectionReasonWindowVisible: false,
    patientsTabEnabled: false,
    numberOfPeriodsToAverage: 3,
    columnsMap: Object.fromEntries(
      ordered.map((column, displayOrder) => {
        const value: TemplateColumn = {
          name: column.name,
          label: column.label,
          indicator: column.indicator,
          definition: column.definition,
          displayOrder,
          isDisplayed: !['averageConsumption', 'calculatedOrderQuantityIsa'].includes(column.name),
          source: column.sources.includes('USER_INPUT') ? 'USER_INPUT' : column.sources[0],
          ...(column.options[0] ? { option: column.options[0] } : {}),
          columnDefinition: column,
        };
        return [column.name, value];
      }),
    ),
  };
}
