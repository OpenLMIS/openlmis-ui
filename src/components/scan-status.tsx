import { useTranslation } from 'react-i18next';
import type { BarcodeScanStatus } from '@/hooks/use-barcode-scan';
import { cn } from '@/lib/utils';

const STATUS_KEYS = {
  ready: 'scan.ready',
  working: 'scan.working',
  accepted: 'scan.accepted',
  error: 'scan.not-resolved',
} as const;

export function ScanStatus({ status, message }: BarcodeScanStatus) {
  const { t } = useTranslation();
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-muted-foreground"
      role="status"
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 shrink-0 rounded-full motion-reduce:animate-none',
          status === 'ready' && 'animate-pulse bg-muted-foreground',
          status === 'working' && 'animate-ping bg-primary',
          status === 'accepted' && 'bg-success',
          status === 'error' && 'bg-destructive',
        )}
      />
      <span>{message ? t(message.key, message.params) : t(STATUS_KEYS[status])}</span>
    </div>
  );
}
