import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import {
  DataTableComboboxFilter,
  DataTableSelectFilter,
} from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { LoadError } from '@/components/load-error';
import { Skeleton } from '@/components/ui/skeleton';
import { minimalFacilitiesOptions, programsOptions } from '@/features/reference-data/api/queries';
import {
  CLEARED_SUPPLY_LINE_FILTERS,
  SUPPLY_LINE_HIDEABLE_COLUMNS,
  type SupplyLinesSearch,
} from '@/features/supply-lines/lib/search';
import { withPicked } from '@/lib/filter-options';

type FilterProps = {
  search: SupplyLinesSearch;
  onFilterChange: (patch: Partial<SupplyLinesSearch>) => void;
};

export function SupplyLinesToolbar({
  search,
  onFilterChange,
  columnView,
  disabled = false,
}: FilterProps & {
  columnView: ReturnType<typeof useColumnVisibility>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <DataTableToolbar>
      <div className="flex-1 @2xl/main:flex-none">
        <DataTableFilters
          disabled={disabled}
          activeCount={[search.supplyingFacilityId, search.programId].filter(Boolean).length}
          onClear={() => onFilterChange(CLEARED_SUPPLY_LINE_FILTERS)}
        >
          <FacilityFilter search={search} onFilterChange={onFilterChange} />
          <ProgramFilter search={search} onFilterChange={onFilterChange} />
        </DataTableFilters>
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          disabled={disabled}
          columns={SUPPLY_LINE_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
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

function FacilityFilter({ search, onFilterChange }: FilterProps) {
  const { t } = useTranslation();
  const query = useQuery(minimalFacilitiesOptions());
  const picked = withPicked(
    query.data
      ?.toSorted((a, b) => a.name.localeCompare(b.name))
      .map((facility) => ({
        value: facility.id,
        label: facility.name,
        description: facility.code,
      })) ?? [],
    search.supplyingFacilityId,
    t('supply-lines.unknown-facility'),
  );
  return (
    <div className="flex flex-col gap-2">
      {query.isPending ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t('supply-lines.facilities-loading')}
          className="h-8 w-full"
        >
          <Skeleton fill />
        </div>
      ) : (
        <DataTableComboboxFilter
          label={t('supply-lines.supplying-facility')}
          options={picked.options}
          value={picked.value}
          onValueChange={(id) =>
            onFilterChange({ supplyingFacilityId: id || undefined, page: undefined })
          }
        />
      )}
      {query.isError && (
        <LoadError
          error={query.error}
          reset={() => {
            void query.refetch();
          }}
          title={t('supply-lines.facilities-error')}
          description={t('supply-lines.lookup-error-description')}
        />
      )}
    </div>
  );
}

function ProgramFilter({ search, onFilterChange }: FilterProps) {
  const { t } = useTranslation();
  const query = useQuery(programsOptions());
  const picked = withPicked(
    query.data?.map((program) => ({ value: program.id, label: program.name ?? program.code })) ??
      [],
    search.programId,
    t('supply-lines.unknown-program'),
  );
  return (
    <div className="flex flex-col gap-2">
      {query.isPending ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t('supply-lines.programs-loading')}
          className="h-8 w-full"
        >
          <Skeleton fill />
        </div>
      ) : (
        <DataTableSelectFilter
          label={t('supply-lines.program')}
          options={picked.options}
          value={picked.value}
          onValueChange={(id) => onFilterChange({ programId: id || undefined, page: undefined })}
        />
      )}
      {query.isError && (
        <LoadError
          error={query.error}
          reset={() => {
            void query.refetch();
          }}
          title={t('supply-lines.programs-error')}
          description={t('supply-lines.lookup-error-description')}
        />
      )}
    </div>
  );
}
