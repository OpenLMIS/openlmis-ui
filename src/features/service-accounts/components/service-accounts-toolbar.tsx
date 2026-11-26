import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableAddToolbar } from '@/components/data-table/data-table-add-toolbar';
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
  return (
    <DataTableAddToolbar
      disabled={disabled}
      layout={layout}
      sort={{
        columns: [{ id: 'createdDate', label: t('service-accounts.created') }],
        ...searchSort(search, DEFAULT_SERVICE_ACCOUNTS_SORT, onSortChange),
      }}
    >
      <Button disabled={disabled} onClick={onAdd} size="lg" width="full">
        <PlusIcon data-icon="inline-start" />
        {t('service-accounts.add')}
      </Button>
    </DataTableAddToolbar>
  );
}
