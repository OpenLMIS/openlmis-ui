import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SnapshotAlert } from '@/components/app-shell/offline-alert';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOfflineCopies } from '@/features/requisitions/hooks/use-offline-copies';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useOnline } from '@/lib/online';
import { isSecureOrigin } from '@/lib/secure-context';

export function RequisitionCopyNotice({
  id,
  ids,
  representation,
  result,
  failure,
  local = false,
  list = false,
  expected = true,
}: {
  id?: string;
  ids?: readonly string[];
  representation?: 'single' | 'batch';
  result?: Promise<unknown>;
  failure?: unknown;
  local?: boolean;
  list?: boolean;
  expected?: boolean;
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
  if (!isSecureOrigin)
    return list ? (
      <p role="note" className="text-muted-foreground text-sm">
        {t('requisitions.offline.insecure-description')}
      </p>
    ) : null;
  if (saved) savedIdentity.current = identity;
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
  if (pending) return <p role="note">{t('requisitions.offline.saving')}</p>;
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
