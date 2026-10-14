import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableComboboxFilter } from '@/components/data-table/data-table-filters';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { geographicZonesOptions } from '@/features/reference-data/api/queries';
import { toZoneOption } from '@/features/reference-data/lib/zone-filter';
import {
  SUPERVISORY_NODE_HIDEABLE_COLUMNS,
  type SupervisoryNodesSearch,
} from '@/features/supervisory-nodes/lib/search';
import { withPicked } from '@/lib/filter-options';

type SupervisoryNodesToolbarProps = {
  search: SupervisoryNodesSearch;
  onFilterChange: (patch: Partial<SupervisoryNodesSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
};

export function SupervisoryNodesToolbar({
  search,
  onFilterChange,
  columnView,
}: SupervisoryNodesToolbarProps) {
  const { t } = useTranslation();
  const { data: zones } = useQuery(geographicZonesOptions());
  const zoneFilter = useMemo(
    () => withPicked(zones?.map(toZoneOption), search.zoneId, t('supervisory-nodes.unknown-zone')),
    [zones, search.zoneId, t],
  );

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          onValueChange={(name) => onFilterChange({ name: name || undefined, page: undefined })}
          placeholder={t('supervisory-nodes.search')}
          value={search.name ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:w-72 @2xl/main:flex-none">
        <DataTableComboboxFilter
          label={t('supervisory-nodes.zone')}
          limit={-1}
          onValueChange={(zoneId) =>
            onFilterChange({ zoneId: zoneId || undefined, page: undefined })
          }
          options={zoneFilter.options}
          value={zoneFilter.value}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={SUPERVISORY_NODE_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
    </DataTableToolbar>
  );
}
