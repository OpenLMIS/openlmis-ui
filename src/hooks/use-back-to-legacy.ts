import { useTranslation } from 'react-i18next';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useAppName } from '@/lib/app-configuration';
import { legacyHome } from '@/lib/legacy-home';

export function useBackToLegacy(hash = '') {
  const { t } = useTranslation();
  const appName = useAppName();
  const home = legacyHome(import.meta.env.BASE_URL);
  const url = `${home}${hash}`;
  return {
    available: home !== import.meta.env.BASE_URL,
    label: t('legacy.label'),
    description: t('legacy.description', { appName }),
    onClick: () =>
      whenLeaveAllowed(() => {
        allowUnload();
        window.location.assign(url);
      }, 'leave'),
  };
}
