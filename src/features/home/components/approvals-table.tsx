import { useSuspenseQuery } from '@tanstack/react-query';
import { CircleCheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { approvalsOptions } from '@/features/home/api/queries';
import { CountBadge, DashboardCard } from '@/features/home/components/dashboard-parts';
import { PENDING } from '@/features/home/components/dashboard-skeleton';
import { waitingSince } from '@/features/home/lib/requisitions';

/** The requisitions waiting on this user, most urgent first. */
export function ApprovalsTable() {
  const { t } = useTranslation();
  return (
    <DashboardCard
      badge={<CountBadge query={approvalsOptions()} select={(approvals) => approvals.total} />}
      description={t('home.approvals.description')}
      name="approvals"
      pending={PENDING.approvals}
      title={t('home.approvals.title')}
    >
      <ApprovalRows />
    </DashboardCard>
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
