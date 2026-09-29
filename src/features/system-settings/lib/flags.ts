import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlagSource,
  resolveFlag,
} from '@/lib/feature-flags';

export type FlagValues = Record<FeatureFlagKey, boolean | string>;
type StoredFlags = Record<string, boolean | string>;

const isKnown = (key: string): key is FeatureFlagKey => Object.hasOwn(FEATURE_FLAGS, key);

const inherited = (key: FeatureFlagKey, deployment: Record<string, unknown>) =>
  resolveFlag(key, {}, deployment);

export function toFlagValues(saved: StoredFlags, deployment: Record<string, unknown>): FlagValues {
  return Object.fromEntries(
    FEATURE_FLAG_KEYS.map((key) => [key, resolveFlag(key, saved, deployment).value]),
  ) as FlagValues;
}

export function inheritedFlagValue(
  key: FeatureFlagKey,
  deployment: Record<string, unknown>,
): boolean | string {
  return inherited(key, deployment).value;
}

export function flagSource(
  key: FeatureFlagKey,
  value: boolean | string,
  deployment: Record<string, unknown>,
): FeatureFlagSource {
  const current = inherited(key, deployment);
  return value === current.value ? current.source : 'admin';
}

export function buildFlagOverrides(
  values: FlagValues,
  saved: StoredFlags,
  deployment: Record<string, unknown>,
): StoredFlags {
  const unknown = Object.entries(saved).filter(([key]) => !isKnown(key));
  const changed = FEATURE_FLAG_KEYS.filter(
    (key) => values[key] !== inherited(key, deployment).value,
  );
  return Object.fromEntries([...unknown, ...changed.map((key) => [key, values[key]])]);
}

function sameEntries(a: StoredFlags, b: StoredFlags) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => a[key] === b[key]);
}

export function isFlagsChanged(
  values: FlagValues,
  saved: StoredFlags,
  deployment: Record<string, unknown>,
): boolean {
  return !sameEntries(
    buildFlagOverrides(values, saved, deployment),
    buildFlagOverrides(toFlagValues(saved, deployment), saved, deployment),
  );
}
