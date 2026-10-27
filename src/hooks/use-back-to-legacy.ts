import { useTranslation } from 'react-i18next';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useAppName } from '@/lib/app-configuration';
import { legacyHome } from '@/lib/legacy-home';

export function useBackToLegacy() {
  const { t } = useTranslation();
  const appName = useAppName();
  return {
    label: t('legacy.label'),
    description: t('legacy.description', { appName }),
    onClick: () =>
      whenLeaveAllowed(() => {
        const url = legacyHome(import.meta.env.BASE_URL);
        allowUnload();
        window.location.assign(url);
      }),
  };
}
