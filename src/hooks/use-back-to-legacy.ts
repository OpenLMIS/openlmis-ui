import { useTranslation } from 'react-i18next';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useAppName } from '@/lib/app-configuration';
import { legacyHome } from '@/lib/legacy-home';

export const legacyAvailable = () =>
  legacyHome(import.meta.env.BASE_URL) !== import.meta.env.BASE_URL;

export function openLegacy(hash = '') {
  const url = `${legacyHome(import.meta.env.BASE_URL)}${hash}`;
  whenLeaveAllowed(() => {
    allowUnload();
    window.location.assign(url);
  }, 'leave');
}

export function useBackToLegacy(hash = '') {
  const { t } = useTranslation();
  const appName = useAppName();
  return {
    available: legacyAvailable(),
    label: t('legacy.label'),
    description: t('legacy.description', { appName }),
    onClick: () => openLegacy(hash),
  };
}
