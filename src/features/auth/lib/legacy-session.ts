import type { LoginData } from '@/features/auth/store/login-data';

// The AngularJS UI keeps its session in localStorage through angular-local-storage,
// configured with the `openlmis.` prefix. Same origin, so we can read it directly.
const LEGACY_PREFIX = 'openlmis.';

const LEGACY_KEYS = {
  accessToken: 'ACCESS_TOKEN',
  referenceDataUserId: 'USER_ID',
  username: 'USERNAME',
  roleAssignments: 'ROLE_ASSIGNMENTS',
} as const;

/** The key a `storage` event names when the legacy UI signs in or out. */
export const LEGACY_TOKEN_STORAGE_KEY = `${LEGACY_PREFIX}${LEGACY_KEYS.accessToken}`;

// Plain strings are stored raw, but angular-local-storage JSON-encodes other
// values, so tolerate a quoted token rather than passing quotes to the API.
function readLegacyValue(key: string): string | null {
  let raw: string | null;

  try {
    raw = window.localStorage.getItem(`${LEGACY_PREFIX}${key}`);
  } catch {
    return null;
  }

  if (!raw) return null;

  const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  return value.trim() || null;
}

/** Returns the legacy UI's session, or `null` when it is not signed in. */
export function readLegacySession(): LoginData | null {
  const accessToken = readLegacyValue(LEGACY_KEYS.accessToken);
  if (!accessToken) return null;

  return {
    accessToken,
    referenceDataUserId: readLegacyValue(LEGACY_KEYS.referenceDataUserId) ?? '',
    username: readLegacyValue(LEGACY_KEYS.username) ?? '',
  };
}

/**
 * Signs the legacy UI out too. The token is shared, so our logout already kills
 * it server-side; leaving the keys behind would only render a dead session.
 */
export function clearLegacySession(): void {
  try {
    for (const key of Object.values(LEGACY_KEYS)) {
      window.localStorage.removeItem(`${LEGACY_PREFIX}${key}`);
    }
  } catch {
    // A storage failure must not stop our own logout from completing.
  }
}
