import { CircleSlashIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RetryButton } from '@/components/display/dialog-parts';
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
import { SupersetSignIn } from '@/features/reports/components/superset-sign-in';
import { resolveDashboardMode } from '@/features/reports/lib/dashboard-mode';
import type { DashboardReport } from '@/features/reports/lib/types';

/** Shows a dashboard as its record allows; hiding the app ends the opening and returning starts one. */
export function DashboardViewer({
  report,
  supersetUrl,
  userId,
  username,
  placement = 'catalog',
  onReload,
}: {
  report: DashboardReport;
  supersetUrl: string | undefined;
  userId: string;
  username: string;
  placement?: 'catalog' | 'home';
  onReload?: () => void;
}) {
  const hidden = usePageHidden();
  const viewer = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState({ count: 0, restoreFocus: false });
  const [wasHidden, setWasHidden] = useState(hidden);
  if (hidden !== wasHidden) {
    setWasHidden(hidden);
    if (hidden && opening.restoreFocus) setOpening({ ...opening, restoreFocus: false });
  }
  const retry = () => {
    const restoreFocus = viewer.current?.contains(document.activeElement) ?? false;
    setOpening(({ count }) => ({ count: count + 1, restoreFocus }));
  };

  const mode = resolveDashboardMode(report, supersetUrl, window.location.origin);
  const home = placement === 'home';
  const reload = home ? (onReload ?? retry) : undefined;
  if (mode.kind === 'not-configured') return <DashboardNotSetUp onRetry={reload} />;
  if (mode.kind === 'unsupported') return <DashboardUnsupported onRetry={reload} />;
  if (hidden) return null;
  const openingProps = {
    title: report.name,
    onRetry: retry,
    restoreFocus: opening.restoreFocus,
  };
  return (
    <div ref={viewer} className="contents">
      {mode.kind === 'superset-sign-in' ? (
        <SupersetSignIn
          key={opening.count}
          url={mode.url}
          supersetUrl={mode.supersetUrl}
          username={username}
          dismissToRetry={home}
          {...openingProps}
        />
      ) : mode.kind === 'embedded' ? (
        <SupersetEmbed
          key={opening.count}
          uuid={mode.uuid}
          supersetUrl={mode.supersetUrl}
          userId={userId}
          hideBackLink={home}
          {...openingProps}
        />
      ) : (
        <DashboardFrame key={opening.count} url={mode.url} {...openingProps} />
      )}
    </div>
  );
}

function DashboardUnsupported({ onRetry }: { onRetry?: () => void }) {
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
      <EmptyContent>{onRetry ? <RetryButton onClick={onRetry} /> : <BackToReports />}</EmptyContent>
    </Empty>
  );
}
