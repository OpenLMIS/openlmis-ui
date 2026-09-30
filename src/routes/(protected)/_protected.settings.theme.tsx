import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { ThemeSettings } from '@/features/system-settings/components/theme-settings';

export const Route = createFileRoute('/(protected)/_protected/settings/theme')({
  staticData: { crumbKey: 'system-settings.title' },
  component: ThemePage,
});

function ThemePage() {
  const { data: saved } = useSuspenseQuery(appConfigurationOptions());
  return saved ? <ThemeSettings saved={saved} /> : null;
}
