import { CircleSlashIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageHidden } from '@/components/shared/page-visibility';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { DashboardFrame } from '@/features/reports/components/dashboard-frame';
import { BackToReports, DashboardNotSetUp } from '@/features/reports/components/dashboard-states';
import { SupersetEmbed } from '@/features/reports/components/superset-embed';
import { resolveDashboardMode } from '@/features/reports/lib/dashboard-mode';
import type { DashboardReport } from '@/features/reports/lib/types';

/** Shows a dashboard as its record allows; hiding the app ends the opening and returning starts one. */
export function DashboardViewer({
  report,
  supersetUrl,
  userId,
}: {
  report: DashboardReport;
  supersetUrl: string | undefined;
  userId: string;
}) {
  const hidden = usePageHidden();
  const [opening, setOpening] = useState({ count: 0, retried: false });
  const [wasHidden, setWasHidden] = useState(hidden);
  if (hidden !== wasHidden) {
    setWasHidden(hidden);
    if (hidden) setOpening(({ count }) => ({ count: count + 1, retried: false }));
  }
  const retry = () => setOpening(({ count }) => ({ count: count + 1, retried: true }));

  const mode = resolveDashboardMode(report, supersetUrl, window.location.origin);
  if (mode.kind === 'not-configured') return <DashboardNotSetUp />;
  if (mode.kind === 'unsupported') return <DashboardUnsupported />;
  if (hidden) return null;
  return mode.kind === 'embedded' ? (
    <SupersetEmbed
      key={opening.count}
      uuid={mode.uuid}
      supersetUrl={mode.supersetUrl}
      title={report.name}
      userId={userId}
      onRetry={retry}
      retried={opening.retried}
    />
  ) : (
    <DashboardFrame
      key={opening.count}
      url={mode.url}
      title={report.name}
      onRetry={retry}
      retried={opening.retried}
    />
  );
}

function DashboardUnsupported() {
  const { t } = useTranslation();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleSlashIcon />
        </EmptyMedia>
        <EmptyTitle>{t('reports.dashboard.unsupported-title')}</EmptyTitle>
        <EmptyDescription>{t('reports.dashboard.unsupported-description')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <BackToReports />
      </EmptyContent>
    </Empty>
  );
}
