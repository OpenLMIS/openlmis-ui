import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import {
  DataTableComboboxFilter,
  DataTableSelectFilter,
} from '@/components/data-table/data-table-filters';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { geographicZonesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { toProgramFilter } from '@/features/reference-data/lib/program-filter';
import { toZoneOption } from '@/features/reference-data/lib/zone-filter';
import {
  REQUISITION_GROUP_HIDEABLE_COLUMNS,
  type RequisitionGroupsListSearch,
} from '@/features/requisition-groups/lib/search';
import { withPicked } from '@/lib/filter-options';

type RequisitionGroupsToolbarProps = {
  search: RequisitionGroupsListSearch;
  onFilterChange: (patch: Partial<RequisitionGroupsListSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
};

export function RequisitionGroupsToolbar({
  search,
  onFilterChange,
  columnView,
}: RequisitionGroupsToolbarProps) {
  const { t } = useTranslation();
  const { data: zones } = useQuery(geographicZonesOptions());
  const zoneFilter = useMemo(
    () =>
      withPicked(
        zones?.map((zone) => ({ ...toZoneOption(zone), value: zone.code })),
        search.zone,
        t('requisition-groups.unknown-zone'),
      ),
    [zones, search.zone, t],
  );

  const { data: programs } = useQuery(programsOptions());
  const programFilter = useMemo(
    () => toProgramFilter(programs, search.program),
    [programs, search.program],
  );

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          onValueChange={(name) => onFilterChange({ name: name || undefined, page: undefined })}
          placeholder={t('requisition-groups.search')}
          value={search.name ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:w-72 @2xl/main:flex-none">
        <DataTableComboboxFilter
          label={t('requisition-groups.zone')}
          limit={-1}
          onValueChange={(zone) => onFilterChange({ zone: zone || undefined, page: undefined })}
          options={zoneFilter.options}
          value={zoneFilter.value}
        />
      </div>
      <div className="flex-1 @2xl/main:w-72 @2xl/main:flex-none">
        <DataTableSelectFilter
          allLabel={t('requisition-groups.all-programs')}
          label={t('requisition-groups.program')}
          onValueChange={(program) =>
            onFilterChange({ program: program || undefined, page: undefined })
          }
          options={programFilter.options}
          value={programFilter.value}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={REQUISITION_GROUP_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      <div className="w-full @2xl/main:w-auto">
        <Button
          render={
            <Link
              to="/administration/requisition-groups/new"
              state={{ requisitionGroupsListSearch: search }}
            />
          }
          width="full"
        >
          <PlusIcon data-icon="inline-start" />
          {t('requisition-groups.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
