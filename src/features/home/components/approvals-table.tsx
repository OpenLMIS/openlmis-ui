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
import type { RequisitionSummary } from '@/features/home/lib/types';

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

/** Below this the table becomes a two-line list, which fits a phone without scrolling sideways. */
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

  const rows = data.requisitions.map((requisition) => ({
    requisition,
    waiting: formatDate(new Date(waitingSince(requisition))),
  }));

  return (
    <div ref={measure}>{wide ? <ApprovalsGrid rows={rows} /> : <ApprovalsList rows={rows} />}</div>
  );
}

type ApprovalRow = {
  requisition: RequisitionSummary;
  waiting: string;
};

function EmergencyBadge({ requisition }: { requisition: RequisitionSummary }) {
  const { t } = useTranslation();
  if (!requisition.emergency) return null;
  return <Badge variant="destructive">{t('home.approvals.emergency')}</Badge>;
}

/** A column per detail, when the card has the room. */
function ApprovalsGrid({ rows }: { rows: readonly ApprovalRow[] }) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('home.approvals.program')}</TableHead>
          <TableHead>{t('home.approvals.facility')}</TableHead>
          <TableHead>{t('home.approvals.period')}</TableHead>
          <TableHead>{t('home.approvals.waiting-since')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ requisition, waiting }) => (
          <TableRow key={requisition.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium">{requisition.program.name}</span>
                <EmergencyBadge requisition={requisition} />
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span>{requisition.facility.name}</span>
                <span className="text-xs text-muted-foreground">{requisition.facility.code}</span>
              </div>
            </TableCell>
            <TableCell>{requisition.processingPeriod.name}</TableCell>
            <TableCell>
              <span className="text-muted-foreground">{waiting}</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Two lines per requisition on a narrow card: where and since when, then what for. */
function ApprovalsList({ rows }: { rows: readonly ApprovalRow[] }) {
  const { t } = useTranslation();

  return (
    <ul className="flex flex-col divide-y">
      {rows.map(({ requisition, waiting }) => (
        <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0" key={requisition.id}>
          <div className="flex items-baseline justify-between gap-3">
            {/* Separate items, so the gap holds even where Latin names sit in a right-to-left line. */}
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-sm font-medium">{requisition.facility.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {requisition.facility.code}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              <span className="sr-only">{t('home.approvals.waiting-since')} </span>
              {waiting}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="min-w-0 truncate">
              {requisition.program.name} · {requisition.processingPeriod.name}
            </span>
            <EmergencyBadge requisition={requisition} />
          </div>
        </li>
      ))}
    </ul>
  );
}
