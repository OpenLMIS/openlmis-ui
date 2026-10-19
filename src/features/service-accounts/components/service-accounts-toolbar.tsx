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
};

const noop = () => {};

export function ServiceAccountsToolbar({
  search,
  onSortChange,
  layout,
  onAdd,
}: ServiceAccountsToolbarProps) {
  const { t } = useTranslation();
  const add = (
    <Button onClick={onAdd} width="full">
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
        columns={[]}
        layout={layout}
        onVisibilityChange={noop}
        sort={{
          columns: [{ id: 'createdDate', label: t('service-accounts.created') }],
          ...searchSort(search, DEFAULT_SERVICE_ACCOUNTS_SORT, onSortChange),
        }}
        visibility={{}}
      />
      <div className="flex-1">{add}</div>
    </DataTableToolbar>
  );
}
