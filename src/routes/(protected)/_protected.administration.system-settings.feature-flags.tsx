import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { FeatureFlagsSettings } from '@/features/system-settings/components/feature-flags-settings';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/system-settings/feature-flags',
)({
  staticData: { crumbKey: 'system-settings.tabs.feature-flags' },
  component: FeatureFlagsPage,
});

function FeatureFlagsPage() {
  const { data: saved } = useSuspenseQuery(appConfigurationOptions());
  return saved ? <FeatureFlagsSettings key={saved.version} saved={saved} /> : null;
}
