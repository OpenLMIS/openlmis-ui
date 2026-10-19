import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_REJECTION_REASONS_SORT,
  REJECTION_REASON_HIDEABLE_COLUMNS,
  REJECTION_REASON_SORT_COLUMNS,
  type RejectionReasonsListSearch,
} from '@/features/rejection-reasons/lib/search';
import { type SearchChange, searchSort } from '@/lib/table-search';

type RejectionReasonsToolbarProps = {
  search: RejectionReasonsListSearch;
  onSearchChange: SearchChange<RejectionReasonsListSearch>;
  columnView: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
  onAdd: () => void;
};

export function RejectionReasonsToolbar({
  search,
  onSearchChange,
  columnView,
  layout,
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
          layout={layout}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          sort={{
            columns: REJECTION_REASON_SORT_COLUMNS.map(({ id, labelKey }) => ({
              id,
              label: t(labelKey),
            })),
            ...searchSort<RejectionReasonsListSearch>(
              search,
              DEFAULT_REJECTION_REASONS_SORT,
              onSearchChange,
            ),
          }}
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
