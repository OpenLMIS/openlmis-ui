import { create } from 'zustand';
import { type Appearance, useAppConfigurationStore } from '@/lib/app-configuration';

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

type AppearanceChoice = 'light' | 'dark' | null;
type ResolvedAppearance = 'light' | 'dark';

function readChoice(): AppearanceChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export const useAppearanceStore = create<{ choice: AppearanceChoice; systemDark: boolean }>(() => ({
  choice: readChoice(),
  systemDark: prefersDark(),
}));

export function setAppearanceChoice(choice: AppearanceChoice): void {
  try {
    if (choice) localStorage.setItem(STORAGE_KEY, choice);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  useAppearanceStore.setState({ choice });
}

export function syncAppearanceFromStorage(key: string | null): void {
  if (key === STORAGE_KEY || key === null) useAppearanceStore.setState({ choice: readChoice() });
}

export function watchSystemAppearance(): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const update = () => useAppearanceStore.setState({ systemDark: query.matches });
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}

export function resolveAppearance(
  choice: AppearanceChoice,
  defaultAppearance: Appearance | null,
  systemDark: boolean,
): ResolvedAppearance {
  const appearance = choice ?? defaultAppearance ?? 'system';
  if (appearance !== 'system') return appearance;
  return systemDark ? 'dark' : 'light';
}

export function getResolvedAppearance(): ResolvedAppearance {
  const { choice, systemDark } = useAppearanceStore.getState();
  const { defaultAppearance } = useAppConfigurationStore.getState().configuration.theme;
  return resolveAppearance(choice, defaultAppearance, systemDark);
}

export function useResolvedAppearance(): ResolvedAppearance {
  const { choice, systemDark } = useAppearanceStore();
  const defaultAppearance = useAppConfigurationStore(
    (state) => state.configuration.theme.defaultAppearance,
  );
  return resolveAppearance(choice, defaultAppearance, systemDark);
}

export function applyAppearance(appearance: ResolvedAppearance): void {
  const root = document.documentElement;
  root.classList.toggle('dark', appearance === 'dark');
  root.style.colorScheme = appearance;
}
