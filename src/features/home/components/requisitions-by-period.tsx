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
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
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
import {
  CountBadge,
  CountedTitle,
  useFormatNumber,
  WidgetError,
} from '@/features/home/components/dashboard-parts';
import { type MonthTotals, totalsByMonth } from '@/features/home/lib/periods';

function useMonthTotals() {
  const { data: requisitions } = useSuspenseQuery(recentRequisitionsOptions());
  return useMemo(() => totalsByMonth(requisitions), [requisitions]);
}

/** Month and year in the reader's language, read from a `YYYY-MM` key. */
function useMonthFormats() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const format = (options: Intl.DateTimeFormatOptions) => {
      const formatter = new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: 'UTC' });
      return (key: string) => formatter.format(new Date(`${key}-01T00:00:00Z`));
    };
    return {
      full: format({ month: 'short', year: 'numeric' }),
      month: format({ month: 'short' }),
      year: format({ year: 'numeric' }),
    };
  }, [i18n.language]);
}

type MonthTickProps = {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: string };
  months: readonly MonthTotals[];
  formats: ReturnType<typeof useMonthFormats>;
};

/** The month, with its year beneath where the year starts or changes, so six ticks fit a phone. */
function MonthTick({ x = 0, y = 0, index = 0, payload, months, formats }: MonthTickProps) {
  if (!payload) return null;
  const key = payload.value;
  const showYear = index === 0 || months[index - 1]?.month.slice(0, 4) !== key.slice(0, 4);
  return (
    <text className="fill-muted-foreground text-xs" textAnchor="middle" x={x} y={y}>
      <tspan dy="0.8em" x={x}>
        {formats.month(key)}
      </tspan>
      {showYear && (
        <tspan dy="1.3em" x={x}>
          {formats.year(key)}
        </tspan>
      )}
    </text>
  );
}

/** Sent requisitions in each of the latest months, split into still in progress and approved. */
export function RequisitionsByPeriod() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CountedTitle title={t('home.periods.title')}>
          <MonthsTotal />
        </CountedTitle>
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
          <MonthChart />
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function MonthsTotal() {
  const months = useMonthTotals();
  return <CountBadge count={months.reduce((sum, m) => sum + m.inProgress + m.approved, 0)} />;
}

function MonthChart() {
  const { t } = useTranslation();
  const format = useFormatNumber();
  const formats = useMonthFormats();
  const isRtl = useDirection() === 'rtl';
  const months = useMonthTotals();
  const config = useMemo(
    () =>
      ({
        inProgress: { label: t('home.periods.in-progress'), color: 'var(--chart-2)' },
        approved: { label: t('home.periods.approved'), color: 'var(--chart-4)' },
      }) satisfies ChartConfig,
    [t],
  );

  if (months.length === 0) {
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
        <BarChart accessibilityLayer data={months} margin={{ top: 20 }}>
          <CartesianGrid vertical={false} />
          {/* Every month is labelled; there are at most six, so none is skipped. */}
          <XAxis
            axisLine={false}
            dataKey="month"
            interval={0}
            reversed={isRtl}
            height={36}
            tick={<MonthTick formats={formats} months={months} />}
            tickLine={false}
            tickMargin={4}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            orientation={isRtl ? 'right' : 'left'}
            tickFormatter={format}
            tickLine={false}
            width={32}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent labelFormatter={(month) => formats.full(String(month))} />
            }
            cursor={false}
          />
          {/* Recharts sorts the legend by name; the stacking order reads better. */}
          <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
          {/* The card-coloured stroke is the 2px gap that keeps stacked segments apart. */}
          <Bar
            dataKey="inProgress"
            fill="var(--color-inProgress)"
            maxBarSize={24}
            shape={InProgressSegment}
            stackId="month"
            stroke="var(--card)"
            strokeWidth={2}
          />
          <Bar
            dataKey="approved"
            fill="var(--color-approved)"
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            stackId="month"
            stroke="var(--card)"
            strokeWidth={2}
          >
            <LabelList
              className="fill-muted-foreground"
              formatter={(value) => (typeof value === 'number' ? format(value) : value)}
              position="top"
              valueAccessor={(entry: { payload: MonthTotals }) =>
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
            <th scope="col">{t('home.periods.month')}</th>
            <th scope="col">{t('home.periods.in-progress')}</th>
            <th scope="col">{t('home.periods.approved')}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">{formats.full(month.month)}</th>
              <td>{format(month.inProgress)}</td>
              <td>{format(month.approved)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** The lower segment, rounded on top only when nothing is stacked above it. */
function InProgressSegment(props: RectangleProps & { payload?: MonthTotals }) {
  return <Rectangle {...props} radius={props.payload?.approved ? 0 : [4, 4, 0, 0]} />;
}
