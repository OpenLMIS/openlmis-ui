import { useSuspenseQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useDirection } from '@/components/ui/direction';
import { type PipelineStatus, REQUISITION_PIPELINE } from '@/features/home/api/api';
import { requisitionStatusCountsOptions } from '@/features/home/api/queries';
import {
  CountBadge,
  DashboardCard,
  useFormatNumber,
} from '@/features/home/components/dashboard-parts';
import { PENDING } from '@/features/home/components/dashboard-skeleton';
import { sum } from '@/features/home/lib/sum';

/** One step of the chart ramp per status, lightest first, so the order of the pipeline reads in the colour. */
const STATUS_COLOR: Record<PipelineStatus, { fill: string; dot: string }> = {
  SUBMITTED: { fill: 'var(--chart-1)', dot: 'bg-chart-1' },
  AUTHORIZED: { fill: 'var(--chart-2)', dot: 'bg-chart-2' },
  IN_APPROVAL: { fill: 'var(--chart-3)', dot: 'bg-chart-3' },
  APPROVED: { fill: 'var(--chart-4)', dot: 'bg-chart-4' },
  RELEASED: { fill: 'var(--chart-5)', dot: 'bg-chart-5' },
};

const STATUS_LABEL = {
  SUBMITTED: 'home.statuses.submitted',
  AUTHORIZED: 'home.statuses.authorized',
  IN_APPROVAL: 'home.statuses.in-approval',
  APPROVED: 'home.statuses.approved',
  RELEASED: 'home.statuses.released',
} as const satisfies Record<PipelineStatus, string>;

const totalCount = (counts: Record<PipelineStatus, number>) => sum(Object.values(counts));

/** Where sent requisitions stand, from submitted to released. */
export function RequisitionStatusMeter() {
  const { t } = useTranslation();
  return (
    <DashboardCard
      badge={<CountBadge query={requisitionStatusCountsOptions()} select={totalCount} />}
      description={t('home.statuses.description')}
      name="statuses"
      pending={PENDING.statuses}
      title={t('home.statuses.title')}
    >
      <StatusMeter />
    </DashboardCard>
  );
}

function StatusMeter() {
  const { t } = useTranslation();
  const format = useFormatNumber();
  const isRtl = useDirection() === 'rtl';
  const { data } = useSuspenseQuery(requisitionStatusCountsOptions());
  const total = sum(Object.values(data));
  const config = useMemo(
    () =>
      Object.fromEntries(
        REQUISITION_PIPELINE.map((status) => [
          status,
          { label: t(STATUS_LABEL[status]), color: STATUS_COLOR[status].fill },
        ]),
      ) satisfies ChartConfig,
    [t],
  );
  const share = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100));

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={config} height="meter">
        <BarChart
          accessibilityLayer
          barCategoryGap={0}
          data={[data]}
          layout="vertical"
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis domain={[0, Math.max(total, 1)]} hide reversed={isRtl} type="number" />
          <YAxis hide type="category" />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
          {REQUISITION_PIPELINE.map((status) => (
            <Bar
              dataKey={status}
              fill={`var(--color-${status})`}
              key={status}
              stackId="statuses"
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <ul className="flex flex-col gap-1.5">
        {REQUISITION_PIPELINE.map((status) => (
          <li className="flex items-center gap-2 text-sm" key={status}>
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${STATUS_COLOR[status].dot}`}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {t(STATUS_LABEL[status])}
            </span>
            <span className="font-medium tabular-nums">{format(data[status])}</span>
            <span className="w-10 text-end text-muted-foreground tabular-nums">
              {share(data[status])}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
