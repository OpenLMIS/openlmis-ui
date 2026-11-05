import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DraftFieldConflict } from '@/features/requisitions/lib/draft-merge';
import { patientRowLabel } from '@/features/requisitions/lib/patients';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

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
  const { t } = useTranslation();
  const [choices, setChoices] = useState<Record<string, 'yours' | 'server'>>({});
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = (path: string) => {
    const [kind, id, key, month] = path.split('/');
    if (kind === 'draftStatusMessage') return t('requisitions.edit.draft-comment');
    if (kind === 'datePhysicalStockCountCompleted') return t('requisitions.edit.stock-count-date');
    if (kind === 'patients')
      return `${patientRowLabel(t, id.split(':')[1])} ${month ? Number(month) + 1 : t('requisitions.patients.skip')}`;
    return `${record.template.columnsMap[key]?.label ?? key ?? t('orders.create.facility')}${lineLabels[id] ? ` (${lineLabels[id]})` : ''}`;
  };
  const display = (value: unknown) =>
    value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
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
        </DialogHeader>
        <div className="flex max-h-96 flex-col gap-4 overflow-auto">
          {conflicts.map(({ path, yours, server }) => (
            <fieldset key={path}>
              <legend>{label(path)}</legend>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={choices[path] === 'yours' ? 'default' : 'outline'}
                  aria-pressed={choices[path] === 'yours'}
                  disabled={pending}
                  onClick={() => setChoices({ ...choices, [path]: 'yours' })}
                >
                  {t('requisitions.merge.yours')}: {display(yours)}
                </Button>
                <Button
                  variant={choices[path] === 'server' ? 'default' : 'outline'}
                  aria-pressed={choices[path] === 'server'}
                  disabled={pending}
                  onClick={() => setChoices({ ...choices, [path]: 'server' })}
                >
                  {t('requisitions.merge.server')}: {display(server)}
                </Button>
              </div>
            </fieldset>
          ))}
          {failed && <p role="alert">{t('error.description')}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            {t('dialog.close')}
          </Button>
          <Button
            disabled={pending || Object.keys(choices).length !== conflicts.length}
            onClick={async () => {
              setPending(true);
              try {
                await onResolve(choices);
              } catch {
                setFailed(true);
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
