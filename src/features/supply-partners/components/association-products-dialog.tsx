import { type PaginationState, type RowSelectionState, useTable } from '@tanstack/react-table';
import { PackageSearchIcon } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useMemo, useState } from 'react';
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
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { productPickColumns, productPickVisibility } from '@/components/product-pick-columns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Orderable } from '@/features/reference-data/lib/types';
import { matchesNameOrCode } from '@/features/supply-partners/lib/search';
import { useDialogCardLayout } from '@/hooks/use-card-view';

const productLabel = (product: Orderable) =>
  product.fullProductName
    ? `${product.productCode} - ${product.fullProductName}`
    : product.productCode;
type Props = {
  children?: ReactNode;
  open: boolean;
  selectedIds: readonly string[];
  selectedProducts: readonly Orderable[];
  options: readonly Orderable[];
  onCommit: (ids: string[]) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
};
export function AssociationProductsDialog({ open, onClose, children, ...props }: Props) {
  const { shown, close, dialogProps } = useDialogTarget(open ? 'products' : undefined, onClose);
  return (
    <FormDialog {...dialogProps()} size="table">
      {shown && (
        <ProductsForm
          {...props}
          onCommit={(ids) => {
            props.onCommit(ids);
            close();
          }}
        />
      )}
      {children}
    </FormDialog>
  );
}
function ProductsForm({
  selectedIds,
  selectedProducts,
  options,
  onCommit,
  onDirtyChange,
}: Omit<Props, 'open' | 'onClose'>) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(
    () => new Map<string, true>(selectedIds.map((id) => [id, true])),
  );
  const [query, setQuery] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const { measure, width, cards } = useDialogCardLayout<HTMLDivElement>('table');
  const initial = [...selectedIds].sort().join(':');
  const dirty = [...picked.keys()].sort().join(':') !== initial;
  useLayoutEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const filtered = options.filter((item) =>
    matchesNameOrCode({ name: item.fullProductName, code: item.productCode }, query),
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
        code: t('supply-partners.code'),
        product: t('supply-partners.product'),
        unit: t('supply-partners.unit'),
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
    enableRowSelection: true,
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
  const unavailable = [...picked.keys()].filter((id) => !options.some((item) => item.id === id));
  return (
    <div className="flex min-h-0 flex-1 flex-col" ref={measure}>
      <FormDialogForm onSubmit={() => onCommit([...picked.keys()])}>
        <FormDialogHeader>
          <FormDialogTitle>{t('supply-partners.add-products')}</FormDialogTitle>
          <FormDialogDescription>
            {t('supply-partners.selection-description')}
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
                placeholder={t('supply-partners.search-items')}
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
                  title={t(query ? 'supply-partners.no-matches' : 'supply-partners.no-products')}
                  action={
                    query && (
                      <Button variant="destructive" onClick={() => setQuery('')}>
                        {t('supply-partners.clear-search')}
                      </Button>
                    )
                  }
                />
              }
              footer={filtered.length > 0 && <DataTablePagination table={table} />}
              after={
                unavailable.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-sm">
                      {t('supply-partners.unavailable-for-add')}
                    </p>
                    {unavailable.map((id) => {
                      const item = selectedProducts.find((product) => product.id === id);
                      const label = item ? productLabel(item) : t('supply-partners.unavailable');
                      return (
                        <label
                          key={id}
                          htmlFor={`unavailable-${id}`}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            id={`unavailable-${id}`}
                            aria-label={label}
                            checked
                            onCheckedChange={() =>
                              setPicked((old) => {
                                const next = new Map(old);
                                next.delete(id);
                                return next;
                              })
                            }
                          />
                          <span dir="auto">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                )
              }
            />
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm" role="status">
              {t('supply-partners.selected-count', { count: picked.size })}
            </p>
            <div className="ms-auto flex max-w-full flex-wrap justify-end gap-2">
              <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
              <FormDialogSubmit>{t('supply-partners.add-products')}</FormDialogSubmit>
            </div>
          </div>
        </FormDialogFooter>
      </FormDialogForm>
    </div>
  );
}
