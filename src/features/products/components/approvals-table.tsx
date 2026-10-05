import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { BuildingIcon, EllipsisIcon, EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { productApprovalsOptions } from '@/features/products/api/queries';
import { groupApprovals } from '@/features/products/lib/approvals';
import type { Approval } from '@/features/products/lib/types';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import { programName } from '@/features/reference-data/lib/programs';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';

type ApprovalRow =
  | { kind: 'group'; id: string; facilityType: string }
  | { kind: 'approval'; id: string; facilityType: string; approval: Approval };

type RowActions = {
  canEdit: boolean;
  onEdit: (approvalId: string) => void;
  onRemove: (approvalId: string) => void;
};

type StockColumn = 'maxPeriodsOfStock' | 'minPeriodsOfStock' | 'emergencyOrderPoint';

const columnHelper = createColumnHelper<DataTableFeatures, ApprovalRow>();

const muted = <span className="text-muted-foreground">-</span>;

function createColumns(t: TFunction, formatNumber: (value: number) => string, actions: RowActions) {
  const stockColumn = (id: StockColumn, title: string) =>
    columnHelper.display({
      id,
      header: ({ column }) => <DataTableColumnHeader column={column} title={title} />,
      meta: { className: 'w-48' },
      cell: ({ row }) => {
        if (row.original.kind === 'group') return null;
        const value = row.original.approval[id];
        return value == null ? muted : <span dir="ltr">{formatNumber(value)}</span>;
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

type ApprovalActionsProps = { approval: Approval; facilityType: string; actions: RowActions };

function ApprovalActions({ approval, facilityType, actions }: ApprovalActionsProps) {
  const { t } = useTranslation();
  const menu = useMenuOpensDialog();
  const edit = menu.opensDialog(() => actions.onEdit(approval.id));

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('products.approvals.actions-for', {
                facilityType,
                program: programName(approval.program),
              })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          {actions.canEdit ? (
            <>
              <DropdownMenuItem onClick={edit}>
                <PencilIcon />
                {t('products.approvals.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={menu.opensDialog(() => actions.onRemove(approval.id))}
                variant="destructive"
              >
                <Trash2Icon />
                {t('products.approvals.remove')}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={edit}>
              <EyeIcon />
              {t('products.approvals.view')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const NO_ROWS: ApprovalRow[] = [];

const getRowId = (row: ApprovalRow) => `${row.kind}-${row.id}`;

const noop = () => {};

function useApprovalsTable({
  rows,
  columnVisibility,
  canEdit,
  onEdit,
  onRemove,
}: RowActions & { rows: ApprovalRow[]; columnVisibility: ColumnVisibilityState }) {
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
  columnVisibility,
}: {
  columnVisibility: ColumnVisibilityState;
}) {
  const table = useApprovalsTable({
    rows: NO_ROWS,
    columnVisibility,
    canEdit: false,
    onEdit: noop,
    onRemove: noop,
  });
  return <DataTableSkeleton rowCount={3} table={table} />;
}

type ApprovalsTableProps = RowActions & {
  productId: string;
  columnVisibility: ColumnVisibilityState;
};

export function ApprovalsTable({ productId, columnVisibility, ...actions }: ApprovalsTableProps) {
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
  const table = useApprovalsTable({ rows, columnVisibility, ...actions });

  return (
    <DataTable
      empty={
        <DataTableEmpty
          description={t(
            actions.canEdit
              ? 'products.approvals.empty-description'
              : 'products.approvals.empty-read-only',
          )}
          icon={<BuildingIcon />}
          title={t('products.approvals.empty-title')}
        />
      }
      table={table}
    />
  );
}
