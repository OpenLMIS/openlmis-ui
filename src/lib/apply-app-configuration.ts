import {
  applyBranding,
  getAppConfiguration,
  useAppConfigurationStore,
} from '@/lib/app-configuration';
import {
  applyAppearance,
  getResolvedAppearance,
  syncAppearanceFromStorage,
  useAppearanceStore,
  watchSystemAppearance,
} from '@/lib/appearance';
import { applyThemePreset } from '@/lib/theme-presets';

function applyConfiguration() {
  const configuration = getAppConfiguration();
  applyBranding(configuration);
  applyThemePreset(configuration.theme.preset);
  applyAppearance(getResolvedAppearance());
}

const applyResolvedAppearance = () => applyAppearance(getResolvedAppearance());

export function startApplyingAppConfiguration(): () => void {
  applyConfiguration();
  const onStorage = (event: StorageEvent) => syncAppearanceFromStorage(event.key);
  window.addEventListener('storage', onStorage);
  const stops = [
    useAppConfigurationStore.subscribe(applyConfiguration),
    useAppearanceStore.subscribe(applyResolvedAppearance),
    watchSystemAppearance(),
    () => window.removeEventListener('storage', onStorage),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
