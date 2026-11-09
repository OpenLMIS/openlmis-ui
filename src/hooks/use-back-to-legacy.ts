import { useTranslation } from 'react-i18next';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useAppName } from '@/lib/app-configuration';
import { legacyHome } from '@/lib/legacy-home';

export function useBackToLegacy(hash = '') {
  const { t } = useTranslation();
  const appName = useAppName();
  const home = legacyHome(import.meta.env.BASE_URL);
  const open = (targetHash: string) =>
    whenLeaveAllowed(() => {
      allowUnload();
      window.location.assign(`${home}${targetHash}`);
    }, 'leave');
  return {
    available: home !== import.meta.env.BASE_URL,
    label: t('legacy.label'),
    description: t('legacy.description', { appName }),
    onClick: () => open(hash),
    open,
  };
}
