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
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';

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
export function RequisitionTabsSkeleton() {
  return (
    <div aria-busy className="h-9 w-full @lg/main:w-80">
      <Skeleton fill />
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
export function RequisitionGridPending() {
  const { t } = useTranslation();
  const table = useTable({
    columns: PENDING_COLUMNS.map((id) =>
      helper.display({ id, header: t(`requisitions.requisition.${id}`) }),
    ),
    data: NO_LINES,
    features: dataTableFeatures,
  });
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div aria-busy ref={measure} className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <div className="h-9 flex-1">
          <Skeleton fill />
        </div>
        <div className="h-9 w-20">
          <Skeleton fill />
        </div>
        <div className="h-9 w-36">
          <Skeleton fill />
        </div>
        <div className="h-9 w-20">
          <Skeleton fill />
        </div>
      </div>
      {cards ? (
        <CardListSkeleton count={10} rows={5} />
      ) : (
        <DataTableSkeleton table={table} rowCount={10} density="compact" layout="auto" />
      )}
    </div>
  );
}
