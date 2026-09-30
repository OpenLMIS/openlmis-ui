import { create } from 'zustand';

// Written to `config.json` by the container, since one image serves every environment.
type RuntimeConfig = {
  authServerClientId?: string;
  authServerClientSecret?: string;
  featureFlags: Record<string, unknown>;
};

const useRuntimeConfigStore = create<RuntimeConfig>(() => ({ featureFlags: {} }));

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadRuntimeConfig(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (!response.ok) return;

    const parsed: unknown = await response.json();
    if (typeof parsed !== 'object' || parsed === null) return;

    const { authServerClientId, authServerClientSecret, featureFlags } = parsed as Record<
      string,
      unknown
    >;
    useRuntimeConfigStore.setState({
      authServerClientId: asString(authServerClientId),
      authServerClientSecret: asString(authServerClientSecret),
      featureFlags: asRecord(featureFlags),
    });
  } catch {
    window.addEventListener('online', () => void loadRuntimeConfig(), { once: true });
  }
}

export function getAuthClientCredentials(): { clientId?: string; clientSecret?: string } {
  const runtimeConfig = useRuntimeConfigStore.getState();
  return {
    clientId: runtimeConfig.authServerClientId || import.meta.env.VITE_AUTH_SERVER_CLIENT_ID,
    clientSecret:
      runtimeConfig.authServerClientSecret || import.meta.env.VITE_AUTH_SERVER_CLIENT_SECRET,
  };
}

export function getDeploymentFlags(): Record<string, unknown> {
  return useRuntimeConfigStore.getState().featureFlags;
}

export function useDeploymentFlags(): Record<string, unknown> {
  return useRuntimeConfigStore((state) => state.featureFlags);
}
