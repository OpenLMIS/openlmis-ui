import { useSuspenseQuery } from '@tanstack/react-query';
import { BarChartIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Rectangle,
  type RectangleProps,
  XAxis,
  YAxis,
} from 'recharts';
import { QueryBoundary } from '@/components/query-boundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useDirection } from '@/components/ui/direction';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { recentRequisitionsOptions } from '@/features/home/api/queries';
import { useFormatNumber, WidgetError } from '@/features/home/components/dashboard-parts';
import { type PeriodTotals, totalsByPeriod } from '@/features/home/lib/periods';

/** Requisitions sent in each of the latest periods, split into still in progress and approved. */
export function RequisitionsByPeriod() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.periods.title')}</CardTitle>
        <CardDescription>{t('home.periods.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          errorComponent={({ reset }) => <WidgetError onRetry={reset} />}
          pendingFallback={
            <div className="h-64 w-full">
              <Skeleton fill />
            </div>
          }
          resetKey="recent-requisitions"
        >
          <PeriodChart />
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function PeriodChart() {
  const { t } = useTranslation();
  const format = useFormatNumber();
  const isRtl = useDirection() === 'rtl';
  const { data: requisitions } = useSuspenseQuery(recentRequisitionsOptions());
  const periods = useMemo(() => totalsByPeriod(requisitions), [requisitions]);
  const config = useMemo(
    () =>
      ({
        inProgress: { label: t('home.periods.in-progress'), color: 'var(--chart-2)' },
        approved: { label: t('home.periods.approved'), color: 'var(--chart-4)' },
      }) satisfies ChartConfig,
    [t],
  );

  if (periods.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BarChartIcon />
          </EmptyMedia>
          <EmptyTitle>{t('home.periods.empty-title')}</EmptyTitle>
          <EmptyDescription>{t('home.periods.empty-description')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <ChartContainer config={config} height="plot">
        <BarChart accessibilityLayer data={periods} margin={{ top: 20 }}>
          <CartesianGrid vertical={false} />
          <XAxis axisLine={false} dataKey="name" reversed={isRtl} tickLine={false} tickMargin={8} />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            orientation={isRtl ? 'right' : 'left'}
            tickFormatter={format}
            tickLine={false}
            width={32}
          />
          <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
          {/* Recharts sorts the legend by name; the stacking order reads better. */}
          <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
          {/* The card-coloured stroke is the 2px gap that keeps stacked segments apart. */}
          <Bar
            dataKey="inProgress"
            fill="var(--color-inProgress)"
            maxBarSize={24}
            shape={InProgressSegment}
            stackId="period"
            stroke="var(--card)"
            strokeWidth={2}
          />
          <Bar
            dataKey="approved"
            fill="var(--color-approved)"
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            stackId="period"
            stroke="var(--card)"
            strokeWidth={2}
          >
            <LabelList
              className="fill-muted-foreground"
              formatter={(value) => (typeof value === 'number' ? format(value) : value)}
              position="top"
              valueAccessor={(entry: { payload: { inProgress: number; approved: number } }) =>
                entry.payload.inProgress + entry.payload.approved
              }
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{t('home.periods.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('home.periods.period')}</th>
            <th scope="col">{t('home.periods.in-progress')}</th>
            <th scope="col">{t('home.periods.approved')}</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.periodId}>
              <th scope="row">{period.name}</th>
              <td>{format(period.inProgress)}</td>
              <td>{format(period.approved)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** The lower segment, rounded on top only when nothing is stacked above it. */
function InProgressSegment(props: RectangleProps & { payload?: PeriodTotals }) {
  return <Rectangle {...props} radius={props.payload?.approved ? 0 : [4, 4, 0, 0]} />;
}
