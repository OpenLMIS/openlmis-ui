import { useStore } from '@tanstack/react-form';
import type { ParseKeys } from 'i18next';
import { memo, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardBand, CardControlRow, CardListItem, CardRows } from '@/components/display/card-list';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { TableCell, TableRow } from '@/components/ui/table';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';
import {
  applyPatientChanges,
  PATIENT_MONTHS,
  type PatientDisease,
  type PatientRow,
  patientFieldId,
  patientRowHasValues,
  patientRowLabel,
  validatePatients,
} from '@/features/requisitions/lib/patients';

export const PatientEditRow = memo(function PatientEditRow({
  editor,
  disease,
  base,
  cards,
  pending,
  skipWidth,
  overflowMonths = '',
}: {
  editor: RequisitionEditor;
  disease: PatientDisease;
  base: PatientRow;
  cards: boolean;
  pending?: boolean;
  skipWidth: number;
  overflowMonths?: string;
}) {
  const { t, i18n } = useTranslation();
  const id = `${disease}:${base.key}`;
  const changes = useStore(editor.form.store, (state) => state.values.draft.patients?.[id]);
  const showAll = useStore(editor.form.store, (state) => state.values.showAllErrors);
  const row = useMemo(
    () =>
      applyPatientChanges(
        { TBData: [[]], leprosyData: [[]], [disease]: [[base]] },
        changes ? { [id]: changes } : null,
      )[disease][0][0],
    [base, changes, disease, id],
  );
  const errors = validatePatients(
    { TBData: [[]], leprosyData: [[]], [disease]: [[row]] },
    showAll,
    true,
  );
  if (overflowMonths)
    for (const month of overflowMonths.split(','))
      errors[patientFieldId(disease, row.key, Number(month))] = 'stock-events.number-too-large';
  const label = patientRowLabel(t, row.key);
  const skip = (
    <div className="flex size-7 items-center justify-center rounded-md bg-background">
      <Checkbox
        checked={row.isSkipped}
        disabled={pending || (!row.isSkipped && patientRowHasValues(row))}
        aria-label={`${t('requisitions.patients.skip')}: ${label}`}
        onCheckedChange={(skipped) => editor.setPatientSkip(disease, row.key, skipped)}
      />
    </div>
  );
  const cell = (index: number) => (
    <PatientEditCell
      editor={editor}
      disease={disease}
      row={row}
      month={index}
      label={label}
      error={errors[patientFieldId(disease, row.key, index)]}
      cards={cards}
      pending={pending}
    />
  );
  const invalid = Object.keys(errors).length > 0;
  if (cards)
    return (
      <CardListItem tone={invalid ? 'invalid' : row.isSkipped ? 'skipped' : undefined}>
        <CardBand>
          <bdi>{label}</bdi>
        </CardBand>
        <CardRows>
          <CardControlRow label={t('requisitions.patients.skip')}>{skip}</CardControlRow>
          {PATIENT_MONTHS.filter((index) => !row.data[index].disabled).map((index) => (
            <CardControlRow
              key={index}
              label={t('requisitions.patients.month', {
                month: new Intl.NumberFormat(i18n.language).format(index + 1),
              })}
            >
              {cell(index)}
            </CardControlRow>
          ))}
        </CardRows>
      </CardListItem>
    );
  return (
    <TableRow
      pinned
      data-invalid={invalid || undefined}
      tone={row.isSkipped ? 'skipped' : undefined}
    >
      <TableCell sticky>
        <div className="flex justify-center">{skip}</div>
      </TableCell>
      <TableCell sticky stickyOffset={skipWidth}>
        <bdi>{label}</bdi>
      </TableCell>
      {PATIENT_MONTHS.map((index) => (
        <TableCell key={`month${index + 1}`}>{!row.data[index].disabled && cell(index)}</TableCell>
      ))}
    </TableRow>
  );
});

const PatientEditCell = memo(function PatientEditCell({
  editor,
  disease,
  row,
  month,
  label,
  error,
  cards,
  pending,
}: {
  editor: RequisitionEditor;
  disease: PatientDisease;
  row: PatientRow;
  month: number;
  label: string;
  error?: ParseKeys;
  cards: boolean;
  pending?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { form } = editor;
  const name = `texts.${patientFieldId(disease, row.key, month)}` as const;
  useEffect(() => {
    form.setFieldMeta(name, (meta) => ({
      ...meta,
      isTouched: !!error,
      errorMap: { onChange: error },
    }));
  }, [form, name, error]);
  return (
    <div className="w-full min-w-20 whitespace-normal">
      <Field surface="background">
        <form.AppField
          name={name}
          defaultValue={String(row.data[month].value ?? '')}
          listeners={{
            onChange: ({ value }) => editor.setPatientValue(disease, row.key, month, value),
          }}
        >
          {(field) => (
            <field.NumberField
              label={t('requisitions.patients.cell-label', {
                row: label,
                month: new Intl.NumberFormat(i18n.language).format(month + 1),
              })}
              layout="inline"
              hideErrors={!cards}
              controlSize={cards ? 'default' : 'sm'}
              disabled={pending || row.isSkipped}
            />
          )}
        </form.AppField>
      </Field>
    </div>
  );
});
