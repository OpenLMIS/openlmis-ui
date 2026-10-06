import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  type PaginationState,
  type RowSelectionState,
  type Updater,
  useTable,
} from '@tanstack/react-table';
import { PackageSearchIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { selectionColumn } from '@/components/data-table/data-table-selection';
import {
  resolveColumnVisibility,
  useElementWidth,
} from '@/components/data-table/responsive-columns';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { LoadError } from '@/components/load-error';
import type { Product } from '@/features/products/lib/types';
import { orderablesSearchOptions } from '@/features/reference-data/api/queries';

const PAGE_SIZE = 10;

const HIDEABLE_COLUMNS = [{ id: 'unit', hideBelow: 'md' }] as const;

type KitProductsDialogProps = {
  open: boolean;
  kitId: string;
  inKit: ReadonlySet<string>;
  onAdd: (products: Product[]) => void;
  onClose: () => void;
};

export function KitProductsDialog({ open, kitId, inKit, onAdd, onClose }: KitProductsDialogProps) {
  const { shown, dialogProps } = useDialogTarget(open ? 'add' : undefined, onClose);

  return (
    <FormDialog {...dialogProps(false)} height="fixed" size="xl">
      {shown && <KitProductsForm inKit={inKit} kitId={kitId} onAdd={onAdd} onDone={onClose} />}
    </FormDialog>
  );
}

const productLabel = (product: Product) => {
  const name = product.fullProductName
    ? `${product.productCode} - ${product.fullProductName}`
    : product.productCode;
  const unit = product.dispensable?.displayUnit;
  return unit ? `${name} (${unit})` : name;
};

const columnHelper = createColumnHelper<DataTableFeatures, Product>();

function Locked({ locked, children }: { locked: boolean; children: ReactNode }) {
  return locked ? <span className="text-muted-foreground">{children}</span> : children;
}

function useColumns(kitId: string) {
  const { t } = useTranslation();
  return useMemo(
    () =>
      columnHelper.columns([
        selectionColumn<Product>(productLabel),
        columnHelper.accessor('productCode', {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('products.code')} />
          ),
          cell: ({ row, getValue }) => (
            <Locked locked={!row.getCanSelect()}>
              <span className="block whitespace-normal break-all" dir="ltr">
                {getValue()}
              </span>
            </Locked>
          ),
          meta: { className: 'w-24 @lg/table:w-36' },
        }),
        columnHelper.accessor((product) => product.fullProductName ?? '', {
          id: 'name',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('products.kit.product')} />
          ),
          cell: ({ row, getValue }) => (
            <Locked locked={!row.getCanSelect()}>
              <span className="block whitespace-normal break-words">
                <bdi>{getValue()}</bdi>
                {row.id === kitId && ` ${t('products.kit.this-kit')}`}
              </span>
            </Locked>
          ),
        }),
        columnHelper.accessor((product) => product.dispensable?.displayUnit ?? '', {
          id: 'unit',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('products.kit.unit')} />
          ),
          cell: ({ row, getValue }) => (
            <Locked locked={!row.getCanSelect()}>
              <span className="flex">
                <span className="min-w-0 truncate" dir="ltr">
                  {getValue()}
                </span>
              </span>
            </Locked>
          ),
          meta: { className: 'w-32' },
        }),
      ]),
    [t, kitId],
  );
}

type KitProductsFormProps = Omit<KitProductsDialogProps, 'open' | 'onClose'> & {
  onDone: () => void;
};

const getRowId = (product: Product) => product.id;

function KitProductsForm({ kitId, inKit, onAdd, onDone }: KitProductsFormProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ name: '', code: '' });
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [picked, setPicked] = useState<ReadonlyMap<string, Product>>(new Map());
  const [measure, width] = useElementWidth<HTMLDivElement>();

  const results = useQuery({
    ...orderablesSearchOptions({
      ...filters,
      page: pagination.pageIndex,
      size: pagination.pageSize,
    }),
    placeholderData: keepPreviousData,
  });
  const rows = results.data?.content ?? [];

  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries([...inKit, ...picked.keys()].map((id) => [id, true])),
    [inKit, picked],
  );
  const changeSelection = (updater: Updater<RowSelectionState>) => {
    const next = typeof updater === 'function' ? updater(rowSelection) : updater;
    const shown = new Map(rows.map((product) => [product.id, product]));
    setPicked(
      new Map(
        Object.keys(next)
          .filter((id) => !inKit.has(id))
          .flatMap((id) => {
            const product = shown.get(id) ?? picked.get(id);
            return product ? [[id, product] as const] : [];
          }),
      ),
    );
  };
  const filter = (patch: Partial<typeof filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const table = useTable({
    features: dataTableFeatures,
    columns: useColumns(kitId),
    data: rows,
    getRowId,
    rowCount: results.data?.totalElements ?? 0,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    enableRowSelection: (row) => row.id !== kitId && !inKit.has(row.id),
    state: {
      pagination,
      rowSelection,
      columnVisibility: resolveColumnVisibility(HIDEABLE_COLUMNS, {}, width),
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: changeSelection,
  });

  const submit = () => {
    onAdd([...picked.values()]);
    onDone();
  };

  return (
    <FormDialogForm onSubmit={submit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('products.kit.add-title')}</FormDialogTitle>
        <FormDialogDescription>{t('products.kit.add-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="@container/kit flex flex-col gap-4" ref={measure}>
          <DataTableToolbar>
            <div className="w-full @md/kit:w-56">
              <DataTableSearch
                label={t('products.kit.search-code')}
                onValueChange={(code) => filter({ code })}
                placeholder={t('products.search-code')}
                value={filters.code}
              />
            </div>
            <div className="w-full @md/kit:w-56">
              <DataTableSearch
                label={t('products.kit.search-name')}
                onValueChange={(name) => filter({ name })}
                placeholder={t('products.search-name')}
                value={filters.name}
              />
            </div>
          </DataTableToolbar>
          {results.isError ? (
            <LoadError
              description={t('products.kit.search-error')}
              error={results.error}
              reset={() => void results.refetch()}
              title={t('products.kit.search-error-title')}
            />
          ) : results.isPending ? (
            <DataTableSkeleton rowCount={PAGE_SIZE} table={table} />
          ) : (
            <DataTable
              empty={
                <DataTableEmpty
                  description={t('products.kit.search-empty-description')}
                  icon={<PackageSearchIcon />}
                  title={t('products.kit.search-empty')}
                />
              }
              footer={
                (results.data?.totalElements ?? 0) > 0 && (
                  <DataTablePagination disabled={results.isPlaceholderData} table={table} />
                )
              }
              isStale={results.isPlaceholderData}
              table={table}
            />
          )}
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled={picked.size === 0}>
          {t('products.kit.add-picked', { count: picked.size })}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
