import { CheckIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { StockEventSaveState } from '@/features/stock-events/lib/stock-event-autosave';
import { DraftConflictError } from '@/features/stock-events/lib/stock-event-local';

type Props = StockEventSaveState & {
  onRetry: () => void;
  onResolve: (choice: 'load' | 'copy') => Promise<void>;
};
export function EventDraftStatus({ status, error, onRetry, onResolve }: Props) {
  const { t } = useTranslation();
  const [resolving, setResolving] = useState(false);
  const resolve = async (choice: 'load' | 'copy') => {
    if (resolving) return;
    setResolving(true);
    try {
      await onResolve(choice);
    } finally {
      setResolving(false);
    }
  };
  return (
    <>
      <div
        className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground"
        role="note"
      >
        {status === 'saved' ? (
          <Badge variant="secondary">
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
            {t('stock-events.draft-saved')}
          </Badge>
        ) : status === 'saving' || status === 'loading' ? (
          <Loader2Icon
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        )}
        {status !== 'saved' && (
          <span>
            {t(
              status === 'loading'
                ? 'stock-events.draft-loading'
                : status === 'saving'
                  ? 'stock-events.draft-saving'
                  : status === 'conflict'
                    ? 'stock-events.draft-conflict'
                    : 'stock-events.draft-failed',
            )}
          </span>
        )}
        {status === 'saving' && error !== undefined && (
          <span>{t('stock-events.draft-failed')}</span>
        )}
        {status === 'failed' && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            {t('stock-events.draft-retry')}
          </Button>
        )}
      </div>
      <AlertDialog open={status === 'conflict'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stock-events.draft-conflict-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('stock-events.draft-conflict-description')}
              {error !== undefined && !(error instanceof DraftConflictError) && (
                <span className="block text-destructive">{t('stock-events.draft-failed')}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={resolving} onClick={() => void resolve('copy')}>
              {t('stock-events.draft-copy')}
            </Button>
            <Button disabled={resolving} onClick={() => void resolve('load')}>
              {t('stock-events.draft-load')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
