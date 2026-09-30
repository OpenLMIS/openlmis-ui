import type { LoginData } from '@/features/auth/store/login-data';

// The AngularJS UI's angular-local-storage prefix; the origin is shared, so we read it directly.
const LEGACY_PREFIX = 'openlmis.';

const LEGACY_KEYS = {
  accessToken: 'ACCESS_TOKEN',
  referenceDataUserId: 'USER_ID',
  username: 'USERNAME',
  roleAssignments: 'ROLE_ASSIGNMENTS',
} as const;

/** The keys a `storage` event names when the legacy UI signs in or out. */
export const LEGACY_SESSION_STORAGE_KEYS: readonly string[] = [
  LEGACY_KEYS.accessToken,
  LEGACY_KEYS.referenceDataUserId,
  LEGACY_KEYS.username,
].map((key) => `${LEGACY_PREFIX}${key}`);

// angular-local-storage JSON-encodes some values, so a quoted token is unwrapped.
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

export function readLegacySession(): LoginData | null {
  const accessToken = readLegacyValue(LEGACY_KEYS.accessToken);
  const referenceDataUserId = readLegacyValue(LEGACY_KEYS.referenceDataUserId);
  const username = readLegacyValue(LEGACY_KEYS.username);
  if (!accessToken || !referenceDataUserId || !username) return null;

  return { accessToken, referenceDataUserId, username };
}

// The token is shared and our logout kills it, so the legacy keys would only hold a dead session.
export function clearLegacySession(): void {
  try {
    for (const key of Object.values(LEGACY_KEYS)) {
      window.localStorage.removeItem(`${LEGACY_PREFIX}${key}`);
    }
  } catch {
    // A storage failure must not stop our own logout from completing.
  }
}
