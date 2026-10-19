import { useSuspenseQuery } from '@tanstack/react-query';
import { CircleCheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardBand, CardList, CardListItem, CardRows } from '@/components/card-list';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { SettingsItem } from '@/components/form/settings-list';
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
import { PENDING, WIDE_TABLE } from '@/features/home/components/dashboard-skeleton';
import { waitingSince } from '@/features/home/lib/requisitions';
import type { RequisitionSummary } from '@/features/home/lib/types';

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

function ApprovalsGrid({ rows }: { rows: readonly ApprovalRow[] }) {
  const { t } = useTranslation();

  return (
    <DataTableCard>
      <Table>
        <TableHeader surface="muted">
          <TableRow>
            <TableHead>
              <DataTableHeaderLabel>{t('home.approvals.program')}</DataTableHeaderLabel>
            </TableHead>
            <TableHead>
              <DataTableHeaderLabel>{t('home.approvals.facility')}</DataTableHeaderLabel>
            </TableHead>
            <TableHead>
              <DataTableHeaderLabel>{t('home.approvals.period')}</DataTableHeaderLabel>
            </TableHead>
            <TableHead>
              <DataTableHeaderLabel>{t('home.approvals.waiting-since')}</DataTableHeaderLabel>
            </TableHead>
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
    </DataTableCard>
  );
}

function ApprovalsList({ rows }: { rows: readonly ApprovalRow[] }) {
  const { t } = useTranslation();

  return (
    <CardList>
      {rows.map(({ requisition, waiting }) => (
        <CardListItem key={requisition.id} surface="flat">
          <CardBand>
            <div className="flex min-w-0 flex-col">
              <bdi className="wrap-anywhere">{requisition.facility.name}</bdi>
              <span className="font-normal text-muted-foreground text-xs" dir="ltr">
                {requisition.facility.code}
              </span>
            </div>
            <EmergencyBadge requisition={requisition} />
          </CardBand>
          <CardRows>
            <SettingsItem label={t('home.approvals.program')}>
              <bdi>{requisition.program.name}</bdi>
            </SettingsItem>
            <SettingsItem label={t('home.approvals.period')}>
              <bdi>{requisition.processingPeriod.name}</bdi>
            </SettingsItem>
            <SettingsItem label={t('home.approvals.waiting-since')}>{waiting}</SettingsItem>
          </CardRows>
        </CardListItem>
      ))}
    </CardList>
  );
}
