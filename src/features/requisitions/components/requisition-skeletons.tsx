import { useQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { CardListSkeleton } from '@/components/card-list';
import {
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import {
  RecordSummary,
  RecordSummaryFieldSkeleton,
  RecordSummaryFields,
  RecordSummaryHeading,
} from '@/components/record-summary';
import { Skeleton } from '@/components/ui/skeleton';
import { facilityOptions } from '@/features/reference-data/api/queries';
import { RequisitionGridToolbar } from '@/features/requisitions/components/requisition-grid-toolbar';
import {
  compileColumns,
  defaultRequisitionTab,
  type GridColumn,
  type RequisitionTab,
} from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { useCardView } from '@/hooks/use-card-view';
import type { QuantityUnit } from '@/lib/quantity';

export function RequisitionHeaderSkeleton({ record }: { record?: RequisitionRecord }) {
  const { data: facility } = useQuery({
    ...facilityOptions(record?.facility.id ?? ''),
    enabled: !!record,
  });
  const fields = [
    'operator',
    'district',
    'region',
    ...(facility?.geographicZone?.parent?.parent ? ['province'] : []),
    'period',
    ...(record?.datePhysicalStockCountCompleted ? ['physical-count'] : []),
  ];
  return (
    <RecordSummary aria-busy>
      <RecordSummaryHeading>
        <div className="h-4 w-16">
          <Skeleton fill />
        </div>
        <div className="h-5 w-32">
          <Skeleton fill />
        </div>
        <div className="h-5 w-32">
          <Skeleton fill />
        </div>
      </RecordSummaryHeading>
      <RecordSummaryFields>
        {fields.map((id) => (
          <RecordSummaryFieldSkeleton key={id} />
        ))}
      </RecordSummaryFields>
    </RecordSummary>
  );
}
export function RequisitionCommentsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-2">
      <div className="h-5 w-56">
        <Skeleton fill />
      </div>
      <div className="h-5 w-56">
        <Skeleton fill />
      </div>
      <div className="h-9 w-32">
        <Skeleton fill />
      </div>
    </div>
  );
}
export function RequisitionTabsSkeleton({ record }: { record?: RequisitionRecord }) {
  const tabs = record?.template.patientsTabEnabled
    ? ['patients', 'fullSupply', 'nonFullSupply']
    : ['fullSupply', 'nonFullSupply'];
  return (
    <div
      aria-busy
      className="grid w-full grid-cols-1 gap-1 rounded-lg bg-muted p-1 @lg/main:flex @lg/main:w-fit"
    >
      {tabs.map((tab) => (
        <div key={tab} className="h-9 w-full @lg/main:w-40">
          <Skeleton fill />
        </div>
      ))}
    </div>
  );
}
const helper = createColumnHelper<DataTableFeatures, never>();
const PENDING_COLUMNS = [
  'product',
  'quantity',
  'stock',
  'requested',
  'approved',
  'remarks',
] as const;
const NO_LINES: never[] = [];
export function RequisitionGridPending({
  hideSkipped = false,
  canSwitch = false,
  record,
  tab,
  unit = 'DOSES',
}: {
  hideSkipped?: boolean;
  canSwitch?: boolean;
  record?: RequisitionRecord;
  tab?: RequisitionTab;
  unit?: QuantityUnit;
}) {
  const { t } = useTranslation();
  const columns: GridColumn[] = record
    ? compileColumns(record.template, {
        tab: tab ?? defaultRequisitionTab(record.template),
        status: record.status,
        emergency: record.emergency,
        supplyingStock: false,
      })
    : PENDING_COLUMNS.map((name) => ({
        name,
        label: t(`requisitions.requisition.${name}`),
        sticky: false,
        definition: '',
        kind: 'text',
        convertsToPacks: false,
      }));
  const templateId =
    record?.template.id ??
    Object.keys(record?.template.columnsMap ?? {})
      .sort()
      .join(':');
  const view = useCardView<HTMLDivElement>(
    columns.filter((column) => !column.sticky).map((column) => ({ id: column.name })),
    `requisition-columns:${templateId}`,
  );
  const table = useTable({
    columns: columns.map(({ name, label }) =>
      helper.display({
        id: name,
        header: name === 'packSize' ? t('requisitions.requisition.pack-size') : label,
      }),
    ),
    data: NO_LINES,
    features: dataTableFeatures,
    state: { columnVisibility: view.columnView.visibility },
  });
  return (
    <div aria-busy ref={view.measure} className="flex flex-col gap-4">
      <RequisitionGridToolbar
        disabled
        columns={columns}
        view={view}
        search={{}}
        onSearchChange={noop}
        hideSkipped={hideSkipped}
        skippedCount={0}
        unit={unit}
        setUnit={noop}
        canSwitch={canSwitch}
      />
      {view.cards ? (
        <CardListSkeleton count={10} rows={Math.max(0, columns.length - 1)} />
      ) : (
        <DataTableSkeleton table={table} rowCount={10} density="compact" layout="auto" />
      )}
    </div>
  );
}

const noop = () => {};
