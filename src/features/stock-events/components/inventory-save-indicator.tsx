import { CheckIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InventorySaveStatus } from '@/features/stock-events/lib/physical-inventory-autosave';

const keys = {
  saving: 'physical-inventory.saving',
  saved: 'physical-inventory.saved-local',
  failed: 'physical-inventory.not-saved-local',
} as const;
export function InventorySaveIndicator({ status }: { status: InventorySaveStatus }) {
  const { t } = useTranslation();
  const failed = useRef(false);
  const [announcement, setAnnouncement] = useState<'failed' | 'saved' | null>(null);
  useEffect(() => {
    if (status === 'failed') {
      failed.current = true;
      setAnnouncement('failed');
    } else if (status === 'saved' && failed.current) {
      failed.current = false;
      setAnnouncement('saved');
    }
  }, [status]);
  return (
    <>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {status === 'saved' ? (
          <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-success" />
        ) : status === 'saving' ? (
          <Loader2Icon aria-hidden="true" className="size-4 shrink-0 animate-spin" />
        ) : (
          <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        )}
        {t(keys[status])}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement ? t(keys[announcement]) : ''}
      </p>
    </>
  );
}
