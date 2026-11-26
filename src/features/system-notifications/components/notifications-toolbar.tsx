import { PlusIcon } from 'lucide-react';
import { type ComponentProps, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableComboboxFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useComboboxFilter } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import {
  CLEARED_NOTIFICATION_FILTERS,
  type NotificationsSearch,
  SYSTEM_NOTIFICATION_HIDEABLE_COLUMNS,
} from '@/features/system-notifications/lib/search';

type AuthorFilterProps = Pick<
  ComponentProps<typeof DataTableComboboxFilter>,
  'options' | 'onOpenChange' | 'emptyMessage' | 'status'
>;

type NotificationsToolbarProps = {
  search: NotificationsSearch;
  onFilterChange: (patch: Partial<NotificationsSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
  authorFilter?: AuthorFilterProps | undefined;
  onAdd: () => void;
  disabled?: boolean;
};

export function NotificationsToolbar({
  search,
  onFilterChange,
  columnView,
  layout,
  authorFilter,
  onAdd,
  disabled,
}: NotificationsToolbarProps) {
  const { t } = useTranslation();
  const displayedId = useId();
  const { contains } = useComboboxFilter();

  return (
    <DataTableToolbar>
      <div className="flex-1 @2xl/main:me-auto @2xl/main:flex-none">
        <DataTableFilters
          activeCount={Number(Boolean(search.authorId)) + Number(Boolean(search.displayed))}
          disabled={disabled}
          onClear={() => onFilterChange(CLEARED_NOTIFICATION_FILTERS)}
          size="lg"
        >
          {authorFilter && (
            <DataTableComboboxFilter
              {...authorFilter}
              filter={(option, query) =>
                contains(option.label, query) || contains(option.description ?? '', query)
              }
              label={t('system-notifications.admin.author')}
              limit={authorFilter.options.length}
              onValueChange={(authorId) =>
                onFilterChange({ authorId: authorId || undefined, page: undefined })
              }
              value={search.authorId ?? ''}
            />
          )}
          <Label htmlFor={displayedId}>
            <Checkbox
              checked={Boolean(search.displayed)}
              id={displayedId}
              onCheckedChange={(checked) =>
                onFilterChange({ displayed: checked ? true : undefined, page: undefined })
              }
            />
            {t('system-notifications.admin.only-displayed')}
          </Label>
        </DataTableFilters>
      </div>
      <div className="flex w-full items-center gap-2 @2xl/main:w-auto">
        <div className="shrink-0">
          <DataTableViewOptions
            columns={SYSTEM_NOTIFICATION_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
              id,
              label: t(labelKey),
            }))}
            disabled={disabled}
            layout={layout}
            onReset={columnView.onReset}
            onVisibilityChange={columnView.onVisibilityChange}
            size="lg"
            visibility={columnView.visibility}
          />
        </div>
        <div className="min-w-0 flex-1 @2xl/main:flex-none">
          <Button disabled={disabled} onClick={onAdd} size="lg" width="full">
            <PlusIcon data-icon="inline-start" />
            {t('system-notifications.admin.add-title')}
          </Button>
        </div>
      </div>
    </DataTableToolbar>
  );
}
