import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import {
  DataTableComboboxFilter,
  DataTableSelectFilter,
} from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { minimalFacilitiesOptions, programsOptions } from '@/features/reference-data/api/queries';
import type { ConvertSearch } from '@/features/requisitions/lib/convert-search';
import { withPicked } from '@/lib/filter-options';

export function ConvertToolbar({
  search,
  onFilterChange,
  view,
  disabled = false,
}: {
  search: ConvertSearch;
  onFilterChange: (patch: Partial<ConvertSearch>) => void;
  view: ReactNode;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { data: facilities } = useQuery(minimalFacilitiesOptions());
  const { data: programs } = useQuery(programsOptions());
  const unknown = t('valid-assignments.unknown');
  const facilityOptions = useMemo(() => {
    const collator = new Intl.Collator(i18n.language);
    return facilities
      ?.toSorted((a, b) => collator.compare(a.name ?? '', b.name ?? ''))
      .map(({ id, name }) => ({ value: id, label: name ?? id }));
  }, [facilities, i18n.language]);
  const facility = withPicked(facilityOptions, search.facilityId, unknown);
  const program = withPicked(
    programs?.map(({ id, name }) => ({ value: id, label: name ?? id })),
    search.programId,
    unknown,
  );
  return (
    <DataTableToolbar>
      <div className="flex-1 @2xl/main:me-auto @2xl/main:flex-none">
        <DataTableFilters
          size="lg"
          disabled={disabled}
          activeCount={[search.facilityId, search.programId].filter(Boolean).length}
          onClear={() =>
            onFilterChange({ facilityId: undefined, programId: undefined, page: undefined })
          }
        >
          <DataTableComboboxFilter
            label={t('requisitions.columns.facility')}
            options={facility.options}
            value={facility.value}
            onValueChange={(facilityId) =>
              onFilterChange({ facilityId: facilityId || undefined, page: undefined })
            }
          />
          <DataTableSelectFilter
            label={t('requisitions.filters.program')}
            options={program.options}
            value={program.value}
            disabled={!programs || disabled}
            onValueChange={(programId) =>
              onFilterChange({ programId: programId || undefined, page: undefined })
            }
          />
        </DataTableFilters>
      </div>
      <div className="flex-1 @2xl/main:flex-none">{view}</div>
    </DataTableToolbar>
  );
}
