import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { Badge } from '@/components/ui/badge';
import type { RequisitionStatusMessage } from '@/features/requisitions/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { REQUISITION_STATUS } from '@/lib/requisition-status';

export function CommentEntry({
  badge,
  meta,
  action,
  children,
}: {
  badge: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-4 py-3 shadow-xs">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          {badge}
          {meta && <p className="min-w-0 text-muted-foreground text-xs">{meta}</p>}
        </div>
        {action}
      </div>
      {children && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          <bdi>{children}</bdi>
        </p>
      )}
    </article>
  );
}

export function StatusMessage({ message }: { message: RequisitionStatusMessage }) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const author = [message.authorFirstName, message.authorLastName].filter(Boolean).join(' ');
  const status = REQUISITION_STATUS[message.status];
  const StatusIcon = status.icon;
  return (
    <CommentEntry
      badge={
        <Badge variant={status.tone}>
          <StatusIcon data-icon="inline-start" />
          {t(status.labelKey)}
        </Badge>
      }
      meta={t('requisitions.requisition.comment-byline', {
        hasAuthor: author ? 'yes' : 'no',
        author,
        date: formatTimestamp(message.createdDate, i18n.language, { time: true, timeZone }),
      })}
    >
      {message.body}
    </CommentEntry>
  );
}
