import { useSuspenseQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { customersListOptions } from '@/features/customers/api/queries';

export function CustomerStats() {
  const { data: customers } = useSuspenseQuery(customersListOptions);

  const total = customers.length;
  const active = customers.filter((c) => c.status === 'Active').length;
  const trial = customers.filter((c) => c.status === 'Trial').length;
  const mrr = customers.reduce((sum, c) => sum + c.mrr, 0);

  const stats = [
    {
      description: 'Total Customers',
      value: total.toLocaleString(),
      deltaIcon: TrendingUp,
      deltaText: '+8.2%',
    },
    {
      description: 'Active Subscriptions',
      value: active.toLocaleString(),
      deltaIcon: TrendingUp,
      deltaText: '+3.4%',
    },
    {
      description: 'Monthly Recurring Revenue',
      value: `$${mrr.toLocaleString()}`,
      deltaIcon: TrendingUp,
      deltaText: '+12.1%',
    },
    {
      description: 'Trial Pipeline',
      value: trial.toLocaleString(),
      deltaIcon: TrendingDown,
      deltaText: '-2.0%',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:gap-6">
      {stats.map((stat) => (
        <Card surface="background" key={stat.description} className="@container/card">
          <CardHeader>
            <CardDescription>{stat.description}</CardDescription>
            <CardTitle variant="metric">{stat.value}</CardTitle>
            <CardAction>
              <Badge>
                <stat.deltaIcon />
                {stat.deltaText}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
