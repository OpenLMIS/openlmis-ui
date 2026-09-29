import { getAppConfiguration, useAppConfigurationStore } from '@/lib/app-configuration';
import { getDeploymentFlags } from '@/lib/runtime-config';

type BooleanFlag = { type: 'boolean'; default: boolean };
type EnumFlag = { type: 'enum'; options: readonly string[]; default: string };

export const FEATURE_FLAGS = {
  BATCH_APPROVE_SCREEN: { type: 'boolean', default: false },
  DEFAULT_QUANTITY_UNIT: { type: 'enum', options: ['PACKS', 'DOSES'], default: 'DOSES' },
  GS1_SCANNING: { type: 'boolean', default: false },
  QUANTITY_UNIT_OPTION: { type: 'enum', options: ['PACKS', 'DOSES', 'BOTH'], default: 'BOTH' },
  SHOW_REQUISITION_LESS_ORDER: { type: 'boolean', default: true },
} as const satisfies Record<string, BooleanFlag | EnumFlag>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export type FeatureFlagValue<K extends FeatureFlagKey> = (typeof FEATURE_FLAGS)[K] extends {
  options: readonly (infer Option)[];
}
  ? Option
  : boolean;

export type FeatureFlagSource = 'admin' | 'deployment' | 'default';

function readValue(definition: BooleanFlag | EnumFlag, raw: unknown): string | boolean | undefined {
  if (definition.type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
  }
  return typeof raw === 'string' && definition.options.includes(raw) ? raw : undefined;
}

export function resolveFlag<K extends FeatureFlagKey>(
  key: K,
  admin: Record<string, unknown>,
  deployment: Record<string, unknown>,
): { value: FeatureFlagValue<K>; source: FeatureFlagSource } {
  const definition: BooleanFlag | EnumFlag = FEATURE_FLAGS[key];

  const fromAdmin = readValue(definition, admin[key]);
  if (fromAdmin !== undefined) return { value: fromAdmin as FeatureFlagValue<K>, source: 'admin' };

  const fromDeployment = readValue(definition, deployment[key]);
  if (fromDeployment !== undefined) {
    return { value: fromDeployment as FeatureFlagValue<K>, source: 'deployment' };
  }

  return { value: definition.default as FeatureFlagValue<K>, source: 'default' };
}

export function getFlag<K extends FeatureFlagKey>(key: K): FeatureFlagValue<K> {
  return resolveFlag(key, getAppConfiguration().featureFlags, getDeploymentFlags()).value;
}

export function useFlag<K extends FeatureFlagKey>(key: K): FeatureFlagValue<K> {
  const admin = useAppConfigurationStore((state) => state.configuration.featureFlags);
  return resolveFlag(key, admin, getDeploymentFlags()).value;
}
