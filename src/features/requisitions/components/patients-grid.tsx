import { createColumnHelper, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { FlagBadge } from '@/components/flag-badge';
import { TableCards } from '@/components/table-cards';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type PatientRow, parsePatients } from '@/features/requisitions/lib/patients';
import { useCardLayout } from '@/hooks/use-card-view';

type Row = { id: string; heading?: string; patient?: PatientRow };
const helper = createColumnHelper<DataTableFeatures, Row>();
const rowKeys = {
  numberOfAdultPatients: 'requisitions.patients.adult-patients',
  numberOfChildren: 'requisitions.patients.children',
  numberOfRetreatmentPatients: 'requisitions.patients.retreatment-patients',
  numberOfAdultsOnIPT: 'requisitions.patients.adults-ipt',
  numberOfChildrenOnIPT: 'requisitions.patients.children-ipt',
  numberOfAdultOnMBRegimen: 'requisitions.patients.adults-mb',
  numberOfAdultOnPBRegimen: 'requisitions.patients.adults-pb',
  numberOfChildrenOnMBRegimen: 'requisitions.patients.children-mb',
  numberOfChildrenOnPBRegimen: 'requisitions.patients.children-pb',
} as const;
export function PatientsGrid({ patientsData }: { patientsData?: string | null }) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const patients = useMemo(() => parsePatients(patientsData), [patientsData]);
  const data = useMemo(
    () =>
      [
        { group: t('requisitions.patients.tb'), rows: patients.TBData[0] ?? [] },
        { group: t('requisitions.patients.leprosy'), rows: patients.leprosyData[0] ?? [] },
      ].flatMap(({ group, rows }) =>
        rows.length
          ? [
              { id: group, heading: group },
              ...rows.map((patient) => ({ id: `${group}:${patient.key}`, patient })),
            ]
          : [],
      ),
    [patients, t],
  );
  const label = (row: PatientRow) =>
    row.key in rowKeys ? t(rowKeys[row.key as keyof typeof rowKeys]) : row.key;
  const flag = (row: PatientRow) => (
    <FlagBadge
      value={row.isSkipped}
      trueLabel={t('requisitions.yes')}
      falseLabel={t('requisitions.no')}
    />
  );
  const skip = t('requisitions.patients.skip');
  const month = (index: number) => new Intl.NumberFormat(i18n.language).format(index + 1);
  const columns = [
    ...(!cards
      ? [
          helper.display({
            id: 'skip',
            header: skip,
            cell: ({ row }) =>
              row.original.patient ? (
                <Checkbox
                  disabled
                  checked={row.original.patient.isSkipped}
                  aria-label={`${skip}: ${label(row.original.patient)}`}
                />
              ) : null,
          }),
        ]
      : []),
    helper.display({
      id: 'patient',
      header: t('requisitions.patients.month-of-treatment'),
      cell: ({ row }) =>
        row.original.patient ? (
          <span className="flex flex-wrap items-center gap-2">
            <bdi>{label(row.original.patient)}</bdi>
            {cards && flag(row.original.patient)}
          </span>
        ) : null,
    }),
    ...Array.from({ length: 12 }, (_, index) =>
      helper.display({
        id: `month${index}`,
        header: month(index),
        meta: { label: month(index) },
        cell: ({ row }) => {
          const value = row.original.patient?.data[index];
          if (!value || value.disabled) return null;
          return value.value == null || value.value === ''
            ? null
            : new Intl.NumberFormat(i18n.language).format(Number(value.value));
        },
      }),
    ),
  ];
  const table = useTable({ features: dataTableFeatures, columns, data });
  const empty = <DataTableEmpty title={t('requisitions.patients.empty')} />;
  return (
    <div ref={measure}>
      {cards ? (
        <TableCards
          table={table}
          title="patient"
          heading={(row) => row.heading}
          tone={(row) => (row.patient?.isSkipped ? 'skipped' : undefined)}
          empty={empty}
          detailVisible={(row, id) =>
            !id.startsWith('month') || !row.patient?.data[Number(id.slice(5))]?.disabled
          }
        />
      ) : (
        <DataTableCard>
          <Table
            density="compact"
            layout="auto"
            aria-label={t('requisitions.requisition.patients')}
          >
            <TableHeader surface="muted">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.id}>
                    <DataTableHeaderLabel>{column.header as string}</DataTableHeaderLabel>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) =>
                  row.original.heading !== undefined ? (
                    <TableRow key={row.id} surface="primary">
                      <TableCell colSpan={14}>
                        <div className="ps-6">{row.original.heading}</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={row.id}
                      tone={row.original.patient?.isSkipped ? 'skipped' : undefined}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const render = cell.column.columnDef.cell;
                        return (
                          <TableCell key={cell.id}>
                            {typeof render === 'function' ? render(cell.getContext()) : render}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ),
                )
              ) : (
                <TableRow>
                  <TableCell colSpan={14}>{empty}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}
