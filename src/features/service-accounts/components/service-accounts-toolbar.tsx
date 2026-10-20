import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_SERVICE_ACCOUNTS_SORT,
  type ServiceAccountsSearch,
} from '@/features/service-accounts/lib/search';
import { searchSort } from '@/lib/table-search';

type ServiceAccountsToolbarProps = {
  search: ServiceAccountsSearch;
  onSortChange: (patch: Partial<ServiceAccountsSearch>) => void;
  layout: 'table' | 'cards';
  onAdd: () => void;
  disabled?: boolean;
};

export function ServiceAccountsToolbar({
  search,
  onSortChange,
  layout,
  onAdd,
  disabled = false,
}: ServiceAccountsToolbarProps) {
  const { t } = useTranslation();
  const add = (
    <Button disabled={disabled} onClick={onAdd} width="full">
      <PlusIcon data-icon="inline-start" />
      {t('service-accounts.add')}
    </Button>
  );

  if (layout === 'table') {
    return (
      <DataTableToolbar>
        <div className="w-full @2xl/main:ms-auto @2xl/main:w-auto">{add}</div>
      </DataTableToolbar>
    );
  }
  return (
    <DataTableToolbar>
      <DataTableViewOptions
        disabled={disabled}
        layout={layout}
        sort={{
          columns: [{ id: 'createdDate', label: t('service-accounts.created') }],
          ...searchSort(search, DEFAULT_SERVICE_ACCOUNTS_SORT, onSortChange),
        }}
      />
      <div className="flex-1">{add}</div>
    </DataTableToolbar>
  );
}
