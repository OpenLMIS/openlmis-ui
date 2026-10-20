import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EyeIcon, LayersIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RowActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { FlagBadge } from '@/components/flag-badge';
import { TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Badge } from '@/components/ui/badge';
import type { ProductDetail, ProgramLink } from '@/features/products/lib/types';
import {
  orderableDisplayCategoriesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';

type ProgramLinkRow = ProgramLink & { name: string };

type LineActions = {
  canEdit: boolean;
  onEdit: (programId: string) => void;
  onRemove: (programId: string) => void;
};

const columnHelper = createColumnHelper<DataTableFeatures, ProgramLinkRow>();

function createColumns(t: TFunction, formatPrice: (price: number) => string, actions: LineActions) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.programs.program')} />
      ),
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="whitespace-normal break-words font-medium" dir="auto">
            {row.original.name}
          </span>
          {row.original.active === false && (
            <Badge variant="destructive">
              <XIcon data-icon="inline-start" />
              {t('products.programs.inactive')}
            </Badge>
          )}
        </span>
      ),
    }),
    columnHelper.accessor('orderableCategoryDisplayName', {
      id: 'category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.programs.category')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="whitespace-normal break-words" dir="auto">
            {getValue()}
          </span>
        ) : null,
      meta: { className: '@3xl/main:w-1/4', label: t('products.programs.category') },
    }),
    columnHelper.accessor('fullSupply', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.programs.full-supply')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue() ?? false}
          trueLabel={t('products.programs.yes')}
          falseLabel={t('products.programs.no')}
        />
      ),
      meta: { className: 'w-28', label: t('products.programs.full-supply') },
    }),
    columnHelper.accessor('pricePerPack', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.programs.price')} />
      ),
      cell: ({ getValue }) => {
        const price = getValue();
        return price == null ? null : <span dir="ltr">{formatPrice(price)}</span>;
      },
      meta: { className: 'w-32', label: t('products.programs.price') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('products.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <ProgramLinkActions actions={actions} link={row.original} />,
    }),
  ]);
}

function ProgramLinkActions({ link, actions }: { link: ProgramLinkRow; actions: LineActions }) {
  const { t } = useTranslation();

  const label = t('products.programs.actions-for', { program: link.name });

  return (
    <RowActions
      label={label}
      actions={
        actions.canEdit
          ? [
              {
                id: 'edit',
                icon: <PencilIcon />,
                label: t('products.programs.edit'),
                onSelect: () => actions.onEdit(link.programId),
              },
              {
                id: 'remove',
                icon: <Trash2Icon />,
                label: t('products.programs.remove'),
                destructive: true,
                onSelect: () => actions.onRemove(link.programId),
              },
            ]
          : [
              {
                id: 'view',
                icon: <EyeIcon />,
                label: t('products.programs.view'),
                onSelect: () => actions.onEdit(link.programId),
              },
            ]
      }
    />
  );
}

type ProgramLinksTableProps = LineActions & {
  cards: boolean;
  product: ProductDetail;
  columnVisibility: ColumnVisibilityState;
};

const NO_ROWS: ProgramLinkRow[] = [];

const getRowId = (row: ProgramLinkRow) => row.programId;

function useProgramLinksTable({
  rows,
  columnVisibility,
  ...actions
}: LineActions & { rows: ProgramLinkRow[]; columnVisibility: ColumnVisibilityState }) {
  const { t, i18n } = useTranslation();
  const { canEdit, onEdit, onRemove } = actions;
  const columns = useMemo(() => {
    const price = new Intl.NumberFormat(i18n.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return createColumns(t, price.format, { canEdit, onEdit, onRemove });
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

export function ProgramLinksTableSkeleton({
  cards,
  canEdit,
  columnVisibility,
}: {
  cards: boolean;
  canEdit: boolean;
  columnVisibility: ColumnVisibilityState;
}) {
  const table = useProgramLinksTable({
    rows: NO_ROWS,
    columnVisibility,
    canEdit: false,
    onEdit: noop,
    onRemove: noop,
  });
  if (cards)
    return <TableCardsSkeleton actions={canEdit ? 2 : 1} rowCount={3} table={table} title="name" />;
  return <DataTableSkeleton rowCount={3} table={table} />;
}

const noop = () => {};

export function ProgramLinksTable({
  cards,
  product,
  columnVisibility,
  ...actions
}: ProgramLinksTableProps) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(programsOptions());
  const { data: categories } = useQuery(orderableDisplayCategoriesOptions());
  const rows = useMemo(() => {
    const names = new Map(programs.map((program) => [program.id, programName(program)]));
    const categoryNames = new Map(
      (categories ?? []).map((category) => [category.id, category.displayName]),
    );
    return product.programs
      .map((link) => ({
        ...link,
        name: names.get(link.programId) ?? link.programId,
        orderableCategoryDisplayName:
          categoryNames.get(link.orderableDisplayCategoryId ?? '') ??
          link.orderableCategoryDisplayName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [programs, categories, product.programs]);
  const table = useProgramLinksTable({ rows, columnVisibility, ...actions });

  const empty = (
    <DataTableEmpty
      description={t(
        actions.canEdit
          ? 'products.programs.empty-description'
          : 'products.programs.empty-read-only',
      )}
      icon={<LayersIcon />}
      title={t('products.programs.empty-title')}
    />
  );
  if (cards) return <TableCards empty={empty} table={table} title="name" />;
  return <DataTable empty={empty} table={table} />;
}
