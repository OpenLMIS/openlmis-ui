import { useSuspenseQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usersListOptions } from '@/features/users/api/queries';

export function UserStats() {
  const { data: users } = useSuspenseQuery(usersListOptions);

  const total = users.length;
  const active = users.filter((u) => u.status === 'Active').length;
  const invited = users.filter((u) => u.status === 'Invited').length;
  const admins = users.filter((u) => u.role === 'Owner' || u.role === 'Admin').length;

  const stats = [
    {
      description: 'Total Members',
      value: total.toLocaleString(),
      deltaIcon: TrendingUp,
      deltaText: '+6.1%',
    },
    {
      description: 'Active',
      value: active.toLocaleString(),
      deltaIcon: TrendingUp,
      deltaText: '+4.8%',
    },
    {
      description: 'Pending Invites',
      value: invited.toLocaleString(),
      deltaIcon: TrendingUp,
      deltaText: '+2.0%',
    },
    {
      description: 'Admins & Owners',
      value: admins.toLocaleString(),
      deltaIcon: TrendingDown,
      deltaText: '-1.1%',
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
