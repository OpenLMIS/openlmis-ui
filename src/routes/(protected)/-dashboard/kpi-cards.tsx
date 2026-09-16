import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Kpi = {
  description: string;
  value: string;
  delta: { icon: LucideIcon; text: string };
  footer: { primary: string; icon: LucideIcon; secondary: string };
};

const KPIS: Kpi[] = [
  {
    description: 'Total Revenue',
    value: '$1,250.00',
    delta: { icon: TrendingUp, text: '+12.5%' },
    footer: {
      primary: 'Trending up this month',
      icon: TrendingUp,
      secondary: 'Visitors for the last 6 months',
    },
  },
  {
    description: 'New Customers',
    value: '1,234',
    delta: { icon: TrendingDown, text: '-20%' },
    footer: {
      primary: 'Down 20% this period',
      icon: TrendingDown,
      secondary: 'Acquisition needs attention',
    },
  },
  {
    description: 'Active Accounts',
    value: '45,678',
    delta: { icon: TrendingUp, text: '+12.5%' },
    footer: {
      primary: 'Strong user retention',
      icon: TrendingUp,
      secondary: 'Engagement exceeds targets',
    },
  },
  {
    description: 'Growth Rate',
    value: '4.5%',
    delta: { icon: TrendingUp, text: '+4.5%' },
    footer: {
      primary: 'Steady performance increase',
      icon: TrendingUp,
      secondary: 'Meets growth projections',
    },
  },
];

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:gap-6">
      {KPIS.map((kpi) => (
        <Card surface="background" key={kpi.description} className="@container/card">
          <CardHeader>
            <CardDescription>{kpi.description}</CardDescription>
            <CardTitle variant="metric">{kpi.value}</CardTitle>
            <CardAction>
              <Badge>
                <kpi.delta.icon />
                {kpi.delta.text}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter variant="metric" gap="xs" className="flex-col items-start">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {kpi.footer.primary}
              <kpi.footer.icon className="size-4" />
            </div>
            <div className="text-muted-foreground">{kpi.footer.secondary}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
