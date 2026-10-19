import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import {
  DataTableComboboxFilter,
  DataTableSelectFilter,
} from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import {
  GEOGRAPHIC_ZONE_HIDEABLE_COLUMNS,
  type GeographicZonesSearch,
} from '@/features/geographic-zones/lib/search';
import {
  geographicLevelsOptions,
  geographicZonesOptions,
} from '@/features/reference-data/api/queries';
import { toZoneOption } from '@/features/reference-data/lib/zone-filter';
import { withPicked } from '@/lib/filter-options';

type GeographicZonesToolbarProps = {
  search: GeographicZonesSearch;
  onFilterChange: (patch: Partial<GeographicZonesSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
};

export function GeographicZonesToolbar({
  search,
  onFilterChange,
  columnView,
  layout,
}: GeographicZonesToolbarProps) {
  const { t } = useTranslation();
  const { data: zones } = useQuery(geographicZonesOptions());
  const { data: levels } = useQuery(geographicLevelsOptions());
  const parentFilter = useMemo(
    () => withPicked(zones?.map(toZoneOption), search.parent, t('geographic-zones.unknown-parent')),
    [zones, search.parent, t],
  );
  const levelFilter = withPicked(
    levels?.map((level) => ({ value: String(level.levelNumber), label: level.name ?? level.code })),
    search.levelNumber === undefined ? undefined : String(search.levelNumber),
    t('geographic-zones.unknown-level'),
  );
  const activeCount =
    Number(Boolean(search.code)) +
    Number(Boolean(search.parent)) +
    Number(search.levelNumber !== undefined);

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          onValueChange={(name) => onFilterChange({ name: name || undefined, page: undefined })}
          placeholder={t('geographic-zones.search')}
          value={search.name ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:flex-none">
        <DataTableFilters
          activeCount={activeCount}
          onClear={() =>
            onFilterChange({
              code: undefined,
              parent: undefined,
              levelNumber: undefined,
              page: undefined,
            })
          }
        >
          <DataTableSearch
            onValueChange={(code) => onFilterChange({ code: code || undefined, page: undefined })}
            placeholder={t('geographic-zones.search-code')}
            value={search.code ?? ''}
          />
          <DataTableComboboxFilter
            label={t('geographic-zones.parent')}
            limit={-1}
            onValueChange={(parent) =>
              onFilterChange({ parent: parent || undefined, page: undefined })
            }
            options={parentFilter.options}
            value={parentFilter.value}
          />
          <DataTableSelectFilter
            allLabel={t('geographic-zones.all-levels')}
            label={t('geographic-zones.level')}
            onValueChange={(level) =>
              onFilterChange({
                levelNumber: level === '' ? undefined : Number(level),
                page: undefined,
              })
            }
            options={levelFilter.options}
            value={levelFilter.value}
          />
        </DataTableFilters>
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={GEOGRAPHIC_ZONE_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          layout={layout}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
    </DataTableToolbar>
  );
}
