import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableComboboxFilter } from '@/components/data-table/data-table-filters';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { FACILITY_HIDEABLE_COLUMNS, type FacilitiesSearch } from '@/features/facilities/lib/search';
import { toZoneFilter } from '@/features/facilities/lib/zone-filter';
import { geographicZonesOptions } from '@/features/reference-data/api/queries';

type FacilitiesToolbarProps = {
  search: FacilitiesSearch;
  onFilterChange: (patch: Partial<FacilitiesSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd: () => void;
};

export function FacilitiesToolbar({
  search,
  onFilterChange,
  columnView,
  onAdd,
}: FacilitiesToolbarProps) {
  const { t } = useTranslation();
  const { data: zones } = useQuery(geographicZonesOptions());
  const zoneFilter = useMemo(
    () => toZoneFilter(zones, search.zoneId, t('facilities.unknown-zone')),
    [zones, search.zoneId, t],
  );

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          onValueChange={(name) => onFilterChange({ name: name || undefined, page: undefined })}
          placeholder={t('facilities.search')}
          value={search.name ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:w-72 @2xl/main:flex-none">
        <DataTableComboboxFilter
          label={t('facilities.zone')}
          onValueChange={(zoneId) =>
            onFilterChange({ zoneId: zoneId || undefined, page: undefined })
          }
          options={zoneFilter.options}
          value={zoneFilter.value}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={FACILITY_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      <div className="w-full @2xl/main:w-auto">
        <Button onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('facilities.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
