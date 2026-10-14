import { sortColumns } from '@/features/requisition-templates/lib/column-order';
import type {
  ColumnSource,
  NewRequisitionTemplate,
  RequisitionTemplate,
  TemplateColumnDefinition,
} from '@/features/requisition-templates/lib/types';
import { toWholeNumber } from '@/lib/whole-number';

export type ColumnDraft = {
  label: string;
  definition: string | null | undefined;
  isDisplayed: boolean;
  source: ColumnSource | '';
  optionId: string | null;
  tag: string | null;
  displayOrder: number;
};

export type TemplateDraft = {
  name: string;
  rejectionReasonWindowVisible: boolean;
  requisitionReportOnly: boolean;
  patientsTabEnabled: boolean;
  populateStockOnHandFromStockCards: boolean;
  numberOfPeriodsToAverage: string;
  facilityTypeIds: string[];
  order: string[];
  columns: Record<string, ColumnDraft>;
  columnDefinitions: Readonly<
    Record<string, TemplateColumnDefinition & { readonly originalDisplayOrder: number }>
  >;
};

export function draftFromTemplate(template: NewRequisitionTemplate): TemplateDraft {
  return {
    name: template.name,
    rejectionReasonWindowVisible: template.rejectionReasonWindowVisible,
    requisitionReportOnly: template.requisitionReportOnly,
    patientsTabEnabled: template.patientsTabEnabled,
    populateStockOnHandFromStockCards: template.populateStockOnHandFromStockCards,
    numberOfPeriodsToAverage: template.numberOfPeriodsToAverage?.toString() ?? '',
    facilityTypeIds: template.facilityTypes.map(({ id }) => id),
    order: sortColumns(template.columnsMap).map(({ columnDefinition }) => columnDefinition.id),
    columnDefinitions: Object.fromEntries(
      Object.values(template.columnsMap).map((column) => [
        column.columnDefinition.id,
        {
          ...structuredClone(column.columnDefinition),
          originalDisplayOrder: column.displayOrder,
        },
      ]),
    ),
    columns: Object.fromEntries(
      Object.values(template.columnsMap).map((column) => [
        column.columnDefinition.id,
        {
          label: column.label,
          definition: column.definition,
          isDisplayed: column.isDisplayed,
          source: column.source ?? '',
          optionId: column.option?.id ?? null,
          tag: column.tag ?? null,
          displayOrder: column.displayOrder,
        },
      ]),
    ),
  };
}

export function applyDraft(latest: RequisitionTemplate, draft: TemplateDraft): RequisitionTemplate {
  const orderChanged = Object.entries(draft.columns).some(
    ([key, column]) => column.displayOrder !== draft.columnDefinitions[key].originalDisplayOrder,
  );
  return {
    ...latest,
    name: draft.name,
    rejectionReasonWindowVisible: draft.rejectionReasonWindowVisible,
    requisitionReportOnly: draft.requisitionReportOnly,
    patientsTabEnabled: draft.patientsTabEnabled,
    populateStockOnHandFromStockCards: draft.populateStockOnHandFromStockCards,
    numberOfPeriodsToAverage: draft.numberOfPeriodsToAverage.trim()
      ? toWholeNumber(draft.numberOfPeriodsToAverage)
      : null,
    facilityTypes: draft.facilityTypeIds.map((id) => ({ id })),
    columnsMap: Object.fromEntries(
      Object.entries(latest.columnsMap).map(([name, column]) => {
        const edited = draft.columns[column.columnDefinition.id];
        if (!edited) return [name, column];
        const { optionId, displayOrder, ...values } = edited;
        return [
          name,
          {
            ...column,
            ...values,
            ...(orderChanged ? { displayOrder } : {}),
            source: values.source || null,
            option: column.columnDefinition.options.find(({ id }) => id === optionId) ?? null,
          },
        ];
      }),
    ),
  };
}

export const STOCK_COLUMNS = [
  'beginningBalance',
  'stockOnHand',
  'totalLossesAndAdjustments',
  'totalConsumedQuantity',
  'totalReceivedQuantity',
  'totalStockoutDays',
  'averageConsumption',
];

export function setStockFlag(draft: TemplateDraft, on: boolean): TemplateDraft {
  return {
    ...draft,
    populateStockOnHandFromStockCards: on,
    columns: Object.fromEntries(
      Object.entries(draft.columns).map(([key, column]) => {
        const { name, sources } = draft.columnDefinitions[key];
        if (!STOCK_COLUMNS.includes(name) || (on && !sources.includes('STOCK_CARDS')))
          return [key, column];
        const source = on
          ? 'STOCK_CARDS'
          : sources.includes('USER_INPUT')
            ? 'USER_INPUT'
            : (sources.find((source) => source !== 'STOCK_CARDS') ?? '');
        return [key, { ...column, source }];
      }),
    ),
  };
}

export function setDisplayed(draft: TemplateDraft, key: string, shown: boolean): TemplateDraft {
  const definition = draft.columnDefinitions[key];
  const couple =
    definition.name === 'numberOfPatientsOnTreatmentNextMonth' &&
    definition.sources.includes('USER_INPUT') &&
    definition.sources.includes('CALCULATED');
  return {
    ...draft,
    columns: {
      ...draft.columns,
      [key]: {
        ...draft.columns[key],
        isDisplayed: shown,
        ...(couple ? { source: shown ? 'USER_INPUT' : 'CALCULATED' } : {}),
      },
    },
  };
}

export function tagChoices(draft: TemplateDraft, key: string, tags: readonly string[]) {
  const used = new Set(
    Object.entries(draft.columns)
      .filter(([other]) => other !== key)
      .map(([, column]) => column.tag),
  );
  const own = draft.columns[key].tag;
  return [
    ...new Set([...tags.filter((tag) => !used.has(tag) && tag !== own), ...(own ? [own] : [])]),
  ].sort();
}
