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
  labels?: Partial<{
    saved: string;
    saving: string;
    loading: string;
    failed: string;
    retry: string;
    conflict: string;
    conflictTitle: string;
    conflictDescription: string;
    copy: string | null;
    load: string;
  }>;
  onRetry: () => void;
  onResolve: (choice: 'load' | 'copy') => Promise<void>;
  conflict?: { description: string; keep: string; failed?: string };
};
export function DraftStatus({
  status,
  error,
  labels: overrides,
  onRetry,
  onResolve,
  conflict,
}: Props) {
  const { t } = useTranslation();
  const labels = {
    saved: t('stock-events.draft-saved'),
    saving: t('stock-events.draft-saving'),
    loading: t('stock-events.draft-loading'),
    failed: t('stock-events.draft-failed'),
    retry: t('stock-events.draft-retry'),
    conflict: t('stock-events.draft-conflict'),
    conflictTitle: t('stock-events.draft-conflict-title'),
    conflictDescription: t('stock-events.draft-conflict-description'),
    copy: t('stock-events.draft-copy'),
    load: t('stock-events.draft-load'),
    ...overrides,
  };
  const loadButton = useRef<HTMLButtonElement>(null);
  const [resolving, setResolving] = useState(false);
  const resolveFailure = conflict
    ? conflict.failed
    : error !== undefined && !(error instanceof DraftConflictError)
      ? labels.failed
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
            {labels[status]}
          </Badge>
        ) : (
          <span className="flex min-w-0 items-start gap-2">
            <TriangleAlertIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-destructive"
            />
            <span>{status === 'conflict' ? labels.conflict : labels.failed}</span>
          </span>
        )}
        {status === 'saving' && error !== undefined && <span>{labels.failed}</span>}
        {status === 'failed' && (
          <Button size="lg" variant="outline" onClick={onRetry}>
            {labels.retry}
          </Button>
        )}
      </div>
      <AlertDialog open={status === 'conflict'}>
        <AlertDialogContent initialFocus={loadButton}>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.conflictTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {conflict?.description ?? labels.conflictDescription}
              {resolveFailure && <span className="block text-destructive">{resolveFailure}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {(conflict?.keep ?? labels.copy) && (
              <Button variant="outline" disabled={resolving} onClick={() => void resolve('copy')}>
                {conflict?.keep ?? labels.copy}
              </Button>
            )}
            <Button ref={loadButton} disabled={resolving} onClick={() => void resolve('load')}>
              {labels.load}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
