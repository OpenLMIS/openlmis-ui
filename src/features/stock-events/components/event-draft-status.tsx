import { CheckIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { useRef, useState } from 'react';
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
import { DraftConflictError } from '@/lib/draft-store';
import type { DraftSaveState } from '@/lib/draft-writer';

type Props = DraftSaveState & {
  onRetry: () => void;
  onResolve: (choice: 'load' | 'copy') => Promise<void>;
  conflict?: { description: string; keep: string; failed?: string };
};
export function EventDraftStatus({ status, error, onRetry, onResolve, conflict }: Props) {
  const { t } = useTranslation();
  const loadButton = useRef<HTMLButtonElement>(null);
  const [resolving, setResolving] = useState(false);
  const resolveFailure = conflict
    ? conflict.failed
    : error !== undefined && !(error instanceof DraftConflictError)
      ? t('stock-events.draft-failed')
      : undefined;
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
        {status === 'saved' || status === 'saving' || status === 'loading' ? (
          <Badge variant="secondary">
            {status === 'saved' ? (
              <CheckIcon aria-hidden="true" className="text-success" data-icon="inline-start" />
            ) : (
              <Loader2Icon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
                data-icon="inline-start"
              />
            )}
            {t(
              status === 'saved'
                ? 'stock-events.draft-saved'
                : status === 'saving'
                  ? 'stock-events.draft-saving'
                  : 'stock-events.draft-loading',
            )}
          </Badge>
        ) : (
          <span className="flex min-w-0 items-start gap-2">
            <TriangleAlertIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-destructive"
            />
            <span>
              {t(
                status === 'conflict' ? 'stock-events.draft-conflict' : 'stock-events.draft-failed',
              )}
            </span>
          </span>
        )}
        {status === 'saving' && error !== undefined && (
          <span>{t('stock-events.draft-failed')}</span>
        )}
        {status === 'failed' && (
          <Button size="lg" variant="outline" onClick={onRetry}>
            {t('stock-events.draft-retry')}
          </Button>
        )}
      </div>
      <AlertDialog open={status === 'conflict'}>
        <AlertDialogContent initialFocus={loadButton}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stock-events.draft-conflict-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {conflict?.description ?? t('stock-events.draft-conflict-description')}
              {resolveFailure && <span className="block text-destructive">{resolveFailure}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={resolving} onClick={() => void resolve('copy')}>
              {conflict?.keep ?? t('stock-events.draft-copy')}
            </Button>
            <Button ref={loadButton} disabled={resolving} onClick={() => void resolve('load')}>
              {t('stock-events.draft-load')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
