import type { ParseKeys } from 'i18next';
import { getAppConfiguration, useAppConfigurationStore } from '@/lib/app-configuration';
import { getDeploymentFlags } from '@/lib/runtime-config';

type FlagText = {
  labelKey: ParseKeys;
  descriptionKey: ParseKeys;
  usedByKey: ParseKeys;
};
type BooleanFlag = FlagText & { type: 'boolean'; default: boolean };
type EnumFlag<Option extends string = string> = FlagText & {
  type: 'enum';
  options: readonly Option[];
  optionKeys: Record<Option, ParseKeys>;
  default: Option;
};

function enumFlag<const Option extends string>(
  flag: Omit<EnumFlag<Option>, 'type' | 'default'> & { default: NoInfer<Option> },
): EnumFlag<Option> {
  return { type: 'enum', ...flag };
}

const QUANTITY_UNIT_KEYS = {
  PACKS: 'feature-flags.quantity-unit.packs',
  DOSES: 'feature-flags.quantity-unit.doses',
  BOTH: 'feature-flags.quantity-unit.both',
} as const;

export const FEATURE_FLAGS = {
  BATCH_APPROVE_SCREEN: {
    type: 'boolean',
    default: false,
    labelKey: 'feature-flags.batch-approve-screen.label',
    descriptionKey: 'feature-flags.batch-approve-screen.description',
    usedByKey: 'feature-flags.batch-approve-screen.used-by',
  },
  DEFAULT_QUANTITY_UNIT: enumFlag({
    options: ['PACKS', 'DOSES'],
    optionKeys: QUANTITY_UNIT_KEYS,
    default: 'DOSES',
    labelKey: 'feature-flags.default-quantity-unit.label',
    descriptionKey: 'feature-flags.default-quantity-unit.description',
    usedByKey: 'feature-flags.default-quantity-unit.used-by',
  }),
  GS1_SCANNING: {
    type: 'boolean',
    default: false,
    labelKey: 'feature-flags.gs1-scanning.label',
    descriptionKey: 'feature-flags.gs1-scanning.description',
    usedByKey: 'feature-flags.gs1-scanning.used-by',
  },
  QUANTITY_UNIT_OPTION: enumFlag({
    options: ['PACKS', 'DOSES', 'BOTH'],
    optionKeys: QUANTITY_UNIT_KEYS,
    default: 'BOTH',
    labelKey: 'feature-flags.quantity-unit-option.label',
    descriptionKey: 'feature-flags.quantity-unit-option.description',
    usedByKey: 'feature-flags.quantity-unit-option.used-by',
  }),
  SHOW_REQUISITION_LESS_ORDER: {
    type: 'boolean',
    default: true,
    labelKey: 'feature-flags.show-requisition-less-order.label',
    descriptionKey: 'feature-flags.show-requisition-less-order.description',
    usedByKey: 'feature-flags.show-requisition-less-order.used-by',
  },
} as const satisfies Record<string, BooleanFlag | EnumFlag>;

export type FeatureFlagDefinition = BooleanFlag | EnumFlag;

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

type FeatureFlagValue<K extends FeatureFlagKey> = (typeof FEATURE_FLAGS)[K] extends {
  options: readonly (infer Option)[];
}
  ? Option
  : boolean;

export type FeatureFlagSource = 'admin' | 'deployment' | 'default';

export function readFlagValue(
  definition: FeatureFlagDefinition,
  raw: unknown,
): string | boolean | undefined {
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
  const definition: FeatureFlagDefinition = FEATURE_FLAGS[key];

  const fromAdmin = readFlagValue(definition, admin[key]);
  if (fromAdmin !== undefined) return { value: fromAdmin as FeatureFlagValue<K>, source: 'admin' };

  const fromDeployment = readFlagValue(definition, deployment[key]);
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
