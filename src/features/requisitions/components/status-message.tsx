import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard } from '@/components/data-table/data-table';
import { CardBand } from '@/components/display/card-list';
import { formatTimestamp } from '@/components/form/date-value';
import { Badge } from '@/components/ui/badge';
import type { RequisitionStatusMessage } from '@/features/requisitions/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { REQUISITION_STATUS } from '@/lib/requisition-status';

export function CommentEntry({
  badge,
  meta,
  note,
  children,
}: {
  badge: ReactNode;
  meta?: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article>
      <DataTableCard>
        <div className="divide-y">
          <CardBand>
            <div className="flex shrink-0 items-center">{badge}</div>
            {meta && (
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-end">
                {meta}
              </div>
            )}
          </CardBand>
          {(children || note) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
              {children && (
                <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  <bdi>{children}</bdi>
                </p>
              )}
              {note && (
                <Badge variant="secondary" wrap="normal">
                  <InfoIcon data-icon="inline-start" />
                  {note}
                </Badge>
              )}
            </div>
          )}
        </div>
      </DataTableCard>
    </article>
  );
}

export function StatusBadge({ status }: { status: RequisitionStatusMessage['status'] }) {
  const { t } = useTranslation();
  const tone = REQUISITION_STATUS[status];
  const StatusIcon = tone.icon;
  return (
    <Badge variant={tone.tone}>
      <StatusIcon data-icon="inline-start" />
      {t(tone.labelKey)}
    </Badge>
  );
}

export function messageAuthor(message: RequisitionStatusMessage) {
  return [message.authorFirstName, message.authorLastName].filter(Boolean).join(' ');
}

export function StatusMessage({ message }: { message: RequisitionStatusMessage }) {
  const { i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const author = messageAuthor(message);
  return (
    <CommentEntry
      badge={<StatusBadge status={message.status} />}
      meta={
        <>
          {author && <bdi>{author}</bdi>}
          <time
            className="font-normal text-muted-foreground text-xs"
            dateTime={message.createdDate}
          >
            {formatTimestamp(message.createdDate, i18n.language, { time: true, timeZone })}
          </time>
        </>
      }
    >
      {message.body}
    </CommentEntry>
  );
}
