import type { ParseKeys } from 'i18next';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Router types extend by interface merging.
  interface StaticDataRouteOption {
    crumbKey?: ParseKeys;
    crumbParentSearch?: (search: Record<string, unknown>) => Record<string, unknown>;
    rights?: readonly string[];
  }
}
