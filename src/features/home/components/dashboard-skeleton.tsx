import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** A placeholder of a given size; its size belongs to the layout, so it sits in a wrapper. */
function Block({ className }: { className: string }) {
  return (
    <div className={className}>
      <Skeleton fill />
    </div>
  );
}

function CardSkeleton({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          <span className="block h-4 w-48 py-0.5">
            <Skeleton fill />
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Block className={body} />
      </CardContent>
    </Card>
  );
}

/** The dashboard's frame while the user's rights load: the full layout, real titles, placeholder values. */
export function DashboardSkeleton() {
  const { t } = useTranslation();
  const stats = [
    t('home.stats.approve'),
    t('home.stats.convert'),
    t('home.stats.orders'),
    t('home.stats.equipment'),
  ];

  return (
    <div aria-busy className="flex flex-col gap-4 lg:gap-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-foreground/10 @4xl/main:grid-cols-4">
        {stats.map((label) => (
          <div className="flex flex-col gap-1 bg-card px-4 py-3" key={label}>
            <span className="text-sm text-muted-foreground">{label}</span>
            <Block className="h-8 w-16 py-1" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 @4xl/main:grid-cols-3">
        <div className="grid @4xl/main:col-span-2">
          <CardSkeleton body="h-64 w-full" title={t('home.periods.title')} />
        </div>
        <div className="grid">
          <CardSkeleton body="h-36 w-full" title={t('home.statuses.title')} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 @4xl/main:grid-cols-3">
        <div className="grid @4xl/main:col-span-2">
          <CardSkeleton body="h-64 w-full" title={t('home.approvals.title')} />
        </div>
        <div className="grid">
          <CardSkeleton body="h-40 w-full" title={t('home.equipment.title')} />
        </div>
      </div>
    </div>
  );
}

/** Where the header's buttons will be, so the heading does not shift when they arrive. */
export function ActionsSkeleton() {
  return (
    <div className="flex gap-2">
      <Block className="h-10 w-28" />
      <Block className="h-10 w-28" />
    </div>
  );
}
