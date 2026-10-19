import { createColumnHelper, useTable } from '@tanstack/react-table';
import { SearchXIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DialogNotFound } from '@/components/dialog-parts';
import { DialogTable } from '@/components/dialog-table';
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
  type Member,
  memberColumns,
} from '@/features/supply-partners/components/association-members-table';
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
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { type TableSearch, useTableSearchState } from '@/lib/table-search';
import { cn } from '@/lib/utils';

const helper = createColumnHelper<DataTableFeatures, Member>();
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
    <FormDialog {...dialogProps(pending)} closeButton={!pending} size="table">
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
  const rows: Member[] =
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
  const columns = useMemo(() => helper.columns(memberColumns(t)), [t]);
  const { measure, cards } = useDialogCardLayout<HTMLDivElement>('table');
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
        <div className={cn('flex flex-col gap-4', cards && 'min-h-0 flex-1')} ref={measure}>
          <search className="w-full max-w-sm">
            <DataTableSearch
              value={query}
              placeholder={t('supply-partners.search-items')}
              onValueChange={(value) => {
                setQuery(value);
                setSearch((old) => ({ ...old, page: undefined }));
              }}
            />
          </search>
          <ReferenceStatus associations={[association]} />
          {(kind === 'facilities' ? refs.facilities.isSuccess : refs.products.isSuccess) && (
            <DialogTable
              cards={cards}
              layout="auto"
              table={table}
              title="name"
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
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
