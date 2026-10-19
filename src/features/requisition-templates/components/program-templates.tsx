import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon, SettingsIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { FlagBadge } from '@/components/flag-badge';
import { TableCards } from '@/components/table-cards';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

export function useTemplatesTable(templates = NO_TEMPLATES, types = NO_TYPES, cards = false) {
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
          meta: { className: 'min-w-56 w-1/3' },
        }),
        helper.display({
          id: 'facilityTypes',
          header: t('requisition-templates.facility-type'),
          cell: ({ row }) =>
            row.original.facilityTypes.length > 0 ? (
              <FacilityTypesCell template={row.original} types={types} />
            ) : null,
          meta: { className: 'min-w-48 w-1/4', label: t('requisition-templates.facility-type') },
        }),
        helper.accessor('requisitionReportOnly', {
          header: t('requisition-templates.report-only'),
          meta: { className: 'min-w-32', label: t('requisition-templates.report-only') },
          cell: ({ getValue }) => (
            <FlagBadge
              value={getValue()}
              trueLabel={t('requisition-templates.yes')}
              falseLabel={t('requisition-templates.no')}
            />
          ),
        }),
        helper.display({
          id: 'actions',
          header: () => <span className="sr-only">{t('requisition-templates.action')}</span>,
          meta: { className: 'w-16' },
          cell: ({ row }) =>
            cards ? (
              <CardActions
                actions={[
                  {
                    id: 'configure',
                    icon: <SettingsIcon />,
                    label: t('requisition-templates.configure'),
                    name: t('requisition-templates.configure-template', {
                      template: row.original.name,
                    }),
                    link: (
                      <Link
                        to="/administration/requisition-templates/$id"
                        params={{ id: row.original.id }}
                      />
                    ),
                  },
                ]}
              />
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      aria-label={t('requisition-templates.configure-template', {
                        template: row.original.name,
                      })}
                      className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
                      to="/administration/requisition-templates/$id"
                      params={{ id: row.original.id }}
                    />
                  }
                >
                  <SettingsIcon />
                </TooltipTrigger>
                <TooltipContent>{t('requisition-templates.configure')}</TooltipContent>
              </Tooltip>
            ),
        }),
      ]),
    [t, types, cards],
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
  cards,
  program,
  templates,
  types,
}: {
  cards: boolean;
  program: Program;
  templates: RequisitionTemplate[];
  types: FacilityType[];
}) {
  const { t } = useTranslation();
  const table = useTemplatesTable(templates, types, cards);
  const empty = (
    <DataTableEmpty
      icon={<ClipboardListIcon />}
      title={t('requisition-templates.empty-program', { program: programName(program) })}
      description={t('requisition-templates.empty-program-description')}
    />
  );
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="font-semibold text-lg" dir="auto">
        {programName(program)}
      </h2>
      {cards ? (
        <TableCards empty={empty} table={table} title="name" />
      ) : (
        <DataTable empty={empty} layout="auto" table={table} />
      )}
    </section>
  );
}

export function ProgramTemplateSections({ cards }: { cards: boolean }) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(programsOptions());
  const { data: templates } = useSuspenseQuery(requisitionTemplatesOptions());
  const { data: types } = useSuspenseQuery(facilityTypesOptions());
  const groups = groupTemplatesByProgram(programs, templates);
  if (!groups.length)
    return (
      <DataTableEmpty
        icon={<ClipboardListIcon />}
        title={t('requisition-templates.no-programs')}
        description={t('requisition-templates.no-programs-description')}
      />
    );
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {groups.map(({ program, templates }) => (
        <ProgramTemplates
          cards={cards}
          key={program.id}
          program={program}
          templates={templates}
          types={types}
        />
      ))}
    </div>
  );
}
