import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import {
  DataTableComboboxFilter,
  DataTableSelectFilter,
} from '@/components/data-table/data-table-filters';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { toFacilityOption, toProgramOption } from '@/components/valid-assignments/options';
import {
  ASSIGNMENT_HIDEABLE_COLUMNS,
  type AssignmentsSearch,
} from '@/components/valid-assignments/search';
import type { AssignmentKind } from '@/components/valid-assignments/types';
import { minimalFacilitiesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { withPicked } from '@/lib/filter-options';

type AssignmentsToolbarProps = {
  kind: AssignmentKind;
  search: AssignmentsSearch;
  onFilterChange: (patch: Partial<AssignmentsSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd: () => void;
};

export function AssignmentsToolbar({
  kind,
  search,
  onFilterChange,
  columnView,
  onAdd,
}: AssignmentsToolbarProps) {
  const { t } = useTranslation();
  const { data: facilities } = useQuery(minimalFacilitiesOptions());
  const { data: programs } = useQuery(programsOptions());
  const unknown = t('valid-assignments.unknown');
  const facilityFilter = useMemo(
    () => withPicked(facilities?.map(toFacilityOption), search.facilityId, unknown),
    [facilities, search.facilityId, unknown],
  );
  const programFilter = useMemo(
    () => withPicked(programs?.map(toProgramOption), search.programId, unknown),
    [programs, search.programId, unknown],
  );

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableComboboxFilter
          label={t('valid-assignments.facility')}
          onValueChange={(facilityId) =>
            onFilterChange({ facilityId: facilityId || undefined, page: undefined })
          }
          options={facilityFilter.options}
          value={facilityFilter.value}
        />
      </div>
      <div className="flex-1 @2xl/main:w-64 @2xl/main:flex-none">
        <DataTableSelectFilter
          label={t('valid-assignments.program')}
          onValueChange={(programId) =>
            onFilterChange({ programId: programId || undefined, page: undefined })
          }
          options={programFilter.options}
          value={programFilter.value}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={ASSIGNMENT_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
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
          {t('valid-assignments.add', { kind })}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
