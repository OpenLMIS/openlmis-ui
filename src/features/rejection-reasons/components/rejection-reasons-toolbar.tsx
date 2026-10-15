import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import {
  REJECTION_REASON_HIDEABLE_COLUMNS,
  type RejectionReasonsListSearch,
} from '@/features/rejection-reasons/lib/search';
import type { SearchChange } from '@/lib/table-search';

type RejectionReasonsToolbarProps = {
  search: RejectionReasonsListSearch;
  onSearchChange: SearchChange<RejectionReasonsListSearch>;
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd: () => void;
};

export function RejectionReasonsToolbar({
  search,
  onSearchChange,
  columnView,
  onAdd,
}: RejectionReasonsToolbarProps) {
  const { t } = useTranslation();
  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          label={t('rejection-reasons.search')}
          value={search.name ?? ''}
          onValueChange={(name) =>
            onSearchChange({ name: name || undefined, page: undefined }, true)
          }
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={REJECTION_REASON_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      <div className="flex-1 @2xl/main:flex-none">
        <Button onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('rejection-reasons.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
