/**
 * Settings that vary per environment and cannot be compiled in.
 *
 * Vite resolves `import.meta.env` at build time, so baking the OAuth client into
 * the bundle would tie one image to one environment. The container writes
 * `<base>/config.json` from its own env at start instead, the same trick the
 * legacy UI uses on `openlmis.js`. Falls back to `import.meta.env` for `pnpm dev`.
 */
type RuntimeConfig = {
  authServerClientId?: string;
  authServerClientSecret?: string;
  featureFlags: Record<string, unknown>;
};

let runtimeConfig: RuntimeConfig = { featureFlags: {} };

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
    runtimeConfig = {
      authServerClientId: asString(authServerClientId),
      authServerClientSecret: asString(authServerClientSecret),
      featureFlags: asRecord(featureFlags),
    };
  } catch {
    window.addEventListener('online', () => void loadRuntimeConfig(), { once: true });
  }
}

export function getAuthClientCredentials(): { clientId?: string; clientSecret?: string } {
  return {
    clientId: runtimeConfig.authServerClientId || import.meta.env.VITE_AUTH_SERVER_CLIENT_ID,
    clientSecret:
      runtimeConfig.authServerClientSecret || import.meta.env.VITE_AUTH_SERVER_CLIENT_SECRET,
  };
}

export function getDeploymentFlags(): Record<string, unknown> {
  return runtimeConfig.featureFlags;
}
