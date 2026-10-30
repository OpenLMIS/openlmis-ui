import { useStore } from '@tanstack/react-form';
import { createColumnHelper, FlexRender, useTable } from '@tanstack/react-table';
import { Fragment, memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { CardList } from '@/components/display/card-list';
import { TableCards } from '@/components/display/table-cards';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PATIENT_ROW_KEYS,
  PatientEditRow,
} from '@/features/requisitions/components/patients-edit-cards';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';
import {
  applyPatientChanges,
  PATIENT_MONTHS,
  type PatientRow,
  parsePatients,
  patientFieldId,
  validatePatients,
} from '@/features/requisitions/lib/patients';
import { useCardLayout } from '@/hooks/use-card-view';

type Row = { id: string; heading?: string; patient?: PatientRow };
const helper = createColumnHelper<DataTableFeatures, Row>();
const rowKeys = PATIENT_ROW_KEYS;
export const PatientsGrid = memo(function PatientsGrid({
  patientsData,
  editor,
  pending,
}: {
  patientsData?: string | null;
  editor?: RequisitionEditor;
  pending?: boolean;
}) {
  const patients = useMemo(() => parsePatients(patientsData), [patientsData]);
  const { t } = useTranslation();
  if (patients.unreadable)
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('requisitions.patients.unreadable')}</AlertDescription>
      </Alert>
    );
  return editor ? (
    <PatientsEditor patients={patients} editor={editor} pending={pending} />
  ) : (
    <PatientsReadOnly patients={patients} />
  );
});
function PatientsEditor({
  patients,
  editor,
  pending,
}: {
  patients: ReturnType<typeof parsePatients>;
  editor: RequisitionEditor;
  pending?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const { skipRef, skipWidth } = useSkipWidth(cards);
  const changes = useStore(editor.form.store, (state) => state.values.draft.patients);
  const payloadErrors = useMemo(
    () => validatePatients(applyPatientChanges(patients, changes)),
    [patients, changes],
  );
  const groups = (['TBData', 'leprosyData'] as const).map((disease) => (
    <Fragment key={disease}>
      {cards ? (
        <li>
          <h3 className="font-semibold">
            {t(disease === 'TBData' ? 'requisitions.patients.tb' : 'requisitions.patients.leprosy')}
          </h3>
        </li>
      ) : (
        <TableRow surface="primary">
          <TableCell colSpan={14}>
            <div className="sticky start-1.5 w-fit ps-6">
              {t(
                disease === 'TBData' ? 'requisitions.patients.tb' : 'requisitions.patients.leprosy',
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
      {patients[disease][0].map((row) => (
        <PatientEditRow
          key={row.key}
          disease={disease}
          base={row}
          editor={editor}
          cards={cards}
          pending={pending}
          skipWidth={skipWidth}
          overflowMonths={PATIENT_MONTHS.filter(
            (month) =>
              payloadErrors[patientFieldId(disease, row.key, month)] ===
              'stock-events.number-too-large',
          ).join(',')}
        />
      ))}
    </Fragment>
  ));
  return (
    <div ref={measure}>
      {cards ? (
        <CardList>{groups}</CardList>
      ) : (
        <DataTableCard>
          <Table
            density="compact"
            layout="auto"
            aria-label={t('requisitions.requisition.patients')}
          >
            <TableHeader surface="muted">
              <TableRow pinned surface="muted">
                <TableHead ref={skipRef} sticky>
                  <DataTableHeaderLabel>{t('requisitions.patients.skip')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead sticky stickyOffset={skipWidth}>
                  <DataTableHeaderLabel>
                    {t('requisitions.patients.month-of-treatment')}
                  </DataTableHeaderLabel>
                </TableHead>
                {PATIENT_MONTHS.map((index) => (
                  <TableHead key={`month${index + 1}`}>
                    <DataTableHeaderLabel>
                      {new Intl.NumberFormat(i18n.language).format(index + 1)}
                    </DataTableHeaderLabel>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>{groups}</TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}
function useSkipWidth(cards: boolean) {
  const skipRef = useRef<HTMLTableCellElement>(null);
  const [skipWidth, setSkipWidth] = useState(0);
  useLayoutEffect(() => {
    if (cards) return;
    const node = skipRef.current;
    if (!node) return;
    const update = () => setSkipWidth(node.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [cards]);
  return { skipRef, skipWidth };
}
function PatientsReadOnly({ patients }: { patients: ReturnType<typeof parsePatients> }) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const { skipRef, skipWidth } = useSkipWidth(cards);
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
  const columns = useMemo(() => {
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
    return [
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
            if (!value || value.disabled) return cards ? false : null;
            return value.value == null || value.value === ''
              ? null
              : new Intl.NumberFormat(i18n.language).format(Number(value.value));
          },
        }),
      ),
    ];
  }, [cards, t, i18n.language]);
  const table = useTable({ features: dataTableFeatures, columns, data });
  const empty = (
    <DataTableEmpty
      title={t('requisitions.patients.empty')}
      description={t('requisitions.patients.empty-description')}
    />
  );
  return (
    <div ref={measure}>
      {cards ? (
        <TableCards
          table={table}
          title="patient"
          heading={(row) => row.heading}
          tone={(row) => (row.patient?.isSkipped ? 'skipped' : undefined)}
          empty={empty}
        />
      ) : (
        <DataTableCard>
          <Table
            density="compact"
            layout="auto"
            aria-label={t('requisitions.requisition.patients')}
          >
            <TableHeader surface="muted">
              <TableRow pinned surface="muted">
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    ref={column.id === 'skip' ? skipRef : undefined}
                    sticky={column.id === 'skip' || column.id === 'patient'}
                    stickyOffset={column.id === 'patient' ? skipWidth : 0}
                  >
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
                        <div className="sticky start-1.5 w-fit ps-6">
                          <bdi>{row.original.heading}</bdi>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={row.id}
                      pinned
                      tone={row.original.patient?.isSkipped ? 'skipped' : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          sticky={cell.column.id === 'skip' || cell.column.id === 'patient'}
                          stickyOffset={cell.column.id === 'patient' ? skipWidth : 0}
                        >
                          <FlexRender cell={cell} />
                        </TableCell>
                      ))}
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
