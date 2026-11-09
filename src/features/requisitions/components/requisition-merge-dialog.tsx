import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serverMessage } from '@/components/display/dialog-parts';
import { formatDateValue } from '@/components/form/date-value';
import { useAppForm } from '@/components/form/form';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { FieldGroup } from '@/components/ui/field';
import type { DraftFieldConflict } from '@/features/requisitions/lib/draft-merge';
import { patientRowLabel } from '@/features/requisitions/lib/patients';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { EMPTY_VALUE } from '@/lib/empty-value';

export function RequisitionMergeDialog({
  conflicts,
  record,
  lineLabels,
  onClose,
  onResolve,
}: {
  conflicts: DraftFieldConflict[];
  record: RequisitionRecord;
  lineLabels: Record<string, string>;
  onClose: () => void;
  onResolve: (choices: Record<string, 'yours' | 'server'>) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { choices: conflicts.map(() => '') },
    onSubmit: async ({ value }) => {
      if (pending || value.choices.some((choice) => !choice)) return;
      setPending(true);
      setFailure(null);
      try {
        await onResolve(
          Object.fromEntries(
            conflicts.map(({ path }, index) => [path, value.choices[index] as 'yours' | 'server']),
          ),
        );
      } catch (error) {
        setFailure(serverMessage(error) ?? t('error.description'));
      } finally {
        setPending(false);
      }
    },
  });
  const numbers = new Intl.NumberFormat(i18n.language);
  const label = (path: string) => {
    const [kind, id, key, month] = path.split('/');
    if (kind === 'draftStatusMessage') return t('requisitions.edit.draft-comment');
    if (kind === 'datePhysicalStockCountCompleted') return t('requisitions.edit.stock-count-date');
    if (kind === 'patients')
      return t('requisitions.merge.field-label', {
        row: patientRowLabel(t, id.split(':')[1]),
        field:
          month !== undefined
            ? t('requisitions.patients.month', { month: numbers.format(Number(month) + 1) })
            : t('requisitions.patients.skip'),
      });
    const column =
      key === 'stockAdjustments'
        ? (record.template.columnsMap.totalLossesAndAdjustments?.label ??
          t('requisitions.adjustments.title'))
        : key === 'skipped'
          ? t('requisitions.edit.skip')
          : (record.template.columnsMap[key]?.label ?? t('requisitions.edit.products.product'));
    return t('requisitions.merge.field-label', { row: lineLabels[id] ?? id, field: column });
  };
  const display = (path: string, value: unknown): string => {
    if (path.startsWith('removedLineIds/') || path.startsWith('addedLines/'))
      return t(value == null ? 'requisitions.merge.removed' : 'requisitions.merge.added');
    if (value == null || value === '') return EMPTY_VALUE;
    if (path === 'datePhysicalStockCountCompleted')
      return formatDateValue(String(value), i18n.language);
    if (typeof value === 'boolean') return t(value ? 'requisitions.yes' : 'requisitions.no');
    if (typeof value === 'number') return numbers.format(value);
    if (Array.isArray(value))
      return (
        new Intl.ListFormat(i18n.language).format(
          value.map((entry) => {
            const item = entry as { reasonId: string; quantity: number };
            const reason = record.stockAdjustmentReasons?.find(
              (reason) => reason.id === item.reasonId,
            );
            return t('requisitions.merge.adjustment-value', {
              reason: reason?.name ?? reason?.description ?? item.reasonId,
              quantity: numbers.format(item.quantity),
            });
          }),
        ) || EMPTY_VALUE
      );
    return String(value);
  };
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <FormDialogForm onSubmit={form.handleSubmit}>
        <FormDialogHeader>
          <FormDialogTitle>{t('requisitions.merge.title')}</FormDialogTitle>
          <FormDialogDescription>{t('requisitions.merge.description')}</FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <FieldGroup>
            {conflicts.map(({ path, yours, server }, index) => (
              <form.AppField key={path} name={`choices[${index}]`}>
                {(field) => (
                  <field.RadioGroupField
                    label={label(path)}
                    disabled={pending}
                    options={(['yours', 'server'] as const).map((side) => ({
                      value: side,
                      label: t(
                        side === 'yours'
                          ? 'requisitions.merge.yours-value'
                          : 'requisitions.merge.server-value',
                        {
                          value: display(path, side === 'yours' ? yours : server),
                        },
                      ),
                    }))}
                  />
                )}
              </form.AppField>
            ))}
            {failure && <p role="alert">{failure}</p>}
          </FieldGroup>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={pending}>{t('dialog.close')}</FormDialogCancel>
          <form.Subscribe selector={(state) => state.values.choices.some((choice) => !choice)}>
            {(incomplete) => (
              <FormDialogSubmit pending={pending} disabled={incomplete}>
                {t('requisitions.merge.recover')}
              </FormDialogSubmit>
            )}
          </form.Subscribe>
        </FormDialogFooter>
      </FormDialogForm>
    </FormDialog>
  );
}
