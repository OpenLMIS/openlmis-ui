import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { buttonVariants } from '@/components/ui/button';
import { facilityTypesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import type { FacilityType, Program } from '@/features/reference-data/lib/types';
import { requisitionTemplatesOptions } from '@/features/requisition-templates/api/queries';
import { FacilityTypesCell } from '@/features/requisition-templates/components/facility-types-cell';
import { groupTemplatesByProgram } from '@/features/requisition-templates/lib/templates-list';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';

const helper = createColumnHelper<DataTableFeatures, RequisitionTemplate>();
const NO_TEMPLATES: RequisitionTemplate[] = [];
const NO_TYPES: FacilityType[] = [];

export function useTemplatesTable(templates = NO_TEMPLATES, types = NO_TYPES) {
  const { t } = useTranslation();
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: t('requisition-templates.name'),
          cell: ({ getValue }) => (
            <span className="whitespace-normal break-words font-medium" dir="auto">
              {getValue()}
            </span>
          ),
          meta: { className: 'w-1/3' },
        }),
        helper.display({
          id: 'facilityTypes',
          header: t('requisition-templates.facility-type'),
          cell: ({ row }) => <FacilityTypesCell template={row.original} types={types} />,
          meta: { className: 'w-1/4' },
        }),
        helper.accessor('requisitionReportOnly', {
          header: t('requisition-templates.report-only'),
          cell: ({ getValue }) =>
            getValue() ? (
              t('requisition-templates.yes')
            ) : (
              <span className="text-muted-foreground">{t('requisition-templates.no')}</span>
            ),
        }),
        helper.display({
          id: 'actions',
          header: t('requisition-templates.action'),
          meta: { className: 'w-32' },
          cell: ({ row }) => (
            <Link
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
              to="/administration/requisition-templates/$id"
              params={{ id: row.original.id }}
            >
              {t('requisition-templates.configure')}
            </Link>
          ),
        }),
      ]),
    [t, types],
  );
  return useTable({
    features: dataTableFeatures,
    columns,
    data: templates,
    getRowId: (row) => row.id,
    enableSorting: false,
  });
}

function ProgramTemplates({
  program,
  templates,
  types,
}: {
  program: Program;
  templates: RequisitionTemplate[];
  types: FacilityType[];
}) {
  const { t } = useTranslation();
  const table = useTemplatesTable(templates, types);
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="font-semibold text-lg" dir="auto">
        {programName(program)}
      </h2>
      <DataTable
        table={table}
        empty={
          <DataTableEmpty
            title={t('requisition-templates.empty-program', { program: programName(program) })}
          />
        }
      />
    </section>
  );
}

export function ProgramTemplateSections() {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(programsOptions());
  const { data: templates } = useSuspenseQuery(requisitionTemplatesOptions());
  const { data: types } = useSuspenseQuery(facilityTypesOptions());
  const groups = groupTemplatesByProgram(programs, templates);
  if (!groups.length) return <DataTableEmpty title={t('requisition-templates.no-programs')} />;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {groups.map(({ program, templates }) => (
        <ProgramTemplates key={program.id} program={program} templates={templates} types={types} />
      ))}
    </div>
  );
}
