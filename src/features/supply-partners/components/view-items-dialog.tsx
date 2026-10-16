import { createColumnHelper, useTable } from '@tanstack/react-table';
import { SearchXIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DialogNotFound } from '@/components/dialog-parts';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { Button } from '@/components/ui/button';
import {
  ReferenceStatus,
  usePartnerReferences,
} from '@/features/supply-partners/components/supply-partner-references';
import { associationKey } from '@/features/supply-partners/lib/association';
import {
  matchesNameOrCode,
  type SupplyPartnerEditSearch,
} from '@/features/supply-partners/lib/search';
import type { AssociationDraft } from '@/features/supply-partners/lib/types';
import { type TableSearch, useTableSearchState } from '@/lib/table-search';

type Item = { id: string; name: string | null; code: string };
const helper = createColumnHelper<DataTableFeatures, Item>();
const NO_SORT = { id: 'name', desc: false };
export function ViewItemsDialog({
  search,
  associations,
  onClose,
  pending,
}: {
  search: SupplyPartnerEditSearch;
  associations: AssociationDraft[];
  onClose: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const target = search.view ? `${search.view}:${search.viewAssociation ?? ''}` : undefined;
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const [kind, ...pair] = (shown ?? '').split(':');
  const item = associations.find((row) => associationKey(row) === pair.join(':'));
  return (
    <FormDialog {...dialogProps(pending)} closeButton={!pending} size="xl">
      {shown &&
        (item ? (
          <ViewItems
            key={shown}
            association={item}
            kind={kind === 'facilities' ? 'facilities' : 'products'}
          />
        ) : (
          <DialogNotFound
            title={t('supply-partners.associations')}
            description={t('supply-partners.unavailable')}
          />
        ))}
    </FormDialog>
  );
}
function ViewItems({
  association,
  kind,
}: {
  association: AssociationDraft;
  kind: 'facilities' | 'products';
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<TableSearch>({});
  const refs = usePartnerReferences([association]);
  const rows: Item[] =
    kind === 'facilities'
      ? (refs.facilities.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
        }))
      : (refs.products.data ?? []).map((item) => ({
          id: item.id,
          name: item.fullProductName,
          code: item.productCode,
        }));
  const filtered = rows.filter((item) => matchesNameOrCode(item, query));
  const size = search.size ?? 10;
  const page = Math.min(search.page ?? 1, Math.max(1, Math.ceil(filtered.length / size)));
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: t('supply-partners.name'),
          cell: ({ getValue }) => <span dir="auto">{getValue()}</span>,
        }),
        helper.accessor('code', {
          header: t('supply-partners.code'),
          cell: ({ getValue }) => <span dir="auto">{getValue()}</span>,
        }),
      ]),
    [t],
  );
  const state = useTableSearchState({
    search: { ...search, page },
    defaultSort: NO_SORT,
    onSearchChange: (update) => setSearch((previous) => ({ ...previous, ...update(previous) })),
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: filtered.slice((page - 1) * size, page * size),
    rowCount: filtered.length,
    getRowId: (row) => row.id,
    manualPagination: true,
    enableSorting: false,
    ...state,
  });
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>
          {t(
            kind === 'facilities'
              ? 'supply-partners.view-facilities'
              : 'supply-partners.view-products',
          )}
        </FormDialogTitle>
        <FormDialogDescription>{t('supply-partners.view-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody layout="table">
        <DataTableSearch
          value={query}
          placeholder={t('supply-partners.search-items')}
          onValueChange={(value) => {
            setQuery(value);
            setSearch((old) => ({ ...old, page: undefined }));
          }}
        />
        <ReferenceStatus associations={[association]} />
        {(kind === 'facilities' ? refs.facilities.isSuccess : refs.products.isSuccess) && (
          <DataTable
            layout="auto"
            table={table}
            empty={
              <DataTableEmpty
                icon={<SearchXIcon />}
                title={t(
                  query
                    ? 'supply-partners.no-matches'
                    : kind === 'facilities'
                      ? 'supply-partners.no-facilities'
                      : 'supply-partners.no-products',
                )}
                description={query ? t('supply-partners.no-matches-description') : undefined}
                action={
                  query && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setQuery('');
                        setSearch((old) => ({ ...old, page: undefined }));
                      }}
                    >
                      {t('supply-partners.clear-search')}
                    </Button>
                  )
                }
              />
            }
            footer={filtered.length > 0 && <DataTablePagination table={table} />}
          />
        )}
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
