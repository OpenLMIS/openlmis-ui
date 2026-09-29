import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlagSource,
  readFlagValue,
  resolveFlag,
} from '@/lib/feature-flags';

export type FlagEntry = { value: boolean | string; overridden: boolean };
export type FlagDraft = Record<FeatureFlagKey, FlagEntry>;
type StoredFlags = Record<string, boolean | string>;

const isKnown = (key: string): key is FeatureFlagKey => Object.hasOwn(FEATURE_FLAGS, key);

const inherited = (key: FeatureFlagKey, deployment: Record<string, unknown>) =>
  resolveFlag(key, {}, deployment);

export function toFlagDraft(saved: StoredFlags, deployment: Record<string, unknown>): FlagDraft {
  return Object.fromEntries(
    FEATURE_FLAG_KEYS.map((key) => {
      const stored = readFlagValue(FEATURE_FLAGS[key], saved[key]);
      return [
        key,
        stored === undefined
          ? { value: inherited(key, deployment).value, overridden: false }
          : { value: stored, overridden: true },
      ];
    }),
  ) as FlagDraft;
}

export function inheritedFlagValue(
  key: FeatureFlagKey,
  deployment: Record<string, unknown>,
): boolean | string {
  return inherited(key, deployment).value;
}

export function flagSource(
  key: FeatureFlagKey,
  entry: FlagEntry,
  deployment: Record<string, unknown>,
): FeatureFlagSource {
  return entry.overridden ? 'admin' : inherited(key, deployment).source;
}

export function buildFlagOverrides(draft: FlagDraft, saved: StoredFlags): StoredFlags {
  const unknown = Object.entries(saved).filter(([key]) => !isKnown(key));
  const overridden = FEATURE_FLAG_KEYS.filter((key) => draft[key].overridden);
  return Object.fromEntries([...unknown, ...overridden.map((key) => [key, draft[key].value])]);
}

export function isFlagsChanged(
  draft: FlagDraft,
  saved: StoredFlags,
  deployment: Record<string, unknown>,
): boolean {
  const current = toFlagDraft(saved, deployment);
  return FEATURE_FLAG_KEYS.some(
    (key) =>
      draft[key].value !== current[key].value || draft[key].overridden !== current[key].overridden,
  );
}
