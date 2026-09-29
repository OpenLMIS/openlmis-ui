import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  type FeatureFlagKey,
  readFlagValue,
} from '@/lib/feature-flags';

export type FlagDraft = Partial<Record<FeatureFlagKey, boolean | string>>;

const isKnown = (key: string): key is FeatureFlagKey => Object.hasOwn(FEATURE_FLAGS, key);

export function toFlagDraft(saved: Record<string, boolean | string>): FlagDraft {
  const draft: FlagDraft = {};
  for (const key of FEATURE_FLAG_KEYS) {
    const value = readFlagValue(FEATURE_FLAGS[key], saved[key]);
    if (value !== undefined) draft[key] = value;
  }
  return draft;
}

export function buildFlagOverrides(
  draft: FlagDraft,
  saved: Record<string, boolean | string>,
): Record<string, boolean | string> {
  const unknown = Object.fromEntries(Object.entries(saved).filter(([key]) => !isKnown(key)));
  const chosen = Object.fromEntries(
    Object.entries(draft).filter(
      (entry): entry is [string, boolean | string] => entry[1] !== undefined,
    ),
  );
  return { ...unknown, ...chosen };
}

function sameEntries(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => a[key] === b[key]);
}

export function isFlagsChanged(draft: FlagDraft, saved: Record<string, boolean | string>): boolean {
  return !sameEntries(buildFlagOverrides(draft, saved), saved);
}
