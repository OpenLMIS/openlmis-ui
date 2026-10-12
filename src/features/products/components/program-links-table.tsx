import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, EyeIcon, LayersIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ProductDetail, ProgramLink } from '@/features/products/lib/types';
import {
  orderableDisplayCategoriesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';

type ProgramLinkRow = ProgramLink & { name: string };

type RowActions = {
  canEdit: boolean;
  onEdit: (programId: string) => void;
  onRemove: (programId: string) => void;
};

const columnHelper = createColumnHelper<DataTableFeatures, ProgramLinkRow>();

function createColumns(t: TFunction, formatPrice: (price: number) => string, actions: RowActions) {
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
      meta: { className: '@3xl/main:w-1/4' },
    }),
    columnHelper.accessor('fullSupply', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.programs.full-supply')} />
      ),
      cell: ({ getValue }) => t(getValue() ? 'products.programs.yes' : 'products.programs.no'),
      meta: { className: 'w-28' },
    }),
    columnHelper.accessor('pricePerPack', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.programs.price')} />
      ),
      cell: ({ getValue }) => {
        const price = getValue();
        return price == null ? null : <span dir="ltr">{formatPrice(price)}</span>;
      },
      meta: { className: 'w-32' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('products.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <ProgramLinkActions actions={actions} link={row.original} />,
    }),
  ]);
}

function ProgramLinkActions({ link, actions }: { link: ProgramLinkRow; actions: RowActions }) {
  const { t } = useTranslation();
  const menu = useMenuOpensDialog();
  const edit = menu.opensDialog(() => actions.onEdit(link.programId));

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('products.programs.actions-for', { program: link.name })}
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
                {t('products.programs.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={menu.opensDialog(() => actions.onRemove(link.programId))}
                variant="destructive"
              >
                <Trash2Icon />
                {t('products.programs.remove')}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={edit}>
              <EyeIcon />
              {t('products.programs.view')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type ProgramLinksTableProps = RowActions & {
  product: ProductDetail;
  columnVisibility: ColumnVisibilityState;
};

const NO_ROWS: ProgramLinkRow[] = [];

const getRowId = (row: ProgramLinkRow) => row.programId;

function useProgramLinksTable({
  rows,
  columnVisibility,
  ...actions
}: RowActions & { rows: ProgramLinkRow[]; columnVisibility: ColumnVisibilityState }) {
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
  columnVisibility,
}: {
  columnVisibility: ColumnVisibilityState;
}) {
  const table = useProgramLinksTable({
    rows: NO_ROWS,
    columnVisibility,
    canEdit: false,
    onEdit: noop,
    onRemove: noop,
  });
  return <DataTableSkeleton rowCount={3} table={table} />;
}

const noop = () => {};

export function ProgramLinksTable({
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

  return (
    <DataTable
      empty={
        <DataTableEmpty
          description={t(
            actions.canEdit
              ? 'products.programs.empty-description'
              : 'products.programs.empty-read-only',
          )}
          icon={<LayersIcon />}
          title={t('products.programs.empty-title')}
        />
      }
      table={table}
    />
  );
}
