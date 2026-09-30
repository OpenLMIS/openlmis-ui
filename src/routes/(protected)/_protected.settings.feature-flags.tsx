import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { FeatureFlagsSettings } from '@/features/system-settings/components/feature-flags-settings';

export const Route = createFileRoute('/(protected)/_protected/settings/feature-flags')({
  staticData: { crumbKey: 'system-settings.title' },
  component: FeatureFlagsPage,
});

function FeatureFlagsPage() {
  const { data: saved } = useSuspenseQuery(appConfigurationOptions());
  return saved ? <FeatureFlagsSettings saved={saved} /> : null;
}
