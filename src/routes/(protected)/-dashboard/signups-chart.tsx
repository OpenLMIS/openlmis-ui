import { TrendingUpIcon } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { SIGNUPS_DATA } from '@/routes/(protected)/-dashboard/mock-data';

const chartConfig = {
  signups: { label: 'Signups', color: 'var(--primary)' },
} satisfies ChartConfig;

export function SignupsChart() {
  return (
    <Card surface="background">
      <CardHeader>
        <CardTitle gap="sm" className="flex items-center">
          New Signups
          <Badge>
            <TrendingUpIcon aria-hidden="true" />
            +144%
          </Badge>
        </CardTitle>
        <CardDescription>Weekly user registration trends</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-62.5 w-full">
          <AreaChart
            accessibilityLayer
            data={SIGNUPS_DATA}
            margin={{ top: 20, right: 2, bottom: 0, left: 2 }}
          >
            <defs>
              <linearGradient id="signups-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-signups)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-signups)" stopOpacity={0} />
              </linearGradient>
              <filter id="signups-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="signups-line-glow" x="-10%" y="-20%" width="120%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="signups"
              type="natural"
              fill="url(#signups-fill)"
              stroke="var(--color-signups)"
              strokeWidth={2}
              filter="url(#signups-line-glow)"
              dot={{
                r: 4,
                fill: 'var(--color-signups)',
                strokeWidth: 2,
                stroke: 'var(--background)',
                filter: 'url(#signups-dot-glow)',
              }}
              activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--background)' }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
