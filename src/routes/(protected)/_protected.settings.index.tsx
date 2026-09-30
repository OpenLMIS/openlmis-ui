import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { BrandingSettings } from '@/features/system-settings/components/branding-settings';

export const Route = createFileRoute('/(protected)/_protected/settings/')({
  staticData: { crumbKey: 'system-settings.title' },
  component: BrandingPage,
});

function BrandingPage() {
  const { data: saved } = useSuspenseQuery(appConfigurationOptions());
  return saved ? <BrandingSettings saved={saved} /> : null;
}
