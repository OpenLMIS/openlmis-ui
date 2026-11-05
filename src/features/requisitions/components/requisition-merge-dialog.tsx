import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serverMessage } from '@/components/display/dialog-parts';
import { formatDateValue } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  const [choices, setChoices] = useState<Record<string, 'yours' | 'server'>>({});
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const numbers = new Intl.NumberFormat(i18n.language);
  const label = (path: string) => {
    const [kind, id, key, month] = path.split('/');
    if (kind === 'draftStatusMessage') return t('requisitions.edit.draft-comment');
    if (kind === 'datePhysicalStockCountCompleted') return t('requisitions.edit.stock-count-date');
    if (kind === 'patients')
      return `${patientRowLabel(t, id.split(':')[1])} - ${month !== undefined ? t('requisitions.patients.month', { month: numbers.format(Number(month) + 1) }) : t('requisitions.patients.skip')}`;
    const column =
      key === 'stockAdjustments'
        ? (record.template.columnsMap.totalLossesAndAdjustments?.label ??
          t('requisitions.adjustments.title'))
        : key === 'skipped'
          ? t('requisitions.edit.skip')
          : (record.template.columnsMap[key]?.label ?? t('requisitions.edit.products.product'));
    return [lineLabels[id] ?? id, column].join(' - ');
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
        value
          .map((entry) => {
            const item = entry as { reasonId: string; quantity: number };
            const reason = record.stockAdjustmentReasons?.find(
              (reason) => reason.id === item.reasonId,
            );
            return `${reason?.name ?? reason?.description ?? item.reasonId}: ${numbers.format(item.quantity)}`;
          })
          .join(', ') || EMPTY_VALUE
      );
    return String(value);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('requisitions.merge.title')}</DialogTitle>
          <DialogDescription>{t('requisitions.merge.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-96 flex-col gap-4 overflow-auto">
          {conflicts.map(({ path, yours, server }) => (
            <fieldset key={path}>
              <legend id={`merge-${path}`}>{label(path)}</legend>
              <RadioGroup
                aria-labelledby={`merge-${path}`}
                value={choices[path] ?? null}
                disabled={pending}
                onValueChange={(value) =>
                  setChoices({ ...choices, [path]: value as 'yours' | 'server' })
                }
              >
                {(['yours', 'server'] as const).map((side) => (
                  <label
                    key={side}
                    htmlFor={`merge-${path}-${side}`}
                    className="flex items-center gap-2"
                  >
                    <RadioGroupItem id={`merge-${path}-${side}`} value={side} />
                    {t(side === 'yours' ? 'requisitions.merge.yours' : 'requisitions.merge.server')}
                    : {display(path, side === 'yours' ? yours : server)}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          ))}
          {failure && <p role="alert">{failure}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            {t('dialog.close')}
          </Button>
          <Button
            disabled={pending || Object.keys(choices).length !== conflicts.length}
            onClick={async () => {
              setPending(true);
              setFailure(null);
              try {
                await onResolve(choices);
              } catch (error) {
                setFailure(serverMessage(error) ?? t('error.description'));
              } finally {
                setPending(false);
              }
            }}
          >
            {t('requisitions.merge.recover')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
