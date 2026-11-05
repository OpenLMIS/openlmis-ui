import { useRouter } from '@tanstack/react-router';
import { CheckIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { createContext, use, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SnapshotAlert } from '@/components/app-shell/offline-alert';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOfflineCopies } from '@/features/requisitions/hooks/use-offline-copies';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useOnline } from '@/lib/online';
import { isSecureOrigin } from '@/lib/secure-context';

export const RequisitionCopyContext = createContext<
  Parameters<typeof RequisitionCopyNotice>[0] | undefined
>(undefined);
export function RequisitionCopyBadge() {
  const props = use(RequisitionCopyContext);
  return props ? <RequisitionCopyNotice {...props} badge /> : null;
}

export function RequisitionCopyNotice({
  id,
  onlineResultsAt,
  ids,
  representation,
  result,
  failure,
  local = false,
  list = false,
  expected = true,
  badge = false,
}: {
  id?: string;
  onlineResultsAt?: number;
  ids?: readonly string[];
  representation?: 'single' | 'batch';
  result?: Promise<unknown>;
  failure?: unknown;
  local?: boolean;
  list?: boolean;
  expected?: boolean;
  badge?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(!!result);
  const identity = `${representation}:${id ?? ids?.join(',') ?? 'all'}`;
  const savedIdentity = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    setError(undefined);
    setPending(!!result);
    void result?.then((error) => {
      if (active) {
        setError(error);
        setPending(false);
      }
    });
    return () => {
      active = false;
    };
  }, [result]);
  const online = useOnline();
  const copies = useOfflineCopies();
  const candidates = copies?.filter((copy) =>
    id ? copy.id === id : ids ? ids.includes(copy.id) : true,
  );
  const saved = candidates?.toSorted((a, b) => a.fetchedAt - b.fetchedAt)[0];
  if (!expected) return null;
  if (onlineResultsAt && !online)
    return (
      <SnapshotAlert
        snapshot={{ fetchedAt: onlineResultsAt, generation: String(onlineResultsAt) }}
        online={false}
        message="requisitions.offline.online-results"
      />
    );
  if (!isSecureOrigin)
    return list ? (
      <p role="note" className="text-muted-foreground text-sm">
        {t('requisitions.offline.insecure-description')}
      </p>
    ) : null;
  if (saved) savedIdentity.current = identity;
  if (badge) {
    const failed = failure === undefined ? error : failure;
    if (!pending && !failed && !(representation ? saved?.[representation] : saved)) return null;
    return (
      <Badge variant={failed ? 'destructive' : 'secondary'} wrap="normal">
        {failed ? (
          <TriangleAlertIcon data-icon="inline-start" />
        ) : pending ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : (
          <CheckIcon className="text-success" data-icon="inline-start" />
        )}
        {t(
          failed
            ? 'requisitions.offline.failed-label'
            : pending
              ? 'requisitions.offline.saving-label'
              : 'requisitions.offline.saved-label',
        )}
      </Badge>
    );
  }

  if (id && copies && !saved && savedIdentity.current === identity)
    return (
      <Alert variant="warning">
        <AlertTitle>{t('requisitions.offline.removed-title')}</AlertTitle>
        <AlertDescription>{t('requisitions.offline.removed-description')}</AlertDescription>
        <AlertAction>
          <Button
            variant="warning"
            onClick={() =>
              whenLeaveAllowed(() => {
                allowUnload();
                window.location.reload();
              }, 'leave')
            }
          >
            {t('error.try-again')}
          </Button>
        </AlertAction>
      </Alert>
    );
  if (pending) return null;
  if (failure === undefined ? error : failure)
    return (
      <Alert variant="warning">
        <AlertTitle>{t('requisitions.offline.failed-title')}</AlertTitle>
        <AlertDescription>{t('requisitions.offline.failed-description')}</AlertDescription>
        <AlertAction>
          <Button variant="warning" onClick={() => void router.invalidate()}>
            {t('error.try-again')}
          </Button>
        </AlertAction>
      </Alert>
    );
  if ((!online || local) && saved)
    return (
      <SnapshotAlert
        snapshot={{
          fetchedAt: representation
            ? (saved[representation]?.fetchedAt ?? saved.fetchedAt)
            : saved.fetchedAt,
          generation: String(saved.generation),
        }}
        online={online}
        message="requisitions.offline.snapshot"
      />
    );
  return null;
}
