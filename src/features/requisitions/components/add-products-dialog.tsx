import { type PaginationState, type RowSelectionState, useTable } from '@tanstack/react-table';
import { PackageSearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableEmpty, dataTableFeatures } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DialogTable } from '@/components/dialog-table';
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
import { productPickColumns, productPickVisibility } from '@/components/product-pick-columns';
import { Button } from '@/components/ui/button';
import type { Orderable } from '@/features/reference-data/lib/types';
import { useDialogCardLayout } from '@/hooks/use-card-view';

const productLabel = (product: Orderable) =>
  product.fullProductName
    ? `${product.productCode} - ${product.fullProductName}`
    : product.productCode;
export type AddProductsDialogProps = {
  open?: boolean;
  products: readonly Orderable[];
  pending?: boolean;
  onSave: (products: Orderable[]) => void;
  onClose: () => void;
};
export function AddProductsDialog({ open = true, onClose, ...props }: AddProductsDialogProps) {
  return (
    <FormDialog
      open={open}
      closeButton={!props.pending}
      onOpenChange={(value) => {
        if (!value && !props.pending) onClose();
      }}
      size="table"
    >
      {open && <ProductsForm {...props} />}
    </FormDialog>
  );
}
function ProductsForm({
  products: options,
  onSave,
  pending = false,
}: Omit<AddProductsDialogProps, 'open' | 'onClose'>) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(new Map<string, true>());
  const [query, setQuery] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const { measure, width, cards } = useDialogCardLayout('table');
  const filtered = options.filter((item) =>
    [item.fullProductName, item.productCode].some((value) =>
      value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    ),
  );
  const pageIndex = Math.min(
    pagination.pageIndex,
    Math.max(0, Math.ceil(filtered.length / pagination.pageSize) - 1),
  );
  const rows = filtered.slice(
    pageIndex * pagination.pageSize,
    (pageIndex + 1) * pagination.pageSize,
  );
  const columns = useMemo(
    () =>
      productPickColumns({
        code: t('requisitions.edit.products.code'),
        product: t('requisitions.edit.products.product'),
        unit: t('requisitions.edit.products.unit'),
        selectLabel: productLabel,
      }),
    [t],
  );
  const rowSelection = Object.fromEntries(picked);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    rowCount: filtered.length,
    manualPagination: true,
    enableSorting: false,
    enableRowSelection: !pending,
    state: {
      pagination: { ...pagination, pageIndex },
      rowSelection,
      columnVisibility: productPickVisibility(cards, width),
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: (updater) => {
      const next: RowSelectionState =
        typeof updater === 'function' ? updater(rowSelection) : updater;
      setPicked(new Map(Object.entries(next).filter(([, selected]) => selected)));
    },
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col" ref={measure}>
      <FormDialogForm
        onSubmit={() => {
          if (!pending && picked.size) onSave(options.filter((item) => picked.has(item.id)));
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>{t('requisitions.edit.products.add-products')}</FormDialogTitle>
          <FormDialogDescription>
            {t('requisitions.edit.products.selection-description')}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody layout="table">
          <div className="flex flex-col gap-4">
            <search
              className="w-full max-w-sm"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              <DataTableSearch
                value={query}
                placeholder={t('requisitions.edit.products.search-items')}
                onValueChange={(value) => {
                  setQuery(value);
                  setPagination((old) => ({ ...old, pageIndex: 0 }));
                }}
              />
            </search>
            <DialogTable
              cards={cards}
              table={table}
              title="name"
              empty={
                <DataTableEmpty
                  icon={<PackageSearchIcon />}
                  title={t(
                    query
                      ? 'requisitions.edit.products.no-matches'
                      : 'requisitions.edit.products.no-products',
                  )}
                  action={
                    query && (
                      <Button variant="destructive" onClick={() => setQuery('')}>
                        {t('requisitions.edit.products.clear-search')}
                      </Button>
                    )
                  }
                />
              }
              footer={filtered.length > 0 && <DataTablePagination table={table} />}
            />
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm" role="status">
              {t('requisitions.edit.products.selected-count', { count: picked.size })}
            </p>
            <div className="ms-auto flex max-w-full flex-wrap justify-end gap-2">
              <FormDialogCancel disabled={pending}>{t('dialog.cancel')}</FormDialogCancel>
              <FormDialogSubmit pending={pending} disabled={!picked.size}>
                {t('requisitions.edit.products.add-products')}
              </FormDialogSubmit>
            </div>
          </div>
        </FormDialogFooter>
      </FormDialogForm>
    </div>
  );
}
