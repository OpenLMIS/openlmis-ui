import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { TourLegendItem } from '@/features/onboarding/lib/types';

export function TourLegend({ items }: { items: readonly TourLegendItem[] }) {
  const { t } = useTranslation();
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {items.map(({ label, text, tone, icon: Icon }) => (
        <li key={label} className="flex items-start gap-2">
          <span className="shrink-0">
            <Badge variant={tone}>
              {Icon && <Icon aria-hidden="true" data-icon="inline-start" />}
              {t(label)}
            </Badge>
          </span>
          <span className="min-w-0 flex-1 text-muted-foreground">{t(text)}</span>
        </li>
      ))}
    </ul>
  );
}
