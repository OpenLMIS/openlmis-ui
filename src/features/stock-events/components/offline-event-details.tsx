import type { ParseKeys } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { deviceEventLineValues } from '@/features/stock-events/lib/device-event-line-values';
import {
  COUNTERPARTY,
  EVENT_KINDS,
  type EventKindConfig,
} from '@/features/stock-events/lib/event-kinds';
import { productLabel } from '@/features/stock-events/lib/products';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { orEmpty } from '@/lib/empty-value';
import { recordLabel } from '@/lib/facility-program-selection';

export function OfflineEventDetails({ event }: { event: DeviceEvent }) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const config: EventKindConfig = EVENT_KINDS[event.kind];
  const counterparty = config.counterparty === 'none' ? null : COUNTERPARTY[config.counterparty];
  const context: ParseKeys | undefined = counterparty
    ? counterparty.column
    : config.reasons
      ? 'offline-events.reason'
      : undefined;
  const contextLabel: ParseKeys = counterparty
    ? config.counterparty === 'destination'
      ? 'offline-events.detail-issue-to'
      : 'offline-events.detail-received-from'
    : 'offline-events.detail-reason';
  const headers: ParseKeys[] = [
    'offline-events.lot',
    'offline-events.quantity',
    ...(context ? [context] : []),
  ];
  const lines = deviceEventLineValues(event, i18n.language, t, headers);
  return (
    <div className="flex min-w-0 flex-col gap-2 whitespace-normal wrap-anywhere">
      <div>
        <p>
          {t('offline-events.detail-facility', { value: orEmpty(recordLabel(event.facility)) })}
        </p>
        <p>{t('offline-events.detail-program', { value: orEmpty(recordLabel(event.program)) })}</p>
      </div>
      {(expanded ? lines : lines.slice(0, 3)).map((line, index) => (
        <p key={line.key}>
          <strong>
            <bdi>
              {event.lines[index] ? productLabel(event.lines[index].orderable) : line.product}
            </bdi>
          </strong>
          {t('offline-events.detail-separator')}
          {t('offline-events.detail-lot', {
            value: line.values[0] || t('offline-events.no-lots'),
          })}
          {context && (
            <>
              {t('offline-events.detail-separator')}
              {t(contextLabel, { value: orEmpty(line.values[2]) })}
            </>
          )}
          {t('offline-events.detail-separator')}
          {t('offline-events.detail-quantity', { value: line.values[1] })}
        </p>
      ))}
      {lines.length > 3 && (
        <div>
          <Button
            variant="link"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? t('offline-events.fewer-lines')
              : t('offline-events.more-lines', { count: lines.length - 3 })}
          </Button>
        </div>
      )}
    </div>
  );
}
