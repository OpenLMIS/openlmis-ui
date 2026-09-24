import { useSuspenseQuery } from '@tanstack/react-query';
import { CircleCheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { APPROVALS_SHOWN, approvalsOptions } from '@/features/home/api/queries';
import { CountBadge, CountedTitle, WidgetError } from '@/features/home/components/dashboard-parts';
import type { RequisitionSummary } from '@/features/home/lib/types';

/** The requisitions waiting on this user, so the most urgent approval is one click away. */
export function ApprovalsTable() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CountedTitle title={t('home.approvals.title')}>
          <ApprovalsTotal />
        </CountedTitle>
        <CardDescription>{t('home.approvals.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          errorComponent={({ reset }) => <WidgetError onRetry={reset} />}
          pendingFallback={<ApprovalsSkeleton />}
          resetKey="approvals"
        >
          <ApprovalRows />
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function ApprovalsTotal() {
  const { data } = useSuspenseQuery(approvalsOptions());
  return <CountBadge count={data.total} />;
}

/** When the requisition reached the approver: authorized, or submitted where there is no authorize step. */
function waitingSince(requisition: RequisitionSummary) {
  const { statusChanges, createdDate } = requisition;
  return (
    statusChanges?.AUTHORIZED?.changeDate ?? statusChanges?.SUBMITTED?.changeDate ?? createdDate
  );
}

/** Below this the facility and period fold under the program and the date is left out. */
const WIDE_TABLE = 560;

function ApprovalRows() {
  const { t, i18n } = useTranslation();
  const { data } = useSuspenseQuery(approvalsOptions());
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const wide = width === undefined || width >= WIDE_TABLE;
  const formatDate = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format,
    [i18n.language],
  );

  if (data.requisitions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleCheckIcon />
          </EmptyMedia>
          <EmptyTitle>{t('home.approvals.empty-title')}</EmptyTitle>
          <EmptyDescription>{t('home.approvals.empty-description')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div ref={measure}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('home.approvals.program')}</TableHead>
            {wide && <TableHead>{t('home.approvals.facility')}</TableHead>}
            {wide && <TableHead>{t('home.approvals.period')}</TableHead>}
            {wide && <TableHead>{t('home.approvals.waiting-since')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.requisitions.map((requisition) => {
            const facility = (
              <div className="flex flex-col">
                <span>{requisition.facility.name}</span>
                <span className="text-xs text-muted-foreground">{requisition.facility.code}</span>
              </div>
            );
            return (
              <TableRow key={requisition.id}>
                <TableCell>
                  {/* On a narrow card the facility and period stack here instead of taking columns. */}
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{requisition.program.name}</span>
                      {requisition.emergency && (
                        <Badge variant="destructive">{t('home.approvals.emergency')}</Badge>
                      )}
                    </div>
                    {!wide && facility}
                    {!wide && (
                      <span className="text-xs text-muted-foreground">
                        {requisition.processingPeriod.name}
                      </span>
                    )}
                  </div>
                </TableCell>
                {wide && <TableCell>{facility}</TableCell>}
                {wide && <TableCell>{requisition.processingPeriod.name}</TableCell>}
                {wide && (
                  <TableCell>
                    <span className="text-muted-foreground">
                      {formatDate(new Date(waitingSince(requisition)))}
                    </span>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ApprovalsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      {Array.from({ length: APPROVALS_SHOWN }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders with nothing else to key on.
        <div className="h-10 w-full" key={index}>
          <Skeleton fill />
        </div>
      ))}
    </div>
  );
}
