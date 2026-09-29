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

function applyAll() {
  const configuration = getAppConfiguration();
  applyBranding(configuration);
  applyThemePreset(configuration.theme.preset);
  applyAppearance(getResolvedAppearance());
}

export function startApplyingAppConfiguration(): () => void {
  applyAll();
  const onStorage = (event: StorageEvent) => syncAppearanceFromStorage(event.key);
  window.addEventListener('storage', onStorage);
  const stops = [
    useAppConfigurationStore.subscribe(applyAll),
    useAppearanceStore.subscribe(applyAll),
    watchSystemAppearance(),
    () => window.removeEventListener('storage', onStorage),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
