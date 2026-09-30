import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { FeatureFlagsSettings } from '@/features/system-settings/components/feature-flags-settings';
import { textFilterSchema } from '@/lib/table-search';

export const Route = createFileRoute('/(protected)/_protected/settings/feature-flags')({
  validateSearch: z.object({ search: textFilterSchema }),
  staticData: { crumbKey: 'system-settings.title' },
  component: FeatureFlagsPage,
});

function FeatureFlagsPage() {
  const { data: saved } = useSuspenseQuery(appConfigurationOptions());
  const { search } = Route.useSearch();
  const navigate = Route.useNavigate();

  return saved ? (
    <FeatureFlagsSettings
      onSearchChange={(value) =>
        void navigate({ search: { search: value || undefined }, replace: true })
      }
      saved={saved}
      search={search ?? ''}
    />
  ) : null;
}
