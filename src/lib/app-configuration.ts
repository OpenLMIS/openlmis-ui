import { z } from 'zod';
import { create } from 'zustand';
import { appConfig } from '@/lib/config';

const CACHE_KEY = 'openlmis-ui.app-configuration';
const LOAD_TIMEOUT_MS = 3000;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const DEFAULT_LOGO_URL = `${import.meta.env.BASE_URL}olmis.png`;

export const APPEARANCES = ['light', 'dark', 'system'] as const;

const appearanceSchema = z.enum(APPEARANCES);

const configurationSchema = z.object({
  version: z.number().int().nonnegative().catch(0),
  appName: z.string().trim().min(1).max(64).nullable().catch(null),
  showAppName: z.boolean().catch(true),
  logo: z
    .object({
      url: z.string().regex(/^\/(?!\/)/),
      contentType: z.string().startsWith('image/'),
    })
    .nullable()
    .catch(null),
  theme: z
    .object({
      preset: z.string().nullable().catch(null),
      defaultAppearance: appearanceSchema.nullable().catch(null),
    })
    .catch({ preset: null, defaultAppearance: null }),
  featureFlags: z.record(z.string(), z.unknown()).catch({}),
});

type AppConfiguration = z.infer<typeof configurationSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;

export const DEFAULT_APP_CONFIGURATION: AppConfiguration = configurationSchema.parse({});

export function parseAppConfiguration(value: unknown): AppConfiguration {
  return configurationSchema.catch(DEFAULT_APP_CONFIGURATION).parse(value);
}

export const useAppConfigurationStore = create<{ configuration: AppConfiguration }>(() => ({
  configuration: DEFAULT_APP_CONFIGURATION,
}));

export function getAppConfiguration(): AppConfiguration {
  return useAppConfigurationStore.getState().configuration;
}

export function setAppConfiguration(configuration: AppConfiguration): void {
  useAppConfigurationStore.setState({ configuration });
}

function readCache(): unknown {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function writeCache(value: unknown): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {}
}

function fallBackToCache(): void {
  setAppConfiguration(parseAppConfiguration(readCache()));
}

export function rememberAppConfiguration(value: unknown): void {
  writeCache(value);
  setAppConfiguration(parseAppConfiguration(value));
}

export async function loadAppConfiguration(): Promise<void> {
  fallBackToCache();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/appConfiguration`, {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      fallBackToCache();
      return;
    }
    rememberAppConfiguration(await response.json());
  } catch {
    fallBackToCache();
  } finally {
    clearTimeout(timeout);
  }
}

export function getAppName(configuration: AppConfiguration): string {
  return configuration.appName ?? appConfig.BRAND;
}

export function getLogoUrl(configuration: AppConfiguration): string {
  return configuration.logo?.url ?? DEFAULT_LOGO_URL;
}

export function useAppName(): string {
  return useAppConfigurationStore((state) => getAppName(state.configuration));
}

export function useShowAppName(): boolean {
  return useAppConfigurationStore((state) => state.configuration.showAppName);
}

export function useLogoUrl(): string {
  return useAppConfigurationStore((state) => getLogoUrl(state.configuration));
}

export function applyBranding(configuration: AppConfiguration): void {
  let title = document.getElementById('app-title');
  if (!title) {
    title = document.createElement('title');
    title.id = 'app-title';
    document.head.append(title);
  }
  title.textContent = getAppName(configuration);

  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.append(icon);
  }
  const logoUrl = getLogoUrl(configuration);
  icon.href = logoUrl;
  icon.type = configuration.logo?.contentType ?? 'image/png';

  if (logoUrl === DEFAULT_LOGO_URL) return;
  const probe = new Image();
  const target = icon;
  probe.onerror = () => {
    if (target.getAttribute('href') !== logoUrl) return;
    target.href = DEFAULT_LOGO_URL;
    target.type = 'image/png';
  };
  probe.src = logoUrl;
}
