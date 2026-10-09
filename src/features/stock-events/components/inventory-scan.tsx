import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateValue } from '@/components/form/date-value';
import {
  FormDialog,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { ScanStatus } from '@/components/scan-status';
import { Button } from '@/components/ui/button';
import { tradeItemByGtinOptions } from '@/features/reference-data/api/queries';
import {
  countInventoryScan,
  type InventoryScanPrompt,
  resolveInventoryScan,
} from '@/features/stock-events/lib/physical-inventory-scan';
import type {
  InventoryLine,
  InventoryStockLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { useBarcodeScan } from '@/hooks/use-barcode-scan';
import { scanMessage } from '@/lib/scan-messages';
import { getSessionScope } from '@/lib/session-scope';

export function InventoryScan({
  eligible,
  lines,
  canManageLots,
  paused,
  onCount,
}: {
  eligible: readonly InventoryStockLine[];
  lines: readonly InventoryLine[];
  canManageLots: boolean;
  paused: boolean;
  onCount: (line: InventoryLine) => void;
}) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [scope] = useState(getSessionScope);
  const acceptedExpiries = useRef(new Set<string>());
  const latest = useRef({ eligible, lines, paused, onCount });
  latest.current = { eligible, lines, paused, onCount };
  const [prompt, setPrompt] = useState<{
    value: InventoryScanPrompt;
    complete: (accepted: boolean) => void;
  } | null>(null);
  const [mounted] = useState(() => ({ current: true }));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, [mounted]);
  const status = useBarcodeScan({
    enabled: !paused,
    onScan: async (scan, signal) => {
      if (!scan.ok) return scanMessage(scan.error);
      const current = () =>
        !signal.aborted && mounted.current && getSessionScope() === scope && !latest.current.paused;
      if (!current()) return;
      let tradeItem: import('@/features/reference-data/lib/types').TradeItem | null;
      try {
        tradeItem = await client.fetchQuery(tradeItemByGtinOptions(scan.gtin));
      } catch {
        return current() ? scanMessage('gtinLookupFailed') : undefined;
      }
      if (!current()) return;
      if (!tradeItem) return scanMessage('gtinNotRegistered', { gtin: scan.gtin });
      const result = await resolveInventoryScan({
        scan,
        tradeItemId: tradeItem.id,
        eligible: latest.current.eligible,
        lines: latest.current.lines,
        canManageLots,
        acceptedExpiries: acceptedExpiries.current,
        signal,
        confirm: (value) =>
          new Promise<boolean>((resolve) => {
            const abort = () => {
              if (mounted.current) setPrompt(null);
              resolve(false);
            };
            signal.addEventListener('abort', abort, { once: true });
            setPrompt({
              value,
              complete: (accepted) => {
                signal.removeEventListener('abort', abort);
                setPrompt(null);
                resolve(accepted);
              },
            });
          }),
      });
      if (!current()) return;
      if (result.type === 'refuse') return result.message;
      if (result.type === 'line') {
        const existing = latest.current.lines.find((line) => line.key === result.line.key);
        latest.current.onCount(countInventoryScan(existing ?? result.line));
      }
    },
  });
  return (
    <>
      <ScanStatus {...status} />
      <FormDialog
        open={!!prompt}
        onOpenChange={(open) => {
          if (!open) prompt?.complete(false);
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>
            {t(
              prompt?.value.type === 'new-lot'
                ? 'physical-inventory.scan-new-lot-title'
                : 'stock-events.expiry-mismatch-title',
            )}
          </FormDialogTitle>
          <FormDialogDescription>
            {prompt &&
              (prompt.value.type === 'new-lot'
                ? t('physical-inventory.scan-new-lot-description', {
                    lotCode: prompt.value.lotCode,
                    expiryDate: prompt.value.expiryDate
                      ? formatDateValue(prompt.value.expiryDate, i18n.language)
                      : t('physical-inventory.no-expiry'),
                  })
                : t('scan.confirm-expiry-mismatch', {
                    recordedDate: formatDateValue(prompt.value.recorded, i18n.language),
                    scannedDate: formatDateValue(prompt.value.scanned, i18n.language),
                  }))}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogFooter>
          <Button variant="outline" onClick={() => prompt?.complete(false)}>
            {t('stock-events.cancel')}
          </Button>
          <Button onClick={() => prompt?.complete(true)}>{t('stock-events.confirm')}</Button>
        </FormDialogFooter>
      </FormDialog>
    </>
  );
}
