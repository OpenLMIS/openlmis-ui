import { createContext, useContext, useSyncExternalStore } from 'react';
import type { CurrencySettings } from '@/features/reference-data/lib/types';
import type { BatchDrafts } from '@/features/requisitions/hooks/use-batch-drafts';
import type { BatchReason } from '@/features/requisitions/lib/batch-reason';
import type { BatchRequisition, BatchRow } from '@/features/requisitions/lib/batch-types';
export type BatchContextValue = {
  records: readonly BatchRequisition[];
  rows: readonly BatchRow[];
  drafts: BatchDrafts;
  currency: CurrencySettings;
  disabled: boolean;
  reasons: ReadonlyMap<string, BatchReason>;
};
export const BatchContext = createContext<BatchContextValue | null>(null);
export function useBatch() {
  const value = useContext(BatchContext);
  if (!value) throw new Error('Missing batch context');
  return value;
}
export function useBatchVersion(key: string) {
  const { drafts } = useBatch();
  return useSyncExternalStore(
    (listener) => drafts.subscribe(key, listener),
    () => drafts.version(key),
  );
}
