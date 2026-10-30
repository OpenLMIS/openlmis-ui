import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TransferInstructionsDialogProps = {
  open: boolean;
  onClose: () => void;
  /** The button that opened the dialog, focused again on close. */
  finalFocus: RefObject<HTMLButtonElement | null>;
  /** Translated bodies of the Export, Edit and Upload steps. */
  steps: { export: string; edit: string; upload: string };
  note: string;
};

export function TransferInstructionsDialog({
  open,
  onClose,
  finalFocus,
  steps,
  note,
}: TransferInstructionsDialogProps) {
  const { t, i18n } = useTranslation();
  const items = [
    { title: t('file-transfer.instructions-export-title'), body: steps.export },
    { title: t('file-transfer.instructions-edit-title'), body: steps.edit },
    { title: t('file-transfer.instructions-upload-title'), body: steps.upload },
  ];
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent finalFocus={finalFocus} layout="scroll">
        <DialogHeader>
          <DialogTitle>{t('file-transfer.instructions-label')}</DialogTitle>
          <DialogDescription>{t('file-transfer.instructions-description')}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
          <ol className="flex flex-col gap-4">
            {items.map((step, index) => (
              <li className="flex gap-3" key={step.title}>
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs"
                >
                  {new Intl.NumberFormat(i18n.language).format(index + 1)}
                </span>
                <div className="min-w-0">
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-sm leading-relaxed">{note}</p>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
