import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { BuildingIcon, EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { RowActions } from '@/components/display/card-actions';
import { TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { productApprovalsOptions } from '@/features/products/api/queries';
import { groupApprovals } from '@/features/products/lib/approvals';
import type { Approval } from '@/features/products/lib/types';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import { programName } from '@/features/reference-data/lib/programs';

type ApprovalRow =
  | { kind: 'group'; id: string; facilityType: string }
  | { kind: 'approval'; id: string; facilityType: string; approval: Approval };

type LineActions = {
  canEdit: boolean;
  onEdit: (approvalId: string) => void;
  onRemove: (approvalId: string) => void;
};

type StockColumn = 'maxPeriodsOfStock' | 'minPeriodsOfStock' | 'emergencyOrderPoint';

const columnHelper = createColumnHelper<DataTableFeatures, ApprovalRow>();

function createColumns(
  t: TFunction,
  formatNumber: (value: number) => string,
  actions: LineActions,
) {
  const stockColumn = (id: StockColumn, title: string) =>
    columnHelper.display({
      id,
      header: ({ column }) => <DataTableColumnHeader column={column} title={title} />,
      meta: { className: 'w-48', label: title },
      cell: ({ row }) => {
        if (row.original.kind === 'group') return null;
        const value = row.original.approval[id];
        return value == null ? null : <span dir="ltr">{formatNumber(value)}</span>;
      },
    });

  return columnHelper.columns([
    columnHelper.display({
      id: 'facilityType',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.approvals.facility-type')} />
      ),
      cell: ({ row }) =>
        row.original.kind === 'group' ? (
          <span className="whitespace-normal break-words font-medium" dir="auto">
            {row.original.facilityType}
          </span>
        ) : (
          <span className="sr-only">{row.original.facilityType}</span>
        ),
      meta: { className: 'w-2/5 @2xl/main:w-1/5' },
    }),
    columnHelper.display({
      id: 'program',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.approvals.program')} />
      ),
      cell: ({ row }) =>
        row.original.kind === 'approval' && (
          <span className="whitespace-normal break-words" dir="auto">
            {programName(row.original.approval.program)}
          </span>
        ),
      meta: { label: t('products.approvals.program') },
    }),
    stockColumn('maxPeriodsOfStock', t('products.approvals.max-periods')),
    stockColumn('emergencyOrderPoint', t('products.approvals.emergency-point')),
    stockColumn('minPeriodsOfStock', t('products.approvals.min-periods')),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('products.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) =>
        row.original.kind === 'approval' && (
          <ApprovalActions
            actions={actions}
            approval={row.original.approval}
            facilityType={row.original.facilityType}
          />
        ),
    }),
  ]);
}

type ApprovalActionsProps = { approval: Approval; facilityType: string; actions: LineActions };

function ApprovalActions({ approval, facilityType, actions }: ApprovalActionsProps) {
  const { t } = useTranslation();

  const label = t('products.approvals.actions-for', {
    facilityType,
    program: programName(approval.program),
  });

  return (
    <RowActions
      label={label}
      actions={
        actions.canEdit
          ? [
              {
                id: 'edit',
                icon: <PencilIcon />,
                label: t('products.approvals.edit'),
                onSelect: () => actions.onEdit(approval.id),
              },
              {
                id: 'remove',
                icon: <Trash2Icon />,
                label: t('products.approvals.remove'),
                destructive: true,
                onSelect: () => actions.onRemove(approval.id),
              },
            ]
          : [
              {
                id: 'view',
                icon: <EyeIcon />,
                label: t('products.approvals.view'),
                onSelect: () => actions.onEdit(approval.id),
              },
            ]
      }
    />
  );
}

const NO_ROWS: ApprovalRow[] = [];

const getRowId = (row: ApprovalRow) => `${row.kind}-${row.id}`;

const noop = () => {};

const withoutFacilityType = (visibility: ColumnVisibilityState) => ({
  ...visibility,
  facilityType: false,
});

const groupHeading = (row: ApprovalRow) => (row.kind === 'group' ? row.facilityType : undefined);

function useApprovalsTable({
  rows,
  columnVisibility,
  canEdit,
  onEdit,
  onRemove,
}: LineActions & { rows: ApprovalRow[]; columnVisibility: ColumnVisibilityState }) {
  const { t, i18n } = useTranslation();
  const columns = useMemo(() => {
    const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 });
    return createColumns(t, number.format, { canEdit, onEdit, onRemove });
  }, [t, i18n.language, canEdit, onEdit, onRemove]);

  return useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId,
    enableSorting: false,
    state: { columnVisibility },
  });
}

export function ApprovalsTableSkeleton({
  cards,
  canEdit,
  columnVisibility,
}: {
  cards: boolean;
  canEdit: boolean;
  columnVisibility: ColumnVisibilityState;
}) {
  const table = useApprovalsTable({
    rows: NO_ROWS,
    columnVisibility: cards ? withoutFacilityType(columnVisibility) : columnVisibility,
    canEdit: false,
    onEdit: noop,
    onRemove: noop,
  });
  if (cards)
    return (
      <TableCardsSkeleton actions={canEdit ? 2 : 1} rowCount={3} table={table} title="program" />
    );
  return <DataTableSkeleton rowCount={3} table={table} />;
}

type ApprovalsTableProps = LineActions & {
  cards: boolean;
  productId: string;
  columnVisibility: ColumnVisibilityState;
};

export function ApprovalsTable({
  cards,
  productId,
  columnVisibility,
  ...actions
}: ApprovalsTableProps) {
  const { t } = useTranslation();
  const { data: approvals } = useSuspenseQuery(productApprovalsOptions(productId));
  const rows = useMemo(
    () =>
      groupApprovals(approvals).flatMap(({ facilityType, approvals: grouped }): ApprovalRow[] => [
        { kind: 'group', id: facilityType.id, facilityType: facilityTypeName(facilityType) },
        ...grouped.map((approval) => ({
          kind: 'approval' as const,
          id: approval.id,
          facilityType: facilityTypeName(facilityType),
          approval,
        })),
      ]),
    [approvals],
  );
  const table = useApprovalsTable({
    rows,
    columnVisibility: cards ? withoutFacilityType(columnVisibility) : columnVisibility,
    ...actions,
  });
  const empty = (
    <DataTableEmpty
      description={t(
        actions.canEdit
          ? 'products.approvals.empty-description'
          : 'products.approvals.empty-read-only',
      )}
      icon={<BuildingIcon />}
      title={t('products.approvals.empty-title')}
    />
  );
  if (cards) {
    return <TableCards empty={empty} heading={groupHeading} table={table} title="program" />;
  }
  return <DataTable empty={empty} table={table} />;
}
